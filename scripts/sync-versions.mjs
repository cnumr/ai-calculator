#!/usr/bin/env node
// Synchronise la version de package.json (racine, source unique gérée par Changesets)
// vers frontend/package.json et backend/pyproject.toml.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { version } = JSON.parse(
  readFileSync(path.join(rootDir, "package.json"), "utf8")
);

const frontendPath = path.join(rootDir, "frontend", "package.json");
const frontendPkg = JSON.parse(readFileSync(frontendPath, "utf8"));
frontendPkg.version = version;
writeFileSync(frontendPath, `${JSON.stringify(frontendPkg, null, 2)}\n`);

const pyprojectPath = path.join(rootDir, "backend", "pyproject.toml");
const pyproject = readFileSync(pyprojectPath, "utf8");
const versionLine = /^version = ".*"$/m;
if (!versionLine.test(pyproject)) {
  throw new Error(
    `Impossible de trouver 'version = "..."' dans ${pyprojectPath}`
  );
}
writeFileSync(
  pyprojectPath,
  pyproject.replace(versionLine, `version = "${version}"`)
);

console.log(`Version synchronisée : ${version}`);
