import { NextRequest, NextResponse } from "next/server";
import type { ProviderId, AgentStep, DiffResult } from "@/types";
import { PROVIDERS, getModel } from "@/lib/providers";
import { routePrompt } from "@/lib/routing";
import { createDiff } from "@/lib/diff";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 dakika

const WORKSPACE = "/home/z/my-project/workspace";

interface AgentBody {
  goal: string;
  apiKeys: Record<string, string>;
  systemPrompt?: string;
  maxSteps?: number;
}

interface Step {
  id: string;
  index: number;
  action: string;
  description: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  input?: string;
  output?: string;
  toolCall?: AgentStep["toolCall"];
  diff?: DiffResult;
  timestamp: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: AgentBody = await req.json();
    const { goal, apiKeys, systemPrompt, maxSteps = 8 } = body;

    if (!goal) {
      return NextResponse.json({ error: "Hedef gerekli" }, { status: 400 });
    }

    const taskId = `agent-${Date.now()}`;
    const steps: Step[] = [];

    // Step 1: Plan
    const planStep: Step = {
      id: `step-${Date.now()}-0`,
      index: 0,
      action: "plan",
      description: "Görevi analiz et ve adımları planla",
      status: "running",
      timestamp: Date.now(),
    };
    steps.push(planStep);

    const availableProviders = (Object.keys(PROVIDERS) as ProviderId[]).filter(
      (id) => id === "ollama" || apiKeys[id]
    );

    if (availableProviders.length === 0) {
      planStep.status = "failed";
      planStep.output = "Hiç API anahtarı yok";
      return NextResponse.json({
        taskId,
        steps,
        status: "failed",
        error: "En az bir API anahtarı gerekli",
      });
    }

    // Plan için routing
    const planRoute = routePrompt(
      { prompt: goal, hasImages: false, fileContext: "", codeLength: 0, isReasoning: true },
      apiKeys
    );
    const planProvider = planRoute.provider;
    const planModel = planRoute.model;
    const planApiKey = apiKeys[planProvider] ?? "";

    // Workspace dosyalarını oku (context)
    let fileContext = "";
    try {
      const tree = await listFilesRecursive(WORKSPACE, "", 3);
      fileContext = tree.map((f) => `- ${f}`).join("\n");
    } catch {
      // ignore
    }

    const planPrompt = `Sen otonom bir kod asistanısın. Görev: "${goal}"

Workspace dosyaları:
${fileContext}

Bu görevi tamamlamak için en fazla ${maxSteps} adımda bir plan yap. Her adım şu alanları içermeli:
- action: file_read | file_write | file_search | terminal | analyze | done
- description: kısa açıklama
- input: action'a özel input (örn: file_read için path)

SADECE JSON döndür:
{
  "steps": [
    {"action": "file_read", "description": "...", "input": "src/index.ts"},
    ...
  ]
}

Terminal komutları güvenlik sebebiyle kısıtlı. file_write için input hem path hem content içermeli (format: "path|||content").`;

    const planResponse = await callAI(
      planProvider,
      planModel,
      planApiKey,
      planPrompt,
      systemPrompt
    );

    planStep.status = "success";
    planStep.output = planResponse.content;
    planStep.input = planPrompt;

    // Parse plan
    let plannedSteps: Array<{
      action: string;
      description: string;
      input?: string;
    }> = [];

