// Fails when manifest.json and package.json disagree on the version, so a
// release is never built with a half-bumped version. Prints the version.
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

if (manifest.version !== pkg.version) {
  console.error(`manifest.json is ${manifest.version} but package.json is ${pkg.version}; bump both.`);
  process.exit(1);
}
console.log(manifest.version);
