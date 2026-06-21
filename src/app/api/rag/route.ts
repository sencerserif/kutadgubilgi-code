import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RAG_DIR = "/home/z/my-project/workspace/rag";

interface RagChunk {
  documentId: string;
  filename: string;
  chunk: number;
  content: string;
  page?: number;
}

// Basit semantic search: TF-IDF + cosine similarity
// (gerçek bir embedding modeli için büyük bağımlılık gerekir)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "upload") {
      return await handleUpload(body);
    }
    if (action === "search") {
      return await handleSearch(body.query, body.topK ?? 5);
    }
    if (action === "list") {
      return await handleList();
    }
    if (action === "delete") {
      return await handleDelete(body.id);
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return handleList();
}

async function handleList() {
  await fs.mkdir(RAG_DIR, { recursive: true });
  const files = await fs.readdir(RAG_DIR).catch(() => []);
  const docs = [];
  for (const file of files) {
    if (file.endsWith(".meta.json")) {
      try {
        const meta = JSON.parse(
          await fs.readFile(path.join(RAG_DIR, file), "utf-8")
        );
        docs.push(meta);
      } catch {
        // skip
      }
    }
  }
  return NextResponse.json({ documents: docs });
}

async function handleUpload(body: {
  filename: string;
  content: string;
  type: string;
}) {
  await fs.mkdir(RAG_DIR, { recursive: true });
  const docId = `doc-${Date.now()}`;
  const filename = body.filename;
  const content = body.content;

  // Chunking: ~500 karakter, 100 overlap
  const chunks = chunkText(content, 500, 100);

  // TF-IDF için tüm chunk'ları kaydet
  const chunksFile = path.join(RAG_DIR, `${docId}.chunks.json`);
  await fs.writeFile(
    chunksFile,
    JSON.stringify(
      chunks.map((c, i) => ({
        documentId: docId,
        filename,
        chunk: i,
        content: c,
      })),
      null,
      2
    )
  );

  const meta = {
    id: docId,
    filename,
    path: chunksFile,
    size: content.length,
    chunks: chunks.length,
    uploadedAt: Date.now(),
    type: body.type,
  };

  await fs.writeFile(
    path.join(RAG_DIR, `${docId}.meta.json`),
    JSON.stringify(meta, null, 2)
  );

  return NextResponse.json({ success: true, document: meta });
}

async function handleSearch(query: string, topK: number) {
  if (!query) {
    return NextResponse.json({ sources: [] });
  }

  await fs.mkdir(RAG_DIR, { recursive: true });
  const files = await fs.readdir(RAG_DIR).catch(() => []);
  const allChunks: RagChunk[] = [];

  for (const file of files) {
    if (file.endsWith(".chunks.json")) {
      try {
        const chunks: RagChunk[] = JSON.parse(
          await fs.readFile(path.join(RAG_DIR, file), "utf-8")
        );
        allChunks.push(...chunks);
      } catch {
        // skip
      }
    }
  }

  if (allChunks.length === 0) {
    return NextResponse.json({ sources: [] });
  }

  // TF-IDF + cosine similarity (basit)
  const queryTokens = tokenize(query);
  const queryTf = tf(queryTokens);

  const scored = allChunks.map((chunk) => {
    const chunkTokens = tokenize(chunk.content);
    const chunkTf = tf(chunkTokens);
    const score = cosineSimilarity(queryTf, chunkTf, chunkTokens);
    return { ...chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK).filter((s) => s.score > 0);

  return NextResponse.json({
    sources: top.map((s) => ({
      documentId: s.documentId,
      filename: s.filename,
      chunk: s.chunk,
      content: s.content,
      score: s.score,
    })),
  });
}

async function handleDelete(id: string) {
  await fs.unlink(path.join(RAG_DIR, `${id}.chunks.json`)).catch(() => {});
  await fs.unlink(path.join(RAG_DIR, `${id}.meta.json`)).catch(() => {});
  return NextResponse.json({ success: true });
}

function chunkText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + size);
    chunks.push(chunk);
    i += size - overlap;
  }
  return chunks.length > 0 ? chunks : [text];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sçğıöşü]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function tf(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  tokens.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1));
  // Normalize
  const max = Math.max(...map.values(), 1);
  map.forEach((v, k) => map.set(k, v / max));
  return map;
}

function cosineSimilarity(
  queryTf: Map<string, number>,
  chunkTf: Map<string, number>,
  chunkTokens: string[]
): number {
  let dot = 0;
  let queryMag = 0;
  let chunkMag = 0;

  queryTf.forEach((v, k) => {
    queryMag += v * v;
    if (chunkTf.has(k)) {
      dot += v * (chunkTf.get(k) ?? 0);
    }
  });

  chunkTf.forEach((v) => {
    chunkMag += v * v;
  });

  // Boost: chunk token'larından kaç tanesi query'de var
  const matchBoost = chunkTokens.filter((t) => queryTf.has(t)).length /
    Math.max(chunkTokens.length, 1);

  if (queryMag === 0 || chunkMag === 0) return 0;
  return (dot / Math.sqrt(queryMag * chunkMag)) * 0.7 + matchBoost * 0.3;
}
