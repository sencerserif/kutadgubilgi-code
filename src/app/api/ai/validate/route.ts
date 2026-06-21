import { NextRequest, NextResponse } from "next/server";
import type { ProviderId } from "@/types";
import { PROVIDERS } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

interface ValidateBody {
  provider: ProviderId;
  apiKey: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ValidateBody = await req.json();
    const { provider, apiKey } = body;

    if (!provider) {
      return NextResponse.json({ error: "Provider gerekli" }, { status: 400 });
    }

    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      return NextResponse.json({ error: "Bilinmeyen sağlayıcı" }, { status: 400 });
    }

    if (provider === "ollama") {
      try {
        const res = await fetch(`${providerConfig.baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          return NextResponse.json({
            valid: false,
            error: `Ollama çalışmıyor (${res.status})`,
          });
        }
        const data = await res.json();
        return NextResponse.json({
          valid: true,
          models: (data.models ?? []).map((m: { name: string }) => m.name),
        });
      } catch {
        return NextResponse.json({
          valid: false,
          error: "Ollama'ya bağlanılamadı. http://localhost:11434 çalışıyor mu?",
        });
      }
    }

    if (!apiKey) {
      return NextResponse.json({ valid: false, error: "API anahtarı gerekli" });
    }

    const testResult = await testProvider(provider, apiKey);
    return NextResponse.json(testResult);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}

async function testProvider(
  provider: ProviderId,
  apiKey: string
): Promise<{ valid: boolean; models?: string[]; error?: string }> {
  const providerConfig = PROVIDERS[provider];

  try {
    if (provider === "openai" || provider === "deepseek" || provider === "xai" || provider === "openrouter" || provider === "zhipu" || provider === "perplexity" || provider === "mistral" || provider === "together") {
      const res = await fetch(`${providerConfig.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(provider === "openrouter" && {
            "HTTP-Referer": "https://kutadgubilgi.app",
            "X-Title": "Kutadgubilgi Code",
          }),
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          valid: false,
          error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        };
      }

      const data = await res.json();
      const models = (data.data ?? []).map((m: { id: string }) => m.id);
      return { valid: true, models };
    }

    if (provider === "anthropic") {
      const res = await fetch(`${providerConfig.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": providerConfig.apiVersion!,
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 401) {
        return { valid: false, error: "Geçersiz API anahtarı" };
      }
      if (!res.ok) {
        const text = await res.text();
        return {
          valid: false,
          error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        };
      }
      return { valid: true };
    }

    if (provider === "google") {
      const res = await fetch(
        `${providerConfig.baseUrl}/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) {
        const text = await res.text();
        return {
          valid: false,
          error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        };
      }
      const data = await res.json();
      const models = (data.models ?? []).map((m: { name: string }) =>
        m.name.replace("models/", "")
      );
      return { valid: true, models };
    }

    if (provider === "cohere") {
      // Cohere: /v2/chat ile minimal test
      const res = await fetch(`${providerConfig.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "command-r7b-12-2024",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 401 || res.status === 403) {
        return { valid: false, error: "Geçersiz API anahtarı" };
      }
      if (!res.ok) {
        const text = await res.text();
        return {
          valid: false,
          error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        };
      }
      return { valid: true };
    }

    return { valid: false, error: "Desteklenmeyen sağlayıcı" };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Bağlantı hatası",
    };
  }
}
