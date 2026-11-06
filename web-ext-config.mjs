// Shared web-ext settings, picked up automatically by `web-ext lint`,
// `build` and `sign` (locally and in .github/workflows). Keeps the package to
// the add-on itself: no tooling, docs or store material.
export default {
  ignoreFiles: [
    "node_modules",
    "package.json",
    "package-lock.json",
    "README.md",
    "store",
    "web-ext-config.mjs",
    "web-ext-artifacts",
    "scripts",
  ],
  build: {
    overwriteDest: true,
  },
  // No warnings are expected, so a new one fails the lint like an error.
  lint: {
    warningsAsErrors: true,
  },
};
