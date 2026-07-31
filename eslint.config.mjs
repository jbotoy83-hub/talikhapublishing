import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // New react-hooks rules flag long-standing, working patterns: state synced
    // from props/effects (set-state-in-effect) and random sample-reference
    // generation (purity). Kept visible as warnings, non-blocking, until each
    // site is refactored. rules-of-hooks intentionally stays an error.
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([
    ".next/**",
    ".claude/**",
    ".codex/**",
    "**/dist/**",
    "**/dist-verify*/**",
    "public/admin/**",
    "node_modules/**",
    "**/node_modules/**",
    "**/pdf.worker.min.mjs",
    "**/*.min.js",
    "**/*.min.mjs",
    "output/**",
    "src/main.js",
    "src/submissionStore.js",
    "src/journalStore.js",
    "src/journalMedia.js",
    "src/publicationFiles.js",
    "src/testimonials-mount.tsx",
    "src/components/icons/**",
    "components/**"
  ])
]);
