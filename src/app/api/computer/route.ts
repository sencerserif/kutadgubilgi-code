import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const execAsync = promisify(exec);

interface ComputerAction {
  action:
    | "screenshot"
    | "mouse_move"
    | "left_click"
    | "right_click"
    | "double_click"
    | "triple_click"
    | "left_click_drag"
    | "type"
    | "key"
    | "scroll"
    | "wait"
    | "cursor_position"
    | "bash"
    | "file_read"
    | "file_write"
    | "file_list"
    | "window_list"
    | "open_app";
  coordinate?: [number, number];
  text?: string;
  scroll_direction?: "up" | "down" | "left" | "right";
  scroll_amount?: number;
  duration?: number;
  command?: string;
  path?: string;
  content?: string;
}

interface ComputerRequest {
  actions: ComputerAction[];
  // Güvenlik: tehlikeli komutları engelle
  allowDangerous?: boolean;
}

// Tehlikeli komut pattern'leri
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+\/($|\s)/i,
  /\brm\s+-rf\s+~/i,
  /\bmkfs\b/i,
  /\bdd\s+if=.*of=\/dev\//i,
  /\b:\(\)\s*\{/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  /\bpoweroff\b/i,
  /\bchmod\s+777\s+\//i,
  /\biptables\b/i,
  /\bnetstat\b/i,
  // Dosya silme
  /\brm\s+-rf\s+\//i,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command));
}

// Platform tespiti
function getPlatform(): "linux" | "mac" | "windows" {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "mac";
  return "linux";
}

// Screenshot al (platform bazlı)
async function takeScreenshot(): Promise<{ image: string; width: number; height: number }> {
  const platform = getPlatform();
  const tmpDir = "/tmp/computer-use";
  await fs.mkdir(tmpDir, { recursive: true });
  const screenshotPath = path.join(tmpDir, `screen-${Date.now()}.png`);

  let cmd = "";
  if (platform === "linux") {
    // xdotool + scrot veya import (ImageMagick)
    try {
      await execAsync("which scrot");
      cmd = `scrot ${screenshotPath}`;
    } catch {
      try {
        await execAsync("which import");
        cmd = `import -window root ${screenshotPath}`;
      } catch {
        // GNOME/KDE
        cmd = `gnome-screenshot -f ${screenshotPath} 2>/dev/null || spectacle -f ${screenshotPath} 2>/dev/null || true`;
      }
    }
  } else if (platform === "mac") {
    cmd = `screencapture -x ${screenshotPath}`;
  } else {
    // Windows - PowerShell
    cmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | ForEach-Object { $bitmap = New-Object System.Drawing.Bitmap($_.Width, $_.Height); $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($_.Location, [System.Drawing.Point]::Empty, $_.Size); $bitmap.Save('${screenshotPath}'); $graphics.Dispose(); $bitmap.Dispose() }"`;
  }

  try {
    await execAsync(cmd, { timeout: 10000 });
    // Base64'e çevir
    const imageBuffer = await fs.readFile(screenshotPath);
    const base64 = imageBuffer.toString("base64");

    // Çözünürlük al
    let width = 1920;
    let height =  1080;
    try {
      const { stdout } = await execAsync(
        platform === "linux"
          ? "xdpyinfo | grep dimensions || xrandr | grep '*'"
          : platform === "mac"
          ? "system_profiler SPDisplaysDataType | grep Resolution"
          : "powershell -command \"[System.Windows.Forms.Screen]::PrimaryScreen.Bounds\""
      );
      const match = stdout.match(/(\d+)x(\d+)/);
      if (match) {
        width = parseInt(match[1]);
        height = parseInt(match[2]);
      }
    } catch {
      // varsayılan
    }

    await fs.unlink(screenshotPath).catch(() => {});
    return { image: base64, width, height };
  } catch (err) {
    throw new Error(
      `Screenshot alınamadı. ${platform === "linux" ? "scrot/import/gnome-screenshot kurulu mu? X11 session gerekli." : "Hata: " + (err instanceof Error ? err.message : "bilinmiyor")}`
    );
  }
}

