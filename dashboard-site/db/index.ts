import { drizzle } from "drizzle-orm/d1";

import { getRuntimeEnv } from "../lib/runtime-env";
import * as schema from "./schema";

export function getDb() {
  const env = getRuntimeEnv();
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` 無法使用；請確認 .openai/hosting.json 已宣告 d1。",
    );
  }
  return drizzle(env.DB, { schema });
}
