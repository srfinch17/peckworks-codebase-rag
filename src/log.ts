import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Append-only event log (the observability layer). Every run appends structured events
 * to logs/events.jsonl so you can answer, after the fact: what did it retrieve? what did
 * it cost? where did it refuse? One JSON object per line (JSON Lines format).
 */
const LOG_PATH = "logs/events.jsonl";

export function logEvent(type: string, data: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), type, ...data });
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, line + "\n");
}