// Mouse kontrolü (xdotool / cliclick / nircmd)
async function mouseAction(
  action: string,
  coordinate?: [number, number],
  scrollDir?: string,
  scrollAmt?: number
): Promise<string> {
  const platform = getPlatform();
  let cmd = "";

  if (platform === "linux") {
    switch (action) {
      case "mouse_move":
        cmd = `xdotool mousemove ${coordinate?.[0] ?? 0} ${coordinate?.[1] ?? 0}`;
        break;
      case "left_click":
        cmd = coordinate
          ? `xdotool mousemove ${coordinate[0]} ${coordinate[1]} click 1`
          : "xdotool click 1";
        break;
      case "right_click":
        cmd = coordinate
          ? `xdotool mousemove ${coordinate[0]} ${coordinate[1]} click 3`
          : "xdotool click 3";
        break;
      case "double_click":
        cmd = coordinate
          ? `xdotool mousemove ${coordinate[0]} ${coordinate[1]} click --repeat 2 1`
          : "xdotool click --repeat 2 1";
        break;
      case "triple_click":
        cmd = coordinate
          ? `xdotool mousemove ${coordinate[0]} ${coordinate[1]} click --repeat 3 1`
          : "xdotool click --repeat 3 1";
        break;
      case "scroll":
        const button = scrollDir === "up" ? 4 : scrollDir === "down" ? 5 : 4;
        const repeat = Math.min(scrollAmt ?? 3, 10);
        cmd = `xdotool click --repeat ${repeat} ${button}`;
        break;
      case "cursor_position":
        cmd = "xdotool getmouselocation";
        break;
    }
  } else if (platform === "mac") {
    // cliclick (brew install cliclick)
    switch (action) {
      case "mouse_move":
        cmd = `cliclick m:${coordinate?.[0] ?? 0},${coordinate?.[1] ?? 0}`;
        break;
      case "left_click":
        cmd = coordinate
          ? `cliclick c:${coordinate[0]},${coordinate[1]}`
          : "cliclick c";
        break;
      case "right_click":
        cmd = coordinate
          ? `cliclick rc:${coordinate[0]},${coordinate[1]}`
          : "cliclick rc";
        break;
      case "double_click":
        cmd = coordinate
          ? `cliclick dc:${coordinate[0]},${coordinate[1]}`
          : "cliclick dc";
        break;
      case "scroll":
        const dir = scrollDir === "up" ? "u" : "d";
        cmd = `cliclick scroll:${dir}:${Math.min(scrollAmt ?? 3, 10)}`;
        break;
    }
  } else {
    // Windows - PowerShell + user32.dll
    const x = coordinate?.[0] ?? 0;
    const y = coordinate?.[1] ?? 0;
    switch (action) {
      case "mouse_move":
        cmd = `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\\"user32.dll\\")] public static extern bool SetCursorPos(int x, int y); }'; [Mouse]::SetCursorPos(${x}, ${y})"`;
        break;
      case "left_click":
        cmd = `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint cButtons, uint dwExtraInfo); }'; [Mouse]::mouse_event(2, 0, 0, 0, 0); [Mouse]::mouse_event(4, 0, 0, 0, 0)"`;
        break;
    }
  }

  if (!cmd) return "Aksiyon desteklenmiyor";

  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    return stdout.trim() || "OK";
  } catch (err) {
    throw new Error(
      `${action} başarısız. ${platform === "linux" ? "xdotool kurulu mu?" : platform === "mac" ? "cliclick kurulu mu? (brew install cliclick)" : "Hata: " + (err instanceof Error ? err.message : "")}`
    );
  }
}

