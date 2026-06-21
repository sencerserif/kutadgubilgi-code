import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import type { ProviderId } from "@/types";
import { PROVIDERS, getModel } from "@/lib/providers";
import { routePrompt } from "@/lib/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const execAsync = promisify(exec);
const WORKSPACE = "/home/z/my-project/workspace";

export async function GET() {
  try {
    const entries = await getTimeline();
    return NextResponse.json({ entries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, apiKeys, hashes } = body;

    if (action === "summarize") {
      return await summarizeCommits(hashes ?? [], apiKeys ?? {});
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getTimeline() {
  try {
    const { stdout } = await execAsync(
      'git log --pretty=format:"%h|%an|%ad|%s" --date=short -30',
      { cwd: WORKSPACE }
    );

    const commits = stdout.split("\n").filter(Boolean).map((line) => {
      const [hash, author, date, ...msg] = line.split("|");
      return {
        hash,
        author,
        date,
        message: msg.join("|"),
        filesChanged: 0,
        additions: 0,
        deletions: 0,
      };
    });

    // Her commit için dosya/değişiklik sayısı
    for (const commit of commits) {
      try {
        const { stdout: stat } = await execAsync(
          `git show --stat --oneline ${commit.hash} | tail -1`,
          { cwd: WORKSPACE }
        );
        const match = stat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
        if (match) {
          commit.filesChanged = parseInt(match[1]);
          commit.additions = match[2] ? parseInt(match[2]) : 0;
          commit.deletions = match[3] ? parseInt(match[3]) : 0;
        }
      } catch {
        // skip
      }
    }

    return commits;
  } catch {
    return [];
  }
}

async function summarizeCommits(
  hashes: string[],
  apiKeys: Record<string, string>
) {
  const availableProviders = (Object.keys(PROVIDERS) as ProviderId[]).filter(
    (id) => id === "ollama" || apiKeys[id]
  );

  if (availableProviders.length === 0) {
    return NextResponse.json({ error: "API anahtarı gerekli" }, { status: 401 });
  }

  // Her hash için diff al
  const summaries: Record<string, string> = {};

  for (const hash of hashes) {
    try {
      const { stdout: diff } = await execAsync(
        `git show ${hash} --stat --pretty=format:"%h %s"`,
        { cwd: WORKSPACE, maxBuffer: 1024 * 1024 }
      );

      const route = routePrompt(
        {
          prompt: "summarize git commit",
          hasImages: false,
          fileContext: diff,
          codeLength: diff.length,
          isReasoning: false,
        },
        apiKeys
      );

      const provider = route.provider;
      const model = route.model;
      const apiKey = apiKeys[provider] ?? "";

      const result = await callAI(
        provider,
        model,
        apiKey,
        `Aşağıdaki git commit'ini Türkçe olarak 1-2 cümleyle özetle:\n\n${diff.slice(0, 4000)}`
      );

      summaries[hash] = result.content;
    } catch (err) {
      summaries[hash] = `Özetlenemedi: ${err instanceof Error ? err.message : "hata"}`;
    }
  }

  return NextResponse.json({ summaries });
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
      body: JSON.stringify({ model, max_tokens: 1024, temperature: 0.3, messages }),
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
        contents: messages.map((m) => ({ role: "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
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
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1024 }),
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
    throw new Error(`AI hatası ${res.status}`);
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
