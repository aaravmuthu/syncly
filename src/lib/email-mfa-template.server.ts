// Security-code email. Table layout and inline styles because Gmail and
// Outlook drop most <style> rules; the <style> block only adds dark mode for
// clients that support it (Apple Mail, iOS).

type Purpose = "enroll" | "verify" | "disable";

const COPY: Record<Purpose, { heading: string; lede: string; action: string }> = {
  enroll: {
    heading: "Turn on two-factor",
    lede: "Enter this code in Syncly to finish setting up email verification.",
    action: "two-factor setup",
  },
  verify: {
    heading: "Confirm it’s you",
    lede: "Enter this code in Syncly to finish signing in.",
    action: "sign-in verification",
  },
  disable: {
    heading: "Turn off two-factor",
    lede: "Enter this code in Syncly to remove email verification from your account.",
    action: "two-factor removal",
  },
};

const SITE = "https://syncly.website";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

export function securityCodeEmail(purpose: Purpose, code: string) {
  const copy = COPY[purpose];
  const subject = "Your Syncly security code";
  const text = `Your Syncly ${copy.action} code is ${code}.\n\nIt expires in 10 minutes and can be used once. If you did not request this code, do not share it.`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${subject}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg { background:#0b0f0e !important; }
    .card { background:#141a18 !important; border-color:#24302c !important; }
    .ink { color:#eef3f1 !important; }
    .muted { color:#93a19c !important; }
    .code { background:#0f2a22 !important; color:#7fe0bd !important; border-color:#1d4a3c !important; }
    .rule { border-color:#24302c !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f3f5f4;" class="bg">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Expires in 10 minutes. Don’t share it with anyone.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#f3f5f4;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;">
      <tr><td style="padding:0 4px 20px;">
        <a href="${SITE}" style="text-decoration:none;">
          <img src="${SITE}/icon-192.png" width="32" height="32" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:8px;">
          <span class="ink" style="display:inline-block;vertical-align:middle;margin-left:10px;font:600 17px/1 ${FONT};color:#0e1513;letter-spacing:-0.2px;">Syncly</span>
        </a>
      </td></tr>
      <tr><td class="card" style="background:#ffffff;border:1px solid #e3e8e6;border-radius:20px;padding:32px 28px;">
        <h1 class="ink" style="margin:0 0 8px;font:600 22px/1.25 ${FONT};color:#0e1513;letter-spacing:-0.3px;">${copy.heading}</h1>
        <p class="muted" style="margin:0 0 24px;font:400 15px/1.5 ${FONT};color:#5b6a65;">${copy.lede}</p>
        <div class="code" style="background:#eaf6f1;border:1px solid #cfe9df;border-radius:14px;padding:18px 0;text-align:center;font:600 34px/1 ${MONO};letter-spacing:10px;color:#0f4d3a;">${code}</div>
        <p class="muted" style="margin:16px 0 0;font:400 13px/1.5 ${FONT};color:#5b6a65;text-align:center;">Expires in 10 minutes · Works once</p>
        <hr class="rule" style="border:0;border-top:1px solid #e3e8e6;margin:28px 0 20px;">
        <p class="muted" style="margin:0;font:400 13px/1.55 ${FONT};color:#5b6a65;">Didn’t ask for this? Ignore this email and don’t share the code. Syncly will never ask you for it.</p>
      </td></tr>
      <tr><td style="padding:20px 4px 0;">
        <p class="muted" style="margin:0;font:400 12px/1.5 ${FONT};color:#8a9792;">Sent by <a href="${SITE}" class="muted" style="color:#8a9792;">Syncly</a> because a security code was requested for your account.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  return { subject, text, html };
}
