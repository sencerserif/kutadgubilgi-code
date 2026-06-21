import { NextRequest } from "next/server";
import type { ProviderId } from "@/types";
import { PROVIDERS } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface StreamBody {
  provider: ProviderId;
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: StreamBody = await req.json();
    const { provider, model, messages, apiKey, temperature, maxTokens, systemPrompt } = body;

    if (!provider || !model) {
      return new Response("Provider ve model gerekli", { status: 400 });
    }

    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      return new Response(`Bilinmeyen sağlayıcı: ${provider}`, { status: 400 });
    }

    if (provider !== "ollama" && !apiKey) {
      return new Response(`${providerConfig.name} API anahtarı gerekli`, { status: 401 });
    }

    const finalMessages = [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      ...messages,
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send({ type: "start", provider, model });

          if (provider === "openai" || provider === "deepseek" || provider === "xai" || provider === "openrouter" || provider === "zhipu" || provider === "perplexity" || provider === "mistral" || provider === "together") {
            await streamOpenAICompatible(
              providerConfig.baseUrl,
              model,
              finalMessages,
              apiKey,
              temperature,
              maxTokens,
              send,
              provider === "openrouter"
            );
          } else if (provider === "anthropic") {
            await streamAnthropic(
              providerConfig.baseUrl,
              model,
              finalMessages,
              apiKey,
              providerConfig.apiVersion!,
              temperature,
              maxTokens,
              send
            );
          } else if (provider === "google") {
            await streamGoogle(
              providerConfig.baseUrl,
              model,
              finalMessages,
              apiKey,
              temperature,
              maxTokens,
              send
            );
          } else if (provider === "cohere") {
            await streamCohere(
              providerConfig.baseUrl,
              model,
              finalMessages,
              apiKey,
              temperature,
              maxTokens,
              send
            );
          } else if (provider === "ollama") {
            await streamOllama(
              providerConfig.baseUrl,
              model,
              finalMessages,
              temperature,
              maxTokens,
              send
            );
          }

          send({ type: "done" });
        } catch (err) {
          send({
            type: "error",
            error: err instanceof Error ? err.message : "Bilinmeyen hata",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return new Response(message, { status: 500 });
  }
}

async function streamOpenAICompatible(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  temperature: number | undefined,
  maxTokens: number | undefined,
  send: (data: Record<string, unknown>) => void,
  isRouter: boolean
) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(isRouter && {
        "HTTP-Referer": "https://kutadgubilgi.app",
        "X-Title": "Kutadgubilgi Code",
      }),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    throw new Error(`API hatası ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content ?? "";
        if (delta) send({ type: "delta", content: delta });
        if (parsed.usage) {
          send({
            type: "usage",
            tokensIn: parsed.usage.prompt_tokens ?? 0,
            tokensOut: parsed.usage.completion_tokens ?? 0,
          });
        }
      } catch {
        // skip
      }
    }
  }
}

async function streamAnthropic(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  apiVersion: string,
  temperature: number | undefined,
  maxTokens: number | undefined,
  send: (data: Record<string, unknown>) => void
) {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const res = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": apiVersion,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens ?? 4096,
      temperature: temperature ?? 0.7,
      system: systemMsg?.content,
      messages: chatMessages,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    throw new Error(`Anthropic hatası ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          send({ type: "delta", content: parsed.delta.text });
        }
        if (parsed.type === "message_start" && parsed.message?.usage) {
          send({ type: "usage", tokensIn: parsed.message.usage.input_tokens ?? 0, tokensOut: 0 });
        }
        if (parsed.type === "message_delta" && parsed.usage) {
          send({ type: "usage", tokensIn: 0, tokensOut: parsed.usage.output_tokens ?? 0 });
        }
      } catch {
        // skip
      }
    }
  }
}

async function streamGoogle(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  temperature: number | undefined,
  maxTokens: number | undefined,
  send: (data: Record<string, unknown>) => void
) {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  // Thinking modelleri için özel config
  const isThinkingModel = model.includes("thinking") || model.includes("2.5");
  const generationConfig: Record<string, unknown> = {
    temperature: temperature ?? 0.7,
    maxOutputTokens: maxTokens ?? 8192,
  };

  // Thinking modelleri için thinkingConfig
  if (isThinkingModel) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  let res: Response;
  try {
    res = await fetch(
      `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: chatMessages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
          generationConfig,
        }),
      }
    );
  } catch (err) {
    throw new Error(
      `Google API bağlantı hatası: ${err instanceof Error ? err.message : "bilinmiyor"}. İnternet bağlantınızı veya API key'i kontrol edin.`
    );
  }

  if (!res.ok || !res.body) {
    const errText = await res.text();
    let errorMsg = `Google API hatası ${res.status}`;
    try {
      const errData = JSON.parse(errText);
      if (errData.error?.message) {
        errorMsg += `: ${errData.error.message}`;
      } else {
        errorMsg += `: ${errText.slice(0, 300)}`;
      }
    } catch {
      errorMsg += `: ${errText.slice(0, 300)}`;
    }
    throw new Error(errorMsg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        // Hata kontrolü
        if (parsed.error) {
          send({ type: "error", error: parsed.error.message ?? "Google API hatası" });
          continue;
        }
        const parts = parsed.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) {
          if (p.text) send({ type: "delta", content: p.text });
          // Thinking modelleri için thought flag
          if (p.thought && p.text) {
            send({ type: "reasoning", content: p.text });
          }
        }
        if (parsed.usageMetadata) {
          send({
            type: "usage",
            tokensIn: parsed.usageMetadata.promptTokenCount ?? 0,
            tokensOut: parsed.usageMetadata.candidatesTokenCount ?? 0,
          });
        }
      } catch {
        // JSON parse hatası - skip
      }
    }
  }
}

async function streamOllama(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number | undefined,
  maxTokens: number | undefined,
  send: (data: Record<string, unknown>) => void
) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: { temperature: temperature ?? 0.7, num_predict: maxTokens ?? 4096 },
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    throw new Error(`Ollama hatası ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.message?.content) send({ type: "delta", content: parsed.message.content });
        if (parsed.done) {
          send({
            type: "usage",
            tokensIn: parsed.prompt_eval_count ?? 0,
            tokensOut: parsed.eval_count ?? 0,
          });
        }
      } catch {
        // skip
      }
    }
  }
}

// Cohere streaming
async function streamCohere(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  temperature: number | undefined,
  maxTokens: number | undefined,
  send: (data: Record<string, unknown>) => void
) {
  const res = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    throw new Error(`Cohere hatası ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content-delta" && parsed.delta?.message?.content?.text) {
          send({ type: "delta", content: parsed.delta.message.content.text });
        }
        if (parsed.type === "message-end" && parsed.delta?.usage) {
          send({
            type: "usage",
            tokensIn: parsed.delta.usage.billed_units?.input_tokens ?? 0,
            tokensOut: parsed.delta.usage.billed_units?.output_tokens ?? 0,
          });
        }
      } catch {
        // skip
      }
    }
  }
}
