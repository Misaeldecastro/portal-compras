import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(apiDir, "..", ".env.local"),
];

function parseEnvValue(rawValue) {
  let value = rawValue.trim();

  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  }

  return value
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll('\\"', '"')
    .replaceAll("\\'", "'");
}

function loadLocalEnv() {
  const envPath = envPaths.find((candidate) => existsSync(candidate));
  if (!envPath) return;

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.replace(/^\uFEFF/, "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = parseEnvValue(trimmed.slice(separatorIndex + 1));

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();
