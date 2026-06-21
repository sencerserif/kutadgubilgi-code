"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  RefreshCw,
  FilePlus,
  FolderPlus,
  Search,
  Trash2,
  Loader2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { FileNode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getLanguageFromPath } from "@/lib/language";

export function FileTree() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ path: string; line: number; content: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));

  const { openFile, activeFile, setSettingsOpen } = useStore();

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files?action=tree");
      const data = await res.json();
      if (data.tree) {
        setTree(data.tree);
      }
    } catch (err) {
      toast.error("Dosya ağacı yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Auto-refresh file tree every 3 seconds (file watching simulation)
  useEffect(() => {
    const interval = setInterval(() => {
      loadTree();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadTree]);

  // Refresh on window focus
  useEffect(() => {
    const onFocus = () => loadTree();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadTree]);

  const handleOpenFile = async (path: string, name: string) => {
    try {
      const res = await fetch(
        `/api/files?action=read&path=${encodeURIComponent(path)}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      openFile({
        path,
        name,
        content: data.content,
        language: getLanguageFromPath(name),
        isDirty: false,
        originalContent: data.content,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya açılamadı");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          query: searchQuery,
          path: "",
        }),
      });
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch {
      toast.error("Arama başarısız");
    } finally {
      setSearching(false);
    }
  };

  const handleNewFile = async () => {
    const name = window.prompt("Yeni dosya adı (örn: src/index.ts):");
    if (!name) return;
    try {
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write",
          path: name,
          content: "",
        }),
      });
      toast.success(`${name} oluşturuldu`);
      loadTree();
      handleOpenFile(name, name.split("/").pop() ?? name);
    } catch {
      toast.error("Dosya oluşturulamadı");
    }
  };

  const handleNewFolder = async () => {
    const name = window.prompt("Yeni klasör adı:");
    if (!name) return;
    try {
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mkdir", path: name }),
      });
      toast.success(`${name} klasörü oluşturuldu`);
      loadTree();
    } catch {
      toast.error("Klasör oluşturulamadı");
    }
  };

  const handleDelete = async (path: string) => {
    if (!window.confirm(`${path} silinsin mi?`)) return;
    try {
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", path }),
      });
      toast.success(`${path} silindi`);
      loadTree();
    } catch {
      toast.error("Silme başarısız");
    }
  };

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (node: FileNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expanded.has(node.path);
    const isActive = activeFile === node.path;

    if (node.type === "directory") {
      return (
        <div key={node.path}>
          <div
            className="flex items-center gap-1 px-2 py-1 hover:bg-accent rounded cursor-pointer text-sm group"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => toggleExpand(node.path)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="truncate">{node.name}</span>
            <button
              className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(node.path);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          {isExpanded &&
            node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        className={`flex items-center gap-1 px-2 py-1 hover:bg-accent rounded cursor-pointer text-sm group ${
          isActive ? "bg-accent text-foreground" : ""
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => handleOpenFile(node.path, node.name)}
      >
        <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{node.name}</span>
        <button
          className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(node.path);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Header */}
      <div className="border-b border-sidebar-border px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Gezgin
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleNewFile}
              title="Yeni Dosya"
            >
              <FilePlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleNewFolder}
              title="Yeni Klasör"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={loadTree}
              title="Yenile"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Dosyalarda ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
              if (e.key === "Escape") {
                setSearchQuery("");
                setSearchResults([]);
              }
            }}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Tree / Search Results */}
      <div className="flex-1 overflow-y-auto py-1">
        {searchResults.length > 0 ? (
          <div className="px-2">
            <div className="text-xs text-muted-foreground mb-1 px-1">
              {searchResults.length} sonuç
            </div>
            {searchResults.map((r, i) => (
              <div
                key={i}
                className="px-2 py-1.5 hover:bg-accent rounded cursor-pointer text-xs"
                onClick={() => handleOpenFile(r.path, r.path.split("/").pop() ?? r.path)}
              >
                <div className="text-foreground truncate">{r.path}</div>
                <div className="text-muted-foreground truncate">
                  L{r.line}: {r.content}
                </div>
              </div>
            ))}
          </div>
        ) : searching ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : tree.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {loading ? "Yükleniyor..." : "Workspace boş"}
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleNewFile}
              >
                <FilePlus className="h-3 w-3 mr-1" />
                İlk dosyayı oluştur
              </Button>
            </div>
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}
