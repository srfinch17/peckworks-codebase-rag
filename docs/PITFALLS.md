# PITFALLS - peckworks-codebase-rag

Consult before touching ingest, chunking, or the Qdrant store. Append every real gotcha
(dated), the same discipline that made clipmeta easy to work in.

## Known limitations (by design, for now)

- **`.gitignore` support is intentionally partial.** We honor a built-in skip set
  (`node_modules`, `.git`, `bin`, `obj`, `dist`, `build`, `out`, `.vs`, `.vscode`, `.idea`,
  `packages`, `TestResults`, `.qdrant_storage`, `.cache`, `logs`) plus *simple* top-level
  `.gitignore` rules (plain names, trailing-slash directory entries, and `*.ext` suffix
  globs). We do **not** implement negation (`!`), `**`, path anchoring, or nested
  `.gitignore` files. This is a deliberate YAGNI cut: binaries are excluded anyway because
  ingest only includes known code/doc extensions. Revisit only if a real repo gets
  mis-indexed.

- **Line-window chunking can split a long function mid-body.** This is the Phase-1 baseline
  *on purpose*; Phase 2 (tree-sitter symbol-aware chunking) fixes it and we measure the
  hit-rate gain against this baseline. Don't "fix" it early: the baseline is the point.

- **`minScore` is a low safety net, not a fake-question filter (0.57).** Measured against the
  clipmeta golden set: with both the text-tuned and code-tuned embedders, answerable and
  unanswerable questions score in overlapping ranges (jina: answerable 0.61-0.85, should-refuse
  0.63-0.69), so no threshold cleanly separates them. The floor is kept low to avoid wrongly
  refusing real answers; catching false-premise questions needs a different mechanism (a semantic
  "do these passages answer it?" judge), not a higher number. See DECISIONS (2026-07-10).

- **Embeddings are code-tuned (jina-embeddings-v2-base-code, 768-dim), swapped from MiniLM.**
  MiniLM (text-tuned) ranked prose above the code it described; swapping to the code-tuned jina
  model raised hit-rate 11% -> 61% on the clipmeta golden set (DECISIONS, 2026-07-10). The
  `Embedder` interface (`src/embed.ts`) and `config.localModelId` remain the swap point. Residual
  cost: jina is ~7x larger, so ingest is slower and the model download is bigger. Changing the
  model changes `embeddingDim` and requires a `--recreate` re-ingest.

- **Re-ingesting upserts; it does not delete stale chunks.** If files are removed or
  renamed between ingests, their old chunks linger in the collection (point IDs are random
  UUIDs, so a changed file produces new points rather than replacing old ones). For a clean
  rebuild, drop/recreate the collection. A proper incremental re-index (delete-by-path
  before re-upsert) is a future improvement, not P1 scope.

## Gotchas

- **2026-07-08: `fetch failed` from the Qdrant client on Node 26 was a two-major-version undici mismatch.**
  - *Symptom:* `npm run ingest` failed instantly with `Failed to obtain server version ... fetch failed`, even though Qdrant was confirmed up (HTTP 200 from PowerShell, and a plain Node `fetch()` to the same URL, both worked).
  - *Root cause:* `@qdrant/js-client-rest` (latest, 1.18.0) depends on `undici@6` and builds an undici-6 `Agent` that it passes as the request `dispatcher` to Node's global `fetch`. Node 26 ships built-in `undici@8`, which rejects the v6 dispatcher with `UND_ERR_INVALID_ARG: invalid onError method`. Plain `fetch()` works because it uses the built-in dispatcher; only the client's custom Agent triggers it.
  - *Diagnosis tip:* the top-level error is a misleading `fetch failed`. The real cause is only in `err.cause.code` / `err.cause.message` - always inspect those before assuming a connectivity problem.
  - *Fix:* pin undici up to Node's major via an npm `overrides` block in package.json: `"overrides": { "undici": "^8.2.0" }`, then `npm install`. `checkCompatibility: false` does NOT help - every request uses the bad dispatcher, not just the version check.
  - *Red herring:* `localhost` vs `127.0.0.1` (IPv4/IPv6) was suspected first and is NOT the cause - Node `fetch` reached both fine. Do not chase it.

- **2026-07-08: Docker Desktop engine wedged during first-run setup (EOF / "other side closed").**
  - *Symptom:* the Qdrant container hung in `Created`/spinning state; `compose start` failed with `error during connect: ... EOF`; stray auto-named qdrant containers appeared.
  - *Contributing cause:* firing multiple concurrent Docker state-change commands (`compose up`, `docker start`) and killing them mid-operation left the engine in a bad state.
  - *Fix:* full reset - quit Docker Desktop, `wsl --shutdown`, reopen, wait for "Engine running", then `docker compose up -d --force-recreate`. Verify with an HTTP GET to `http://127.0.0.1:6333/readyz` (expect 200), not just the container's "started" state.
  - *Lesson:* do not fire overlapping Docker state-change commands. Run one, confirm it, then the next.

- **2026-07-10: Qdrant `Bad Request` / `fetch failed` on ingest was a 32 MB request-size limit.**
  - *Symptom:* after swapping to 768-dim embeddings, `npm run ingest` failed with a bare `Bad
    Request` (or `TypeError: fetch failed` at the transport). `--recreate` had already rebuilt the
    collection; it died at the upsert with zero points stored.
  - *Root cause:* `upsertChunks` sent all points in one request. Qdrant caps a request body at 32
    MB (`33554432` bytes); a full repo of 768-dim vectors plus text payloads serializes to ~44 MB.
    The exact server message is only in the client error's `data` (`"JSON payload (44375260 bytes)
    is larger than allowed (limit: 33554432 bytes)"`), not in the top-level `Bad Request`.
  - *Diagnosis tip:* this shares the `fetch failed` symptom with the 2026-07-08 undici gotcha but
    is a different cause. Read the client error's `data` (Qdrant size limit) and `err.cause`
    (undici dispatcher) before assuming either.
  - *Why it was latent:* MiniLM's 384-dim vectors made a ~24 MB request, just under the limit;
    doubling the vector width exposed a bug that was never model-specific.
  - *Fix:* batch the upsert (`UPSERT_BATCH_SIZE = 128` in `src/store.ts`) so no single request is
    oversized.
  - *Also observed:* deleting a collection and immediately re-creating it can race (Qdrant returns
    `Bad Request: Collection data already exists`); retry the create if it happens.
