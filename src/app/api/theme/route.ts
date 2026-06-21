import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THEME_DIR = "/home/z/my-project/workspace/themes";

interface Theme {
  id: string;
  name: string;
  isBuiltIn: boolean;
  colors: {
    background: string;
    foreground: string;
    card: string;
    border: string;
    primary: string;
    accent: string;
    sidebar: string;
    muted: string;
  };
  isDark: boolean;
  createdAt?: number;
}

const BUILTIN_THEMES: Theme[] = [
  {
    id: "dark",
    name: "Karanlık (varsayılan)",
    isBuiltIn: true,
    isDark: true,
    colors: {
      background: "#0a0a0b",
      foreground: "#fafafa",
      card: "#17181c",
      border: "#27272a",
      primary: "#f59e0b",
      accent: "#262626",
      sidebar: "#0f0f10",
      muted: "#3f3f46",
    },
  },
  {
    id: "light",
    name: "Aydınlık",
    isBuiltIn: true,
    isDark: false,
    colors: {
      background: "#ffffff",
      foreground: "#0a0a0b",
      card: "#f4f4f5",
      border: "#e4e4e7",
      primary: "#d97706",
      accent: "#f4f4f5",
      sidebar: "#fafafa",
      muted: "#d4d4d8",
    },
  },
  {
    id: "midnight",
    name: "Gece Yarısı Mavisi",
    isBuiltIn: true,
    isDark: true,
    colors: {
      background: "#0c1426",
      foreground: "#e2e8f0",
      card: "#1e293b",
      border: "#334155",
      primary: "#3b82f6",
      accent: "#1e3a5f",
      sidebar: "#0f172a",
      muted: "#475569",
    },
  },
  {
    id: "forest",
    name: "Orman Yeşili",
    isBuiltIn: true,
    isDark: true,
    colors: {
      background: "#0a1f0f",
      foreground: "#dcfce7",
      card: "#14532d",
      border: "#166534",
      primary: "#22c55e",
      accent: "#1a3a1f",
      sidebar: "#0d2818",
      muted: "#15803d",
    },
  },
  {
    id: "sunset",
    name: "Gün Batımı",
    isBuiltIn: true,
    isDark: true,
    colors: {
      background: "#1a0f1a",
      foreground: "#fef3c7",
      card: "#2d1b2d",
      border: "#4c1d4c",
      primary: "#ec4899",
      accent: "#3d1f3d",
      sidebar: "#1f0f1f",
      muted: "#5c2a5c",
    },
  },
  {
    id: "monokai",
    name: "Monokai",
    isBuiltIn: true,
    isDark: true,
    colors: {
      background: "#272822",
      foreground: "#f8f8f2",
      card: "#3e3d32",
      border: "#75715e",
      primary: "#a6e22e",
      accent: "#49483e",
      sidebar: "#1e1f1c",
      muted: "#75715e",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    isBuiltIn: true,
    isDark: true,
    colors: {
      background: "#282a36",
      foreground: "#f8f8f2",
      card: "#44475a",
      border: "#6272a4",
      primary: "#bd93f9",
      accent: "#44475a",
      sidebar: "#21222c",
      muted: "#6272a4",
    },
  },
];

export async function GET() {
  try {
    await fs.mkdir(THEME_DIR, { recursive: true });
    const files = await fs.readdir(THEME_DIR).catch(() => []);
    const customThemes: Theme[] = [];
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          customThemes.push(JSON.parse(await fs.readFile(path.join(THEME_DIR, file), "utf-8")));
        } catch {
          // skip
        }
      }
    }
    return NextResponse.json({ themes: [...BUILTIN_THEMES, ...customThemes] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "hata" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "save") {
      const theme: Theme = {
        ...body.theme,
        id: body.theme.id ?? `custom-${Date.now()}`,
        isBuiltIn: false,
        createdAt: Date.now(),
      };
      await fs.mkdir(THEME_DIR, { recursive: true });
      await fs.writeFile(
        path.join(THEME_DIR, `${theme.id}.json`),
        JSON.stringify(theme, null, 2)
      );
      return NextResponse.json({ theme });
    }

    if (action === "delete") {
      await fs.unlink(path.join(THEME_DIR, `${body.id}.json`)).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "hata" }, { status: 500 });
  }
}
