import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKSPACE = "/home/z/my-project/workspace";

interface LspBody {
  action: "info" | "hover" | "diagnostics" | "symbols" | "completions";
  path?: string;
  content?: string;
  line?: number;
  column?: number;
  language?: string;
}

// Basit dil algılama + sembolik analiz (gerçek LSP server gerektirmez)
function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    go: "go",
    rs: "rust",
    rb: "ruby",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
  };
  return map[ext] ?? "plaintext";
}

// Basit regex tabanlı sembol tespiti
function findSymbols(content: string, language: string) {
  const symbols: Array<{
    name: string;
    type: string;
    line: number;
    column: number;
    detail?: string;
  }> = [];

  const lines = content.split("\n");

  const patterns: Record<string, Array<{ type: string; regex: RegExp }>> = {
    typescript: [
      { type: "function", regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/ },
      { type: "function", regex: /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/ },
      { type: "function", regex: /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?function/ },
      { type: "class", regex: /(?:export\s+)?class\s+(\w+)/ },
      { type: "interface", regex: /(?:export\s+)?interface\s+(\w+)/ },
      { type: "type", regex: /(?:export\s+)?type\s+(\w+)/ },
      { type: "const", regex: /(?:export\s+)?const\s+(\w+)\s*[:=]/ },
      { type: "variable", regex: /(?:let|var)\s+(\w+)\s*[:=]/ },
    ],
    javascript: [
      { type: "function", regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/ },
      { type: "function", regex: /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/ },
      { type: "function", regex: /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?function/ },
      { type: "class", regex: /(?:export\s+)?class\s+(\w+)/ },
      { type: "const", regex: /(?:export\s+)?const\s+(\w+)\s*[:=]/ },
      { type: "variable", regex: /(?:let|var)\s+(\w+)\s*[:=]/ },
    ],
    python: [
      { type: "function", regex: /def\s+(\w+)/ },
      { type: "class", regex: /class\s+(\w+)/ },
      { type: "variable", regex: /^(\w+)\s*=/ },
      { type: "import", regex: /^(?:from\s+\S+\s+)?import\s+(\w+)/ },
    ],
    go: [
      { type: "function", regex: /func\s+(?:\([^)]*\)\s+)?(\w+)/ },
      { type: "type", regex: /type\s+(\w+)/ },
      { type: "const", regex: /const\s+(\w+)/ },
      { type: "variable", regex: /var\s+(\w+)/ },
    ],
    rust: [
      { type: "function", regex: /(?:pub\s+)?fn\s+(\w+)/ },
      { type: "struct", regex: /(?:pub\s+)?struct\s+(\w+)/ },
      { type: "enum", regex: /(?:pub\s+)?enum\s+(\w+)/ },
      { type: "trait", regex: /(?:pub\s+)?trait\s+(\w+)/ },
      { type: "const", regex: /(?:pub\s+)?const\s+(\w+)/ },
    ],
  };

  const langPatterns = patterns[language] ?? patterns.typescript;

  lines.forEach((line, lineIdx) => {
    for (const { type, regex } of langPatterns) {
      const match = line.match(regex);
      if (match) {
        const name = match[1];
        symbols.push({
          name,
          type,
          line: lineIdx + 1,
          column: line.indexOf(name) + 1,
          detail: line.trim().slice(0, 100),
        });
        break;
      }
    }
  });

  return symbols;
}

// Basit diagnostics (lint benzeri)
function findDiagnostics(content: string, language: string) {
  const diagnostics: Array<{
    line: number;
    column: number;
    severity: "error" | "warning" | "info";
    message: string;
    rule?: string;
  }> = [];

  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    // Common issues
    if (/\bconsole\.log\b/.test(line) && (language === "typescript" || language === "javascript")) {
      diagnostics.push({
        line: idx + 1,
        column: line.indexOf("console.log") + 1,
        severity: "info",
        message: "console.log bulundu - production'da kaldırın",
        rule: "no-console",
      });
    }

    if (/\bvar\s+/.test(line) && (language === "typescript" || language === "javascript")) {
      diagnostics.push({
        line: idx + 1,
        column: line.indexOf("var") + 1,
        severity: "warning",
        message: "var yerine let/const kullanın",
        rule: "no-var",
      });
    }

    if (/\b(any|Any)\b/.test(line) && language === "typescript") {
      diagnostics.push({
        line: idx + 1,
        column: 0,
        severity: "warning",
        message: "any tipi kullanımı - daha spesifik tip kullanın",
        rule: "no-explicit-any",
      });
    }

    if (/\bdebugger\b/.test(line)) {
      diagnostics.push({
        line: idx + 1,
        column: line.indexOf("debugger") + 1,
        severity: "warning",
        message: "debugger ifadesi bulundu",
        rule: "no-debugger",
      });
    }

    // Trailing whitespace
    if (/\s$/.test(line) && line.length > 0) {
      diagnostics.push({
        line: idx + 1,
        column: line.length,
        severity: "info",
        message: "Sonda boşluk var",
        rule: "no-trailing-whitespace",
      });
    }

    // Long line
    if (line.length > 120) {
      diagnostics.push({
        line: idx + 1,
        column: 120,
        severity: "info",
        message: `Satır çok uzun (${line.length} karakter)`,
        rule: "max-line-length",
      });
    }

    // TODO/FIXME
    const todoMatch = line.match(/\b(TODO|FIXME|HACK|XXX)\b/);
    if (todoMatch) {
      diagnostics.push({
        line: idx + 1,
        column: line.indexOf(todoMatch[1]) + 1,
        severity: "info",
        message: `${todoMatch[1]} bulundu`,
        rule: "todo-comment",
      });
    }
  });

  return diagnostics;
}

