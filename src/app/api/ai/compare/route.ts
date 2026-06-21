import { NextRequest, NextResponse } from "next/server";
import type { ProviderId, CompareResult } from "@/types";
import { PROVIDERS } from "@/lib/providers";
import { getModel } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CompareBody {
  prompt: string;
  providers: Array<{ provider: ProviderId; model: string }>;
  apiKey: string;
  systemPrompt?: string;
  context?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CompareBody = await req.json();
    const { prompt, providers, systemPrompt, context } = body;

    if (!prompt || !providers?.length) {
      return NextResponse.json(
        { error: "Prompt ve en az 2 sağlayıcı gerekli" },
        { status: 400 }
      );
    }

    const apiKeys: Record<string, string> = body.apiKey
      ? (() => {
          try {
            return JSON.parse(body.apiKey) as Record<string, string>;
          } catch {
            return {};
          }
        })()
      : {};

    // Paralel çağrı
    const results = await Promise.allSettled(
      providers.map(async ({ provider, model }) => {
        const start = Date.now();
        try {
          const apiKey = apiKeys[provider] ?? "";
          const providerConfig = PROVIDERS[provider];

          if (provider !== "ollama" && !apiKey) {
            throw new Error(`${providerConfig.name} API anahtarı yok`);
          }

          const messages = [
            ...(systemPrompt
              ? [{ role: "system" as const, content: systemPrompt }]
              : []),
            ...(context
              ? [
                  {
                    role: "user" as const,
                    content: `[Context]\n${context}`,
                  },
                ]
              : []),
            { role: "user" as const, content: prompt },
          ];

          const res = await fetch(
            `${getBaseUrl(provider)}/chat/completions`,
            getFetchOptions(provider, model, messages, apiKey)
          );

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
          }

          const data = await res.json();
          const content = extractContent(provider, data);
          const tokensIn = extractTokensIn(provider, data);
          const tokensOut = extractTokensOut(provider, data);
          const modelInfo = getModel(provider, model);
          const cost =
            modelInfo ?
              (tokensIn / 1000) * modelInfo.inputCostPer1k +
              (tokensOut / 1000) * modelInfo.outputCostPer1k
            : 0;

          return {
            provider,
            model,
            content,
            tokensIn,
            tokensOut,
            cost,
            duration: Date.now() - start,
          } satisfies CompareResult;
        } catch (err) {
          return {
            provider,
            model,
            content: "",
            tokensIn: 0,
            tokensOut: 0,
            cost: 0,
            duration: Date.now() - start,
            error: err instanceof Error ? err.message : "Bilinmeyen hata",
          } satisfies CompareResult;
        }
      })
    );

    const final = results.map((r) =>
      r.status === "fulfilled" ? r.value : {
        provider: providers[0].provider,
        model: providers[0].model,
        content: "",
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
        duration: 0,
        error: r.reason?.message ?? "Promise rejected",
      }
    );

    return NextResponse.json({ results: final });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getBaseUrl(provider: ProviderId): string {
  return PROVIDERS[provider].baseUrl;
}

function getFetchOptions(
  provider: ProviderId,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string
): RequestInit {
  const providerConfig = PROVIDERS[provider];

  if (provider === "anthropic") {
    const systemMsg = messages.find((m) => m.role === "system");
    const chatMessages = messages.filter((m) => m.role !== "system");
    return {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": providerConfig.apiVersion!,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.7,
        system: systemMsg?.content,
        messages: chatMessages,
      }),
    };
  }

  if (provider === "google") {
    const systemMsg = messages.find((m) => m.role === "system");
    const chatMessages = messages.filter((m) => m.role !== "system");
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: chatMessages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        systemInstruction: systemMsg
          ? { parts: [{ text: systemMsg.content }] }
          : undefined,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    };
  }

  if (provider === "ollama") {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.7, num_predict: 4096 },
      }),
    };
  }

  if (provider === "cohere") {
    return {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    };
  }

  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(provider === "openrouter" && {
        "HTTP-Referer": "https://kutadgubilgi.app",
        "X-Title": "Kutadgubilgi Code",
      }),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  };
}

function extractContent(provider: ProviderId, data: unknown): string {
  const d = data as Record<string, unknown>;
  if (provider === "anthropic") {
    const content = d.content as Array<{ text?: string }> | undefined;
    return content?.map((c) => c.text).join("") ?? "";
  }
  if (provider === "google") {
    const candidates = d.candidates as
      | Array<{ content?: { parts?: Array<{ text?: string }> } }>
      | undefined;
    return candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  }
  if (provider === "ollama") {
    const msg = d.message as { content?: string } | undefined;
    return msg?.content ?? "";
  }
  if (provider === "cohere") {
    const msg = d.message as { content?: Array<{ text?: string }> } | undefined;
    return msg?.content?.[0]?.text ?? "";
  }
  const choices = d.choices as Array<{ message?: { content?: string } }> | undefined;
  return choices?.[0]?.message?.content ?? "";
}

function extractTokensIn(provider: ProviderId, data: unknown): number {
  const d = data as Record<string, unknown>;
  if (provider === "anthropic")
    return (d.usage as { input_tokens?: number })?.input_tokens ?? 0;
  if (provider === "google")
    return (d.usageMetadata as { promptTokenCount?: number })?.promptTokenCount ?? 0;
  if (provider === "ollama") return (d as { prompt_eval_count?: number }).prompt_eval_count ?? 0;
  if (provider === "cohere")
    return ((d.usage as { billed_units?: { input_tokens?: number } })?.billed_units?.input_tokens) ?? 0;
  return (d.usage as { prompt_tokens?: number })?.prompt_tokens ?? 0;
}

function extractTokensOut(provider: ProviderId, data: unknown): number {
  const d = data as Record<string, unknown>;
  if (provider === "anthropic")
    return (d.usage as { output_tokens?: number })?.output_tokens ?? 0;
  if (provider === "google")
    return (d.usageMetadata as { candidatesTokenCount?: number })?.candidatesTokenCount ?? 0;
  if (provider === "ollama") return (d as { eval_count?: number }).eval_count ?? 0;
  if (provider === "cohere")
    return ((d.usage as { billed_units?: { output_tokens?: number } })?.billed_units?.output_tokens) ?? 0;
  return (d.usage as { completion_tokens?: number })?.completion_tokens ?? 0;
}
