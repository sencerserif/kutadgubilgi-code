import { NextRequest, NextResponse } from "next/server";
import type { ProviderId } from "@/types";
import { PROVIDERS } from "@/lib/providers";
import {
  COMPUTER_USE_TOOLS,
  COMPUTER_USE_PROVIDERS,
  VISION_COMPUTER_USE_PROMPT,
} from "@/lib/computerUse";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const execAsync = promisify(exec);

interface ComputerUseBody {
  provider: ProviderId;
  model: string;
  apiKey: string;
  goal: string;
  maxSteps?: number;
  allowDangerous?: boolean;
  onStep?: (step: number, total: number) => void;
}

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface Step {
  index: number;
  thought?: string;
  toolCall?: ToolCall;
  toolResult?: string;
  screenshot?: string;
  status: "thinking" | "acting" | "success" | "failed" | "done";
  timestamp: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: ComputerUseBody = await req.json();
    const { provider, model, apiKey, goal, maxSteps = 15, allowDangerous } = body;

    if (!goal) {
      return NextResponse.json({ error: "Hedef gerekli" }, { status: 400 });
    }

    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      return NextResponse.json({ error: "Bilinmeyen sağlayıcı" }, { status: 400 });
    }

    // Computer use destek kontrolü
    const cuProvider = COMPUTER_USE_PROVIDERS.find((p) => p.id === provider);
    if (!cuProvider || (!cuProvider.supportsComputerUse && !cuProvider.supportsVision)) {
      return NextResponse.json(
        {
          error: `${providerConfig.name} computer use desteklemiyor. Destekleyenler: ${COMPUTER_USE_PROVIDERS.filter((p) => p.supportsComputerUse || p.supportsVision).map((p) => p.name).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const steps: Step[] = [];
    let completed = false;
    let finalSummary = "";

    // İlk ekran görüntüsü
    const initialScreenshot = await takeScreenshot();

    // Conversation history
    const conversationMessages: Array<Record<string, unknown>> = [
      {
        role: "user",
        content: [
          { type: "text", text: `GÖREV: ${goal}\n\nBaşlangıçtaki ekran görüntüsü:` },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: initialScreenshot,
            },
          },
        ],
      },
    ];

    for (let i = 0; i < maxSteps && !completed; i++) {
      const step: Step = {
        index: i + 1,
        status: "thinking",
        timestamp: Date.now(),
      };
      steps.push(step);

      try {
        // AI çağır
        const aiResponse = cuProvider.supportsComputerUse
          ? await callAnthropicComputerUse(provider, model, apiKey, conversationMessages, goal)
          : await callVisionComputerUse(provider, model, apiKey, conversationMessages);

        step.thought = aiResponse.thought;

        // Tool call var mı?
        if (!aiResponse.toolCall) {
          // Tamamlandı
          step.status = "done";
          step.toolResult = aiResponse.content;
          finalSummary = aiResponse.content;
          completed = true;
          break;
        }

        step.toolCall = aiResponse.toolCall;
        step.status = "acting";

        // Tool'u çalıştır
        const toolResult = await executeTool(aiResponse.toolCall, allowDangerous);
        step.toolResult = toolResult.output.slice(0, 500);
        if (toolResult.image) {
          step.screenshot = toolResult.image;
        }

        // Conversation'a ekle
        conversationMessages.push({
          role: "assistant",
          content: aiResponse.rawContent,
        });
        conversationMessages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: `Tool sonucu (${aiResponse.toolCall.name}): ${toolResult.output.slice(0, 2000)}`,
            },
            ...(toolResult.image
              ? [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: "image/png",
                      data: toolResult.image,
                    },
                  },
                ]
              : []),
          ],
        });

        step.status = "success";

        // Tamamlandı mı?
        if (aiResponse.content?.includes("GÖREV TAMAMLANDI")) {
          completed = true;
          finalSummary = aiResponse.content;
          break;
        }
      } catch (err) {
        step.status = "failed";
        step.toolResult = err instanceof Error ? err.message : "hata";
      }
    }

    return NextResponse.json({
      success: completed,
      steps,
      summary: finalSummary || (completed ? "Görev tamamlandı" : "Maksimum adım sayısına ulaşıldı"),
      totalSteps: steps.length,
      provider,
      model,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "hata" },
      { status: 500 }
    );
  }
}

// Anthropic native Computer Use API
async function callAnthropicComputerUse(
  provider: ProviderId,
  model: string,
  apiKey: string,
  messages: Array<Record<string, unknown>>,
  goal: string
): Promise<{
  content: string;
  thought?: string;
  toolCall?: ToolCall;
  rawContent: unknown;
}> {
  const providerConfig = PROVIDERS[provider];
  const res = await fetch(`${providerConfig.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "computer-use-2024-10-22",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages,
      tools: [
        {
          type: "computer_20241022",
          name: "computer",
          display_width_px: 1024,
          display_height_px: 768,
        },
        ...COMPUTER_USE_TOOLS.filter((t) => t.name !== "computer").map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        })),
      ],
      system: `Sen bir computer use asistanısın. Kullanıcının bilgisayarını kontrol ederek görevleri tamamla. Tehlikeli işlemler için onay iste.\n\nGÖREV: ${goal}`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic hatası ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const contentBlocks = data.content ?? [];
  let textContent = "";
  let toolCall: ToolCall | undefined;
  let rawContent = contentBlocks;

  for (const block of contentBlocks) {
    if (block.type === "text") {
      textContent += block.text;
    } else if (block.type === "tool_use") {
      toolCall = {
        name: block.name,
        arguments: block.input ?? {},
      };
    }
  }

  return {
    content: textContent,
    thought: textContent.slice(0, 200),
    toolCall,
    rawContent,
  };
}

