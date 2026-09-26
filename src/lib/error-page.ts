export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light dark; --bg: oklch(0.985 0.006 95); --fg: oklch(0.22 0.012 70); --muted: oklch(0.52 0.012 75); --primary: oklch(0.44 0.09 168); --on-primary: oklch(0.99 0.005 95); --secondary: oklch(0.25 0.01 70 / 0.06); --border: oklch(0.25 0.01 70 / 0.12); }
      @media (prefers-color-scheme: dark) { :root { --bg: oklch(0.06 0.002 270); --fg: oklch(0.985 0.002 270); --muted: oklch(0.72 0.006 270); --primary: oklch(0.72 0.11 168); --on-primary: oklch(0.18 0.02 168); --secondary: oklch(1 0 0 / 0.06); --border: oklch(1 0 0 / 0.08); } }
      body { font: 16px/1.5 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; -webkit-font-smoothing: antialiased; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 0.5rem; }
      p { color: var(--muted); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a { min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 1.25rem; border-radius: 1rem; font: inherit; font-weight: 600; text-decoration: none; border: 1px solid transparent; transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), opacity 160ms; }
      a:active { transform: scale(0.96); }
      a:hover { opacity: 0.92; }
      a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      .primary { background: var(--primary); color: var(--on-primary); }
      .secondary { background: var(--secondary); color: var(--fg); border-color: var(--border); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <a class="primary" href="">Try again</a>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
