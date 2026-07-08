"use strict";

// Thin client for the local RAG web UI. It only talks to this app's own server; the server holds
// the Anthropic key. Everything here is rendering + fetch plumbing.

const $ = (id) => document.getElementById(id);
const repoSel = $("repo");
const form = $("ask-form");
const questionEl = $("question");
const askBtn = $("ask-btn");
const statusEl = $("status");
const answerPanel = $("answer-panel");
const answerText = $("answer-text");
const confidenceEl = $("confidence");
const citationsEl = $("citations");
const retrievalPanel = $("retrieval-panel");
const retrievalEl = $("retrieval");
const topkEl = $("topk");
const topkVal = $("topk-val");
const minscoreEl = $("minscore");
const minscoreVal = $("minscore-val");

let lastQuestion = "";

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function setStatus(msg, kind) {
  if (!msg) {
    statusEl.hidden = true;
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = msg;
  statusEl.className = "status " + (kind || "");
}

function currentKnobs() {
  return { topK: Number(topkEl.value), minScore: Number(minscoreEl.value) };
}

function syncKnobReadouts() {
  topkVal.textContent = topkEl.value;
  minscoreVal.textContent = Number(minscoreEl.value).toFixed(2);
}

async function loadRepos() {
  const { repos, lastRepo } = await fetchJson("/repos");
  repoSel.replaceChildren();
  for (const r of repos) {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    repoSel.appendChild(opt);
  }
  if (repos.length === 0) {
    setStatus("No indexed repos yet. Run `npm run ingest` first, then reload.", "warn");
    askBtn.disabled = true;
    return;
  }
  repoSel.value = lastRepo && repos.includes(lastRepo) ? lastRepo : repos[0];
  await loadSettings();
}

async function loadSettings() {
  const repo = repoSel.value;
  const { topK, minScore } = await fetchJson(`/settings?repo=${encodeURIComponent(repo)}`);
  topkEl.value = String(topK);
  minscoreEl.value = String(minScore);
  syncKnobReadouts();
}

let saveTimer = null;
function persistKnobsDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetchJson("/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: repoSel.value, ...currentKnobs() }),
    }).catch(() => {
      /* persisting is best-effort; a failed save should not interrupt the user */
    });
  }, 400);
}

// Find the retrieved chunk a citation points into, so clicking a citation reveals real context.
function matchChunkText(result, citation) {
  const inRange = result.retrieved.find(
    (r) =>
      r.path === citation.path &&
      citation.startLine >= r.startLine &&
      citation.startLine <= r.endLine
  );
  const samePath = result.retrieved.find((r) => r.path === citation.path);
  return (inRange || samePath || {}).text || citation.quote || "";
}

function renderAnswer(result) {
  answerPanel.hidden = false;
  answerText.textContent = result.answer;
  if (result.refused) {
    confidenceEl.textContent = "refused";
    confidenceEl.className = "badge refused";
  } else {
    confidenceEl.textContent = result.confidence;
    confidenceEl.className = "badge conf-" + result.confidence;
  }

  citationsEl.replaceChildren();
  for (const c of result.citations) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cite";
    chip.textContent = `${c.path}:${c.startLine}`;

    const body = document.createElement("pre");
    body.className = "cite-body";
    body.hidden = true;
    body.textContent = matchChunkText(result, c);
    chip.addEventListener("click", () => {
      body.hidden = !body.hidden;
    });

    const wrap = document.createElement("div");
    wrap.className = "cite-wrap";
    wrap.append(chip, body);
    citationsEl.appendChild(wrap);
  }
}

function renderRetrieval(result) {
  retrievalPanel.hidden = false;
  const { minScore } = currentKnobs();
  retrievalEl.replaceChildren();

  if (result.retrieved.length === 0) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Nothing was retrieved for this question.";
    retrievalEl.appendChild(p);
    return;
  }

  for (const r of result.retrieved) {
    const above = r.score >= minScore;
    const row = document.createElement("div");
    row.className = "hit " + (above ? "above" : "below");

    const score = document.createElement("span");
    score.className = "hit-score";
    score.textContent = r.score.toFixed(3);

    const path = document.createElement("span");
    path.className = "hit-path";
    path.textContent = `${r.path}:${r.startLine}`;
    path.title = path.textContent;

    const bar = document.createElement("span");
    bar.className = "hit-bar";
    const fill = document.createElement("span");
    fill.className = "hit-fill";
    fill.style.width = Math.max(0, Math.min(100, r.score * 100)) + "%";
    bar.appendChild(fill);

    const flag = document.createElement("span");
    flag.className = "hit-flag";
    flag.textContent = above ? "above" : "below";

    row.append(score, path, bar, flag);
    retrievalEl.appendChild(row);
  }

  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = `minScore line ${minScore.toFixed(2)}  (top score ${result.retrieved[0].score.toFixed(3)})`;
  retrievalEl.appendChild(note);
}

async function ask() {
  const question = questionEl.value.trim();
  if (!question) return;
  lastQuestion = question;
  setStatus("Thinking...", "loading");
  askBtn.disabled = true;
  try {
    const result = await fetchJson("/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: repoSel.value, question, ...currentKnobs() }),
    });
    setStatus(null);
    renderAnswer(result);
    renderRetrieval(result);
  } catch (e) {
    setStatus("Error: " + e.message, "error");
  } finally {
    askBtn.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  ask();
});

repoSel.addEventListener("change", () => {
  loadSettings().catch((e) => setStatus("Failed to load settings: " + e.message, "error"));
});

for (const el of [topkEl, minscoreEl]) {
  el.addEventListener("input", () => {
    syncKnobReadouts();
    persistKnobsDebounced();
  });
  // On release, re-run the current question so the effect of tuning is immediately visible.
  el.addEventListener("change", () => {
    if (lastQuestion) ask();
  });
}

loadRepos().catch((e) => setStatus("Failed to load repos: " + e.message, "error"));