// Vision-based Computer Use (GLM-4V, GPT-4o, Gemini) — fallback
async function callVisionComputerUse(
  provider: ProviderId,
  model: string,
  apiKey: string,
  messages: Array<Record<string, unknown>>
): Promise<{
  content: string;
  thought?: string;
  toolCall?: ToolCall;
  rawContent: unknown;
}> {
  const providerConfig = PROVIDERS[provider];

  // Provider'a göre formatla
  let url = "";
  let fetchOpts: RequestInit = {};
  let parseFn: (data: unknown) => { content: string };

  // Son mesajdaki image'ı al
  const lastMessage = messages[messages.length - 1];
  let imageData: string | undefined;
  if (Array.isArray(lastMessage.content)) {
    for (const block of lastMessage.content) {
      if (block.type === "image" && block.source?.data) {
        imageData = block.source.data;
      } else if (typeof block === "object" && block.image_url?.url) {
        imageData = block.image_url.url.split(",")[1];
      }
    }
  }

  // Tüm metin içeriğini birleştir
  let textContent = "";
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text") textContent += block.text + "\n";
      }
    } else if (typeof msg.content === "string") {
      textContent += msg.content + "\n";
    }
  }

  if (provider === "openai" || provider === "openrouter") {
    url = `${providerConfig.baseUrl}/chat/completions`;
    const messageContent: Array<unknown> = [{ type: "text", text: textContent + "\n\n" + VISION_COMPUTER_USE_PROMPT }];
    if (imageData) {
      messageContent.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${imageData}` },
      });
    }
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
        messages: [{ role: "user", content: messageContent }],
        max_tokens: 4096,
      }),
    };
    parseFn = (data) => ({
      content: (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? "",
    });
  } else if (provider === "zhipu") {
    // Zhipu GLM-4V - OpenAI uyumlu
    url = `${providerConfig.baseUrl}/chat/completions`;
    const messageContent: Array<unknown> = [{ type: "text", text: textContent + "\n\n" + VISION_COMPUTER_USE_PROMPT }];
    if (imageData) {
      messageContent.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${imageData}` },
      });
    }
    fetchOpts = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: messageContent }],
        max_tokens: 4096,
      }),
    };
    parseFn = (data) => ({
      content: (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? "",
    });
  } else if (provider === "google") {
    url = `${providerConfig.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const parts: Array<unknown> = [{ text: textContent + "\n\n" + VISION_COMPUTER_USE_PROMPT }];
    if (imageData) {
      parts.push({
        inline_data: {
          mime_type: "image/png",
          data: imageData,
        },
      });
    }
    fetchOpts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
    };
    parseFn = (data) => ({
      content: (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "",
    });
  } else {
    throw new Error(`${provider} vision desteklenmiyor`);
  }

  const res = await fetch(url, fetchOpts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${providerConfig.name} hatası ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const parsed = parseFn(data);

  // Tool call parse et (vision fallback için)
  const toolCall = parseToolCallFromText(parsed.content);

  return {
    content: parsed.content,
    thought: parsed.content.slice(0, 200),
    toolCall,
    rawContent: data,
  };
}

function parseToolCallFromText(content: string): ToolCall | undefined {
  // <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  const match = content.match(/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[1]);
    return {
      name: parsed.name,
      arguments: parsed.arguments ?? {},
    };
  } catch {
    return undefined;
  }
}

async function takeScreenshot(): Promise<string> {
  const tmpDir = "/tmp/computer-use";
  await fs.mkdir(tmpDir, { recursive: true });
  const screenshotPath = path.join(tmpDir, `screen-${Date.now()}.png`);

  let cmd = "scrot";
  try {
    await execAsync("which scrot");
    cmd = `scrot ${screenshotPath}`;
  } catch {
    try {
      await execAsync("which import");
      cmd = `import -window root ${screenshotPath}`;
    } catch {
      cmd = `gnome-screenshot -f ${screenshotPath} 2>/dev/null || true`;
    }
  }

  await execAsync(cmd, { timeout: 10000 });
  const imageBuffer = await fs.readFile(screenshotPath);
  await fs.unlink(screenshotPath).catch(() => {});
  return imageBuffer.toString("base64");
}

async function executeTool(
  call: ToolCall,
  allowDangerous?: boolean
): Promise<{ output: string; image?: string }> {
  // /api/computer route'una yönlendir
  const args = call.arguments as {
    action?: string;
    coordinate?: [number, number];
    text?: string;
    scroll_direction?: string;
    scroll_amount?: number;
    duration?: number;
    command?: string;
    path?: string;
    content?: string;
  };

  // Map tool name → action
  let action = call.name;
  if (call.name === "computer") {
    action = args.action ?? "screenshot";
  }

  const res = await fetch("http://127.0.0.1:3000/api/computer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actions: [
        {
          action,
          coordinate: args.coordinate,
          text: args.text,
          scroll_direction: args.scroll_direction,
          scroll_amount: args.scroll_amount,
          duration: args.duration,
          command: args.command,
          path: args.path,
          content: args.content,
        },
      ],
      allowDangerous,
    }),
  });

  const data = await res.json();
  const result = data.results?.[0];

  if (!result) {
    return { output: "Sonuç yok" };
  }

  return {
    output: result.output ?? result.error ?? "OK",
    image: result.image,
  };
}
