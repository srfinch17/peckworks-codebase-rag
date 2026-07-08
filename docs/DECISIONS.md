# DECISIONS - peckworks-codebase-rag

A running log of forks and why we took them. Deliberately captured as source material for
the future "RAG-ify a repo" skill (P4). Every entry records a design question and its answer.

## 2026-06-20 - initial design

- **Generic tool, one collection per repo - not a repo per codebase.**
  *Why:* "per-codebase" is the data (a Qdrant collection), not the code. Same shape as
  clipmeta: one tool, many MP4s - never a recompiled binary per clip. Avoids N drifting
  copies of identical pipeline code, which is the opposite of the abstraction and reuse
  this design aims for.
  *Considered & rejected:* `peckworks-rag-clipmeta`, `peckworks-rag-budget`, … (the
  first instinct). Rejected for the drift/duplication reason above.

- **Reuse `peckworks-rag-lab` in a new repo - don't rewrite, don't mutate the lab.**
  *Why:* the lab stays a clean, single-purpose *document-RAG* project; this repo
  lifts its proven pipeline and adds a code-aware front end. Same TS stack, so fixes can
  flow both ways.
  *Considered & rejected:* (a) growing the lab in place - blurs its crisp story; (b)
  starting from scratch - throws away working code.

- **TypeScript, not a C#/.NET rewrite.**
  *Why:* reuses the lab's working code. clipmeta being C# is a non-issue: tree-sitter has a
  C# grammar that runs in Node, so a TS tool parses C# in Phase 2.
  *Considered & rejected:* a C#/.NET rewrite, rejected because
  it discards the proven pipeline for no retrieval benefit.

- **Qdrant stays; SQL Server Express set aside.**
  *Why:* Qdrant already works and is a better fit here.
  *Alternatives worth naming (not adopting):* `pgvector` on Postgres, SQL Server 2025 native
  `VECTOR` type. Switching stores would be churn with no goal.

- **Phased chunking: line-window baseline → tree-sitter symbol-aware, measured.**
  *Why:* ship a simple, language-agnostic baseline first, then prove the upgrade with a
  before/after eval. The measurement quantifies the improvement from symbol-aware chunking.

- **Corpus = source code + markdown docs, classified by extension.**
  *Why:* the goal is "help anyone understand / debug / set up." The *why* questions are
  answered in prose (CLAUDE.md, PITFALLS, specs); the *show me the code* questions in source.
  Extension allow-listing also excludes binaries for free.

- **First target: clipmeta.**
  *Why:* it's unusually doc-rich (CLAUDE.md, PITFALLS, dated specs, PRISTINE-MANIFEST), i.e.
  excellent retrieval fuel, and it's a codebase we know well, so we can judge whether the
  answers are actually right.

## 2026-07-08 - local web UI (a second front door)

- **A local web UI, added as a second thin front door - not a rewrite, not a separate repo.**
  *Why:* better UX than the CLI, usable as a personal tool, and screenshot-friendly for a static
  showcase. It reuses the exact pipeline modules the CLI uses (`answerQuestion`, `retrieve`); the
  server is a dumb adapter, mirroring `cli/index.ts`.
  *Considered & rejected:* a framework + build step (React/Vite), overkill for a local single-page
  tool; a separate repo, which throws away the reuse that is the whole point.

- **Query-only in v1; ingest stays a CLI command.**
  *Why:* indexing is long-running; querying is the daily-use, screenshot-worthy part. Keeps v1 small.

- **The Anthropic key stays server-side; the browser never sees it.**
  *Why:* a key in browser-shipped code is world-readable and would be abused. This is also why a
  static, backend-less page was not an option: the answer step needs the key and the embedder runs in
  Node, so a small local server is required. A public demo, if ever wanted, is a static showcase
  (screenshots + example Q&A), not a live keyed site.

- **Per-repo tuning knobs persisted server-side (`data/settings.json`), not in the browser.**
  *Why:* the ideal `topK` / `minScore` is a fact about a repo, not a browser preference, so it lives
  with the server keyed by repo and carries across browsers on the machine. `localStorage` was
  considered and rejected for being per-browser and not per-repo.

## Out of scope for now (parked, with reasons)
- GraphRAG / Neo4j, reranking, hybrid (keyword+vector) search, hosted embeddings.
  *Why parked:* none are needed to get a working, useful tool; each is a natural "what's next"
  extension. Add only when a measured need appears.