    try {
      const jsonMatch = planResponse.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        plannedSteps = parsed.steps ?? [];
      }
    } catch {
      // JSON parse edilemezse manuel adım
      plannedSteps = [
        {
          action: "analyze",
          description: "AI önerisini uygula",
          input: planResponse.content,
        },
      ];
    }

    // Step 2-N: Execute
    for (let i = 0; i < Math.min(plannedSteps.length, maxSteps); i++) {
      const ps = plannedSteps[i];
      const step: Step = {
        id: `step-${Date.now()}-${i + 1}`,
        index: i + 1,
        action: ps.action,
        description: ps.description,
        status: "running",
        input: ps.input,
        timestamp: Date.now(),
      };
      steps.push(step);

      try {
        const result = await executeStep(ps.action, ps.input ?? "", {
          apiKeys,
          systemPrompt,
          provider: planProvider,
          model: planModel,
          apiKey: planApiKey,
          goal,
        });

        step.status = "success";
        step.output = result.output;
        step.toolCall = result.toolCall;
        step.diff = result.diff;

        if (ps.action === "done") {
          break;
        }
      } catch (err) {
        step.status = "failed";
        step.output = err instanceof Error ? err.message : "Bilinmeyen hata";
      }
    }

    // Final step: AI summary
    const summaryStep: Step = {
      id: `step-${Date.now()}-final`,
      index: steps.length,
      action: "summary",
      description: "Sonuç özeti",
      status: "running",
      timestamp: Date.now(),
    };
    steps.push(summaryStep);

    const summaryPrompt = `Görev: "${goal}"

Yapılan adımlar:
${steps
  .filter((s) => s.action !== "summary" && s.action !== "plan")
  .map(
    (s, i) =>
      `${i + 1}. [${s.action}] ${s.description}\nSonuç: ${(s.output ?? "").slice(0, 200)}`
  )
  .join("\n\n")}

Kısa bir sonuç özeti yaz (Türkçe). Görev tamamlandı mı? Ne yapıldı?`;

    const summary = await callAI(
      planProvider,
      planModel,
      planApiKey,
      summaryPrompt,
      systemPrompt
    );

    summaryStep.status = "success";
    summaryStep.output = summary.content;

    return NextResponse.json({
      taskId,
      steps,
      status: "completed",
      result: summary.content,
      provider: planProvider,
      model: planModel,
      tokensIn:
        planResponse.tokensIn + summary.tokensIn,
      tokensOut: planResponse.tokensOut + summary.tokensOut,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function executeStep(
  action: string,
  input: string,
  ctx: {
    apiKeys: Record<string, string>;
    systemPrompt?: string;
    provider: ProviderId;
    model: string;
    apiKey: string;
    goal: string;
  }
): Promise<{
  output: string;
  toolCall?: AgentStep["toolCall"];
  diff?: DiffResult;
}> {
  switch (action) {
    case "file_read": {
      const filePath = input.trim();
      const abs = safePath(filePath);
      const content = await fs.readFile(abs, "utf-8");
      return {
        output: content.slice(0, 8000),
        toolCall: {
          type: "file_read",
          input: { path: filePath },
          output: content.slice(0, 500),
          status: "success",
        },
      };
    }

    case "file_write": {
      const [filePath, ...contentParts] = input.split("|||");
      const content = contentParts.join("|||");
      if (!filePath || content === undefined) {
        throw new Error("Format: path|||content");
      }
      const abs = safePath(filePath.trim());

      // Diff hesapla
      let original = "";
      try {
        original = await fs.readFile(abs, "utf-8");
      } catch {
        // yeni dosya
      }

      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf-8");

      const ext = filePath.split(".").pop()?.toLowerCase() ?? "txt";
      const diff = createDiff(filePath.trim(), original, content, ext);

      return {
        output: `Dosya yazıldı: ${filePath}`,
        toolCall: {
          type: "file_write",
          input: { path: filePath, size: content.length },
          output: "success",
          status: "success",
        },
        diff,
      };
    }

    case "file_search": {
      const query = input.trim();
      const results: Array<{ path: string; line: number; content: string }> = [];
      await searchRecursive(WORKSPACE, "", query, results, 50);
      return {
        output: results
          .map((r) => `${r.path}:${r.line}: ${r.content}`)
          .join("\n"),
        toolCall: {
          type: "file_list",
          input: { query },
          output: `${results.length} sonuç`,
          status: "success",
        },
      };
    }

    case "terminal": {
      const cmd = input.trim();
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          cwd: WORKSPACE,
          timeout: 15000,
          maxBuffer: 1024 * 512,
        });
        return {
          output: (stdout + stderr).slice(0, 4000),
          toolCall: {
            type: "terminal",
            input: { command: cmd },
            output: "success",
            status: "success",
          },
        };
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string };
        return {
          output: ((e.stdout ?? "") + (e.stderr ?? "")).slice(0, 4000),
          toolCall: {
            type: "terminal",
            input: { command: cmd },
            output: "error",
            status: "error",
          },
        };
      }
    }

    case "analyze":
    case "done":
    default: {
      // AI'a input'u analiz ettir
      const prompt = `Görev: "${ctx.goal}"

Bu adım için AI analizi gerekiyor. Aşağıdaki bilgiyi kullan:\n${input}

Kısa, net bir analiz/öneri yaz (Türkçe).`;

      const result = await callAI(
        ctx.provider,
        ctx.model,
        ctx.apiKey,
        prompt,
        ctx.systemPrompt
      );
      return {
        output: result.content,
        toolCall: {
          type: "search",
          input: { prompt },
          output: result.content.slice(0, 500),
          status: "success",
        },
      };
    }
  }
}

