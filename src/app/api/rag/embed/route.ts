import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RAG_DIR = "/home/z/my-project/workspace/rag";

interface EmbedRequest {
  action: "embed" | "search" | "rebuild";
  text?: string;
  documentId?: string;
  apiKeys?: Record<string, string>;
  topK?: number;
  provider?: "openai" | "local";
  model?: string;
}

// Hash-based local embedding (fallback) - 256 dim
function simpleEmbed(text: string): Float32Array {
  const dim = 256;
  const vec = new Float32Array(dim);

  const tokens = text
    .toLowerCase()
    .replace(/[^\w\sçğıöşü]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;

    for (let i = 0; i < token.length - 1; i++) {
      const bigram = token.slice(i, i + 2);
      let h = 0;
      for (let j = 0; j < bigram.length; j++) {
        h = (h * 31 + bigram.charCodeAt(j)) | 0;
      }
      vec[Math.abs(h) % dim] += 0.5;
    }

    for (let i = 0; i < token.length - 2; i++) {
      const trigram = token.slice(i, i + 3);
      let h = 0;
      for (let j = 0; j < trigram.length; j++) {
        h = (h * 31 + trigram.charCodeAt(j)) | 0;
      }
      vec[Math.abs(h) % dim] += 0.3;
    }
  }

  let mag = 0;
  for (let i = 0; i < dim; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag);
  if (mag > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= mag;
  }
  return vec;
}

function cosineSim(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

// OpenAI embeddings (text-embedding-3-small - 1536 dim, $0.00002/1k token)
async function openaiEmbed(
  texts: string[],
  apiKey: string,
  model: string = "text-embedding-3-small"
): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI embeddings hatası ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.data ?? []).map((d: { embedding: number[] }) => d.embedding);
}

export async function POST(req: NextRequest) {
  try {
    const body: EmbedRequest = await req.json();
    const { action } = body;
    const useOpenAI = body.provider === "openai" && body.apiKeys?.openai;

    if (action === "embed") {
      if (useOpenAI) {
        try {
          const [embedding] = await openaiEmbed(
            [body.text ?? ""],
            body.apiKeys!.openai!,
            body.model
          );
          return NextResponse.json({ embedding, dim: embedding.length, provider: "openai" });
        } catch (err) {
          return NextResponse.json({
            error: err instanceof Error ? err.message : "OpenAI embed hatası",
            fallback: "local",
          }, { status: 500 });
        }
      }
      return NextResponse.json({
        embedding: Array.from(simpleEmbed(body.text ?? "")),
        dim: 256,
        provider: "local",
      });
    }

    if (action === "rebuild") {
      return await rebuildEmbeddings(useOpenAI, body.apiKeys?.openai, body.model);
    }

    if (action === "search") {
      return await searchEmbeddings(
        body.text ?? "",
        body.topK ?? 5,
        useOpenAI,
        body.apiKeys?.openai,
        body.model
      );
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function rebuildEmbeddings(
  useOpenAI: boolean,
  openaiKey?: string,
  model?: string
) {
  await fs.mkdir(RAG_DIR, { recursive: true });
  const files = await fs.readdir(RAG_DIR).catch(() => []);

  let totalChunks = 0;
  for (const file of files) {
    if (file.endsWith(".chunks.json")) {
      const docId = file.replace(".chunks.json", "");
      const chunksFile = path.join(RAG_DIR, file);
      const chunks = JSON.parse(await fs.readFile(chunksFile, "utf-8")) as Array<{
        documentId: string;
        filename: string;
        chunk: number;
        content: string;
      }>;

      let embedded: Array<typeof chunks[0] & { embedding: number[]; embeddingProvider: string }>;

      if (useOpenAI && openaiKey) {
        // OpenAI batch embedding (max 2048 input per request)
        const batchSize = 100;
        const allEmbeddings: number[][] = [];
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          const texts = batch.map((c) => c.content.slice(0, 8000));
          try {
            const batchEmbeddings = await openaiEmbed(texts, openaiKey, model);
            allEmbeddings.push(...batchEmbeddings);
          } catch {
            // Fallback to local for this batch
            batch.forEach((_, idx) => {
              allEmbeddings.push(Array.from(simpleEmbed(texts[idx])));
            });
          }
        }
        embedded = chunks.map((c, i) => ({
          ...c,
          embedding: allEmbeddings[i] ?? Array.from(simpleEmbed(c.content)),
          embeddingProvider: "openai",
        }));
      } else {
        embedded = chunks.map((c) => ({
          ...c,
          embedding: Array.from(simpleEmbed(c.content)),
          embeddingProvider: "local",
        }));
      }

      await fs.writeFile(
        path.join(RAG_DIR, `${docId}.embeddings.json`),
        JSON.stringify(embedded)
      );
      totalChunks += embedded.length;
    }
  }

  return NextResponse.json({
    success: true,
    embedded: totalChunks,
    provider: useOpenAI ? "openai" : "local",
  });
}

async function searchEmbeddings(
  query: string,
  topK: number,
  useOpenAI: boolean,
  openaiKey?: string,
  model?: string
) {
  if (!query) return NextResponse.json({ sources: [] });

  await fs.mkdir(RAG_DIR, { recursive: true });
  const files = await fs.readdir(RAG_DIR).catch(() => []);

  let queryVec: number[];
  if (useOpenAI && openaiKey) {
    try {
      const [emb] = await openaiEmbed([query], openaiKey, model);
      queryVec = emb;
    } catch {
      queryVec = Array.from(simpleEmbed(query));
    }
  } else {
    queryVec = Array.from(simpleEmbed(query));
  }

  const allResults: Array<{
    documentId: string;
    filename: string;
    chunk: number;
    content: string;
    score: number;
  }> = [];

  for (const file of files) {
    if (file.endsWith(".embeddings.json")) {
      try {
        const embedded = JSON.parse(
          await fs.readFile(path.join(RAG_DIR, file), "utf-8")
        ) as Array<{
          documentId: string;
          filename: string;
          chunk: number;
          content: string;
          embedding: number[];
        }>;

        for (const chunk of embedded) {
          const score = cosineSim(queryVec, chunk.embedding);
          allResults.push({
            documentId: chunk.documentId,
            filename: chunk.filename,
            chunk: chunk.chunk,
            content: chunk.content,
            score,
          });
        }
      } catch {
        // skip
      }
    }
  }

  allResults.sort((a, b) => b.score - a.score);
  const threshold = useOpenAI ? 0.3 : 0.05;
  const top = allResults.slice(0, topK).filter((r) => r.score > threshold);

  return NextResponse.json({
    sources: top,
    provider: useOpenAI ? "openai" : "local",
  });
}
