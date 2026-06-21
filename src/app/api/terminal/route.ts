import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const execAsync = promisify(exec);
const WORKSPACE_ROOT = "/home/z/my-project/workspace";

// Tehlikeli komutları engelle
const BLOCKED_PATTERNS = [
  /\brm\s+-rf\s+\/($|\s)/i, // rm -rf /
  /\bmkfs\b/i,
  /\bdd\s+if=.*of=\/dev\//i,
  /\b:\(\)\s*\{/i, // fork bomb
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
];

interface TerminalRequest {
  command: string;
  cwd?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { command, cwd }: TerminalRequest = await req.json();

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { error: "Komut gerekli" },
        { status: 400 }
      );
    }

    // Güvenlik kontrolü
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return NextResponse.json(
          {
            error: "Güvenlik: Bu komut engellendi",
            output: "",
            exitCode: 1,
          },
          { status: 403 }
        );
      }
    }

    const workingDir = cwd || WORKSPACE_ROOT;
    const timeout = 20000; // 20 saniye

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, TERM: "xterm-256color" },
      });

      const output = (stdout + (stderr ? `\n[stderr]\n${stderr}` : "")).trim();
      return NextResponse.json({
        output: output || "(çıktı yok)",
        exitCode: 0,
        command,
      });
    } catch (err: unknown) {
      const error = err as {
        stdout?: string;
        stderr?: string;
        code?: number;
        killed?: boolean;
        signal?: string;
      };
      const output =
        (error.stdout ?? "") + (error.stderr ? `\n[stderr]\n${error.stderr}` : "");
      const exitCode = error.killed ? -1 : (error.code ?? 1);

      return NextResponse.json({
        output: output.trim() || "Komut hatası",
        exitCode,
        command,
        timeout: error.killed && error.signal === "SIGTERM",
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
