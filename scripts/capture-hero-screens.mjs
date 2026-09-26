/**
 * Re-captures the landing hero's device screen from the live /demo route, so
 * the iPad mockup always shows the real UI (sample data, never a user's).
 *
 *   bun run dev            # in another terminal
 *   node scripts/capture-hero-screens.mjs
 *
 * Writes public/hero/ipad-{dark,light}.jpg at iPad Air landscape (1180x820 @1.75x,
 * enough for the ~1000px frame on a retina screen without shipping a 2x PNG).
 * Demo-only chrome (the "nothing is saved" pill, the sign-up button and the
 * page intro) is hidden first so the frame reads as the app, not a web page.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:8080";
const PORT = 9333;
const [W, H, DPR] = [1180, 820, 1.75];

const HIDE_DEMO_CHROME = `(() => {
  document.querySelector("header .flex.items-center.gap-2")?.style.setProperty("visibility", "hidden");
  const h1 = document.querySelector("main h1");
  h1?.nextElementSibling?.remove();
  h1?.remove();
  document.querySelector("main > div")?.classList.remove("mt-6");
  window.scrollTo(0, 0);
})()`;

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--hide-scrollbars",
  `--user-data-dir=${join(tmpdir(), "syncly-hero-capture")}`,
  "about:blank",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) return new WebSocket(page.webSocketDebuggerUrl);
    } catch {
      /* Chrome still starting */
    }
    await sleep(200);
  }
  throw new Error("Chrome never exposed a debugging target");
}

const ws = await connect();
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (msg) =>
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result),
    );
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Emulation.setDeviceMetricsOverride", {
  width: W,
  height: H,
  deviceScaleFactor: DPR,
  mobile: false,
});
await mkdir("public/hero", { recursive: true });

for (const theme of ["dark", "light"]) {
  await send("Page.navigate", { url: `${ORIGIN}/demo` });
  await sleep(1500);
  await send("Runtime.evaluate", {
    expression: `localStorage.setItem("syncly-theme", "${theme}")`,
  });
  await send("Page.reload");
  await sleep(4000);
  await send("Runtime.evaluate", { expression: HIDE_DEMO_CHROME });
  await sleep(600);
  const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 80 });
  const out = `public/hero/ipad-${theme}.jpg`;
  await writeFile(out, Buffer.from(data, "base64"));
  console.log("wrote", out);
}

ws.close();
chrome.kill();
