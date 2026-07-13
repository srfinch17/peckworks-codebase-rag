# DECISIONS - peckworks-codebase-rag

A running log of the design forks and why we took them. Each entry records a design question
and the answer we chose.

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
  answered in prose (README, PITFALLS, the decisions log); the *show me the code* questions in source.
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

## 2026-07-09 - retrieval evaluation (a measured baseline)

- **Grade retrieval, not answer text, and do it without the model.**
  *Why:* the question this eval answers is "does the right code come back," which is exactly what
  chunking and embedding choices change. Both the hit check and the refusal check are computable
  from retrieval output plus the `minScore` threshold, with no API call, so a run is free,
  deterministic, and repeatable - the properties a baseline needs to be trustworthy across runs.
  *Considered & rejected:* a full-pipeline eval that calls the model and grades the prose answer;
  rejected as nondeterministic, paid, and adding no signal for the variable under test.

- **Hand-validated golden set as ground truth.**
  *Why:* the expected file for each question must come from someone who knows the code, not from
  the RAG's own output. Grading a tool against its own answers is circular and would score near
  100% while meaning nothing. Candidates were drafted from the target repo's real source and
  validated by hand.

- **File-level hit matching, plus MRR and refusal-accuracy.**
  *Why:* file-level matching is robust to chunk boundaries shifting between runs; MRR adds ranking
  resolution that a pass/fail hit-rate throws away; refusal-accuracy grades the guardrail.

- **First baseline, and what it surfaced (clipmeta, topK=8, minScore=0.25).**
  Baseline hit-rate was 11.1% (2 of 18). Inspecting the misses revealed the cause: with a
  text-tuned embedding model, natural-language questions retrieve the prose that *describes* the
  code (design docs, READMEs) ahead of the code itself. Restricting retrieval to code chunks
  (`--code-only`) raised hit-rate to 61.1% (11 of 18), confirming the code was being outranked
  rather than being unreachable. That flag is a diagnostic, not a general fix (it would hurt
  questions whose answer genuinely lives in prose); the finding is what motivates code-tuned
  embeddings and symbol-aware chunking, both now measurable against this baseline. Separately,
  every should-refuse question scored above 0.25, so the refusal floor is set too low and needs
  raising.

## 2026-07-10 - refusal floor tuning (minScore 0.25 -> 0.57)

- **Raise the floor to 0.57 - the best point on a tradeoff curve, not a clean separator.**
  *Why:* the 2026-07-09 baseline showed every should-refuse question scoring 0.56-0.64, sitting
  inside the answerable range (0.50-0.82). The two score groups overlap, so no single floor
  separates them: any floor high enough to reject the unanswerable questions also rejects some
  real answers (a "false refusal"). Reading the per-question scores, 0.57 is the one point that
  catches the two weakest false-premise questions for a single false refusal; below it nothing is
  caught, and above it real answers are lost faster than fakes (a 0.65 floor would refuse all 4
  but wrongly reject 6 of 18 answerable questions). Re-running the eval confirmed the move:
  refusals 0/4 -> 2/4, hit-rate unchanged at 11.1% (the floor affects only the answer/refuse
  decision, not what is retrieved), with one answerable question now wrongly refused.
  *Considered & rejected:* a 0.65 floor to force 4/4 refusals, rejected for the 6 false refusals
  it costs; leaving 0.25, rejected because it refuses nothing.

- **The overlap is the finding: a threshold cannot fix what the embedding model cannot separate.**
  *Why:* the same text-tuned model that ranks prose above code (the 11% baseline) also scores
  unanswerable questions as highly as answerable ones, because the corpus prose mentions features
  the code does not implement. Pulling the two score groups apart requires a code-tuned embedding
  model, not a better threshold. This tuning is the honest ceiling of the current model and the
  measured motivation for that swap.

## 2026-07-10 - code-tuned embeddings (jina-embeddings-v2-base-code)

- **Swap the text-tuned local embedder (MiniLM) for a free, code-tuned local one - not the paid
  cloud voyage-code-3 the roadmap named.**
  *Why:* the 11% baseline was caused by a text-tuned model ranking prose above code, so a code-tuned
  model is the targeted fix. Two constraints decided which one: cost had to be $0, and privacy was
  moot (the target repos are public), which removed the only reason to prefer cloud. That points to a
  free, open, code-tuned model that runs locally. `jinaai/jina-embeddings-v2-base-code` (Apache-2.0,
  trained on ~150M docstring-to-code pairs, 30+ languages including C#) fits, and runs in the same
  `@xenova/transformers` pipeline the local MiniLM used, so the swap is a config change plus a
  dimension bump (384 -> 768) and a re-ingest.
  *Considered & rejected:* voyage-code-3 (paid, cloud, needs a key - no benefit over a free local
  model for a public repo); a stronger general model such as EmbeddingGemma (not code-specific);
  training a model (months of work to reproduce what is freely available).

- **Result: hit-rate 11.1% -> 61.1%, MRR 0.069 -> 0.425 on the clipmeta golden set.**
  *Why it matters:* the all-types hit-rate rose to exactly the level MiniLM reached only when
  retrieval was artificially restricted to code (`--code-only`, 61.1%), confirming the prediction
  that the text model had been drowning code under the prose that describes it. The "no code leaves
  the machine" property is preserved, because jina runs locally too.

- **One model embeds both code and docs; a two-model (code + text) design is parked.**
  *Why:* retrieval compares a question's vector to stored vectors by cosine distance, which is only
  meaningful within one model's vector space, so a single collection must use a single model. jina
  handles English (it is English + code), so it embeds the markdown docs acceptably. A two-model
  design (separate indexes, dual query embedding, score fusion) is more machinery than the gain
  justifies now; revisit only if prose-answered questions regress.

- **Refusal by similarity threshold is a dead end here, even with the better model.**
  *Why:* jina lifted all scores, but the answerable (0.61-0.85) and should-refuse (0.63-0.69) ranges
  still overlap, because an unanswerable question still retrieves moderately similar real code.
  `minScore` is kept low (0.57) as a safety net against near-empty retrieval, not as a fake-question
  filter. The real refusal fix is a semantic judge ("do these passages actually answer the
  question?"), now a data-backed future item.

- **A latent bulk-upsert bug surfaced and was fixed at the source.**
  *Why:* `upsertChunks` sent all points in one request; 768-dim vectors pushed the body past Qdrant's
  32 MB limit. Fixed by batching the upsert (128 points per request) in `src/store.ts`, so any repo
  size and vector width is safe. See PITFALLS (2026-07-10).

## Out of scope for now (parked, with reasons)
- GraphRAG / Neo4j, reranking, hybrid (keyword+vector) search, hosted embeddings.
  *Why parked:* none are needed to get a working, useful tool; each is a natural "what's next"
  extension. Add only when a measured need appears.
