/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outRoot = path.join(root, "dist", "codecanyon", "PumpPilot", "web");
const docsRoot = path.join(root, "dist", "codecanyon", "PumpPilot", "docs");

const includeDirs = ["app", "components", "hooks", "lib", "models", "public", "esp32", "types", "scripts"];
const includeFiles = [
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "eslint.config.mjs",
  ".gitignore",
  ".env.example",
  "README.md",
  "CODECANYON_INSTALL.md",
  "CODECANYON_CHECKLIST.md",
  "CODECANYON_PACKAGE_STRUCTURE.md",
];

function removeDirIfExists(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function main() {
  const distFolder = path.join(root, "dist");
  removeDirIfExists(distFolder);

  fs.mkdirSync(outRoot, { recursive: true });
  fs.mkdirSync(docsRoot, { recursive: true });

  for (const dir of includeDirs) {
    copyDir(path.join(root, dir), path.join(outRoot, dir));
  }

  for (const file of includeFiles) {
    copyFile(path.join(root, file), path.join(outRoot, file));
  }

  copyFile(path.join(root, "BUYER_QUICK_START.md"), path.join(docsRoot, "buyer-quick-start.md"));

  console.log(`[package] prepared: ${path.join(root, "dist", "codecanyon")}`);
  console.log("[package] next: zip dist/codecanyon/PumpPilot and upload to Codecanyon");
}

main();

