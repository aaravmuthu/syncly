// Server-only HTML parsing helpers for HAC pages.
import type { Assignment, AssignmentCategory, CalendarActivity, Course, ReportCardTerm, TranscriptCourse } from "./types";

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
    ({ parsed, cell }) => parsed.score !== null && parsed.score > 5 && !/[a-z]{4,}/i.test(cell) && !/\d{1,2}\/\d{1,2}/.test(cell),
  );

  return {
    score: fraction?.parsed.score ?? numeric?.parsed.score ?? null,
    total: fraction?.parsed.total ?? null,
    percent: percent?.parsed.percent ?? fraction?.parsed.percent ?? null,
  };
}

function isLikelyWeightOrMultiplierCell(raw: string | null | undefined): boolean {
  const text = (raw ?? "").trim();
  if (!text) return false;
  if (/%|\/|out of|of/i.test(text)) return false;
  if (/weight|weighted|multiplier/i.test(text)) return true;
  const value = num(text);
  if (value === null) return false;
  return value >= 0 && value <= 5 && /^-?\d+(?:\.\d{1,2})?$/.test(text);
}

function parseCourseLabel(raw: string, fallback: string): { name: string; period: string | null; teacher: string | null } {
  const titleRaw = decode(raw) || fallback;
  const parts = titleRaw.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
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

  return { name: name || titleRaw, period, teacher };
}

function courseId(name: string, period: string | null, index = 0): string {
  const key = normalizeName(`${period ?? ""} ${name}`);
  return `c-${key || index}`;
}

function latestTermAverage(term: ReportCardTerm): number | null {
  return term.mp4 ?? term.mp3 ?? term.mp2 ?? term.mp1 ?? term.semester ?? term.exam ?? null;
}

function extractReportCardEntries(html: string): { name: string; term: ReportCardTerm }[] {
  const out: { name: string; term: ReportCardTerm }[] = [];
  const tables = findAll(html, /<table[^>]*>[\s\S]*?<\/table>/gi)
    .map((t) => t[0])
    .filter((t) => /report\s*card|sg-asp-table|MarkingPeriod|Course/i.test(t));
  const blob = tables.join("\n") || html;

  const rows = findAll(blob, /<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows.length) return out;

  const colIdx = { name: -1, mp1: -1, mp2: -1, mp3: -1, mp4: -1, exam: -1, sem: -1 };
  for (const r of rows) {
    const ths = findAll(r[1], /<th[^>]*>([\s\S]*?)<\/th>/gi).map((c) => decode(c[1]).toLowerCase());
    if (ths.length < 2) continue;
    ths.forEach((h, i) => {
      if (colIdx.name < 0 && /(course|description|class)/.test(h)) colIdx.name = i;
      if (/(^|[^0-9])(1st|q1|mp1|first|nine.*1|six.*1|\b1\b)/.test(h) && colIdx.mp1 < 0) colIdx.mp1 = i;
      if (/(^|[^0-9])(2nd|q2|mp2|second|nine.*2|six.*2|\b2\b)/.test(h) && colIdx.mp2 < 0) colIdx.mp2 = i;
      if (/(^|[^0-9])(3rd|q3|mp3|third|nine.*3|six.*3|\b3\b)/.test(h) && colIdx.mp3 < 0) colIdx.mp3 = i;
      if (/(^|[^0-9])(4th|q4|mp4|fourth|nine.*4|six.*4|\b4\b)/.test(h) && colIdx.mp4 < 0) colIdx.mp4 = i;
      if (/exam|final/.test(h) && colIdx.exam < 0) colIdx.exam = i;
      if (/(sem|average|avg)/.test(h) && colIdx.sem < 0) colIdx.sem = i;
    });
    if (colIdx.mp1 >= 0 || colIdx.mp2 >= 0 || colIdx.mp3 >= 0 || colIdx.mp4 >= 0) break;
  }

  for (const r of rows) {
    const cells = findAll(r[1], /<td[^>]*>([\s\S]*?)<\/td>/gi).map((c) => decode(c[1]));
    if (cells.length < 2 || cells.every((c) => !c)) continue;

    let name = colIdx.name >= 0 ? cells[colIdx.name] : "";
    if (!name) name = cells.find((c) => c && !/^\s*[\d.]+\s*$/.test(c) && c.length > 3) || "";
    if (!name || /^(course|description|class)$/i.test(name.trim())) continue;

    let term: ReportCardTerm;
    if (colIdx.mp1 >= 0 || colIdx.mp2 >= 0 || colIdx.mp3 >= 0 || colIdx.mp4 >= 0) {
      term = {
        mp1: colIdx.mp1 >= 0 ? num(cells[colIdx.mp1]) : null,
        mp2: colIdx.mp2 >= 0 ? num(cells[colIdx.mp2]) : null,
        mp3: colIdx.mp3 >= 0 ? num(cells[colIdx.mp3]) : null,
        mp4: colIdx.mp4 >= 0 ? num(cells[colIdx.mp4]) : null,
        exam: colIdx.exam >= 0 ? num(cells[colIdx.exam]) : null,
        semester: colIdx.sem >= 0 ? num(cells[colIdx.sem]) : null,
      };
    } else {
      const grades = cells
        .map((c) => num(c))
        .filter((n): n is number => n !== null && n >= 40 && n <= 100);
      if (!grades.length) continue;
      term = {
        mp1: grades[0] ?? null,
        mp2: grades[1] ?? null,
        mp3: grades[2] ?? null,
        mp4: grades[3] ?? null,
        exam: grades[4] ?? null,
        semester: grades[5] ?? null,
      };
    }

    if (term.mp1 === null && term.mp2 === null && term.mp3 === null && term.mp4 === null) continue;
    out.push({ name, term });
  }

  return out;
}

