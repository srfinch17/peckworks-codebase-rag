import Anthropic from "@anthropic-ai/sdk";
import { config, requireAnthropicKey } from "./config.js";
import { retrieve } from "./retrieve.js";
import { RagAnswerSchema, type RagAnswer, type RetrievedChunk } from "./types.js";
import { logEvent } from "./log.js";

/**
 * STEP 5 - ANSWER (grounded + cited). Retrieve, then ask Claude to answer using ONLY the
 * retrieved chunks and cite what it used (path + startLine + exact quote). The model returns
 * JSON we Zod-validate.
 *
 * Guardrail: if retrieval is weak (top score < config.minScore) we refuse instead of letting
 * the model invent code that isn't in the repo.
 */
const SYSTEM_PROMPT = `You answer questions about a codebase strictly from the provided context passages (source code and docs).
Rules:
- Use ONLY the passages. Do not use outside knowledge or invent APIs.
- If the passages do not contain the answer, say so plainly and set confidence to "low".
- Cite the passages you used: their path + startLine, with the exact supporting quote.
Respond with ONLY a JSON object of this shape (no prose, no markdown fences):
{"answer": string, "citations": [{"path": string, "startLine": number, "quote": string}], "confidence": "high" | "medium" | "low"}`;

export interface AnswerResult {
  answer: RagAnswer;
  retrieved: RetrievedChunk[];
  refused: boolean;
}

/** Format retrieved chunks into a context block the model can read and cite. */
function buildContext(chunks: RetrievedChunk[]): string {
  return chunks.map((c) => `[${c.path}:${c.startLine}]\n${c.text}`).join("\n\n---\n\n");
}

/** Pull the JSON out of the model's reply, tolerating stray markdown code fences. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1]!.trim() : trimmed;
}

/**
 * Parse and validate the model's reply into a RagAnswer. Returns null (never throws) if the
 * reply is malformed JSON or does not match the schema, so the caller can refuse gracefully.
 */
export function tryParseAnswer(raw: string): RagAnswer | null {
  try {
    return RagAnswerSchema.parse(JSON.parse(extractJson(raw)));
  } catch {
    return null;
  }
}

export async function answerQuestion(repo: string, question: string): Promise<AnswerResult> {
  const retrieved = await retrieve(repo, question);
  const topScore = retrieved[0]?.score ?? 0;

  // Refusal guardrail: nothing retrieved, or the best match is too weak. Refuse BEFORE
  // spending an API call, so a question the codebase can't answer is also a cheap one.
  if (retrieved.length === 0 || topScore < config.minScore) {
    logEvent("answer", { repo, question, refused: true, topScore });
    return {
      answer: {
        answer: "I don't have enough in this codebase to answer that confidently.",
        citations: [],
        confidence: "low",
      },
      retrieved,
      refused: true,
    };
  }

  const client = new Anthropic({ apiKey: requireAnthropicKey() });
  const context = buildContext(retrieved);
  const message = await client.messages.create({
    model: config.answerModel,
    max_tokens: config.answerMaxTokens,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: `Context passages:\n\n${context}\n\nQuestion: ${question}` },
    ],
  });

  // The reply is untrusted external data: extract the text, then parse+validate defensively.
  const raw = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const answer = tryParseAnswer(raw);

  // Zod detected a malformed reply. Refuse gracefully instead of crashing.
  if (!answer) {
    logEvent("answer", { repo, question, refused: true, reason: "unparseable-reply", topScore });
    return {
      answer: {
        answer:
          "I found relevant code but couldn't produce a valid structured answer. Try rephrasing the question.",
        citations: [],
        confidence: "low",
      },
      retrieved,
      refused: true,
    };
  }

  logEvent("answer", {
    repo,
    question,
    refused: false,
    topScore,
    confidence: answer.confidence,
    citations: answer.citations.length,
  });
  return { answer, retrieved, refused: false };
}