async function callAI(
  provider: ProviderId,
  model: string,
  apiKey: string,
  prompt: string,
  systemPrompt?: string
): Promise<{ content: string; tokensIn: number; tokensOut: number; cost: number }> {
  const providerConfig = PROVIDERS[provider];
  const messages = [
    ...(systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []),
    { role: "user" as const, content: prompt },
  ];

  // Basitleştirilmiş - sadece OpenAI uyumlu + Anthropic + Google + Ollama
  let url = "";
  let fetchOpts: RequestInit = {};
  let parseFn: (data: unknown) => { content: string; in: number; out: number };

  if (provider === "anthropic") {
    url = `${providerConfig.baseUrl}/messages`;
    const sys = messages.find((m) => m.role === "system");
    const chat = messages.filter((m) => m.role !== "system");
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
        temperature: 0.7,
        system: sys?.content,
        messages: chat,
      }),
    };
    parseFn = (data) => {
      const d = data as Record<string, unknown>;
      const content = (d.content as Array<{ text?: string }>)?.map((c) => c.text).join("") ?? "";
      return {
        content,
        in: (d.usage as { input_tokens?: number })?.input_tokens ?? 0,
        out: (d.usage as { output_tokens?: number })?.output_tokens ?? 0,
      };
    };
  } else if (provider === "google") {
    url = `${providerConfig.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const sys = messages.find((m) => m.role === "system");
    const chat = messages.filter((m) => m.role !== "system");
    fetchOpts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: chat.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        systemInstruction: sys ? { parts: [{ text: sys.content }] } : undefined,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    };
    parseFn = (data) => {
      const d = data as Record<string, unknown>;
      const candidates = d.candidates as
        | Array<{ content?: { parts?: Array<{ text?: string }> } }>
        | undefined;
      return {
        content: candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "",
        in: (d.usageMetadata as { promptTokenCount?: number })?.promptTokenCount ?? 0,
        out: (d.usageMetadata as { candidatesTokenCount?: number })?.candidatesTokenCount ?? 0,
      };
    };
  } else if (provider === "ollama") {
    url = `${providerConfig.baseUrl}/api/chat`;
    fetchOpts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.7, num_predict: 4096 },
      }),
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
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
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

function safePath(p: string): string {
  const resolved = path.resolve(WORKSPACE, p);
  if (!resolved.startsWith(WORKSPACE)) {
    throw new Error("Workspace dışına çıkılamaz");
  }
  return resolved;
}

async function listFilesRecursive(
  absDir: string,
  relDir: string,
  maxDepth: number,
  depth = 0
): Promise<string[]> {
  if (depth >= maxDepth) return [];
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      result.push(`${rel}/`);
      const sub = await listFilesRecursive(
        path.join(absDir, entry.name),
        rel,
        maxDepth,
        depth + 1
      );
      result.push(...sub);
    } else {
      result.push(rel);
    }
  }
  return result;
}

async function searchRecursive(
  absDir: string,
  relDir: string,
  query: string,
  results: Array<{ path: string; line: number; content: string }>,
  max: number
) {
  if (results.length >= max) return;
  const lower = query.toLowerCase();
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(absDir, entry.name);
    const rel = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      await searchRecursive(full, rel, query, results, max);
    } else {
      try {
        const content = await fs.readFile(full, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lower)) {
            results.push({ path: rel, line: i + 1, content: lines[i].trim().slice(0, 200) });
            if (results.length >= max) return;
          }
        }
      } catch {
        // skip
      }
    }
  }
}
