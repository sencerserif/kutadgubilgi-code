import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLAB_DIR = "/home/z/my-project/workspace/collab";

interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursor?: { file: string; line: number };
  lastSeen: number;
}

interface CollabMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  timestamp: number;
  provider?: string;
  model?: string;
}

interface CollabSession {
  id: string;
  name: string;
  users: CollabUser[];
  messages: CollabMessage[];
  createdAt: number;
  updatedAt: number;
}

async function ensureDir() {
  await fs.mkdir(COLLAB_DIR, { recursive: true });
}

async function getSession(id: string): Promise<CollabSession | null> {
  try {
    const data = await fs.readFile(path.join(COLLAB_DIR, `${id}.json`), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveSession(session: CollabSession) {
  await ensureDir();
  await fs.writeFile(
    path.join(COLLAB_DIR, `${session.id}.json`),
    JSON.stringify(session, null, 2)
  );
}

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"];

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  const sessionId = req.nextUrl.searchParams.get("session");

  try {
    if (action === "list") {
      await ensureDir();
      const files = await fs.readdir(COLLAB_DIR).catch(() => []);
      const sessions = [];
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const s = JSON.parse(await fs.readFile(path.join(COLLAB_DIR, file), "utf-8"));
            sessions.push({
              id: s.id,
              name: s.name,
              userCount: s.users?.length ?? 0,
              messageCount: s.messages?.length ?? 0,
              updatedAt: s.updatedAt,
            });
          } catch {
            // skip
          }
        }
      }
      return NextResponse.json({ sessions });
    }

    if (action === "get" && sessionId) {
      const session = await getSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session bulunamadı" }, { status: 404 });
      }
      // Stale user cleanup (5 dk)
      const now = Date.now();
      session.users = session.users.filter((u) => now - u.lastSeen < 5 * 60 * 1000);
      await saveSession(session);
      return NextResponse.json({ session });
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "hata" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const id = createHash("md5").update(`${Date.now()}`).digest("hex").slice(0, 8);
      const session: CollabSession = {
        id,
        name: body.name ?? `Session ${id}`,
        users: [],
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveSession(session);
      return NextResponse.json({ session });
    }

    if (action === "join") {
      const session = await getSession(body.sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session bulunamadı" }, { status: 404 });
      }
      let user = session.users.find((u) => u.id === body.userId);
      if (!user) {
        user = {
          id: body.userId,
          name: body.userName ?? `User ${body.userId.slice(0, 4)}`,
          color: COLORS[session.users.length % COLORS.length],
          lastSeen: Date.now(),
        };
        session.users.push(user);
      } else {
        user.lastSeen = Date.now();
        if (body.userName) user.name = body.userName;
      }
      session.updatedAt = Date.now();
      await saveSession(session);
      return NextResponse.json({ session, user });
    }

    if (action === "heartbeat") {
      const session = await getSession(body.sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session bulunamadı" }, { status: 404 });
      }
      const user = session.users.find((u) => u.id === body.userId);
      if (user) {
        user.lastSeen = Date.now();
        if (body.cursor) user.cursor = body.cursor;
        session.updatedAt = Date.now();
        await saveSession(session);
      }
      return NextResponse.json({ ok: true, session });
    }

    if (action === "leave") {
      const session = await getSession(body.sessionId);
      if (!session) return NextResponse.json({ ok: true });
      session.users = session.users.filter((u) => u.id !== body.userId);
      session.updatedAt = Date.now();
      await saveSession(session);
      return NextResponse.json({ ok: true });
    }

    if (action === "send") {
      const session = await getSession(body.sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session bulunamadı" }, { status: 404 });
      }
      const user = session.users.find((u) => u.id === body.userId);
      if (!user) {
        return NextResponse.json({ error: "Kullanıcı session'da değil" }, { status: 403 });
      }
      const message: CollabMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: user.id,
        userName: user.name,
        userColor: user.color,
        content: body.content,
        timestamp: Date.now(),
        provider: body.provider,
        model: body.model,
      };
      session.messages.push(message);
      session.updatedAt = Date.now();
      await saveSession(session);
      return NextResponse.json({ message, session });
    }

    if (action === "clear") {
      const session = await getSession(body.sessionId);
      if (!session) return NextResponse.json({ ok: true });
      session.messages = [];
      session.updatedAt = Date.now();
      await saveSession(session);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "hata" }, { status: 500 });
  }
}
