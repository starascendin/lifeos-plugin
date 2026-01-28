#!/usr/bin/env node

/**
 * Generates src/build-info.ts with version from package.json and current build timestamp.
 * Run before `tsc` so the values are baked into the compiled JS.
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const content = `// AUTO-GENERATED — do not edit. Regenerated on every build.
export const VERSION = "${pkg.version}";
export const BUILD_TIME = "${new Date().toISOString()}";
`;

writeFileSync(join(__dirname, "..", "src", "build-info.ts"), content);
console.error(`build-info.ts generated: v${pkg.version}`);
