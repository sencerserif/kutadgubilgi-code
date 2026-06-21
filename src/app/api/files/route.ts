import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKSPACE_ROOT = "/home/z/my-project/workspace";

// Güvenlik: path workspace içinde olmalı
function safePath(p: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, p);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error("Geçersiz yol: workspace dışına çıkılamaz");
  }
  return resolved;
}

async function ensureWorkspace() {
  try {
    await fs.mkdir(WORKSPACE_ROOT, { recursive: true });
  } catch {
    // already exists
  }
}

export async function GET(req: NextRequest) {
  await ensureWorkspace();
  const action = req.nextUrl.searchParams.get("action");
  const relPath = req.nextUrl.searchParams.get("path") ?? "";

  try {
    if (action === "list") {
      return await handleList(relPath);
    }
    if (action === "read") {
      return await handleRead(relPath);
    }
    if (action === "tree") {
      return await handleTree();
    }
    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await ensureWorkspace();
  const body = await req.json();
  const { action } = body;

  try {
    if (action === "write") {
      return await handleWrite(body.path, body.content);
    }
    if (action === "mkdir") {
      return await handleMkdir(body.path);
    }
    if (action === "delete") {
      return await handleDelete(body.path);
    }
    if (action === "rename") {
      return await handleRename(body.from, body.to);
    }
    if (action === "search") {
      return await handleSearch(body.query, body.path ?? "");
    }
    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleList(relPath: string) {
  const abs = safePath(relPath);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const result = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(relPath, entry.name);
      const full = path.join(abs, entry.name);
      let size = 0;
      if (entry.isFile()) {
        try {
          const stat = await fs.stat(full);
          size = stat.size;
        } catch {
          // ignore
        }
      }
      return {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? "directory" : "file",
        size,
      };
    })
  );
  // Önce klasörler, sonra dosyalar, alfabetik
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return NextResponse.json({ entries: result });
}

async function handleRead(relPath: string) {
  const abs = safePath(relPath);
  const content = await fs.readFile(abs, "utf-8");
  return NextResponse.json({ content, path: relPath });
}

async function handleTree() {
  const tree = await buildTree("");
  return NextResponse.json({ tree });
}

async function buildTree(relPath: string): Promise<unknown> {
  const abs = safePath(relPath);
  let entries;
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return null;
  }

  const children = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
      .map(async (entry) => {
        const entryPath = path.join(relPath, entry.name);
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: entryPath,
            type: "directory",
            children: await buildTree(entryPath),
          };
        }
        return {
          name: entry.name,
          path: entryPath,
          type: "file",
        };
      })
  );

  return children.filter(Boolean).sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function handleWrite(relPath: string, content: string) {
  const abs = safePath(relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf-8");
  return NextResponse.json({ success: true, path: relPath });
}

async function handleMkdir(relPath: string) {
  const abs = safePath(relPath);
  await fs.mkdir(abs, { recursive: true });
  return NextResponse.json({ success: true });
}

async function handleDelete(relPath: string) {
  const abs = safePath(relPath);
  const stat = await fs.stat(abs);
  if (stat.isDirectory()) {
    await fs.rm(abs, { recursive: true });
  } else {
    await fs.unlink(abs);
  }
  return NextResponse.json({ success: true });
}

async function handleRename(from: string, to: string) {
  const fromAbs = safePath(from);
  const toAbs = safePath(to);
  await fs.rename(fromAbs, toAbs);
  return NextResponse.json({ success: true });
}

async function handleSearch(query: string, relPath: string) {
  if (!query) {
    return NextResponse.json({ results: [] });
  }
  const abs = safePath(relPath);
  const results: Array<{ path: string; line: number; content: string }> = [];
  await searchRecursive(abs, relPath, query, results);
  return NextResponse.json({ results: results.slice(0, 100) });
}

async function searchRecursive(
  absDir: string,
  relDir: string,
  query: string,
  results: Array<{ path: string; line: number; content: string }>
) {
  const lowerQuery = query.toLowerCase();
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
      await searchRecursive(full, rel, query, results);
    } else {
      try {
        const content = await fs.readFile(full, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            results.push({
              path: rel,
              line: i + 1,
              content: lines[i].trim().slice(0, 200),
            });
            if (results.length >= 100) return;
          }
        }
      } catch {
        // binary or unreadable - skip
      }
    }
  }
}

// Helper: generate unique file id
export function fileId(p: string): string {
  return createHash("md5").update(p).digest("hex").slice(0, 8);
}
