import { NextRequest, NextResponse } from "next/server";
import type { ProviderId } from "@/types";
import { PROVIDERS } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  provider: ProviderId;
  model: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    images?: Array<{ url: string; mimeType: string }>;
  }>;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
  reasoning?: boolean; // o1/R1 chain-of-thought
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequestBody = await req.json();
    const { provider, model, messages, apiKey, temperature, maxTokens, systemPrompt } = body;

    if (!provider || !model) {
      return NextResponse.json(
        { error: "Provider ve model gerekli" },
        { status: 400 }
      );
    }

    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      return NextResponse.json(
        { error: `Bilinmeyen sağlayıcı: ${provider}` },
        { status: 400 }
      );
    }

    // Ollama hariç API key gerekli
    if (provider !== "ollama" && !apiKey) {
      return NextResponse.json(
        { error: `${providerConfig.name} API anahtarı gerekli` },
        { status: 401 }
      );
    }

    // Tam messages listesini hazırla (system prompt ekle)
    const finalMessages = [
      ...(systemPrompt
        ? [{ role: "system" as const, content: systemPrompt }]
        : []),
      ...messages,
    ];

    let result: { content: string; tokensIn: number; tokensOut: number; reasoning?: string };

    switch (provider) {
      case "openai":
      case "deepseek":
      case "xai":
      case "openrouter":
      case "zhipu":
      case "perplexity":
      case "mistral":
      case "together":
        result = await callOpenAICompatible(
          providerConfig.baseUrl,
          model,
          finalMessages,
          apiKey,
          temperature,
          maxTokens,
          body.reasoning
        );
        break;
      case "anthropic":
        result = await callAnthropic(
          providerConfig.baseUrl,
          model,
          finalMessages,
          apiKey,
          providerConfig.apiVersion!,
          temperature,
          maxTokens
        );
        break;
      case "google":
        result = await callGoogle(
          providerConfig.baseUrl,
          model,
          finalMessages,
          apiKey,
          temperature,
          maxTokens
        );
        break;
      case "cohere":
        result = await callCohere(
          providerConfig.baseUrl,
          model,
          finalMessages,
          apiKey,
          temperature,
          maxTokens
        );
        break;
      case "ollama":
        result = await callOllama(
          providerConfig.baseUrl,
          model,
          finalMessages,
          temperature,
          maxTokens
        );
        break;
      default:
        return NextResponse.json(
          { error: "Desteklenmeyen sağlayıcı" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      content: result.content,
      reasoning: result.reasoning,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      provider,
      model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[AI API] Hata:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// OpenAI uyumlu API: OpenAI, DeepSeek, xAI, OpenRouter
async function callOpenAICompatible(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string; images?: Array<{ url: string; mimeType: string }> }>,
  apiKey: string,
  temperature?: number,
  maxTokens?: number,
  reasoning?: boolean
): Promise<{ content: string; tokensIn: number; tokensOut: number; reasoning?: string }> {
  // Vision destekli message formatı
  const formattedMessages = messages.map((m) => {
    if (m.images && m.images.length > 0 && m.role === "user") {
      const content: Array<unknown> = [{ type: "text", text: m.content }];
      for (const img of m.images) {
        content.push({
          type: "image_url",
          image_url: { url: img.url },
        });
      }
      return { role: m.role, content };
    }
    return { role: m.role, content: m.content };
  });

  const body: Record<string, unknown> = {
    model,
    messages: formattedMessages,
    max_tokens: maxTokens ?? 4096,
  };
  // o1/R1 modeller için temperature geçilmez
  if (!reasoning) {
    body.temperature = temperature ?? 0.7;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(baseUrl.includes("openrouter") && {
        "HTTP-Referer": "https://kutadgubilgi.app",
        "X-Title": "Kutadgubilgi Code",
      }),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API hatası (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message ?? {};
  return {
    content: msg.content ?? "",
    reasoning: msg.reasoning_content ?? msg.reasoning ?? undefined,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  };
}

// Anthropic Claude
async function callAnthropic(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  apiVersion: string,
  temperature?: number,
  maxTokens?: number
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  // System mesajı ayrı gönderilir
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
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API hatası (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const content = data.content?.map((c: { text?: string }) => c.text).join("") ?? "";
  return {
    content,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
  };
}

// Google Gemini
async function callGoogle(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  temperature?: number,
  maxTokens?: number
): Promise<{ content: string; tokensIn: number; tokensOut: number; reasoning?: string }> {
  // System + history -> contents
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  // Thinking modelleri için özel config
  const isThinkingModel = model.includes("thinking") || model.includes("2.5");
  const generationConfig: Record<string, unknown> = {
    temperature: temperature ?? 0.7,
    maxOutputTokens: maxTokens ?? 8192,
  };
  if (isThinkingModel) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  let res: Response;
  try {
    res = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
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
          generationConfig,
        }),
      }
    );
  } catch (err) {
    throw new Error(
      `Google API bağlantı hatası: ${err instanceof Error ? err.message : "bilinmiyor"}. İnternet veya API key kontrol edin.`
    );
  }

  if (!res.ok) {
    const errText = await res.text();
    let errorMsg = `Google API hatası (${res.status})`;
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

  const data = await res.json();

  // Hata kontrolü
  if (data.error) {
    throw new Error(`Google API: ${data.error.message ?? "hata"}`);
  }

  // Prompt feedback (safety engellemesi)
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Google API: İstek engellendi - ${data.promptFeedback.blockReason}`);
  }

  // Candidates kontrolü
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Google API: Boş yanıt (candidates yok)");
  }

  const candidate = data.candidates[0];

  // Finish reason kontrolü
  if (candidate.finishReason === "SAFETY") {
    throw new Error("Google API: İçerik güvenlik filtresine takıldı");
  }
  if (candidate.finishReason === "MAX_TOKENS") {
    // Kısmi yanıt varsa onu döndür
  }

  const parts = candidate.content?.parts ?? [];
  let content = "";
  let reasoning = "";
  for (const p of parts) {
    if (p.thought && p.text) {
      reasoning += p.text;
    } else if (p.text) {
      content += p.text;
    }
  }

  return {
    content,
    reasoning: reasoning || undefined,
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// Ollama (yerel)
async function callOllama(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature?: number,
  maxTokens?: number
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: temperature ?? 0.7,
        num_predict: maxTokens ?? 4096,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Ollama API hatası (${res.status}). Ollama çalışıyor mu? ${errText}`
    );
  }

  const data = await res.json();
  return {
    content: data.message?.content ?? "",
    tokensIn: data.prompt_eval_count ?? 0,
    tokensOut: data.eval_count ?? 0,
  };
}

// Cohere v2 API (OpenAI benzeri)
async function callCohere(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  temperature?: number,
  maxTokens?: number
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
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
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cohere API hatası (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    content: data.message?.content?.[0]?.text ?? "",
    tokensIn: data.usage?.billed_units?.input_tokens ?? 0,
    tokensOut: data.usage?.billed_units?.output_tokens ?? 0,
  };
}