// Keyboard kontrolü
async function keyboardAction(
  action: "type" | "key",
  text: string
): Promise<string> {
  const platform = getPlatform();
  let cmd = "";

  if (platform === "linux") {
    if (action === "type") {
      // Escape special chars
      const escaped = text.replace(/'/g, "'\\''");
      cmd = `xdotool type --delay 50 '${escaped}'`;
    } else {
      // key: 'Return', 'control+c', 'alt+Tab'
      const xdotoolKey = text
        .replace(/\+/g, "+")
        .replace(/enter|return/i, "Return")
        .replace(/escape|esc/i, "Escape")
        .replace(/tab/i, "Tab")
        .replace(/space/i, "space")
        .replace(/backspace/i, "BackSpace")
        .replace(/delete|del/i, "Delete");
      cmd = `xdotool key ${xdotoolKey}`;
    }
  } else if (platform === "mac") {
    if (action === "type") {
      const escaped = text.replace(/"/g, '\\"');
      cmd = `osascript -e 'tell application "System Events" to keystroke "${escaped}"'`;
    } else {
      // AppleScript key codes
      const keyMap: Record<string, string> = {
        return: "return",
        enter: "return",
        escape: "escape",
        esc: "escape",
        tab: "tab",
        space: "space",
        backspace: "delete",
        delete: "forward delete",
      };
      const key = keyMap[text.toLowerCase()] ?? text;
      cmd = `osascript -e 'tell application "System Events" to key code (ASCII character of "${key}")'`;
    }
  } else {
    // Windows
    if (action === "type") {
      const escaped = text.replace(/"/g, '\\"');
      cmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')"`;
    } else {
      const sendKeysMap: Record<string, string> = {
        return: "{ENTER}",
        enter: "{ENTER}",
        escape: "{ESC}",
        esc: "{ESC}",
        tab: "{TAB}",
        backspace: "{BACKSPACE}",
        delete: "{DELETE}",
      };
      const key = sendKeysMap[text.toLowerCase()] ?? text;
      cmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${key}')"`;
    }
  }

  try {
    const { stdout } = await execAsync(cmd, { timeout: 30000 });
    return stdout.trim() || "OK";
  } catch (err) {
    throw new Error(
      `${action} başarısız: ${err instanceof Error ? err.message : "hata"}`
    );
  }
}

// Pencere listesi
async function listWindows(): Promise<string> {
  const platform = getPlatform();
  let cmd = "";
  if (platform === "linux") {
    cmd = "xdotool search --name '' getwindowname %@ 2>/dev/null | head -20";
  } else if (platform === "mac") {
    cmd = `osascript -e 'tell application "System Events" to get name of every process whose background only is false'`;
  } else {
    cmd = `powershell -command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object MainWindowTitle | Format-Table -HideTableHeaders"`;
  }

  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    return stdout.trim() || "(pencere yok)";
  } catch {
    return "(pencere listesi alınamadı)";
  }
}

// Uygulama aç
async function openApp(appName: string): Promise<string> {
  const platform = getPlatform();
  let cmd = "";
  if (platform === "linux") {
    cmd = `xdg-open ${appName} 2>/dev/null || ${appName} &`;
  } else if (platform === "mac") {
    cmd = `open -a "${appName}"`;
  } else {
    cmd = `start ${appName}`;
  }

  try {
    await execAsync(cmd, { timeout: 5000 });
    return `Uygulama açıldı: ${appName}`;
  } catch {
    return `Uygulama açılamadı: ${appName}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ComputerRequest = await req.json();
    const { actions, allowDangerous } = body;

    if (!actions || !Array.isArray(actions)) {
      return NextResponse.json({ error: "actions gerekli" }, { status: 400 });
    }

    const results: Array<{
      action: string;
      success: boolean;
      output?: string;
      image?: string;
      width?: number;
      height?: number;
      error?: string;
      requiresConfirmation?: boolean;
    }> = [];

    for (const action of actions) {
      try {
        switch (action.action) {
          case "screenshot": {
            const result = await takeScreenshot();
            results.push({
              action: "screenshot",
              success: true,
              output: `Ekran görüntüsü alındı (${result.width}x${result.height})`,
              image: result.image,
              width: result.width,
              height: result.height,
            });
            break;
          }

          case "mouse_move":
          case "left_click":
          case "right_click":
          case "double_click":
          case "triple_click":
          case "scroll":
          case "cursor_position": {
            const output = await mouseAction(
              action.action,
              action.coordinate,
              action.scroll_direction,
              action.scroll_amount
            );
            results.push({
              action: action.action,
              success: true,
              output,
            });
            break;
          }

          case "type":
          case "key": {
            if (!action.text) {
              results.push({
                action: action.action,
                success: false,
                error: "text parametresi gerekli",
              });
              break;
            }
            const output = await keyboardAction(action.action, action.text);
            results.push({
              action: action.action,
              success: true,
              output,
            });
            break;
          }

          case "wait": {
            const duration = Math.min(action.duration ?? 1, 30);
            await new Promise((r) => setTimeout(r, duration * 1000));
            results.push({
              action: "wait",
              success: true,
              output: `${duration} saniye beklendi`,
            });
            break;
          }

          case "bash": {
            if (!action.command) {
              results.push({
                action: "bash",
                success: false,
                error: "command parametresi gerekli",
              });
              break;
            }
            if (!allowDangerous && isDangerous(action.command)) {
              results.push({
                action: "bash",
                success: false,
                error: "Güvenlik: Tehlikeli komut engellendi",
                requiresConfirmation: true,
              });
              break;
            }
            try {
              const { stdout, stderr } = await execAsync(action.command, {
                timeout: 30000,
                maxBuffer: 1024 * 1024,
                cwd: process.env.HOME,
              });
              results.push({
                action: "bash",
                success: true,
                output: (stdout + (stderr ? `\n[stderr]\n${stderr}` : "")).slice(0, 10000) || "(çıktı yok)",
              });
            } catch (err) {
              const e = err as { stdout?: string; stderr?: string; code?: number };
              results.push({
                action: "bash",
                success: false,
                output: ((e.stdout ?? "") + (e.stderr ?? "")).slice(0, 10000),
                error: `exit ${e.code}`,
              });
            }
            break;
          }

          case "file_read": {
            if (!action.path) {
              results.push({ action: "file_read", success: false, error: "path gerekli" });
              break;
            }
            try {
              const content = await fs.readFile(action.path, "utf-8");
              results.push({
                action: "file_read",
                success: true,
                output: content.slice(0, 50000),
              });
            } catch (err) {
              results.push({
                action: "file_read",
                success: false,
                error: err instanceof Error ? err.message : "okuma hatası",
              });
            }
            break;
          }

          case "file_write": {
            if (!action.path || action.content === undefined) {
              results.push({ action: "file_write", success: false, error: "path ve content gerekli" });
              break;
            }
            try {
              await fs.mkdir(path.dirname(action.path), { recursive: true });
              await fs.writeFile(action.path, action.content, "utf-8");
              results.push({
                action: "file_write",
                success: true,
                output: `Yazıldı: ${action.path}`,
              });
            } catch (err) {
              results.push({
                action: "file_write",
                success: false,
                error: err instanceof Error ? err.message : "yazma hatası",
              });
            }
            break;
          }

          case "file_list": {
            const dirPath = action.path || process.env.HOME || ".";
            try {
              const entries = await fs.readdir(dirPath, { withFileTypes: true });
              const list = entries
                .map((e) => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
                .join("\n");
              results.push({
                action: "file_list",
                success: true,
                output: list || "(boş)",
              });
            } catch (err) {
              results.push({
                action: "file_list",
                success: false,
                error: err instanceof Error ? err.message : "liste hatası",
              });
            }
            break;
          }

          case "window_list": {
            const output = await listWindows();
            results.push({
              action: "window_list",
              success: true,
              output,
            });
            break;
          }

          case "open_app": {
            if (!action.text) {
              results.push({ action: "open_app", success: false, error: "text (app name) gerekli" });
              break;
            }
            const output = await openApp(action.text);
            results.push({
              action: "open_app",
              success: true,
              output,
            });
            break;
          }

          default:
            results.push({
              action: action.action,
              success: false,
              error: "Bilinmeyen aksiyon",
            });
        }
      } catch (err) {
        results.push({
          action: action.action,
          success: false,
          error: err instanceof Error ? err.message : "Bilinmeyen hata",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "hata" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    platform: getPlatform(),
    home: process.env.HOME,
    capabilities: {
      screenshot: true,
      mouse: true,
      keyboard: true,
      bash: true,
      fileSystem: true,
      windows: true,
    },
    tools: [
      "screenshot", "mouse_move", "left_click", "right_click", "double_click",
      "type", "key", "scroll", "wait", "bash", "file_read", "file_write",
      "file_list", "window_list", "open_app"
    ],
  });
}
