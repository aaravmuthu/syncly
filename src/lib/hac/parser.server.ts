// Server-only HTML parsing helpers for HAC pages.
import type { Assignment, AssignmentCategory, Course, TranscriptCourse } from "./types";

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function findAll(html: string, re: RegExp): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = r.exec(html)) !== null) out.push(m);
  return out;
}

function categorize(name: string): AssignmentCategory {
  const s = name.toLowerCase();
  if (/(progress check|pcl)/.test(s)) return "Progress Check";
  if (/(assessment of learning|assessment|summative|test|exam|project|major)/.test(s)) return "Summative";
  if (/(formative|homework|classwork|practice|daily|minor)/.test(s)) return "Formative";
  if (/(summative|test|exam|project|assess|major)/.test(s)) return "Summative";
  if (/(formative|quiz|hw|homework|classwork|practice|daily|minor)/.test(s)) return "Formative";
  return "Other";
}

function parseDate(s: string): string | null {
  // Accepts M/D/YYYY or M/D/YY
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const mo = m[1].padStart(2, "0");
  const d = m[2].padStart(2, "0");
  let y = m[3];
  if (y.length === 2) y = "20" + y;
  return `${y}-${mo}-${d}`;
}

function num(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = s.replace(/[^0-9.\-]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type ParsedGradeCell = {
  score: number | null;
  total: number | null;
  percent: number | null;
  hasFraction: boolean;
  hasPercent: boolean;
};

function parseGradeCell(raw: string | null | undefined): ParsedGradeCell {
  const text = (raw ?? "").trim();
  if (!text || parseDate(text)) {
    return { score: null, total: null, percent: null, hasFraction: false, hasPercent: false };
  }

  const normalized = text.replace(/,/g, "");
  const fraction = normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:\/|out of|of)\s*(-?\d+(?:\.\d+)?)/i);
  if (fraction) {
    const score = Number(fraction[1]);
    const total = Number(fraction[2]);
    return {
      score: Number.isFinite(score) ? score : null,
      total: Number.isFinite(total) ? total : null,
      percent: Number.isFinite(score) && Number.isFinite(total) && total !== 0 ? (score / total) * 100 : null,
      hasFraction: true,
      hasPercent: false,
    };
  }

  const percentMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const percent = Number(percentMatch[1]);
    return {
      score: null,
      total: null,
      percent: Number.isFinite(percent) ? percent : null,
      hasFraction: false,
      hasPercent: true,
    };
  }

  return {
    score: num(normalized),
    total: null,
    percent: null,
    hasFraction: false,
    hasPercent: false,
  };
}

function inferGradeFromRow(cells: string[], metaIdx: Set<number>) {
  const candidates = cells
    .map((cell, index) => ({ index, cell, parsed: parseGradeCell(cell) }))
    .filter(({ index, cell, parsed }) => {
      if (metaIdx.has(index)) return false;
      if (!cell.trim()) return false;
      if (/weight|weighted|multiplier|rubric|resource|teacher|comment|notes?/i.test(cell)) return false;
      if (parsed.score !== null && parsed.score > 1000) return false;
      return true;
    });

  const fraction = candidates.find(({ parsed }) => parsed.hasFraction);
  const percent = candidates.find(({ parsed, cell }) => parsed.hasPercent || /%/.test(cell));
  const numeric = candidates.find(
    ({ parsed, cell }) => parsed.score !== null && parsed.score > 1 && !/[a-z]{4,}/i.test(cell) && !/\d{1,2}\/\d{1,2}/.test(cell),
  );

  return {
    score: fraction?.parsed.score ?? numeric?.parsed.score ?? null,
    total: fraction?.parsed.total ?? null,
    percent: percent?.parsed.percent ?? fraction?.parsed.percent ?? null,
  };
}

