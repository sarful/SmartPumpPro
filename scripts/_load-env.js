/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const idx = trimmed.indexOf("=");
  if (idx <= 0) return null;

  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    if (typeof process.env[parsed.key] === "undefined") {
      process.env[parsed.key] = parsed.value;
    }
  }
}

const root = path.resolve(__dirname, "..");
loadFromFile(path.join(root, ".env"));
loadFromFile(path.join(root, ".env.local"));