// Hover info
function getHoverInfo(
  content: string,
  line: number,
  column: number,
  language: string
): { content: string; type?: string } | null {
  const lines = content.split("\n");
  if (line < 1 || line > lines.length) return null;
  const lineContent = lines[line - 1];

  // Word under cursor
  const beforeCursor = lineContent.slice(0, column);
  const wordMatch = beforeCursor.match(/(\w+)$/);
  if (!wordMatch) return null;
  const word = wordMatch[1];

  // Find definition
  const symbols = findSymbols(content, language);
  const def = symbols.find((s) => s.name === word);
  if (def) {
    return {
      content: `**${def.type}** \`${def.name}\`\n\n${def.detail ?? ""}`,
      type: def.type,
    };
  }

  // Built-in patterns
  if (word === "console" && (language === "typescript" || language === "javascript")) {
    return {
      content: "**console** - Debugging API\n\n`console.log()`, `console.error()`, `console.warn()` vb.",
      type: "builtin",
    };
  }

  return null;
}

// Completions
function getCompletions(
  content: string,
  line: number,
  column: number,
  language: string
): Array<{ label: string; detail?: string; kind: string }> {
  const lines = content.split("\n");
  const lineContent = line >= 1 && line <= lines.length ? lines[line - 1] : "";
  const beforeCursor = lineContent.slice(0, column);
  const wordMatch = beforeCursor.match(/(\w+)$/);
  const prefix = wordMatch ? wordMatch[1] : "";

  const completions: Array<{ label: string; detail?: string; kind: string }> = [];

  // Symbols from file
  const symbols = findSymbols(content, language);
  symbols.forEach((s) => {
    if (!prefix || s.name.startsWith(prefix)) {
      completions.push({
        label: s.name,
        detail: s.type,
        kind: s.type,
      });
    }
  });

  // Language keywords
  const keywords: Record<string, string[]> = {
    typescript: ["const", "let", "var", "function", "class", "interface", "type", "enum", "import", "export", "default", "async", "await", "return", "if", "else", "for", "while", "switch", "case", "break", "continue", "new", "this", "super", "extends", "implements"],
    javascript: ["const", "let", "var", "function", "class", "import", "export", "default", "async", "await", "return", "if", "else", "for", "while", "switch", "case", "break", "continue", "new", "this", "super", "extends"],
    python: ["def", "class", "import", "from", "as", "if", "elif", "else", "for", "while", "try", "except", "finally", "return", "yield", "lambda", "with", "async", "await", "self", "True", "False", "None"],
    go: ["func", "var", "const", "type", "struct", "interface", "package", "import", "if", "else", "for", "switch", "case", "default", "return", "go", "defer", "select", "chan", "map", "range"],
    rust: ["fn", "let", "const", "static", "struct", "enum", "trait", "impl", "pub", "use", "mod", "if", "else", "for", "while", "loop", "match", "return", "self", "Self", "mut", "ref", "move", "async", "await"],
  };

  const langKeywords = keywords[language] ?? keywords.typescript;
  langKeywords.forEach((kw) => {
    if (!prefix || kw.startsWith(prefix)) {
      completions.push({
        label: kw,
        detail: "keyword",
        kind: "keyword",
      });
    }
  });

  return completions.slice(0, 50);
}

export async function POST(req: NextRequest) {
  try {
    const body: LspBody = await req.json();
    const { action } = body;

    let content = body.content ?? "";
    let language = body.language ?? "plaintext";
    let filename = body.path ?? "";

    // Dosyadan oku
    if (body.path && !content) {
      try {
        const abs = path.resolve(WORKSPACE, body.path);
        if (!abs.startsWith(WORKSPACE)) {
          return NextResponse.json({ error: "Geçersiz yol" }, { status: 400 });
        }
        content = await fs.readFile(abs, "utf-8");
        filename = body.path;
      } catch {
        return NextResponse.json({ error: "Dosya okunamadı" }, { status: 404 });
      }
    }

    if (!language || language === "plaintext") {
      language = detectLanguage(filename);
    }

    switch (action) {
      case "info": {
        const symbols = findSymbols(content, language);
        const diagnostics = findDiagnostics(content, language);
        return NextResponse.json({
          language,
          filename,
          symbols,
          diagnostics,
          stats: {
            lines: content.split("\n").length,
            characters: content.length,
            symbols: symbols.length,
            issues: diagnostics.length,
            errors: diagnostics.filter((d) => d.severity === "error").length,
            warnings: diagnostics.filter((d) => d.severity === "warning").length,
          },
        });
      }

      case "hover": {
        const hover = getHoverInfo(content, body.line ?? 1, body.column ?? 0, language);
        return NextResponse.json({ hover });
      }

      case "diagnostics": {
        const diagnostics = findDiagnostics(content, language);
        return NextResponse.json({ diagnostics });
      }

      case "symbols": {
        const symbols = findSymbols(content, language);
        return NextResponse.json({ symbols });
      }

      case "completions": {
        const completions = getCompletions(content, body.line ?? 1, body.column ?? 0, language);
        return NextResponse.json({ completions });
      }

      default:
        return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
    }
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "hata" }, { status: 500 });
  }
}