/** Parse the Assignments.aspx Classwork page. */
export function parseClasses(html: string): Course[] {
  // Each class block lives inside a div with class containing "AssignmentClass".
  const blocks = html.split(/<div[^>]*class="[^"]*AssignmentClass[^"]*"/i).slice(1);
  const courses: Course[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const headerMatch = block.match(/sg-header-heading[^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/AssignmentClassName[^>]*>([\s\S]*?)<\/span>/i) ||
      block.match(/<span[^>]*>([^<]*(?:Marking Period|Period|Mrk Per)[^<]*)<\/span>/i);
    const titleRaw = headerMatch ? decode(headerMatch[1]) : `Course ${i + 1}`;
    // Title pattern often: "1101 - 1 ENG 1 GT - Smith, John"
    const parts = titleRaw.split(/\s+-\s+/);
    let period: string | null = null;
    let name = titleRaw;
    let teacher: string | null = null;
    if (parts.length >= 3) {
      period = parts[0];
      name = parts.slice(1, parts.length - 1).join(" - ");
      teacher = parts[parts.length - 1];
    } else if (parts.length === 2) {
      name = parts[0];
      teacher = parts[1];
    }

    const avgMatch =
      block.match(/sg-header-heading[^>]*sg-right[^>]*>([\s\S]*?)<\/span>/i) ||
      block.match(/Student Grade[^<]*<[^>]*>\s*([\d.]+)/i) ||
      block.match(/>\s*Average[^<]*<[^>]*>\s*([\d.]+)/i);
    const average = avgMatch ? num(decode(avgMatch[1])) : null;

    // Category averages table
    const catTableMatch = block.match(/CategoryAverages[\s\S]*?<\/table>/i) ||
      block.match(/Categories[\s\S]*?<\/table>/i);
    const categoryAverages: Course["categoryAverages"] = [];
    if (catTableMatch) {
      const rows = findAll(catTableMatch[0], /<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      for (const row of rows) {
        const cells = findAll(row[1], /<td[^>]*>([\s\S]*?)<\/td>/gi).map((c) => decode(c[1]));
        if (cells.length < 2) continue;
        const cat = cells[0];
        if (/category|total/i.test(cat) || !cat) continue;
        categoryAverages.push({
          category: categorize(cat),
          weight: num(cells[1]),
          average: num(cells[cells.length - 1]),
        });
      }
    }

    // Assignments table
    const assignments: Assignment[] = [];
    const assignTableMatch = block.match(/AssignmentsGridView[\s\S]*?<\/table>/i) ||
      block.match(/<table[^>]*class="[^"]*sg-asp-table[^"]*"[\s\S]*?<\/table>/i);
    if (assignTableMatch) {
      const rows = findAll(assignTableMatch[0], /<tr[^>]*>([\s\S]*?)<\/tr>/gi);

      // Locate the header row to map columns by label rather than fixed index,
      // since the HAC assignment grid layout varies by district/course.
      let idx = { due: -1, name: -1, cat: -1, score: -1, total: -1, pct: -1 };
      for (const r of rows) {
        const headers = findAll(r[1], /<th[^>]*>([\s\S]*?)<\/th>/gi).map((c) => decode(c[1]).toLowerCase());
        if (headers.length < 3) continue;
        const find = (...keys: string[]) =>
          headers.findIndex((h) => keys.some((k) => h.includes(k)));
        idx = {
          due: find("date due", "due date", "due"),
          name: find("assignment"),
          cat: find("category", "type"),
          // "Score" is the points earned; avoid matching "total".
          score: headers.findIndex((h) => h.includes("score") && !h.includes("total")),
          total: find("total points", "max", "possible", "total"),
          pct: headers.findIndex((h) => h.includes("percent") || h.trim() === "%"),
        };
        break;
      }

      for (const r of rows) {
        const cells = findAll(r[1], /<td[^>]*>([\s\S]*?)<\/td>/gi).map((c) => decode(c[1]));
        if (cells.length < 4) continue;

        // Fall back to positional indices if no header row was found.
        const dueCell = idx.due >= 0 ? cells[idx.due] : cells[0];
        const nameCell = idx.name >= 0 ? cells[idx.name] : cells[2] || cells[1];
        const catCell = idx.cat >= 0 ? cells[idx.cat] : cells[3] || "";
        const scoreCell = idx.score >= 0 ? cells[idx.score] : cells[4];
        const totalCell = idx.total >= 0 ? cells[idx.total] : cells[5];
        const pctCell = idx.pct >= 0 ? cells[idx.pct] : cells[6];

        const due = parseDate(dueCell || "");
        if (!due && !/\d+\/\d+/.test(dueCell || "")) continue;
        const aname = nameCell;
        if (!aname || (/^assignment$/i.test(aname.trim()))) continue;

        const score = num(scoreCell);
        const total = num(totalCell);
        const pctParsed = num(pctCell);
        const pct =
          pctParsed !== null
            ? pctParsed
            : score !== null && total
              ? (score / total) * 100
              : null;
        const rowText = cells.join(" ");
        const missing = /\bM\b|Missing/i.test(rowText);
        const absent = /\bABS\b|Absent/i.test(rowText);
        assignments.push({
          name: aname,
          category: categorize(catCell || aname),
          dueDate: due,
          score,
          totalPoints: total,
          percent: pct,
          missing,
          absent,
        });
      }
    }

    courses.push({
      id: `c-${i}`,
      name: name || titleRaw,
      code: null,
      teacher,
      period,
      average,
      assignments,
      categoryAverages,
    });
  }

  return courses;
}

/** Parse transcript table (rows of historical courses). */
export function parseTranscript(html: string): TranscriptCourse[] {
  const out: TranscriptCourse[] = [];
  const tables = findAll(html, /<table[^>]*Transcript[\s\S]*?<\/table>/gi);
  const blob = tables.map((t) => t[0]).join("\n") || html;
  const rows = findAll(blob, /<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const r of rows) {
    const cells = findAll(r[1], /<td[^>]*>([\s\S]*?)<\/td>/gi).map((c) => decode(c[1]));
    if (cells.length < 4) continue;
    if (/course|description|year/i.test(cells[0])) continue;
    out.push({
      year: cells[0] || "",
      grade: cells[1] || "",
      course: cells[2] || cells[3] || "",
      sem1: cells[3] || null,
      sem2: cells[4] || null,
      credits: cells[5] || null,
    });
  }
  return out;
}

/** Extract student name + school from any HAC page (header). */
export function parseStudent(html: string): { name: string; grade: string | null; school: string | null } {
  const nameMatch =
    html.match(/id="[^"]*StudentName[^"]*"[^>]*>([\s\S]*?)</i) ||
    html.match(/class="[^"]*sg-banner-text[^"]*"[^>]*>([\s\S]*?)</i) ||
    html.match(/Welcome,?\s*([^<]+)</i);
  const schoolMatch = html.match(/id="[^"]*SchoolName[^"]*"[^>]*>([\s\S]*?)</i);
  const gradeMatch = html.match(/Grade[^:]*:\s*([0-9]+)/i);
  return {
    name: nameMatch ? decode(nameMatch[1]) : "Student",
    grade: gradeMatch ? gradeMatch[1] : null,
    school: schoolMatch ? decode(schoolMatch[1]) : null,
  };
}

/** Extract a hidden input value from an HTML form. */
export function pickHidden(html: string, name: string): string | null {
  const re = new RegExp(
    `<input[^>]*name=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*value=["']([^"']*)["']`,
    "i",
  );
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(
    `<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}