import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DistrictId, HacData } from "./types";

const Input = z.object({
  district: z.enum(["frisco", "prosper"]),
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

const BASES: Record<DistrictId, string> = {
  frisco: "https://hac.friscoisd.org",
  prosper: "https://hac.prosperisd.org",
};

const PAGE_CANDIDATES = {
  classwork: [
    "/HomeAccess/Content/Student/Assignments.aspx",
    "/HomeAccess/Classes/Classwork",
  ],
  transcript: [
    "/HomeAccess/Content/Student/Transcript.aspx",
    "/HomeAccess/Grades/Transcript",
  ],
  reportCard: [
    "/HomeAccess/Content/Student/ReportCards.aspx",
    "/HomeAccess/Grades/ReportCard",
  ],
  calendar: [
    "/HomeAccess/Home/WeekView",
    "/HomeAccess/Home/Calendar",
  ],
} as const;

function looksLikeLoginPage(html: string): boolean {
  return /forgot my user name or password|register for hac|verificationoption|logondetails\.username|sign in/i.test(html);
}

function looksLikeClassworkPage(html: string): boolean {
  return /assignmentclass|date due|full view|quick view|print classwork|classwork/i.test(html);
}

function looksLikeTranscriptPage(html: string): boolean {
  return /sg-transcript-group|transcript|gpa|class rank|credits/i.test(html);
}

function looksLikeReportCardPage(html: string): boolean {
  return /report cards?|report card run|sg-asp-table|marking period|comments/i.test(html);
}

async function fetchBestPage(
  base: string,
  jar: Record<string, string>,
  ua: string,
  candidates: readonly string[],
  isMatch: (html: string) => boolean,
): Promise<string> {
  let fallbackHtml = "";

  for (const path of candidates) {
    const response = await fetch(`${base}${path}`, {
      headers: { "User-Agent": ua, Cookie: cookieHeader(jar), Accept: "text/html" },
    });

    const html = await response.text();
    if (!response.ok) continue;
    if (looksLikeLoginPage(html)) {
      fallbackHtml = html;
      continue;
    }
    if (isMatch(html)) return html;
    if (!fallbackHtml) fallbackHtml = html;
  }

  return fallbackHtml;
}

function parseSetCookie(headers: Headers): Record<string, string> {
  const jar: Record<string, string> = {};
  // Cloudflare Workers' Headers exposes getSetCookie()
  const raw: string[] = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const list = raw.length ? raw : [headers.get("set-cookie") ?? ""].filter(Boolean);
  for (const c of list) {
    const first = c.split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0) jar[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
  }
  return jar;
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function mergeCookies(jar: Record<string, string>, headers: Headers) {
  const next = parseSetCookie(headers);
  return { ...jar, ...next };
}

export const syncHac = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<HacData> => {
    const { parseClasses, parseTranscript, parseTranscriptGpa, parseReportCard, extractReportCardEntries, parseCalendar, parseStudent, pickHidden, normalizeName } = await import("./parser.server");
    const base = BASES[data.district];
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";

    let jar: Record<string, string> = {};

    // Step 1: GET login page for verification token + cookies.
    const loginUrl = `${base}/HomeAccess/Account/LogOn`;
    let r1: Response;
    try {
      r1 = await fetch(loginUrl, {
        headers: { "User-Agent": ua, Accept: "text/html" },
        redirect: "manual",
      });
    } catch {
      throw new Error(
        `Couldn't reach the ${data.district} HAC portal. The preview environment blocks outbound requests to school sites — this works on the published app.`,
      );
    }
    jar = mergeCookies(jar, r1.headers);
    const loginHtml = await r1.text();
    const token = pickHidden(loginHtml, "__RequestVerificationToken");
    if (!token) {
      throw new Error(`Could not load HAC login page (status ${r1.status}). District portal may be offline.`);
    }

    // Step 2: POST login form.
    const form = new URLSearchParams();
    form.set("__RequestVerificationToken", token);
    form.set("SCKTY00328510CustomEnabled", "False");
    form.set("SCKTY00436568CustomEnabled", "False");
    form.set("Database", "10");
    form.set("VerificationOption", "UsernamePassword");
    form.set("LogOnDetails.UserName", data.username);
    form.set("tempUN", "");
    form.set("tempPW", "");
    form.set("LogOnDetails.Password", data.password);

    const r2 = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "User-Agent": ua,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
        Cookie: cookieHeader(jar),
        Referer: loginUrl,
        Origin: base,
      },
      body: form.toString(),
      redirect: "manual",
    });
    jar = mergeCookies(jar, r2.headers);

    if (!jar[".ASPXAUTH"] && r2.status !== 302) {
      const body = await r2.text();
      if (/invalid|incorrect|locked/i.test(body)) {
        throw new Error("Invalid username or password.");
      }
      throw new Error(`HAC login failed (status ${r2.status}). Check credentials or try again.`);
    }

    // Follow redirect chain (HAC bounces through HomeAccess/Home).
    let nextUrl = r2.headers.get("location");
    let hops = 0;
    while (nextUrl && hops < 5) {
      const u = nextUrl.startsWith("http") ? nextUrl : `${base}${nextUrl}`;
      const r = await fetch(u, {
        headers: { "User-Agent": ua, Cookie: cookieHeader(jar), Accept: "text/html" },
        redirect: "manual",
      });
      jar = mergeCookies(jar, r.headers);
      nextUrl = r.headers.get("location");
      hops++;
      if (!nextUrl) break;
    }

    // Step 3: fetch Classwork, Transcript, Report Card, and Calendar pages.
    // HAC route shapes vary by district/version, so try the classic Content/Student
    // pages first, then the newer Classes/Grades routes.
    const [classworkHtml, transcriptHtml, reportCardHtml, calendarHtml] = await Promise.all([
      fetchBestPage(base, jar, ua, PAGE_CANDIDATES.classwork, looksLikeClassworkPage),
      fetchBestPage(base, jar, ua, PAGE_CANDIDATES.transcript, looksLikeTranscriptPage),
      fetchBestPage(base, jar, ua, PAGE_CANDIDATES.reportCard, looksLikeReportCardPage),
      fetchBestPage(base, jar, ua, PAGE_CANDIDATES.calendar, (html) => /calendar|week view|fc-event|data-date=/i.test(html)),
    ]);

    if (looksLikeLoginPage(classworkHtml) || !looksLikeClassworkPage(classworkHtml)) {
      throw new Error("Session expired or login was not accepted. Please reconnect.");
    }

    const student = parseStudent(classworkHtml);
    let courses = parseClasses(classworkHtml);
    const transcript = parseTranscript(transcriptHtml);
    const officialGpa = parseTranscriptGpa(transcriptHtml);
    const calendar = parseCalendar(calendarHtml);

    // Merge the real report-card quarter grades onto each course by name.
    const rcMap = parseReportCard(reportCardHtml);
    if (!courses.length && rcMap.size) {
      courses = extractReportCardEntries(reportCardHtml).map((entry, index) => ({
        id: `c-rc-${normalizeName(entry.name) || index}`,
        name: entry.name,
        code: null,
        teacher: null,
        period: null,
        average: entry.term.mp4 ?? entry.term.mp3 ?? entry.term.mp2 ?? entry.term.mp1 ?? entry.term.semester ?? entry.term.exam ?? null,
        assignments: [],
        categoryAverages: [],
        reportCard: entry.term,
      }));
    }
    if (rcMap.size) {
      for (const course of courses) {
        const term = rcMap.get(normalizeName(course.name));
        if (term) course.reportCard = term;
      }
    }

    return {
      student,
      courses,
      transcript,
      calendar,
      officialGpa,
      markingPeriodGPAs: [],
      syncedAt: new Date().toISOString(),
      districtId: data.district,
      username: data.username,
    };
  });