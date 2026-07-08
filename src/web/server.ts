import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { answerQuestion } from "../answer.js";
import { listCollections } from "../store.js";
import { repoNameFromCollection } from "../repo.js";
import { getSettings, saveSettings, getLastRepo } from "./settings.js";

/**
 * STEP 6 (optional) - a second thin front door: a local web UI over the same pipeline the CLI
 * uses. The server serves a static page and a small JSON API, and holds the Anthropic key
 * server-side (the browser never sees it). Bound to localhost only.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const PORT = Number(process.env.PORT ?? 5175);
const HOST = "127.0.0.1";

// Only these static files are served, by exact path, so there is no path traversal surface.
const STATIC: Record<string, string> = {
  "/": "index.html",
  "/index.html": "index.html",
  "/app.js": "app.js",
  "/styles.css": "styles.css",
  "/favicon.svg": "favicon.svg",
};
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Read a request body as JSON. Empty body -> {}. */
async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

async function serveStatic(res: ServerResponse, file: string): Promise<void> {
  const buf = await readFile(join(PUBLIC_DIR, file));
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(buf);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (method === "GET" && STATIC[path]) {
    return serveStatic(res, STATIC[path]!);
  }

  // GET /repos -> { repos, lastRepo }: the repo picker's options plus the last-used one.
  if (method === "GET" && path === "/repos") {
    const collections = await listCollections();
    const repos = collections.map(repoNameFromCollection).sort();
    return sendJson(res, 200, { repos, lastRepo: getLastRepo() });
  }

  // GET /settings?repo=<name> -> saved knobs for that repo, or config defaults.
  if (method === "GET" && path === "/settings") {
    const repo = url.searchParams.get("repo");
    if (!repo) return sendJson(res, 400, { error: "repo query param required" });
    return sendJson(res, 200, getSettings(repo));
  }

  // POST /settings { repo, topK, minScore } -> persist per-repo knobs.
  if (method === "POST" && path === "/settings") {
    const { repo, topK, minScore } = await readBody(req);
    if (typeof repo !== "string" || typeof topK !== "number" || typeof minScore !== "number") {
      return sendJson(res, 400, { error: "repo (string), topK (number), minScore (number) required" });
    }
    saveSettings(repo, { topK, minScore });
    return sendJson(res, 200, getSettings(repo));
  }

  // POST /ask { repo, question, topK?, minScore? } -> grounded answer + retrieval + refused flag.
  if (method === "POST" && path === "/ask") {
    const { repo, question, topK, minScore } = await readBody(req);
    if (typeof repo !== "string" || typeof question !== "string" || !question.trim()) {
      return sendJson(res, 400, { error: "repo and a non-empty question are required" });
    }
    const overrides: { topK?: number; minScore?: number } = {};
    if (typeof topK === "number") overrides.topK = topK;
    if (typeof minScore === "number") overrides.minScore = minScore;

    const result = await answerQuestion(repo, question, overrides);
    return sendJson(res, 200, {
      answer: result.answer.answer,
      citations: result.answer.citations,
      confidence: result.answer.confidence,
      retrieved: result.retrieved.map((c) => ({
        path: c.path,
        startLine: c.startLine,
        endLine: c.endLine,
        score: c.score,
        text: c.text,
      })),
      refused: result.refused,
    });
  }

  sendJson(res, 404, { error: `no route for ${method} ${path}` });
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("request error:", err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    } else {
      res.end();
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`peckworks-codebase-rag web UI running at http://${HOST}:${PORT}`);
});
