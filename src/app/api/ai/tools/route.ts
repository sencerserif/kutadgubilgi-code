import { NextRequest, NextResponse } from "next/server";
import type { ProviderId } from "@/types";
import { PROVIDERS, getModel } from "@/lib/providers";
import { createDiff } from "@/lib/diff";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const execAsync = promisify(exec);
const WORKSPACE = "/home/z/my-project/workspace";

interface ToolUseBody {
  provider: ProviderId;
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string; tool_call_id?: string; name?: string }>;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  apiKeys?: Record<string, string>;
  permissions?: {
    autoApproveReads: boolean;
    autoApproveWrites: boolean;
    autoApproveBash: boolean;
    autoApproveSearch: boolean;
  };
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResult {
  id: string;
  name: string;
  output: string;
  error?: string;
  diff?: unknown;
  approved: boolean;
}

// Tüm tool tanımları (Claude Code / OpenCode parity)
const TOOL_DEFINITIONS = [
  {
    name: "read_file",
    description: "Bir dosyanın içeriğini oku. Tam path verilmeli.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace içindeki dosya yolu" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Dosyaya içerik yaz. Yeni dosya oluşturur veya üzerine yazar.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Dosyada string değişiklik yap. old_string → new_string.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "list_directory",
    description: "Dizin içeriğini listele.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Boş = workspace root" },
      },
    },
  },
  {
    name: "bash",
    description: "Bash komutu çalıştır (workspace içinde, güvenlik kontrollü).",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
      },
      required: ["command"],
    },
  },
  {
    name: "grep",
    description: "Workspace içinde dosya içeriği ara.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string", description: "Arama dizini (boş = root)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "glob",
    description: "Dosya adı desektle ara (örn: **/*.ts).",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "todo_write",
    description: "Todo listesi oluştur/güncelle. AI'ın görev takibi için.",
    inputSchema: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            },
          },
        },
      },
      required: ["todos"],
    },
  },
];

function safePath(p: string): string {
  const resolved = path.resolve(WORKSPACE, p);
  if (!resolved.startsWith(WORKSPACE)) {
    throw new Error("Workspace dışına çıkılamaz");
  }
  return resolved;
}