function parseAssignmentRows(tableHtml: string, courseNameIndex: number): Map<string, Course> {
  const courseMap = new Map<string, Course>();
  const rows = findAll(tableHtml, /<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows.length) return courseMap;

  let idx = { course: courseNameIndex, due: -1, name: -1, cat: -1, score: -1, total: -1, pct: -1, avg: -1 };
  for (const r of rows) {
    const headers = findAll(r[1], /<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi).map((c) => decode(c[1]).toLowerCase());
    if (headers.length < 3) continue;
    const find = (...keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
    idx = {
      course: courseNameIndex >= 0 ? courseNameIndex : headers.findIndex((h) => /course|class|subject/.test(h) && !/assignment|description/.test(h)),
      due: find("date due", "due date", "due"),
      name: headers.findIndex((h) => /assignment|description/.test(h)),
      cat: find("category", "type"),
      score: headers.findIndex((h) => /score|points earned|earned|grade/.test(h) && !/total|possible|percent|average/.test(h)),
      total: find("total points", "points possible", "possible", "max", "total"),
      pct: headers.findIndex((h) => h.includes("percent") || h.includes("average") || h.trim() === "%"),
      avg: headers.findIndex((h) => /average|current grade|student grade/.test(h)),
    };
    break;
  }

  for (const r of rows) {
    const cells = findAll(r[1], /<td[^>]*>([\s\S]*?)<\/td>/gi).map((c) => decode(c[1]));
    if (cells.length < 3) continue;

    const rawCourseName = idx.course >= 0 ? cells[idx.course] : null;
    const courseName = rawCourseName?.trim();
    const dueCell = idx.due >= 0 ? cells[idx.due] : cells[0];
    const nameCell = idx.name >= 0 ? cells[idx.name] : cells[1];
    const catCell = idx.cat >= 0 ? cells[idx.cat] : "";
    const scoreCell = idx.score >= 0 ? cells[idx.score] : cells[4];
    const totalCell = idx.total >= 0 ? cells[idx.total] : cells[5];
    const pctCell = idx.pct >= 0 ? cells[idx.pct] : cells[6];
    const average = idx.avg >= 0 ? num(cells[idx.avg]) : null;

    if (!courseName || /^course|class|subject$/i.test(courseName)) continue;
    const due = parseDate(dueCell || "");
    if (!due && !/\d+\/\d+/.test(dueCell || "")) continue;
    const aname = nameCell?.trim();
    if (!aname || /^assignment|description$/i.test(aname)) continue;

    const metaIdx = new Set([idx.course, idx.due, idx.name, idx.cat].filter((v) => v >= 0));
    const parsedScore = parseGradeCell(scoreCell);
    const parsedTotal = parseGradeCell(totalCell);
    const parsedPct = parseGradeCell(pctCell);
    const inferred = inferGradeFromRow(cells, metaIdx);

    const explicitScoreLooksWrong =
      !parsedScore.hasFraction &&
      !parsedScore.hasPercent &&
      parsedScore.score !== null &&
      isLikelyWeightOrMultiplierCell(scoreCell) &&
      (inferred.percent !== null || inferred.score !== null);
    const explicitTotalLooksWrong =
      !parsedTotal.hasFraction &&
      !parsedTotal.hasPercent &&
      parsedTotal.score !== null &&
      isLikelyWeightOrMultiplierCell(totalCell) &&
      inferred.total !== null;

    const score =
      parsedScore.hasFraction || (parsedScore.score !== null && !explicitScoreLooksWrong)
        ? parsedScore.score
        : inferred.score;
    const total =
      parsedScore.hasFraction
        ? parsedScore.total
        : explicitTotalLooksWrong
          ? inferred.total
          : parsedTotal.score ?? parsedTotal.total ?? inferred.total;
    const pctParsed =
      parsedPct.percent ??
      (parsedScore.hasPercent && !explicitScoreLooksWrong ? parsedScore.percent : null) ??
      inferred.percent;
    const percent = pctParsed !== null ? pctParsed : score !== null && total ? (score / total) * 100 : null;

    const key = normalizeName(courseName);
    const existing = courseMap.get(key) ?? {
      id: courseId(courseName, null, courseMap.size),
      name: courseName,
      code: null,
      teacher: null,
      period: null,
      average,
      assignments: [],
      categoryAverages: [],
    };
    if (existing.average === null && average !== null) existing.average = average;

    const rowText = cells.join(" ");
    existing.assignments.push({
      name: aname,
      category: categorize(catCell || aname),
      dueDate: due,
      score,
      totalPoints: total,
      percent,
      missing: /\bM\b|Missing/i.test(rowText),
      absent: /\bABS\b|Absent/i.test(rowText),
    });
    courseMap.set(key, existing);
  }

  return courseMap;
}

function parseFallbackClasswork(html: string): Course[] {
  const merged = new Map<string, Course>();
  const tables = findAll(html, /<table[^>]*>[\s\S]*?<\/table>/gi).map((t) => t[0]);

  for (const table of tables) {
    const firstRow = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i)?.[1] ?? "";
    const headers = findAll(firstRow, /<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi).map((c) => decode(c[1]).toLowerCase());
    if (headers.length < 3) continue;

    const looksLikeAssignments = headers.some((h) => /assignment|description/.test(h)) && headers.some((h) => /due|date/.test(h));
    if (!looksLikeAssignments) continue;

    const courseCol = headers.findIndex((h) => /course|class|subject/.test(h) && !/assignment|description/.test(h));
    const parsed = parseAssignmentRows(table, courseCol);
    for (const [key, course] of parsed) {
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, course);
        continue;
      }
      if (existing.average === null && course.average !== null) existing.average = course.average;
      existing.assignments.push(...course.assignments);
    }
  }

  return Array.from(merged.values());
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
    const { name, period, teacher } = parseCourseLabel(headerMatch?.[1] ?? "", `Course ${i + 1}`);

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
    // A course block can contain several tables (Category Averages summary +
    // the actual assignments grid). Pick the table whose header row mentions
    // "Date Due"/"Assignment" so we never mistake the categories table for it.
    const allTables = findAll(block, /<table[^>]*>[\s\S]*?<\/table>/gi).map((t) => t[0]);
    const assignTable =
      allTables.find((t) => /dgCourseAssignments|AssignmentsGridView/i.test(t)) ||
      allTables.find((t) => /<th/i.test(t) && /date\s*due|assignment/i.test(t)) ||
      allTables.find((t) => /date\s*due/i.test(t));
    const assignTableMatch = assignTable ? [assignTable] : null;
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
          score: headers.findIndex((h) => /score|points earned|earned|grade/.test(h) && !/total|possible|percent|average/.test(h)),
          total: find("total points", "points possible", "possible", "max", "total"),
          pct: headers.findIndex((h) => h.includes("percent") || h.includes("average") || h.trim() === "%"),
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

        const metaIdx = new Set([idx.due, idx.name, idx.cat].filter((v) => v >= 0));
        const parsedScore = parseGradeCell(scoreCell);
        const parsedTotal = parseGradeCell(totalCell);
        const parsedPct = parseGradeCell(pctCell);
        const inferred = inferGradeFromRow(cells, metaIdx);

        const explicitScoreLooksWrong =
          !parsedScore.hasFraction &&
          !parsedScore.hasPercent &&
          parsedScore.score !== null &&
          isLikelyWeightOrMultiplierCell(scoreCell) &&
          (inferred.percent !== null || inferred.score !== null);
        const explicitTotalLooksWrong =
          !parsedTotal.hasFraction &&
          !parsedTotal.hasPercent &&
          parsedTotal.score !== null &&
          isLikelyWeightOrMultiplierCell(totalCell) &&
          inferred.total !== null;

        const score =
          parsedScore.hasFraction || (parsedScore.score !== null && !explicitScoreLooksWrong)
            ? parsedScore.score
            : inferred.score;
        const total =
          parsedScore.hasFraction
            ? parsedScore.total
            : explicitTotalLooksWrong
              ? inferred.total
              : parsedTotal.score ?? parsedTotal.total ?? inferred.total;
        const pctParsed =
          parsedPct.percent ??
          (parsedScore.hasPercent && !explicitScoreLooksWrong ? parsedScore.percent : null) ??
          inferred.percent;
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
      id: courseId(name || `Course ${i + 1}`, period, i),
      name: name || `Course ${i + 1}`,
      code: null,
      teacher,
      period,
      average,
      assignments,
      categoryAverages,
    });
  }

  return courses.length ? courses : parseFallbackClasswork(html);
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

