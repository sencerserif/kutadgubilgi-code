"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Upload,
  FileText,
  Trash2,
  Search,
  Database,
  FileCode,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import type { RagDocument, RagSource } from "@/types";
import { Switch } from "@/components/ui/switch";

export function RagPanel() {
  const {
    ragPanelOpen,
    setRagPanelOpen,
    ragDocuments,
    addRagDocument,
    removeRagDocument,
    setRagDocuments,
    ragUseEmbeddings,
    setRagUseEmbeddings,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RagSource[]>([]);
  const [rebuilding, setRebuilding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ragPanelOpen) loadDocs();
  }, [ragPanelOpen]);

  const loadDocs = async () => {
    try {
      const res = await fetch("/api/rag");
      const data = await res.json();
      setRagDocuments(data.documents ?? []);
    } catch {
      // ignore
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const res = await fetch("/api/rag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload",
            filename: file.name,
            content: text,
            type: file.name.endsWith(".md")
              ? "markdown"
              : file.name.endsWith(".pdf")
              ? "pdf"
              : file.name.match(/\.(ts|tsx|js|jsx|py|go|rs|java)$/)
              ? "code"
              : "text",
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        addRagDocument(data.document);
        toast.success(`${file.name} yüklendi`);
      } catch (err) {
        toast.error(`${file.name} yüklenemedi: ${err instanceof Error ? err.message : "hata"}`);
      }
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const endpoint = ragUseEmbeddings ? "/api/rag/embed" : "/api/rag";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          query,
          topK: 5,
        }),
      });
      const data = await res.json();
      setResults(data.sources ?? []);
    } catch {
      toast.error("Arama başarısız");
    } finally {
      setSearching(false);
    }
  };

  const rebuildEmbeddings = async () => {
    setRebuilding(true);
    try {
      const res = await fetch("/api/rag/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rebuild" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`${data.embedded} chunk embedding'lendi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rebuild başarısız");
    } finally {
      setRebuilding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      removeRagDocument(id);
      toast.success("Döküman silindi");
    } catch {
      toast.error("Silme başarısız");
    }
  };

  return (
    <Sheet open={ragPanelOpen} onOpenChange={setRagPanelOpen}>
      <SheetContent side="right" className="w-[450px] sm:w-[550px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Doküman Arama (RAG)
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,.txt,.json,.csv,.log,.ts,.tsx,.js,.jsx,.py,.go,.rs"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              variant="outline"
              className="w-full h-20 border-dashed text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Doküman yükle (.md, .txt, .json, .ts, .py, vb.)
            </Button>
          </div>

          {/* Documents */}
          {ragDocuments.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Yüklü Dokümanlar ({ragDocuments.length})
              </div>
              <div className="space-y-1">
                {ragDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 p-2 rounded border border-border text-xs group"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{doc.filename}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {doc.chunks} chunk · {(doc.size / 1024).toFixed(1)}KB
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {ragUseEmbeddings ? "Vector Embeddings Arama" : "Semantik Arama (TF-IDF)"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={rebuildEmbeddings}
                  disabled={rebuilding || ragDocuments.length === 0}
                >
                  {rebuilding ? (
                    <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                  ) : (
                    <Database className="h-2.5 w-2.5 mr-1" />
                  )}
                  Embedding Rebuild
                </Button>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className={!ragUseEmbeddings ? "text-foreground font-medium" : "text-muted-foreground"}>TF-IDF</span>
                  <Switch
                    checked={ragUseEmbeddings}
                    onCheckedChange={setRagUseEmbeddings}
                    className="scale-75"
                  />
                  <span className={ragUseEmbeddings ? "text-foreground font-medium" : "text-muted-foreground"}>Vector</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Dokümanlarda ara..."
                className="text-xs h-8"
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleSearch}
                disabled={searching || !query.trim()}
              >
                {searching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
              </Button>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-2 mt-3">
                {results.map((src, idx) => (
                  <div
                    key={idx}
                    className="border border-border rounded p-2 text-xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode className="h-3 w-3 text-primary" />
                      <span className="font-medium truncate">{src.filename}</span>
                      <Badge variant="outline" className="text-[9px] h-4">
                        chunk {src.chunk + 1}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500 ml-auto"
                      >
                        {(src.score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap bg-secondary/30 p-1.5 rounded max-h-32 overflow-y-auto">
                      {src.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
