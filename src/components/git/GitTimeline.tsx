"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCommit, GitBranch, RefreshCw, Loader2, Sparkles, Calendar } from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import type { GitTimelineEntry } from "@/types";

export function GitTimeline() {
  const { gitTimelineOpen, setGitTimelineOpen, settings } = useStore();
  const [entries, setEntries] = useState<GitTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/git/timeline");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      toast.error("Timeline yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gitTimelineOpen) loadTimeline();
  }, [gitTimelineOpen]);

  const summarize = async (hash: string) => {
    setSummarizing(hash);
    try {
      const res = await fetch("/api/git/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "summarize",
          hashes: [hash],
          apiKeys: settings.apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSummaries({
        ...summaries,
        ...data.summaries,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Özetleme başarısız");
    } finally {
      setSummarizing(null);
    }
  };

  const summarizeWeek = async () => {
    const hashes = entries.slice(0, 10).map((e) => e.hash);
    setSummarizing("all");
    try {
      const res = await fetch("/api/git/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "summarize",
          hashes,
          apiKeys: settings.apiKeys,
        }),
      });
      const data = await res.json();
      setSummaries({
        ...summaries,
        ...data.summaries,
      });
      toast.success("Tüm commitler özetlendi");
    } catch {
      toast.error("Özetleme başarısız");
    } finally {
      setSummarizing(null);
    }
  };

  return (
    <Sheet open={gitTimelineOpen} onOpenChange={setGitTimelineOpen}>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-amber-500" />
            Git Timeline
          </SheetTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={summarizeWeek}
              disabled={summarizing === "all" || entries.length === 0}
            >
              {summarizing === "all" ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              Son 10 commit'i özetle
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={loadTimeline}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <GitCommit className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Henüz commit yok
              <p className="mt-1">Terminal'den `git init && git commit` yapın</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, idx) => (
                <div
                  key={entry.hash}
                  className="border border-border rounded-lg p-3 relative"
                >
                  {idx < entries.length - 1 && (
                    <div className="absolute left-7 top-full w-px h-3 bg-border" />
                  )}

                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                      <GitCommit className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-[10px] text-primary font-mono">
                          {entry.hash}
                        </code>
                        <span className="text-[10px] text-muted-foreground">
                          {entry.author}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {entry.date}
                        </span>
                      </div>
                      <div className="text-xs font-medium mb-1">
                        {entry.message}
                      </div>

                      {entry.filesChanged > 0 && (
                        <div className="flex items-center gap-2 text-[10px]">
                          <Badge variant="outline" className="text-[9px] h-4">
                            {entry.filesChanged} dosya
                          </Badge>
                          {entry.additions > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500"
                            >
                              +{entry.additions}
                            </Badge>
                          )}
                          {entry.deletions > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 bg-red-500/10 text-red-500"
                            >
                              -{entry.deletions}
                            </Badge>
                          )}
                          <button
                            className="ml-auto text-[10px] text-primary hover:underline flex items-center gap-1"
                            onClick={() => summarize(entry.hash)}
                            disabled={summarizing === entry.hash}
                          >
                            {summarizing === entry.hash ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-2.5 w-2.5" />
                            )}
                            AI özet
                          </button>
                        </div>
                      )}

                      {summaries[entry.hash] && (
                        <div className="mt-2 text-xs bg-primary/5 border border-primary/20 rounded p-2">
                          {summaries[entry.hash]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