/**
 * Extract the official GPA + class rank from the HAC transcript page.
 * HAC renders these in a summary table/labels at the bottom of the transcript,
 * e.g. "Weighted GPA: 5.1234", "Un-weighted GPA: 3.8900", "Rank: 42 / 510".
 */
export function parseTranscriptGpa(html: string): {
  weighted: number | null;
  unweighted: number | null;
  rank: number | null;
  classSize: number | null;
} {
  const text = decode(html);
  const grab = (re: RegExp): number | null => {
    const m = text.match(re);
    return m ? num(m[1]) : null;
  };

  const weighted = grab(/weighted\s*gpa[^0-9]*([0-9]+(?:\.[0-9]+)?)/i);
  const unweighted =
    grab(/un\s*-?\s*weighted\s*gpa[^0-9]*([0-9]+(?:\.[0-9]+)?)/i) ??
    grab(/simple\s*gpa[^0-9]*([0-9]+(?:\.[0-9]+)?)/i);

  // Rank shows as "Rank: 42 / 510" or "Rank 42 of 510".
  let rank: number | null = null;
  let classSize: number | null = null;
  const rankMatch = text.match(/rank[^0-9]*([0-9]+)\s*(?:\/|of|out of)\s*([0-9]+)/i);
  if (rankMatch) {
    rank = num(rankMatch[1]);
    classSize = num(rankMatch[2]);
  }

  return { weighted, unweighted, rank, classSize };
}

