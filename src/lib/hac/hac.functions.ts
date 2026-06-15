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

const LOGIN_PATH = "/HomeAccess/Account/LogOn?ReturnUrl=%2fHomeAccess%2f";

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
): Promise<{ html: string; url: string }> {
  let fallback = { html: "", url: `${base}${candidates[0]}` };

  for (const path of candidates) {
    const { response, html, url } = await fetchHtmlWithRedirects(`${base}${path}`, jar, ua);
    if (!response.ok) continue;
    if (looksLikeLoginPage(html)) {
      if (!fallback.html) fallback = { html, url };
      continue;
    }
    if (isMatch(html)) return { html, url };
    if (!fallback.html) fallback = { html, url };
  }

  return fallback;
}

/**
 * Re-fetch the Assignments page for a specific marking-period run via an ASP.NET
 * __doPostBack on the report-card-run dropdown. Returns the resulting HTML.
 */
async function postBackRun(
  url: string,
  jar: Record<string, string>,
  ua: string,
  base: string,
  hidden: Record<string, string>,
  controlName: string,
  runValue: string,
): Promise<string> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);
  form.set("__EVENTTARGET", controlName);
  form.set("__EVENTARGUMENT", "");
  form.set(controlName, runValue);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": ua,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
      Cookie: cookieHeader(jar),
      Referer: url,
      Origin: base,
    },
    body: form.toString(),
    redirect: "manual",
  });
  Object.assign(jar, mergeCookies(jar, res.headers));
  return res.text();
}



function extractHtmlRedirectTarget(html: string): string | null {
  const meta = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'>]+)["']/i)?.[1];
  if (meta) return meta.trim();

  const js =
    html.match(/(?:window|document)\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i)?.[1] ??
    html.match(/location\.replace\(["']([^"']+)["']\)/i)?.[1];
  return js?.trim() ?? null;
}

