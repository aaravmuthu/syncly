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
      for (const r of rows) {
        const cells = findAll(r[1], /<td[^>]*>([\s\S]*?)<\/td>/gi).map((c) => decode(c[1]));
        if (cells.length < 4) continue;
        const due = parseDate(cells[0]);
        if (!due && !/\d+\/\d+/.test(cells[0])) continue;
        const aname = cells[2] || cells[1];
        if (!aname || /assignment/i.test(aname) && cells.length < 5) continue;
        const cat = cells[3] || "";
        const score = num(cells[4]);
        const total = num(cells[5]);
        const pct = num(cells[6]) ?? (score !== null && total ? (score / total) * 100 : null);
        const missing = /\bM\b|Missing/i.test(cells.join(" "));
        const absent = /\bABS\b|Absent/i.test(cells.join(" "));
        assignments.push({
          name: aname,
          category: categorize(cat || aname),
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