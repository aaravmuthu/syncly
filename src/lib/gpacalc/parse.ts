import type { GpaCourse, TierId } from "./types";
import { toNumericGrade } from "./engine";

/* Difficulty detection ------------------------------------------------ */

const TIER_PATTERNS: { tier: TierId; re: RegExp }[] = [
  { tier: "dual", re: /\b(dual\s*cr(edit)?|dc|college\s*credit|concurrent)\b/i },
  { tier: "ap", re: /\b(ap|a\.p\.|advanced\s*placement|ib|i\.b\.|international\s*bacc\w*)\b/i },
  {
    tier: "honors",
    re: /\b(honors?|hon|h\b|pre[-\s]?ap|pap|gt|advanced|accel(erated)?|adv)\b/i,
  },
];

export function detectTier(courseName: string): TierId {
  for (const { tier, re } of TIER_PATTERNS) {
    if (re.test(courseName)) return tier;
  }
  return "regular";
}

const EXEMPT_RE =
  /\b(pe\b|physical\s*ed|athletics?|aide|office\s*aide|pass\/?fail|p\/f|advisory|homeroom|lunch|study\s*hall)\b/i;

/* Credit + grade cell helpers ---------------------------------------- */

const CREDIT_RE = /^(0?\.\d{1,2}|[0-4](\.\d{1,2})?)$/;
const GRADE_CELL_RE = /^(\d{1,3}(\.\d+)?|[A-DF][+-]?)$/i;

function isGradeCell(tok: string): boolean {
  if (!GRADE_CELL_RE.test(tok)) return false;
  const n = Number(tok);
  if (Number.isFinite(n)) return n >= 0 && n <= 100;
  return true;
}

/* Parser -------------------------------------------------------------- */

export interface ParseResult {
  courses: GpaCourse[];
  skipped: number;
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `gc_${Date.now().toString(36)}_${seq}`;
}

const YEAR_RE = /(20\d{2})\s*[-–—/]\s*(20\d{2}|\d{2})\b/;
const GRADE_LEVEL_RE = /\bgrade\s*(?:level)?\s*:?\s*(\d{1,2})\b/i;
const GRADE_ORDINAL_RE = /\b(9|10|11|12)\s*th\s*grade\b/i;

/**
 * Parses text pasted from HAC's Transcript or Grades views.
 * Handles tab-separated, multi-space, and pipe-separated rows, and tracks
 * "2023-2024 Grade: 9" style group headers to stamp year / grade level.
 */
export function parseHacPaste(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let curYear = "";
  let curLevel: number | null = null;
  const courses: GpaCourse[] = [];
  let skipped = 0;

  for (const line of lines) {
    // Group header: year and/or grade level, no course grades on the line.
    const ym = line.match(YEAR_RE);
    const gm = line.match(GRADE_LEVEL_RE) ?? line.match(GRADE_ORDINAL_RE);
    const cells = splitCells(line);
    const gradeCells = cells.filter(isGradeCell);

    if ((ym || gm) && gradeCells.length <= 1) {
      if (ym) {
        const end = ym[2].length === 2 ? `20${ym[2]}` : ym[2];
        curYear = `${ym[1]}-${end}`;
      }
      if (gm) {
        const lvl = Number(gm[1]);
        curLevel = lvl >= 9 && lvl <= 12 ? lvl : null;
      }
      continue;
    }

    if (/^(course|description|total|credits?|gpa|rank|semester|building|year)\b/i.test(line) && gradeCells.length === 0) {
      continue;
    }

    const parsed = parseCourseLine(cells, curYear, curLevel);
    if (parsed) courses.push(parsed);
    else if (cells.length > 1) skipped += 1;
  }

  return { courses, skipped };
}

function splitCells(line: string): string[] {
  const parts = line.includes("\t")
    ? line.split("\t")
    : line.includes("|")
      ? line.split("|")
      : line.split(/\s{2,}/);
  const cells = parts.map((p) => p.trim()).filter(Boolean);
  if (cells.length > 1) return cells;
  // Single-space fallback: peel trailing numeric/letter tokens off the name.
  return peelTokens(line);
}

function peelTokens(line: string): string[] {
  const tokens = line.split(/\s+/);
  const tail: string[] = [];
  while (tokens.length > 1) {
    const t = tokens[tokens.length - 1];
    if (isGradeCell(t) || CREDIT_RE.test(t)) {
      tail.unshift(tokens.pop()!);
    } else break;
  }
  if (!tail.length) return [line];
  return [tokens.join(" "), ...tail];
}

function parseCourseLine(cells: string[], year: string, level: number | null): GpaCourse | null {
  if (cells.length < 2) return null;

  // Name = longest alphabetic cell that isn't a grade/credit token.
  const nameCandidates = cells.filter(
    (c) => /[a-z]{3}/i.test(c) && !isGradeCell(c) && !/^\d/.test(c) && !/^(y|n)$/i.test(c),
  );
  if (!nameCandidates.length) return null;
  const name = nameCandidates.sort((a, b) => b.length - a.length)[0];
  const nameIdx = cells.indexOf(name);

  const after = cells.slice(nameIdx + 1);
  const numericTail = after.filter((c) => isGradeCell(c) || CREDIT_RE.test(c));
  if (!numericTail.length) return null;

  // Trailing token that looks like a credit (<= 4 with a decimal) is the credit.
  let credits = 1;
  let gradeTokens = [...numericTail];
  for (let i = gradeTokens.length - 1; i >= 0; i--) {
    const t = gradeTokens[i];
    const n = Number(t);
    if (Number.isFinite(n) && n <= 4 && /\./.test(t)) {
      credits = n;
      gradeTokens.splice(i, 1);
      break;
    }
  }

  const grades = gradeTokens.filter((t) => toNumericGrade(t) !== null);
  if (!grades.length) return null;

  let sem1 = "";
  let sem2 = "";
  let final = "";
  if (grades.length === 1) {
    final = grades[0];
  } else if (grades.length === 2) {
    [sem1, sem2] = grades;
  } else {
    sem1 = grades[0];
    sem2 = grades[1];
    final = grades[2];
  }

  return {
    id: nextId(),
    name,
    year,
    gradeLevel: level,
    tier: detectTier(name),
    sem1,
    sem2,
    final,
    credits,
    exempt: EXEMPT_RE.test(name),
  };
}

export function blankCourse(year: string, level: number | null): GpaCourse {
  return {
    id: nextId(),
    name: "",
    year,
    gradeLevel: level,
    tier: "regular",
    sem1: "",
    sem2: "",
    final: "",
    credits: 1,
    exempt: false,
  };
}
