import { NextRequest, NextResponse } from "next/server";
import type { ProviderId, ReviewIssue } from "@/types";
import { PROVIDERS, getModel } from "@/lib/providers";
import { routePrompt } from "@/lib/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ReviewBody {
  code: string;
  filename?: string;
  language?: string;
  apiKeys: Record<string, string>;
  systemPrompt?: string;
  focus?: Array<"security" | "performance" | "style" | "bug" | "best-practice">;
}

export async function POST(req: NextRequest) {
  try {
    const body: ReviewBody = await req.json();
    const { code, filename = "code", language = "typescript", apiKeys } = body;

    if (!code) {
      return NextResponse.json({ error: "Kod gerekli" }, { status: 400 });
    }

    const availableProviders = (Object.keys(PROVIDERS) as ProviderId[]).filter(
      (id) => id === "ollama" || apiKeys[id]
    );

    if (availableProviders.length === 0) {
      return NextResponse.json({ error: "API anahtarı gerekli" }, { status: 401 });
    }

    // Reasoning için routing
    const route = routePrompt(
      {
        prompt: "code review",
        hasImages: false,
        fileContext: code,
        codeLength: code.length,
        isReasoning: true,
      },
      apiKeys
    );

    const provider = route.provider;
    const model = route.model;
    const apiKey = apiKeys[provider] ?? "";

    const reviewPrompt = `Sen kıdemli bir code reviewer'sın. Aşağıdaki ${language} kodunu incele.

Dosya: ${filename}

\`\`\`${language}
${code}
\`\`\`

Aşağıdakileri değerlendir:
- Güvenlik açıkları (SQL injection, XSS, hardcoded secrets, vb.)
- Performans sorunları (O(n²) algoritmalar, gereksiz re-render, vb.)
- Bug ve mantık hataları
- Best practice ihlalleri
- Code style sorunları

SADECE JSON formatında yanıt ver:
{
  "issues": [
    {
      "severity": "critical|warning|info|suggestion",
      "category": "security|performance|style|bug|best-practice",
      "title": "Kısa başlık",
      "description": "Detaylı açıklama",
      "line": 1,
      "suggestion": "Nasıl düzeltileceği"
    }
  ],
  "summary": "Genel değerlendirme (2-3 cümle)",
  "score": 85
}

Eğer issue yoksa boş array döndür. Skor 0-100 arası (100 = mükemmel).`;

    const result = await callAI(provider, model, apiKey, reviewPrompt);

    let parsed: {
      issues?: ReviewIssue[];
      summary?: string;
      score?: number;
    } = {};

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // JSON parse edilemezse manuel
      parsed = {
        issues: [],
        summary: result.content.slice(0, 500),
        score: 50,
      };
    }

    const issues = (parsed.issues ?? []).map((issue, idx) => ({
      ...issue,
      id: `issue-${Date.now()}-${idx}`,
      file: filename,
    }));

    return NextResponse.json({
      issues,
      summary: parsed.summary ?? "",
      score: parsed.score ?? 50,
      provider,
      model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      cost: result.cost,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function callAI(
  provider: ProviderId,
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ content: string; tokensIn: number; tokensOut: number; cost: number }> {
  const providerConfig = PROVIDERS[provider];
  const messages = [{ role: "user" as const, content: prompt }];

  let url = "";
  let fetchOpts: RequestInit = {};
  let parseFn: (data: unknown) => { content: string; in: number; out: number };

  if (provider === "anthropic") {
    url = `${providerConfig.baseUrl}/messages`;
    fetchOpts = {
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
        temperature: 0.3,
        messages,
      }),
    };
    parseFn = (data) => {
      const d = data as Record<string, unknown>;
      return {
        content: (d.content as Array<{ text?: string }>)?.map((c) => c.text).join("") ?? "",
        in: (d.usage as { input_tokens?: number })?.input_tokens ?? 0,
        out: (d.usage as { output_tokens?: number })?.output_tokens ?? 0,
      };
    };
  } else if (provider === "google") {
    url = `${providerConfig.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    fetchOpts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: messages.map((m) => ({
          role: "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }),
    };
    parseFn = (data) => {
      const d = data as Record<string, unknown>;
      return {
        content: (d.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>)?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "",
        in: (d.usageMetadata as { promptTokenCount?: number })?.promptTokenCount ?? 0,
        out: (d.usageMetadata as { candidatesTokenCount?: number })?.candidatesTokenCount ?? 0,
      };
    };
  } else if (provider === "ollama") {
    url = `${providerConfig.baseUrl}/api/chat`;
    fetchOpts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.3 } }),
    };
    parseFn = (data) => {
      const d = data as Record<string, unknown>;
      return {
        content: (d.message as { content?: string })?.content ?? "",
        in: (d as { prompt_eval_count?: number }).prompt_eval_count ?? 0,
        out: (d as { eval_count?: number }).eval_count ?? 0,
      };
    };
  } else {
    url = `${providerConfig.baseUrl}/chat/completions`;
    fetchOpts = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "openrouter" && {
          "HTTP-Referer": "https://kutadgubilgi.app",
          "X-Title": "Kutadgubilgi Code",
        }),
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 4096 }),
    };
    parseFn = (data) => {
      const d = data as Record<string, unknown>;
      return {
        content: (d.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content ?? "",
        in: (d.usage as { prompt_tokens?: number })?.prompt_tokens ?? 0,
        out: (d.usage as { completion_tokens?: number })?.completion_tokens ?? 0,
      };
    };
  }

  const res = await fetch(url, fetchOpts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI hatası ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const parsed = parseFn(data);
  const modelInfo = getModel(provider, model);
  const cost = modelInfo ?
    (parsed.in / 1000) * modelInfo.inputCostPer1k +
    (parsed.out / 1000) * modelInfo.outputCostPer1k
    : 0;
  return { content: parsed.content, tokensIn: parsed.in, tokensOut: parsed.out, cost };
}
