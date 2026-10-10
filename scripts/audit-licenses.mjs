import { readdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

const entries = [];
const visited = new Set();
async function inspectPackage(dir) {
  const resolved = await realpath(dir);
  if (visited.has(resolved)) return;
  visited.add(resolved);
  let pkg;
  try {
    pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
  } catch {
    return;
  }
  const names = await readdir(dir);
  const licenseFiles = names.filter((name) => /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(name));
  const declared = typeof pkg.license === "string" ? pkg.license : (pkg.license?.type ?? null);
  const review =
    !declared ||
    /GPL|AGPL|SSPL|BUSL|UNLICENSED|SEE LICENSE/i.test(declared) ||
    !licenseFiles.length;
  entries.push({
    name: pkg.name,
    version: pkg.version,
    license: declared,
    licenseFiles,
    reviewRequired: review,
  });
  await scan(path.join(dir, "node_modules"));
}
async function scan(root) {
  let dirs;
  try {
    dirs = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dir of dirs) {
    if (dir.name.startsWith(".")) continue;
    const full = path.join(root, dir.name);
    if (dir.name.startsWith("@")) {
      for (const name of await readdir(full)) await inspectPackage(path.join(full, name));
    } else await inspectPackage(full);
  }
}
await scan("node_modules");
entries.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
const report = {
  note: "Installed dependency inventory. License identifiers and file presence require manual review; this is not legal clearance. Run after each dependency update.",
  packages: entries,
};
await writeFile(".audits/package-licenses.json", JSON.stringify(report, null, 2) + "\n");
console.log(
  `${entries.length} packages inventoried; ${entries.filter((entry) => entry.reviewRequired).length} require review.`,
);
