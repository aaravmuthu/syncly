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
    const { parseClasses, parseTranscript, parseReportCard, parseStudent, pickHidden, normalizeName } = await import("./parser.server");
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
    const classworkUrl = `${base}/HomeAccess/Classes/Classwork`;
    const transcriptUrl = `${base}/HomeAccess/Grades/Transcript`;
    const reportCardUrl = `${base}/HomeAccess/Grades/ReportCard`;
    const calendarUrl = `${base}/HomeAccess/Home/Calendar`;

    const [rc, rt, rr, rcal] = await Promise.all([
      fetch(classworkUrl, {
        headers: { "User-Agent": ua, Cookie: cookieHeader(jar), Accept: "text/html" },
      }),
      fetch(transcriptUrl, {
        headers: { "User-Agent": ua, Cookie: cookieHeader(jar), Accept: "text/html" },
      }),
      fetch(reportCardUrl, {
        headers: { "User-Agent": ua, Cookie: cookieHeader(jar), Accept: "text/html" },
      }),
      fetch(calendarUrl, {
        headers: { "User-Agent": ua, Cookie: cookieHeader(jar), Accept: "text/html" },
      }),
    ]);

    const classworkHtml = await rc.text();
    const transcriptHtml = await rt.text();
    const reportCardHtml = await rr.text();
    const calendarHtml = await rcal.text();

    if (/LogOn|login/i.test(classworkHtml) && !/AssignmentClass/i.test(classworkHtml)) {
      throw new Error("Session expired or login was not accepted. Please reconnect.");
    }

    const student = parseStudent(classworkHtml);
    const courses = parseClasses(classworkHtml);
    const transcript = parseTranscript(transcriptHtml);
    const calendar = parseCalendar(calendarHtml);

    // Merge the real report-card quarter grades onto each course by name.
    const rcMap = parseReportCard(reportCardHtml);
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
      markingPeriodGPAs: [],
      syncedAt: new Date().toISOString(),
      districtId: data.district,
      username: data.username,
    };
  });