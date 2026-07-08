# codebase RAG

Ask natural-language questions about a codebase and get grounded, cited answers, or an honest
"I don't know" when the code doesn't contain the answer. Point it at a repository; it indexes the
source and docs into a searchable vector store, and every answer comes back with `path:line`
citations you can verify. A refusal guardrail keeps it from inventing code that isn't there.

One tool, many repositories: each repo gets its own isolated index (one Qdrant collection per repo).

## How it works

A five-stage pipeline, each stage an isolated, swappable module:

**chunk -> embed -> store -> retrieve -> answer**

- **chunk** - source is split into line windows, so a citation points at a real `path:line`; prose
  is split into character windows.
- **embed** - a local MiniLM model turns each chunk into a 384-dimension vector. Runs offline; no
  code leaves the machine at index time.
- **store** - vectors go into Qdrant, one collection per repository.
- **retrieve** - the question is embedded the same way, and the nearest chunks by cosine similarity
  are pulled back.
- **answer** - the model answers strictly from the retrieved chunks and cites them. If the best
  match is too weak, it refuses instead of guessing.

## Run it

Prereqs: Node, Docker, and an Anthropic API key in `.env` (copy `.env.example`). Indexing and
embedding run locally and offline; only the answer step calls the API.

```bash
docker compose up -d                                 # start Qdrant (the vector store)
npm install
npm test                                             # unit tests

# index a repository
npm run ingest -- --repo <name> --dir <path-to-repo>

# ask questions from the terminal
npm run ask -- --repo <name> "how does X work?"

# or use the local web UI
npm run web                                          # http://127.0.0.1:5175
```

## Web UI

`npm run web` serves a local single-page interface: a repository picker, an ask box, answers with
clickable citations that expand to show the retrieved code, and a retrieval panel that plots each
chunk's similarity score against the refusal threshold. Two live-tunable knobs, retrieval breadth
(`topK`) and the refusal floor (`minScore`), are saved per repository. The Anthropic key stays on
the local server and is never sent to the browser.

## Design

The pipeline modules are the product; the CLI and the web UI are thin front doors over them. Every
tunable parameter lives in one place (`src/config.ts`). See `docs/DECISIONS.md` for why the design
is what it is, and `docs/PITFALLS.md` for the gotchas worth knowing.

## License

ISC
