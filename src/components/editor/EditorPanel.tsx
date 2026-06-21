"use client";

import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import {
  X,
  Save,
  FileCode,
  GitBranch,
  GitCommit,
  RefreshCw,
  Loader2,
  Plus,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getLanguageColor } from "@/lib/language";

export function EditorPanel() {
  const {
    openFiles,
    activeFile,
    setActiveFile,
    closeFile,
    updateFileContent,
    saveFile,
  } = useStore();
  const [saving, setSaving] = useState<string | null>(null);

  const currentFile = openFiles.find((f) => f.path === activeFile);

  const handleSave = async (path: string) => {
    const file = openFiles.find((f) => f.path === path);
    if (!file) return;
    setSaving(path);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write",
          path,
          content: file.content,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      saveFile(path);
      toast.success(`${path.split("/").pop()} kaydedildi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydetme hatası");
    } finally {
      setSaving(null);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (activeFile) handleSave(activeFile);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFile, openFiles]);

  if (openFiles.length === 0 || !currentFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-900 text-muted-foreground">
        <FileCode className="h-12 w-12 mb-3 opacity-30" />
        <h3 className="text-sm font-medium mb-1">Düzenleyici</h3>
        <p className="text-xs text-center max-w-xs">
          Soldaki dosya ağacından bir dosya seçin veya yeni dosya oluşturun
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Tabs */}
      <div className="flex items-center border-b border-border bg-zinc-950 overflow-x-auto">
        {openFiles.map((file) => {
          const isActive = file.path === activeFile;
          return (
            <div
              key={file.path}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-border cursor-pointer text-xs whitespace-nowrap group ${
                isActive
                  ? "bg-zinc-900 text-foreground"
                  : "bg-zinc-950 text-muted-foreground hover:bg-zinc-900/50"
              }`}
              onClick={() => setActiveFile(file.path)}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getLanguageColor(file.language) }}
              />
              <span className={file.isDirty ? "italic" : ""}>
                {file.name}
              </span>
              {file.isDirty && <span className="text-amber-500">●</span>}
              <button
                className="ml-1 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  if (file.isDirty) {
                    if (!confirm("Kaydedilmemiş değişiklikler var. Kapatılsın mı?"))
                      return;
                  }
                  closeFile(file.path);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-zinc-950/50">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={() => currentFile && handleSave(currentFile.path)}
          disabled={!currentFile.isDirty || saving === currentFile.path}
        >
          {saving === currentFile.path ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Kaydet
        </Button>
        <div className="text-[10px] text-muted-foreground ml-2">
          {currentFile.path}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {currentFile.isDirty && (
            <Badge variant="outline" className="text-[9px] h-4 amber-500/20">
              <span className="text-amber-500">Değiştirildi</span>
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {currentFile.content.length} karakter · {currentFile.content.split("\n").length} satır
          </span>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          key={currentFile.path}
          path={currentFile.path}
          language={currentFile.language}
          value={currentFile.content}
          onChange={(value) => {
            if (value !== undefined) {
              updateFileContent(currentFile.path, value);
            }
          }}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "var(--font-jetbrains-mono), monospace",
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            automaticLayout: true,
            lineNumbers: "on",
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            padding: { top: 8, bottom: 8 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
          }}
        />
      </div>
    </div>
  );
}
