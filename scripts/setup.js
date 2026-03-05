/* eslint-disable no-console */
const { spawnSync } = require("child_process");
const path = require("path");

function runNodeScript(scriptFile) {
  const scriptPath = path.join(__dirname, scriptFile);
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function run() {
  console.log("[setup] running install check...");
  runNodeScript("install-check.js");

  console.log("[setup] running migrations...");
  runNodeScript("migrate.js");

  console.log("[setup] running seeder...");
  runNodeScript("seed.js");

  console.log("[setup] done");
}

run();

