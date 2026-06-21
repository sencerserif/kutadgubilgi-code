import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MCP_DIR = "/home/z/my-project/workspace/mcp";

interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  tools?: McpToolDef[];
  resources?: McpResource[];
}

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// Built-in MCP server örnekleri
const BUILTIN_SERVERS: McpServerConfig[] = [
  {
    id: "mcp-filesystem",
    name: "Filesystem",
    url: "stdio://npx @modelcontextprotocol/server-filesystem /home/z/my-project/workspace",
    transport: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", "/home/z/my-project/workspace"],
    enabled: false,
    tools: [
      {
        name: "read_file",
        description: "Dosya oku",
        inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
      {
        name: "write_file",
        description: "Dosya yaz",
        inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      },
      {
        name: "list_directory",
        description: "Dizin listele",
        inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
    ],
  },
  {
    id: "mcp-github",
    name: "GitHub",
    url: "stdio://npx @modelcontextprotocol/server-github",
    transport: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
    enabled: false,
    tools: [
      {
        name: "create_issue",
        description: "GitHub issue oluştur",
        inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["owner", "repo", "title"] },
      },
      {
        name: "search_repositories",
        description: "Repo ara",
        inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      },
    ],
  },
  {
    id: "mcp-fetch",
    name: "Fetch (Web)",
    url: "stdio://npx @modelcontextprotocol/server-fetch",
    transport: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-fetch"],
    enabled: false,
    tools: [
      {
        name: "fetch",
        description: "URL içeriğini çek",
        inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
      },
    ],
  },
  {
    id: "mcp-memory",
    name: "Memory (Knowledge Graph)",
    url: "stdio://npx @modelcontextprotocol/server-memory",
    transport: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-memory"],
    enabled: false,
    tools: [
      {
        name: "create_entities",
        description: "Knowledge graph'a entity ekle",
        inputSchema: { type: "object", properties: { entities: { type: "array" } }, required: ["entities"] },
      },
      {
        name: "read_graph",
        description: "Knowledge graph'ı oku",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  },
  {
    id: "mcp-puppeteer",
    name: "Puppeteer (Browser)",
    url: "stdio://npx @modelcontextprotocol/server-puppeteer",
    transport: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-puppeteer"],
    enabled: false,
    tools: [
      {
        name: "navigate",
        description: "URL'e git",
        inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
      },
      {
        name: "screenshot",
        description: "Ekran görüntüsü al",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  },
  {
    id: "mcp-sqlite",
    name: "SQLite",
    url: "stdio://npx @modelcontextprotocol/server-sqlite",
    transport: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-sqlite", "--db-path", "/home/z/my-project/workspace/data.db"],
    enabled: false,
    tools: [
      {
        name: "read_query",
        description: "SQL SELECT sorgusu çalıştır",
        inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      },
      {
        name: "write_query",
        description: "SQL INSERT/UPDATE/DELETE",
        inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      },
    ],
  },
];

export async function GET() {
  try {
    await fs.mkdir(MCP_DIR, { recursive: true });
    let servers = BUILTIN_SERVERS;

    // Kullanıcı config'lerini yükle
    const userConfigPath = path.join(MCP_DIR, "servers.json");
    try {
      const userConfig = JSON.parse(await fs.readFile(userConfigPath, "utf-8"));
      if (Array.isArray(userConfig.servers)) {
        servers = [...BUILTIN_SERVERS, ...userConfig.servers];
      }
    } catch {
      // file doesn't exist yet
    }

    // Saved state (enabled/disabled)
    const statePath = path.join(MCP_DIR, "state.json");
    try {
      const state = JSON.parse(await fs.readFile(statePath, "utf-8"));
      servers = servers.map((s) => ({
        ...s,
        enabled: state[s.id] ?? s.enabled,
      }));
    } catch {
      // no state
    }

    return NextResponse.json({ servers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "toggle") {
      return await toggleServer(body.id, body.enabled);
    }
    if (action === "add") {
      return await addServer(body.server);
    }
    if (action === "remove") {
      return await removeServer(body.id);
    }
    if (action === "call_tool") {
      return await callTool(body.serverId, body.toolName, body.args);
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function toggleServer(id: string, enabled: boolean) {
  await fs.mkdir(MCP_DIR, { recursive: true });
  const statePath = path.join(MCP_DIR, "state.json");
  let state: Record<string, boolean> = {};
  try {
    state = JSON.parse(await fs.readFile(statePath, "utf-8"));
  } catch {
    // no state
  }
  state[id] = enabled;
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  return NextResponse.json({ success: true });
}

async function addServer(server: Partial<McpServerConfig>) {
  await fs.mkdir(MCP_DIR, { recursive: true });
  const userConfigPath = path.join(MCP_DIR, "servers.json");
  let config: { servers: McpServerConfig[] } = { servers: [] };
  try {
    config = JSON.parse(await fs.readFile(userConfigPath, "utf-8"));
  } catch {
    // no config
  }

  const newServer: McpServerConfig = {
    id: `mcp-custom-${Date.now()}`,
    name: server.name ?? "Custom Server",
    url: server.url ?? "",
    transport: server.transport ?? "http",
    command: server.command,
    args: server.args,
    env: server.env,
    enabled: true,
    tools: server.tools ?? [],
  };
  config.servers.push(newServer);
  await fs.writeFile(userConfigPath, JSON.stringify(config, null, 2));
  return NextResponse.json({ success: true, server: newServer });
}

async function removeServer(id: string) {
  await fs.mkdir(MCP_DIR, { recursive: true });
  const userConfigPath = path.join(MCP_DIR, "servers.json");
  try {
    const config = JSON.parse(await fs.readFile(userConfigPath, "utf-8"));
    config.servers = config.servers.filter((s: McpServerConfig) => s.id !== id);
    await fs.writeFile(userConfigPath, JSON.stringify(config, null, 2));
  } catch {
    // ignore
  }
  return NextResponse.json({ success: true });
}

async function callTool(serverId: string, toolName: string, args: Record<string, unknown>) {
  // Built-in server'lar için stub implementasyon
  // Gerçek MCP protocol stdio/SSE transport gerektirir

  const server = BUILTIN_SERVERS.find((s) => s.id === serverId);
  if (!server) {
    return NextResponse.json({ error: "Server bulunamadı" }, { status: 404 });
  }

  // Filesystem stub
  if (serverId === "mcp-filesystem") {
    if (toolName === "read_file") {
      const filePath = args.path as string;
      try {
        const content = await fs.readFile(filePath, "utf-8");
        return NextResponse.json({ result: content });
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Okuma hatası" });
      }
    }
    if (toolName === "write_file") {
      try {
        await fs.writeFile(args.path as string, args.content as string);
        return NextResponse.json({ result: "Yazıldı" });
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Yazma hatası" });
      }
    }
    if (toolName === "list_directory") {
      try {
        const entries = await fs.readdir(args.path as string, { withFileTypes: true });
        return NextResponse.json({
          result: entries.map((e) => ({ name: e.name, type: e.isDirectory() ? "dir" : "file" })),
        });
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Listeleme hatası" });
      }
    }
  }

  // Diğerleri için stub
  return NextResponse.json({
    stub: true,
    message: `${server.name} / ${toolName} - gerçek MCP transport için server'ı başlatmanız gerekir`,
    args,
  });
}
