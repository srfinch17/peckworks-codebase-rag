"use strict";

// Thin client for the local codebase-RAG UI. It only talks to this app's own server (which holds
// the Anthropic key). Everything here is fetch plumbing plus rendering the answer and the retrieval
// meter.

const $ = (id) => document.getElementById(id);
const repoSel = $("repo");
const conn = $("conn");
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

// Small DOM helpers so rendered content is built from nodes, never innerHTML with server strings.
const div = (cls) => {
  const el = document.createElement("div");
  el.className = cls;
  return el;
};
const span = (cls, text) => {
  const el = document.createElement("span");
  el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};
const pct = (x) => Math.max(0, Math.min(100, x * 100)) + "%";

// Parse a constant (non-user) SVG string into a node. Only used with literals defined here.
const CITE_ICON =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="7,7 3,10 7,13"/><polyline points="13,7 17,10 13,13"/></svg>';
function svgEl(str) {
  const t = document.createElement("template");
  t.innerHTML = str.trim();
  return t.content.firstChild;
}

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
  conn.classList.add("ok");
  conn.title = "connected to the local server";
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
    confidenceEl.textContent = "no answer";
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
    chip.append(svgEl(CITE_ICON), document.createTextNode(`${c.path}:${c.startLine}`));

    const body = document.createElement("pre");
    body.className = "cite-body";
    body.hidden = true;
    body.textContent = matchChunkText(result, c);
    chip.addEventListener("click", () => {
      body.hidden = !body.hidden;
    });

    const wrap = div("cite-wrap");
    wrap.append(chip, body);
    citationsEl.appendChild(wrap);
  }
}

function renderRetrieval(result) {
  retrievalPanel.hidden = false;
  const { minScore } = currentKnobs();
  retrievalEl.replaceChildren();

  if (result.retrieved.length === 0) {
    const p = div("empty");
    p.textContent = "Nothing was retrieved for this question.";
    retrievalEl.appendChild(p);
    return;
  }

  for (const r of result.retrieved) {
    const above = r.score >= minScore;
    const row = div("hit " + (above ? "above" : "below"));

    const meta = div("hit-meta");
    const path = span("hit-path", `${r.path}:${r.startLine}`);
    path.title = `${r.path}:${r.startLine}`;
    meta.append(span("hit-score", r.score.toFixed(3)), path, span("hit-tag", above ? "above" : "below"));

    const track = div("hit-track");
    const fill = div("hit-fill");
    fill.style.width = pct(r.score);
    const thresh = div("hit-thresh");
    thresh.style.left = pct(minScore);
    track.append(fill, thresh);

    row.append(meta, track);
    retrievalEl.appendChild(row);
  }

  // Axis with the minScore floor marked where it actually sits on the 0..1 scale.
  const scale = div("meter-scale");
  const mark = div("scale-mark");
  mark.style.left = pct(minScore);
  mark.append(div("scale-tick"), span("scale-lab", `min ${minScore.toFixed(2)}`));
  scale.append(span("scale-end", "0.0"), mark, span("scale-end right", "1.0"));
  retrievalEl.appendChild(scale);
}

async function ask() {
  const question = questionEl.value.trim();
  if (!question) return;
  lastQuestion = question;
  setStatus("Retrieving the most relevant code", "loading");
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
    setStatus("Something went wrong: " + e.message, "error");
  } finally {
    askBtn.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  ask();
});

repoSel.addEventListener("change", () => {
  loadSettings().catch((e) => setStatus("Could not load settings: " + e.message, "error"));
});

for (const chip of document.querySelectorAll(".chip")) {
  chip.addEventListener("click", () => {
    questionEl.value = chip.dataset.q || "";
    questionEl.focus();
    ask();
  });
}

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

loadRepos().catch((e) => {
  conn.classList.add("bad");
  conn.title = "cannot reach the local server";
  setStatus("Could not reach the server. Is `npm run web` running? " + e.message, "error");
});
