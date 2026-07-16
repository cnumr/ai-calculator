#!/usr/bin/env node
// Exécuté par changesets/action (étape "publish") une fois la PR "Version
// Packages" mergée : ce projet n'est publié sur aucun registre (npm/PyPI),
// donc "publier" signifie ici : taguer le commit et créer la GitHub Release
// correspondante, à partir de la section du CHANGELOG.md générée par
// Changesets pour cette version.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", ...options });
}

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;

const existingTags = run("git", ["tag", "-l", tag]).trim();
if (existingTags === tag) {
  console.log(`Tag ${tag} existe déjà, rien à publier.`);
  process.exit(0);
}

const changelog = readFileSync("CHANGELOG.md", "utf8");
const sectionMatch = changelog.match(
  new RegExp(
    `^## ${version.replace(/\./g, "\\.")}[^\n]*\n([\\s\\S]*?)(?=\n## |$)`,
    "m"
  )
);
const notes = sectionMatch ? sectionMatch[1].trim() : `Version ${version}`;

run("git", ["tag", tag]);
run("git", ["push", "origin", tag]);

run("gh", ["release", "create", tag, "--title", tag, "--notes", notes]);

console.log(`Release ${tag} créée.`);