/**
 * Parse the Report Card page into per-course 4-quarter matrices.
 * Returns a map keyed by a normalized course name.
 * Handles Frisco's `sg-asp-table` report-card grid where each row is a course
 * and grade columns correspond to marking periods (Q1–Q4 + exam/semester).
 */
export function parseReportCard(html: string): Map<string, ReportCardTerm> {
  const out = new Map<string, ReportCardTerm>();

  // Isolate the report card table(s).
  const tables = findAll(html, /<table[^>]*>[\s\S]*?<\/table>/gi)
    .map((t) => t[0])
    .filter((t) => /report\s*card|sg-asp-table|MarkingPeriod|Course/i.test(t));
  const blob = tables.join("\n") || html;

  const rows = findAll(blob, /<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows.length) return out;

  // Locate header row + column indices for each marking period.
  const colIdx = { name: -1, mp1: -1, mp2: -1, mp3: -1, mp4: -1, exam: -1, sem: -1 };
  for (const r of rows) {
    const ths = findAll(r[1], /<th[^>]*>([\s\S]*?)<\/th>/gi).map((c) => decode(c[1]).toLowerCase());
    if (ths.length < 2) continue;
    ths.forEach((h, i) => {
      if (colIdx.name < 0 && /(course|description|class)/.test(h)) colIdx.name = i;
      if (/(^|[^0-9])(1st|q1|mp1|first|nine.*1|six.*1|\b1\b)/.test(h) && colIdx.mp1 < 0) colIdx.mp1 = i;
      if (/(^|[^0-9])(2nd|q2|mp2|second|nine.*2|six.*2|\b2\b)/.test(h) && colIdx.mp2 < 0) colIdx.mp2 = i;
      if (/(^|[^0-9])(3rd|q3|mp3|third|nine.*3|six.*3|\b3\b)/.test(h) && colIdx.mp3 < 0) colIdx.mp3 = i;
      if (/(^|[^0-9])(4th|q4|mp4|fourth|nine.*4|six.*4|\b4\b)/.test(h) && colIdx.mp4 < 0) colIdx.mp4 = i;
      if (/exam|final/.test(h) && colIdx.exam < 0) colIdx.exam = i;
      if (/(sem|average|avg)/.test(h) && colIdx.sem < 0) colIdx.sem = i;
    });
    if (colIdx.mp1 >= 0 || colIdx.mp2 >= 0) break;
  }

  for (const r of rows) {
    const cells = findAll(r[1], /<td[^>]*>([\s\S]*?)<\/td>/gi).map((c) => decode(c[1]));
    if (cells.length < 2) continue;
    if (cells.every((c) => !c)) continue;

    // Course name: header-mapped column, else first text-bearing non-numeric cell.
    let name = colIdx.name >= 0 ? cells[colIdx.name] : "";
    if (!name) name = cells.find((c) => c && !/^\s*[\d.]+\s*$/.test(c) && c.length > 3) || "";
    if (!name || /^(course|description|class)$/i.test(name.trim())) continue;

    let term: ReportCardTerm;
    if (colIdx.mp1 >= 0 || colIdx.mp2 >= 0 || colIdx.mp3 >= 0 || colIdx.mp4 >= 0) {
      term = {
        mp1: colIdx.mp1 >= 0 ? num(cells[colIdx.mp1]) : null,
        mp2: colIdx.mp2 >= 0 ? num(cells[colIdx.mp2]) : null,
        mp3: colIdx.mp3 >= 0 ? num(cells[colIdx.mp3]) : null,
        mp4: colIdx.mp4 >= 0 ? num(cells[colIdx.mp4]) : null,
        exam: colIdx.exam >= 0 ? num(cells[colIdx.exam]) : null,
        semester: colIdx.sem >= 0 ? num(cells[colIdx.sem]) : null,
      };
    } else {
      // No usable header: take numeric grade-like cells (1–100) in order.
      const grades = cells
        .map((c) => num(c))
        .filter((n): n is number => n !== null && n >= 40 && n <= 100);
      if (grades.length < 1) continue;
      term = {
        mp1: grades[0] ?? null,
        mp2: grades[1] ?? null,
        mp3: grades[2] ?? null,
        mp4: grades[3] ?? null,
        exam: grades[4] ?? null,
        semester: grades[5] ?? null,
      };
    }

    if (term.mp1 === null && term.mp2 === null && term.mp3 === null && term.mp4 === null) continue;
    out.set(normalizeName(name), term);
  }

  return out;
}

