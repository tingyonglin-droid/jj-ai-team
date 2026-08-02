import { AsyncLocalStorage } from "node:async_hooks";
import type { AnyD1Database } from "drizzle-orm/d1";

export type RuntimeEnvironment = {
  DB?: AnyD1Database;
  [key: string]: unknown;
};

const runtimeEnvironment = new AsyncLocalStorage<RuntimeEnvironment>();

export function runWithRuntimeEnv<T>(
  environment: RuntimeEnvironment,
  operation: () => T,
) {
  return runtimeEnvironment.run(environment, operation);
}

export function getRuntimeEnv() {
  const environment = runtimeEnvironment.getStore();
  if (!environment) throw new Error("Worker 執行環境尚未注入。");
  return environment;
}
