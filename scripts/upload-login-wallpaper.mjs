import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries((await readFile(".env.local", "utf8"))
  .split(/\r?\n/)
  .filter((line) => /^[A-Z0-9_]+=/i.test(line))
  .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) throw new Error("Supabase credentials are unavailable.");

const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const path = "site-assets/talikha-login-grain.png";
const file = await readFile("public/admin/assets/talikha-login-grain.png");
const { error } = await client.storage.from("editorial-media").upload(path, file, { contentType: "image/png", cacheControl: "31536000", upsert: true });
if (error) throw error;
const { data } = client.storage.from("editorial-media").getPublicUrl(path);
console.log(data.publicUrl);
