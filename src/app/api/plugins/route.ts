import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Plugin execution endpoint
// Built-in plugin'ler için stub implementasyon

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pluginId, action, config, input } = body;

    switch (pluginId) {
      case "plugin-web-search":
        return await webSearch(action, config, input);
      case "plugin-slack":
        return await slack(action, config, input);
      case "plugin-jira":
        return await jira(action, config, input);
      case "plugin-db":
        return await database(action, config, input);
      case "plugin-openapi":
        return await openapi(action, config, input);
      case "plugin-figma":
        return NextResponse.json({
          error: "Figma plugin için backend gerekli",
          stub: true,
        });
      default:
        return NextResponse.json({ error: "Bilinmeyen plugin" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function webSearch(action: string, config: { maxResults?: number; engine?: string }, input: { query: string }) {
  if (action !== "search") {
    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  }

  // DuckDuckGo HTML scraping (basit)
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AICodeStudio/1.0)",
      },
    });
    const html = await res.text();

    // Basit parse
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    const linkRegex = /<a rel="nofollow" class="result__a" href="([^"]+)">(.*?)<\/a>/g;
    const snippetRegex = /<a class="result__snippet"[^>]*>(.*?)<\/a>/g;

    let match;
    const links: Array<{ url: string; title: string }> = [];
    while ((match = linkRegex.exec(html)) !== null) {
      links.push({
        url: match[1],
        title: match[2].replace(/<[^>]+>/g, ""),
      });
    }

    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]+>/g, ""));
    }

    const max = config.maxResults ?? 5;
    for (let i = 0; i < Math.min(links.length, max); i++) {
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] ?? "",
      });
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({
      error: `Arama başarısız: ${err instanceof Error ? err.message : "hata"}`,
      results: [],
    });
  }
}

async function slack(action: string, config: { webhookUrl?: string; channel?: string }, input: { message: string }) {
  if (action !== "send") {
    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  }
  if (!config.webhookUrl) {
    return NextResponse.json({ error: "Webhook URL gerekli" }, { status: 400 });
  }

  const res = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: input.message,
      channel: config.channel,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Slack hatası ${res.status}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function jira(action: string, config: { domain?: string; apiToken?: string }, input: { query?: string; ticketId?: string }) {
  if (!config.domain || !config.apiToken) {
    return NextResponse.json({ error: "Jira yapılandırması eksik" }, { status: 400 });
  }

  // Stub - gerçek implementasyon için Atlassian SDK gerekir
  return NextResponse.json({
    stub: true,
    message: "Jira plugin stub mode - gerçek implementasyon için backend gerekir",
    config: { domain: config.domain },
  });
}

async function database(action: string, config: { connectionString?: string; type?: string }, input: { query?: string }) {
  if (action !== "query") {
    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  }
  if (!config.connectionString) {
    return NextResponse.json({ error: "Connection string gerekli" }, { status: 400 });
  }

  // Güvenlik: sadece SELECT izin ver
  const query = input.query?.trim() ?? "";
  if (!query.toUpperCase().startsWith("SELECT")) {
    return NextResponse.json({
      error: "Güvenlik: Sadece SELECT sorguları çalıştırılabilir",
    }, { status: 403 });
  }

  // Stub - gerçek implementasyon için pg/mysql2/sqlite3 gerekir
  return NextResponse.json({
    stub: true,
    message: "DB plugin stub mode - gerçek implementasyon için backend gerekir",
    query,
  });
}

async function openapi(action: string, config: { specUrl?: string }, input: { endpoint?: string; method?: string }) {
  if (!config.specUrl) {
    return NextResponse.json({ error: "Spec URL gerekli" }, { status: 400 });
  }

  try {
    const res = await fetch(config.specUrl);
    const spec = await res.json();
    return NextResponse.json({
      spec: {
        info: spec.info,
        paths: Object.keys(spec.paths ?? {}),
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: `Spec alınamadı: ${err instanceof Error ? err.message : "hata"}`,
    });
  }
}
