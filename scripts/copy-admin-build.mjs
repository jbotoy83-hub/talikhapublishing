import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

const source = "admin-panel/dist";
const target = "public/admin";

if (!existsSync(source)) {
  console.error(`[copy-admin] admin build output not found at ${source}. Run the admin Vite build first.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync("public", { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`[copy-admin] ${source} -> ${target}`);
