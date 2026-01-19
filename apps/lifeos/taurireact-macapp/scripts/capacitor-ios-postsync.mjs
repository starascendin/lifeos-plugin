import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

// Read current capacitor.config.ts to get appId and appName
function getCapacitorConfig() {
  const configPath = path.join(root, "capacitor.config.ts");
  const content = fs.readFileSync(configPath, "utf8");

  const appIdMatch = content.match(/appId:\s*["']([^"']+)["']/);
  const appNameMatch = content.match(/appName:\s*["']([^"']+)["']/);

  return {
    appId: appIdMatch ? appIdMatch[1] : "com.bryanliu.lifeosnexus",
    appName: appNameMatch ? appNameMatch[1] : "LifeOS Nexus",
  };
}

const config = getCapacitorConfig();
const APP_ID = config.appId;
const APP_NAME = config.appName;
const IS_STAGING = APP_ID.includes(".staging");

console.log(`[postsync] Configuring iOS for: ${APP_NAME} (${APP_ID})`);

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
  next = next.replace(/IPHONEOS_DEPLOYMENT_TARGET = (\d+\.\d+);/g, "IPHONEOS_DEPLOYMENT_TARGET = 17.0;");
  writeIfChanged(filePath, next);
}

function updateBundleIdentifier() {
  const filePath = path.join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
  if (!fs.existsSync(filePath)) return;

  const prev = read(filePath);
  // Replace any existing bundle identifier with current one
  let next = prev.replace(
    /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
    `PRODUCT_BUNDLE_IDENTIFIER = ${APP_ID};`
  );
  if (writeIfChanged(filePath, next)) {
    console.log(`[postsync] Updated bundle identifier to: ${APP_ID}`);
  }
}

function updateInfoPlist() {
  const filePath = path.join(root, "ios", "App", "App", "Info.plist");
  if (!fs.existsSync(filePath)) return;

  let content = read(filePath);

  // Update CFBundleDisplayName
  content = content.replace(
    /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
    `<key>CFBundleDisplayName</key>\n        <string>${APP_NAME}</string>`
  );

  // Update CFBundleURLName and CFBundleURLSchemes
  content = content.replace(
    /<key>CFBundleURLName<\/key>\s*<string>[^<]*<\/string>/,
    `<key>CFBundleURLName</key>\n\t\t\t<string>${APP_ID}</string>`
  );
  content = content.replace(
    /(<key>CFBundleURLSchemes<\/key>\s*<array>\s*)<string>[^<]*<\/string>/,
    `$1<string>${APP_ID}</string>`
  );

  if (writeIfChanged(filePath, content)) {
    console.log(`[postsync] Updated Info.plist with app name: ${APP_NAME}`);
  }
}

function copyIcons() {
  const iconSourceDir = IS_STAGING
    ? path.join(root, "ios-icons-staging")
    : path.join(root, "ios-icons-production");
  const iconDestDir = path.join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");

  if (!fs.existsSync(iconSourceDir)) {
    console.log(`[postsync] Warning: Icon source directory not found: ${iconSourceDir}`);
    return;
  }

  // Copy all files from source to destination
  const files = fs.readdirSync(iconSourceDir);
  for (const file of files) {
    const src = path.join(iconSourceDir, file);
    const dest = path.join(iconDestDir, file);
    fs.copyFileSync(src, dest);
  }
  console.log(`[postsync] Copied ${IS_STAGING ? "staging" : "production"} icons`);
}

ensureCapAppSpmIos17();
ensureXcodeProjectIos17();
updateBundleIdentifier();
updateInfoPlist();
copyIcons();
