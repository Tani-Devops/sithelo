// ====================================================================
// AI abstraction layer. Nothing else in the codebase should import a
// provider SDK directly — always go through `complete()` here, so
// swapping OpenRouter <-> OpenAI <-> Anthropic <-> Gemini is a one-file
// change. Provider is selected by AI_PROVIDER env var, defaulting to
// OpenRouter (matches the pattern used in other Sithelo Holdings
// projects — cheap multi-model fallback without vendor lock-in).
// ====================================================================

export type AiProvider = "openrouter" | "openai" | "anthropic" | "gemini";

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
};

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
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

async function callOpenRouter(opts: CompleteOptions, model: string): Promise<CompleteResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
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
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { text: data.choices[0].message.content, provider: "openrouter", model };
}

async function callOpenAI(opts: CompleteOptions, model: string): Promise<CompleteResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
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
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { text: data.choices[0].message.content, provider: "openai", model };
}

async function callAnthropic(opts: CompleteOptions, model: string): Promise<CompleteResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
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
  if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { text: data.content[0].text, provider: "anthropic", model };
}

async function callGemini(opts: CompleteOptions, model: string): Promise<CompleteResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${opts.system ? opts.system + "\n\n" : ""}${opts.prompt}` }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { text: data.candidates[0].content.parts[0].text, provider: "gemini", model };
}
