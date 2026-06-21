"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/store/useStore";
import { Search, Clock, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";

export function HistorySearch() {
  const { messages } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Ctrl+R / Cmd+R shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset query when closed
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setQuery("");
      setSelectedIdx(0);
    }
  };

  // Filter messages
  const filtered = useMemo(() => {
    if (!query.trim()) {
      return messages.slice(-50).reverse();
    }
    const q = query.toLowerCase();
    return messages
      .filter((m) => m.content.toLowerCase().includes(q))
      .slice(-100)
      .reverse();
  }, [messages, query]);

  // Reset selected when filtered changes (derive instead of effect)
  const safeIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${safeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Copy selected to clipboard
      const selected = filtered[safeIdx];
      if (selected) {
        navigator.clipboard.writeText(selected.content);
        setOpen(false);
        setQuery("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 max-w-2xl overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Geçmiş Arama</DialogTitle>
        </DialogHeader>
        <div className="flex items-center border-b border-border px-3">
          <Search className="h-4 w-4 mr-2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mesaj geçmişinde ara... (↑↓ gezin, Enter kopyala)"
            className="h-12 bg-transparent text-sm outline-none flex-1"
          />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {query ? "Sonuç bulunamadı" : "Henüz mesaj yok"}
            </div>
          ) : (
            filtered.map((msg, idx) => (
              <button
                key={msg.id}
                data-idx={idx}
                onClick={() => {
                  navigator.clipboard.writeText(msg.content);
                  setOpen(false);
                  setQuery("");
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`w-full text-left p-2.5 rounded-md cursor-pointer transition-colors ${
                  idx === safeIdx
                    ? "bg-accent"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      msg.role === "user"
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {msg.role === "user" ? "siz" : msg.provider ?? "AI"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleString("tr-TR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {msg.model && (
                    <span className="text-[10px] text-muted-foreground">
                      · {msg.model}
                    </span>
                  )}
                </div>
                <div className="text-xs line-clamp-2 whitespace-pre-wrap">
                  {msg.content.slice(0, 300)}
                  {msg.content.length > 300 && "..."}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-2.5 w-2.5" />
              <ArrowDown className="h-2.5 w-2.5" />
              gezin
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-2.5 w-2.5" />
              kopyala
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {filtered.length} sonuç
            </span>
          </div>
          <span>Ctrl+R ile aç</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