const BLOCKED_PATTERNS = [
  /\brm\s+-rf\s+\/($|\s)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=.*of=\/dev\//i,
  /\b:\(\)\s*\{/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
];

// Tool execution
async function executeTool(
  call: ToolCall,
  permissions: NonNullable<ToolUseBody["permissions"]>
): Promise<ToolResult> {
  const id = call.id;
  const args = call.arguments;

  try {
    switch (call.name) {
      case "read_file": {
        if (!permissions.autoApproveReads) {
          return { id, name: call.name, output: "İzin reddedildi (read_file)", approved: false };
        }
        const filePath = args.path as string;
        const content = await fs.readFile(safePath(filePath), "utf-8");
        return { id, name: call.name, output: content.slice(0, 50000), approved: true };
      }

      case "write_file": {
        if (!permissions.autoApproveWrites) {
          return { id, name: call.name, output: "İzin reddedildi (write_file - autoApproveWrites kapalı)", approved: false };
        }
        const filePath = args.path as string;
        const content = args.content as string;
        const abs = safePath(filePath);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content, "utf-8");
        return { id, name: call.name, output: `Yazıldı: ${filePath} (${content.length} byte)`, approved: true };
      }

      case "edit_file": {
        if (!permissions.autoApproveWrites) {
          return { id, name: call.name, output: "İzin reddedildi", approved: false };
        }
        const filePath = args.path as string;
        const oldStr = args.old_string as string;
        const newStr = args.new_string as string;
        const abs = safePath(filePath);
        const original = await fs.readFile(abs, "utf-8");
        if (!original.includes(oldStr)) {
          return { id, name: call.name, output: "Hata: old_string bulunamadı", approved: false, error: "not_found" };
        }
        const newContent = original.replace(oldStr, newStr);
        await fs.writeFile(abs, newContent, "utf-8");
        const ext = filePath.split(".").pop()?.toLowerCase() ?? "txt";
        const diff = createDiff(filePath, original, newContent, ext);
        return { id, name: call.name, output: `Düzenlendi: ${filePath}`, diff, approved: true };
      }

      case "list_directory": {
        if (!permissions.autoApproveReads) {
          return { id, name: call.name, output: "İzin reddedildi", approved: false };
        }
        const dirPath = (args.path as string) ?? "";
        const abs = safePath(dirPath);
        const entries = await fs.readdir(abs, { withFileTypes: true });
        const list = entries
          .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
          .map((e) => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
          .join("\n");
        return { id, name: call.name, output: list || "(boş)", approved: true };
      }

      case "bash": {
        if (!permissions.autoApproveBash) {
          return { id, name: call.name, output: "İzin reddedildi (bash - autoApproveBash kapalı)", approved: false };
        }
        const cmd = args.command as string;
        for (const pattern of BLOCKED_PATTERNS) {
          if (pattern.test(cmd)) {
            return { id, name: call.name, output: "Güvenlik: Komut engellendi", approved: false };
          }
        }
        try {
          const { stdout, stderr } = await execAsync(cmd, {
            cwd: WORKSPACE,
            timeout: 20000,
            maxBuffer: 1024 * 512,
          });
          return {
            id,
            name: call.name,
            output: (stdout + (stderr ? `\n[stderr]\n${stderr}` : "")).slice(0, 20000) || "(çıktı yok)",
            approved: true,
          };
        } catch (err) {
          const e = err as { stdout?: string; stderr?: string; code?: number };
          return {
            id,
            name: call.name,
            output: ((e.stdout ?? "") + (e.stderr ?? "")).slice(0, 20000),
            approved: true,
            error: `exit ${e.code}`,
          };
        }
      }

      case "grep": {
        if (!permissions.autoApproveSearch) {
          return { id, name: call.name, output: "İzin reddedildi", approved: false };
        }
        const pattern = args.pattern as string;
        const dirPath = (args.path as string) ?? "";
        const results: string[] = [];
        await grepRecursive(safePath(dirPath), pattern, results, 50);
        return { id, name: call.name, output: results.join("\n") || "(sonuç yok)", approved: true };
      }

      case "glob": {
        if (!permissions.autoApproveSearch) {
          return { id, name: call.name, output: "İzin reddedildi", approved: false };
        }
        const pattern = args.pattern as string;
        const results: string[] = [];
        await globRecursive(WORKSPACE, "", pattern, results, 100);
        return { id, name: call.name, output: results.join("\n") || "(sonuç yok)", approved: true };
      }

      case "todo_write": {
        const todos = args.todos as Array<{ content: string; status: string }>;
        const list = todos.map((t, i) => `${i + 1}. [${t.status === "completed" ? "✓" : t.status === "in_progress" ? "→" : " "}] ${t.content}`).join("\n");
        return { id, name: call.name, output: `Todo güncellendi:\n${list}`, approved: true };
      }

      default:
        return { id, name: call.name, output: `Bilinmeyen tool: ${call.name}`, approved: false };
    }
  } catch (err) {
    return {
      id,
      name: call.name,
      output: err instanceof Error ? err.message : "Bilinmeyen hata",
      approved: false,
      error: "execution_error",
    };
  }
}

async function grepRecursive(
  absDir: string,
  pattern: string,
  results: string[],
  max: number
) {
  if (results.length >= max) return;
  const lower = pattern.toLowerCase();
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      await grepRecursive(full, pattern, results, max);
    } else {
      try {
        const content = await fs.readFile(full, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lower)) {
            const rel = path.relative(WORKSPACE, full);
            results.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
            if (results.length >= max) return;
          }
        }
      } catch {
        // skip
      }
    }
  }
}

