import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const APP_ID = "com.bryanliu.lifeosnexus";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeIfChanged(filePath, next) {
  const prev = read(filePath);
  if (prev === next) return false;
  fs.writeFileSync(filePath, next, "utf8");
  return true;
}

function replaceAll(haystack, from, to) {
  return haystack.split(from).join(to);
}

function ensureCapAppSpmIos17() {
  const filePath = path.join(root, "ios", "App", "CapApp-SPM", "Package.swift");
  if (!fs.existsSync(filePath)) return;

  const prev = read(filePath);
  let next = prev;
  next = replaceAll(next, "platforms: [.iOS(.v15)]", "platforms: [.iOS(.v17)]");
  writeIfChanged(filePath, next);
}

function ensureXcodeProjectIos17() {
  const filePath = path.join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
  if (!fs.existsSync(filePath)) return;

  const prev = read(filePath);
  let next = prev;
  next = next.replace(/IPHONEOS_DEPLOYMENT_TARGET = (\\d+\\.\\d+);/g, "IPHONEOS_DEPLOYMENT_TARGET = 17.0;");
  writeIfChanged(filePath, next);
}

function ensureInfoPlistUrlScheme() {
  const filePath = path.join(root, "ios", "App", "App", "Info.plist");
  if (!fs.existsSync(filePath)) return;

  const prev = read(filePath);
  if (prev.includes("<key>CFBundleURLTypes</key>")) {
    // Normalize previous value (older app ids) to APP_ID.
    let next = prev;
    next = replaceAll(next, "com.bryanliu.lifeos_nexus", APP_ID);
    writeIfChanged(filePath, next);
    return;
  }

  const insert = `\n\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>${APP_ID}</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${APP_ID}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n`;

  const marker = "\n</dict>";
  const idx = prev.lastIndexOf(marker);
  if (idx === -1) return;
  const next = prev.slice(0, idx) + insert + prev.slice(idx);
  writeIfChanged(filePath, next);
}

ensureCapAppSpmIos17();
ensureXcodeProjectIos17();
ensureInfoPlistUrlScheme();
