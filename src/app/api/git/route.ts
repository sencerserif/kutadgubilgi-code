import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execAsync = promisify(exec);
const WORKSPACE_ROOT = "/home/z/my-project/workspace";

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  try {
    switch (action) {
      case "status":
        return await gitStatus();
      case "log":
        return await gitLog();
      case "branches":
        return await gitBranches();
      case "diff":
        return await gitDiff();
      default:
        return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Git hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "init":
        return await gitInit();
      case "add":
        return await gitAdd(body.files ?? ".");
      case "commit":
        return await gitCommit(body.message);
      case "checkout":
        return await gitCheckout(body.branch);
      case "create-branch":
        return await gitCreateBranch(body.name);
      default:
        return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Git hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runGit(args: string): Promise<{ stdout: string; stderr: string }> {
  return execAsync(`git ${args}`, {
    cwd: WORKSPACE_ROOT,
    maxBuffer: 1024 * 1024,
  });
}

async function gitStatus() {
  try {
    const { stdout } = await runGit("status --porcelain=v1 --branch");
    const lines = stdout.split("\n").filter(Boolean);

    const branchLine = lines.find((l) => l.startsWith("##"));
    const branch = branchLine
      ? branchLine.replace("## ", "").split("...")[0]
      : "main";

    const files = lines
      .filter((l) => !l.startsWith("##"))
      .map((l) => ({
        status: l.slice(0, 2),
        file: l.slice(3),
      }));

    return NextResponse.json({ branch, files, raw: stdout });
  } catch (err) {
    return NextResponse.json({
      branch: null,
      files: [],
      error: "Git deposu değil",
      initialized: false,
    });
  }
}

async function gitLog() {
  try {
    const { stdout } = await runGit(
      'log --pretty=format:"%h|%an|%ad|%s" --date=short -20'
    );
    const commits = stdout.split("\n").map((line) => {
      const [hash, author, date, ...msgParts] = line.split("|");
      return {
        hash,
        author,
        date,
        message: msgParts.join("|"),
      };
    });
    return NextResponse.json({ commits });
  } catch {
    return NextResponse.json({ commits: [] });
  }
}

async function gitBranches() {
  try {
    const { stdout } = await runGit("branch -a");
    const branches = stdout
      .split("\n")
      .map((b) => b.trim().replace("*", "").trim())
      .filter(Boolean);
    return NextResponse.json({ branches });
  } catch {
    return NextResponse.json({ branches: [] });
  }
}

async function gitDiff() {
  try {
    const { stdout } = await runGit("diff HEAD");
    return NextResponse.json({ diff: stdout });
  } catch {
    return NextResponse.json({ diff: "" });
  }
}

async function gitInit() {
  try {
    await runGit("init");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Git init hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function gitAdd(files: string) {
  const { stdout, stderr } = await runGit(`add ${files}`);
  return NextResponse.json({ success: true, output: stdout + stderr });
}

async function gitCommit(message: string) {
  const safeMsg = message.replace(/"/g, '\\"');
  const { stdout, stderr } = await runGit(`commit -m "${safeMsg}"`);
  return NextResponse.json({ success: true, output: stdout + stderr });
}

async function gitCheckout(branch: string) {
  const { stdout, stderr } = await runGit(`checkout ${branch}`);
  return NextResponse.json({ success: true, output: stdout + stderr });
}

async function gitCreateBranch(name: string) {
  const { stdout, stderr } = await runGit(`checkout -b ${name}`);
  return NextResponse.json({ success: true, output: stdout + stderr });
}