async function globRecursive(
  absDir: string,
  relDir: string,
  pattern: string,
  results: string[],
  max: number
) {
  if (results.length >= max) return;
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  // Basit pattern eşleştirme: **/*.{ts,tsx} → .ts/.tsx ile biten
  const exts = pattern.match(/\{([^}]+)\}/)?.[1].split(",") ?? [];
  const fileName = pattern.includes("*") ? null : pattern;

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await globRecursive(path.join(absDir, entry.name), rel, pattern, results, max);
    } else {
      let match = false;
      if (fileName) {
        match = entry.name === fileName;
      } else if (exts.length > 0) {
        match = exts.some((ext) => entry.name.endsWith("." + ext.trim()));
      } else if (pattern === "**/*") {
        match = true;
      }
      if (match) {
        results.push(rel);
        if (results.length >= max) return;
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ToolUseBody = await req.json();
    const { provider, model, messages, apiKey, systemPrompt, permissions } = body;

    if (!provider || !model) {
      return NextResponse.json({ error: "Provider ve model gerekli" }, { status: 400 });
    }

    const perms = permissions ?? {
      autoApproveReads: true,
      autoApproveWrites: false,
      autoApproveBash: false,
      autoApproveSearch: true,
    };

    const providerConfig = PROVIDERS[provider];
    if (provider !== "ollama" && !apiKey) {
      return NextResponse.json({ error: "API key gerekli" }, { status: 401 });
    }

    // Tool-aware system prompt
    const toolSystemPrompt = `${systemPrompt ?? ""}

Sen tool kullanabilen bir AI asistanısın. Aşağıdaki tool'lar mevcut:

${TOOL_DEFINITIONS.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

Tool kullanırken şu formatta yanıt ver:
<tool_call>
{"name": "tool_name", "arguments": {...}}
</tool_call>

Birden fazla tool çağırabilirsin. Tool sonuçlarını aldıkça devam et. Görev tamamlandığında normal metin yanıt ver.

Önemli:
- Dosya okumadan önce list_directory ile dizinleri keşfet
- write_file yerine edit_file kullan (daha güvenli)
- bash komutları workspace içinde çalışır
- Todo listesi için todo_write kullan`;

    const finalMessages = [
      ...(systemPrompt || toolSystemPrompt
        ? [{ role: "system" as const, content: toolSystemPrompt }]
        : []),
      ...messages,
    ];

    const toolResults: ToolResult[] = [];
    const allMessages = [...finalMessages];
    let maxIterations = 10;
    let finalContent = "";

    while (maxIterations-- > 0) {
      // AI çağır
      const aiResult = await callAIWithTools(provider, model, allMessages, apiKey);
      finalContent = aiResult.content;

      // Tool call'ları parse et
      const toolCalls = parseToolCalls(aiResult.content);

      if (toolCalls.length === 0) {
        // Tool yok, son yanıt
        break;
      }

      // Her tool call'u çalıştır
      allMessages.push({
        role: "assistant",
        content: aiResult.content,
      });

      for (const call of toolCalls) {
        const result = await executeTool(call, perms);
        toolResults.push(result);
        allMessages.push({
          role: "tool",
          content: `<tool_result name="${result.name}" approved="${result.approved}">${result.output}</tool_result>`,
          tool_call_id: call.id,
          name: call.name,
        });
      }
    }

    return NextResponse.json({
      content: finalContent,
      toolResults,
      tokensIn: 0,
      tokensOut: 0,
      provider,
      model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
  let match;
  let idx = 0;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      calls.push({
        id: `call_${Date.now()}_${idx++}`,
        name: parsed.name,
        arguments: parsed.arguments ?? {},
      });
    } catch {
      // skip invalid JSON
    }
  }
  return calls;
}

async function callAIWithTools(
  provider: ProviderId,
  model: string,
  messages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }>,
  apiKey: string
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const providerConfig = PROVIDERS[provider];

  // OpenAI uyumlu
  if (provider !== "anthropic" && provider !== "google" && provider !== "ollama" && provider !== "cohere") {
    const res = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
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
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API hatası ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
    };
  }

  // Anthropic
  if (provider === "anthropic") {
    const systemMsg = messages.find((m) => m.role === "system");
    const chat = messages.filter((m) => m.role !== "system");
    const res = await fetch(`${providerConfig.baseUrl}/messages`, {
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
        messages: chat.map((m) => ({ role: m.role === "tool" ? "user" : m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic hatası ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      content: data.content?.map((c: { text?: string }) => c.text).join("") ?? "",
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
    };
  }

  // Google
  if (provider === "google") {
    const systemMsg = messages.find((m) => m.role === "system");
    const chat = messages.filter((m) => m.role !== "system");
    const res = await fetch(
      `${providerConfig.baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: chat.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google hatası ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "",
      tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  // Cohere
  if (provider === "cohere") {
    const res = await fetch(`${providerConfig.baseUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cohere hatası ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      content: data.message?.content?.[0]?.text ?? "",
      tokensIn: data.usage?.billed_units?.input_tokens ?? 0,
      tokensOut: data.usage?.billed_units?.output_tokens ?? 0,
    };
  }

  // Ollama
  const res = await fetch(`${providerConfig.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      options: { temperature: 0.7, num_predict: 4096 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama hatası ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    content: data.message?.content ?? "",
    tokensIn: data.prompt_eval_count ?? 0,
    tokensOut: data.eval_count ?? 0,
  };
}
