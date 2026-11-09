// ====================================================================
// AI abstraction layer. Nothing else in the codebase should import a
// provider SDK directly — always go through `complete()` here, so
// swapping OpenRouter <-> OpenAI <-> Anthropic <-> Gemini is a one-file
// change. Provider is selected by AI_PROVIDER env var, defaulting to
// OpenRouter (matches the pattern used in other Sithelo Holdings
// projects — cheap multi-model fallback without vendor lock-in).
//
// SERVER-ONLY: provider API keys are read from non-public env vars, so
// this module must never end up in a client bundle — `server-only`
// enforces that at build time instead of by convention.
// ====================================================================
import "server-only";

export type AiProvider = "openrouter" | "openai" | "anthropic" | "gemini" | "deepseek";

export interface CompleteOptions {
  system?: string;
  prompt: string;
  model?: string; // provider-specific model id; sensible default per provider if omitted
  maxTokens?: number;
  temperature?: number;
}

export interface CompleteResult {
  text: string;
  provider: AiProvider;
  model: string;
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openrouter: "qwen/qwen-2.5-72b-instruct", // non-thinking instruct variant — see Ubulula's lesson on reasoning-model timeouts
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-2.0-flash",
  deepseek: "deepseek-chat", // OpenAI-compatible, non-thinking chat model
};

// Every provider call is bounded — a hung provider must not hold the
// request (and server resources) open indefinitely.
const AI_REQUEST_TIMEOUT_MS = 30_000;

export async function complete(opts: CompleteOptions): Promise<CompleteResult> {
  const provider = (process.env.AI_PROVIDER as AiProvider) || "openrouter";
  const model = opts.model ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "openrouter":
      return callOpenRouter(opts, model);
    case "openai":
      return callOpenAI(opts, model);
    case "anthropic":
      return callAnthropic(opts, model);
    case "gemini":
      return callGemini(opts, model);
    case "deepseek":
      return callDeepSeek(opts, model);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

async function callOpenRouter(opts: CompleteOptions, model: string): Promise<CompleteResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.prompt },
      ],
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  // Status-only error: provider bodies can echo prompt content, which must
  // never surface to a caller through error.message.
  if (!res.ok) throw new Error(`OpenRouter error: status ${res.status}`);
  const data = await res.json();
  return { text: data.choices[0].message.content, provider: "openrouter", model };
}

async function callOpenAI(opts: CompleteOptions, model: string): Promise<CompleteResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.prompt },
      ],
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: status ${res.status}`);
  const data = await res.json();
  return { text: data.choices[0].message.content, provider: "openai", model };
}

async function callAnthropic(opts: CompleteOptions, model: string): Promise<CompleteResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: status ${res.status}`);
  const data = await res.json();
  return { text: data.content[0].text, provider: "anthropic", model };
}

async function callGemini(opts: CompleteOptions, model: string): Promise<CompleteResult> {
  // Key sent via x-goog-api-key header, not a query param — query-string
  // keys are logged by proxies/access logs far more readily than headers.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${opts.system ? opts.system + "\n\n" : ""}${opts.prompt}` }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: status ${res.status}`);
  const data = await res.json();
  return { text: data.candidates[0].content.parts[0].text, provider: "gemini", model };
}

async function callDeepSeek(opts: CompleteOptions, model: string): Promise<CompleteResult> {
  // DeepSeek exposes an OpenAI-compatible chat-completions endpoint.
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.prompt },
      ],
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek error: status ${res.status}`);
  const data = await res.json();
  return { text: data.choices[0].message.content, provider: "deepseek", model };
}
