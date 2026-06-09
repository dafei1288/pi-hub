#!/usr/bin/env node

/**
 * Install script for pi-agent-hud extension.
 *
 * Usage:
 *   node scripts/install.js          # Install to current project
 *   node scripts/install.js --global # Install globally
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const isGlobal = process.argv.includes("--global");
const extName = "pi-hud.ts";
const srcExt = path.resolve(__dirname, "..", "extensions", extName);

if (!fs.existsSync(srcExt)) {
  console.error(`Error: Extension source not found at ${srcExt}`);
  process.exit(1);
}

if (isGlobal) {
  const targetDir = path.join(os.homedir(), ".pi", "agent", "extensions");
  const targetPath = path.join(targetDir, extName);

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(srcExt, targetPath);
  console.log(`Installed globally: ${targetPath}`);
} else {
  const cwd = process.cwd();
  const targetDir = path.join(cwd, ".pi", "extensions");
  const targetPath = path.join(targetDir, extName);

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(srcExt, targetPath);
  console.log(`Installed to project: ${targetPath}`);
}

console.log("Restart pi or run /reload to activate.");