async function fetchHtmlWithRedirects(
  url: string,
  jar: Record<string, string>,
  ua: string,
  referer?: string,
): Promise<{ response: Response; html: string; url: string }> {
  let currentUrl = url;
  let currentReferer = referer;

  for (let hop = 0; hop < 8; hop++) {
    const response = await fetch(currentUrl, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html",
        Cookie: cookieHeader(jar),
        ...(currentReferer ? { Referer: currentReferer } : {}),
      },
      redirect: "manual",
    });
    Object.assign(jar, mergeCookies(jar, response.headers));

    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      currentReferer = currentUrl;
      currentUrl = location.startsWith("http") ? location : new URL(location, currentUrl).toString();
      continue;
    }

    const html = await response.text();
    const htmlRedirect = extractHtmlRedirectTarget(html);
    if (htmlRedirect && !looksLikeLoginPage(html) && htmlRedirect !== currentUrl) {
      currentReferer = currentUrl;
      currentUrl = htmlRedirect.startsWith("http") ? htmlRedirect : new URL(htmlRedirect, currentUrl).toString();
      continue;
    }

    return { response, html, url: currentUrl };
  }

  const response = await fetch(currentUrl, {
    headers: { "User-Agent": ua, Accept: "text/html", Cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  Object.assign(jar, mergeCookies(jar, response.headers));
  return { response, html: await response.text(), url: currentUrl };
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
    const { parseClasses, parseTranscript, parseTranscriptGpa, parseReportCard, extractReportCardEntries, parseCalendar, parseStudent, pickHidden, normalizeName, extractHiddenFields, parseReportCardRuns } = await import("./parser.server");
    const base = BASES[data.district];
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";

    let jar: Record<string, string> = {};

    // Step 1: GET login page for verification token + cookies.
    const loginUrl = `${base}${LOGIN_PATH}`;
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
        "X-Requested-With": "XMLHttpRequest",
        __RequestVerificationToken: token,
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
    const [classwork, transcriptPage, reportCardPage, calendarPage] = await Promise.all([
      fetchBestPage(base, jar, ua, PAGE_CANDIDATES.classwork, looksLikeClassworkPage),
      fetchBestPage(base, jar, ua, PAGE_CANDIDATES.transcript, looksLikeTranscriptPage),
      fetchBestPage(base, jar, ua, PAGE_CANDIDATES.reportCard, looksLikeReportCardPage),
      fetchBestPage(base, jar, ua, PAGE_CANDIDATES.calendar, (html) => /calendar|week view|fc-event|data-date=/i.test(html)),
    ]);

    const classworkHtml = classwork.html;
    const transcriptHtml = transcriptPage.html;
    const reportCardHtml = reportCardPage.html;
    const calendarHtml = calendarPage.html;

    if (looksLikeLoginPage(classworkHtml) || !looksLikeClassworkPage(classworkHtml)) {
      throw new Error("Session expired or login was not accepted. Please reconnect.");
    }

    const student = parseStudent(classworkHtml);
    let courses = parseClasses(classworkHtml);
    const transcript = parseTranscript(transcriptHtml);
    const officialGpa = parseTranscriptGpa(transcriptHtml);
    const calendar = parseCalendar(calendarHtml);

    // Step 4: pull real per-marking-period classwork by re-posting the report-card
    // run dropdown for each quarter (the Assignments page only shows one MP at a time).
    const debug: Record<string, string | number | boolean | null> = {};
    const runs = parseReportCardRuns(classworkHtml);
    debug.runsDetected = runs ? runs.options.length : 0;
    debug.runsControl = runs?.name ?? null;
    debug.runsOptions = runs ? runs.options.map((o) => `${o.mp}=${o.value}|${o.label}`).join(" ;; ") : null;
    if (runs && runs.options.length) {
      // Track which MP the initially-loaded page represents so we don't refetch it.
      const periodHtml = new Map<string, string>();
      for (const opt of runs.options) {
        if (periodHtml.has(opt.mp)) continue;
        try {
          const hidden = extractHiddenFields(classworkHtml);
          const html = await postBackRun(classwork.url, jar, ua, base, hidden, runs.name, opt.value);
          const isCw = !!html && looksLikeClassworkPage(html);
          debug[`pb_${opt.mp}_len`] = html ? html.length : 0;
          debug[`pb_${opt.mp}_isClasswork`] = isCw;
          debug[`pb_${opt.mp}_isLogin`] = !!html && looksLikeLoginPage(html);
          if (isCw) periodHtml.set(opt.mp, html);
        } catch (e) {
          debug[`pb_${opt.mp}_error`] = e instanceof Error ? e.message : String(e);
        }
      }

      for (const [mp, html] of periodHtml) {
        const mpCourses = parseClasses(html);
        debug[`parsed_${mp}_courses`] = mpCourses.length;
        let matched = 0;
        const byName = new Map(mpCourses.map((c) => [normalizeName(c.name), c]));
        for (const course of courses) {
          const m = byName.get(normalizeName(course.name));
          if (!m) continue;
          matched++;
          course.periodData = course.periodData ?? {};
          course.periodData[mp] = {
            average: m.average,
            assignments: m.assignments,
            categoryAverages: m.categoryAverages,
          };
        }
        debug[`matched_${mp}`] = matched;
      }
    }

    // Merge the real report-card quarter grades onto each course by name.
    const rcMap = parseReportCard(reportCardHtml);
    debug.reportCardSize = rcMap.size;
    debug.reportCardLooksRight = looksLikeReportCardPage(reportCardHtml);
    debug.reportCardNames = Array.from(rcMap.keys()).slice(0, 8).join(" ;; ") || null;
    debug.courseNames = courses.map((c) => normalizeName(c.name)).slice(0, 8).join(" ;; ") || null;
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
    debug.coursesWithReportCard = courses.filter((c) => c.reportCard).length;
    debug.coursesWithPeriodData = courses.filter((c) => c.periodData && Object.keys(c.periodData).length).length;
    console.log("[HAC SYNC DEBUG]", JSON.stringify(debug));

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