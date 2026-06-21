"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Palette, Check, Plus, Trash2, Save } from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";

interface Theme {
  id: string;
  name: string;
  isBuiltIn: boolean;
  isDark: boolean;
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
}

export function ThemePanel() {
  const {
    themePanelOpen,
    setThemePanelOpen,
    activeThemeId,
    setActiveThemeId,
    customColors,
    setCustomColors,
  } = useStore();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editTheme, setEditTheme] = useState<Partial<Theme>>({
    name: "",
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
  });

  useEffect(() => {
    if (themePanelOpen) loadThemes();
  }, [themePanelOpen]);

  const loadThemes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/theme");
      const data = await res.json();
      setThemes(data.themes ?? []);
    } catch {
      toast.error("Temalar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (theme: Theme) => {
    setActiveThemeId(theme.id);
    setCustomColors(theme.colors);
    applyColorsToDocument(theme.colors, theme.isDark);
    toast.success(`${theme.name} teması uygulandı`);
  };

  const applyColorsToDocument = (
    colors: Record<string, string>,
    isDark: boolean
  ) => {
    const root = document.documentElement;
    root.style.setProperty("--background", colors.background);
    root.style.setProperty("--foreground", colors.foreground);
    root.style.setProperty("--card", colors.card);
    root.style.setProperty("--border", colors.border);
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--sidebar", colors.sidebar);
    root.style.setProperty("--muted", colors.muted);
    root.style.setProperty("--muted-foreground", colors.muted);
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const saveCustomTheme = async () => {
    if (!editTheme.name) {
      toast.error("İsim gerekli");
      return;
    }
    try {
      const res = await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", theme: editTheme }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await loadThemes();
      applyTheme(data.theme);
      setShowEditor(false);
      toast.success("Tema kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydetme hatası");
    }
  };

  const deleteTheme = async (id: string) => {
    try {
      await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      await loadThemes();
      toast.success("Tema silindi");
    } catch {
      toast.error("Silme hatası");
    }
  };

  return (
    <Sheet open={themePanelOpen} onOpenChange={setThemePanelOpen}>
      <SheetContent side="right" className="w-[450px] sm:w-[550px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Temalar
          </SheetTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowEditor(!showEditor)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Özel Tema
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {showEditor && (
            <div className="border border-border rounded-lg p-3 space-y-2 bg-secondary/20">
              <div className="text-xs font-medium">Yeni Tema Oluştur</div>
              <div>
                <Label className="text-xs">İsim</Label>
                <Input
                  value={editTheme.name ?? ""}
                  onChange={(e) =>
                    setEditTheme({ ...editTheme, name: e.target.value })
                  }
                  className="h-8 text-xs"
                  placeholder="örn: Okyanus Mavisi"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Karanlık mod</Label>
                <input
                  type="checkbox"
                  checked={editTheme.isDark ?? true}
                  onChange={(e) =>
                    setEditTheme({ ...editTheme, isDark: e.target.checked })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(editTheme.colors ?? {}).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={value}
                      onChange={(e) =>
                        setEditTheme({
                          ...editTheme,
                          colors: {
                            ...editTheme.colors,
                            [key]: e.target.value,
                          } as Theme["colors"],
                        })
                      }
                      className="h-6 w-8 rounded cursor-pointer"
                    />
                    <span className="text-[10px] capitalize">{key}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={saveCustomTheme}
                >
                  <Save className="h-3 w-3 mr-1" />
                  Kaydet & Uygula
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setShowEditor(false)}
                >
                  İptal
                </Button>
              </div>
            </div>
          )}

          {themes.map((theme) => {
            const isActive = activeThemeId === theme.id;
            return (
              <div
                key={theme.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  isActive ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
                onClick={() => applyTheme(theme)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{theme.name}</span>
                    {theme.isBuiltIn ? (
                      <Badge variant="outline" className="text-[9px] h-4">
                        builtin
                      </Badge>
                    ) : null}
                    {theme.isDark ? (
                      <Badge variant="outline" className="text-[9px] h-4">
                        karanlık
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] h-4">
                        aydınlık
                      </Badge>
                    )}
                    {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  {!theme.isBuiltIn && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTheme(theme.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-1">
                  {Object.entries(theme.colors).map(([key, color]) => (
                    <div
                      key={key}
                      className="h-6 flex-1 rounded"
                      style={{ backgroundColor: color }}
                      title={`${key}: ${color}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {!loading && themes.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <Palette className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Tema bulunamadı
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