/** Normalize a course name for cross-page matching (lowercase, strip codes/punctuation). */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/^\d+\s+/g, " ")
    .replace(/^[a-z]{2,}\d+[a-z0-9-]*\s+/g, " ")
    .replace(/\b(?:s(?:em)?\s*[12]|semester\s*[12]|mp\s*[1-4]|marking\s+period\s*[1-4])\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

/**
 * Parse the HAC Home/Calendar page into a flat list of activities.
 * HAC renders its calendar with FullCalendar, which embeds events either as a
 * JSON array in a script (`events: [...]`) or as `fc-event` anchor/div elements
 * inside dated day cells. This handles both shapes.
 */
export function parseCalendar(html: string): CalendarActivity[] {
  const out: CalendarActivity[] = [];
  const seen = new Set<string>();

  const push = (date: string | null, title: string, kind: string | null, course: string | null) => {
    if (!date || !title) return;
    const t = decode(title);
    if (!t) return;
    const key = `${date}::${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ date, title: t, course: course ? decode(course) : null, kind: kind ? decode(kind) : null });
  };

  // 1) JSON event objects embedded in scripts: {"title":"...","start":"2026-01-12",...}
  const objs = findAll(html, /\{[^{}]*?"(?:title|Title)"\s*:\s*"[^"]*"[^{}]*?\}/g);
  for (const o of objs) {
    const blob = o[0];
    const title = blob.match(/"(?:title|Title)"\s*:\s*"([^"]*)"/)?.[1];
    const rawDate = blob.match(/"(?:start|Start|date|Date|EventDate)"\s*:\s*"([^"]*)"/)?.[1];
    if (!title || !rawDate) continue;
    const iso = rawDate.match(/^\d{4}-\d{2}-\d{2}/) ? rawDate.slice(0, 10) : parseDate(rawDate);
    const kind = blob.match(/"(?:type|Type|category|Category|className)"\s*:\s*"([^"]*)"/)?.[1] ?? null;
    push(iso, title, kind, null);
  }

  // 2) FullCalendar day cells: <td data-date="2026-01-12">…<a class="fc-event">Title</a>…
  const cells = findAll(html, /data-date=["'](\d{4}-\d{2}-\d{2})["']([\s\S]*?)(?=data-date=|<\/tbody>|<\/table>)/gi);
  for (const c of cells) {
    const date = c[1];
    const events = findAll(c[2], /<(?:a|div|span)[^>]*class=["'][^"']*fc-event[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/gi);
    for (const e of events) {
      const title = decode(e[1]);
      if (title) push(date, title, null, null);
    }
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
