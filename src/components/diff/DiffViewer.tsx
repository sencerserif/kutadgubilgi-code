"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, FileCode, Plus, Minus } from "lucide-react";
import type { DiffResult } from "@/types";
import { toast } from "sonner";

interface DiffViewerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  diff: DiffResult | null;
  onApply?: () => void;
  onReject?: () => void;
}

export function DiffViewer({
  open,
  onOpenChange,
  diff,
  onApply,
  onReject,
}: DiffViewerProps) {
  if (!diff) return null;

  const additions = diff.hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.type === "add").length,
    0
  );
  const deletions = diff.hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.type === "remove").length,
    0
  );

  const handleApply = async () => {
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write",
          path: diff.filePath,
          content: diff.newContent,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`${diff.filePath} güncellendi`);
      onApply?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply başarısız");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            <FileCode className="h-4 w-4 text-primary" />
            Diff: {diff.filePath}
          </SheetTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500">
              <Plus className="h-2.5 w-2.5 mr-1" />
              {additions}
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500">
              <Minus className="h-2.5 w-2.5 mr-1" />
              {deletions}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                onReject?.();
                onOpenChange(false);
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Reddet
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleApply}
            >
              <Check className="h-3 w-3 mr-1" />
              Dosyaya Yaz
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto bg-zinc-950">
          {diff.hunks.map((hunk, hi) => (
            <div key={hi}>
              <div className="px-3 py-1 text-[10px] text-muted-foreground bg-secondary/30 border-y border-border">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </div>
              {hunk.lines.map((line, li) => (
                <div
                  key={li}
                  className={`flex font-mono text-xs px-3 py-0.5 ${
                    line.type === "add"
                      ? "bg-emerald-500/10 text-emerald-200"
                      : line.type === "remove"
                      ? "bg-red-500/10 text-red-200"
                      : "text-zinc-400"
                  }`}
                >
                  <span className="w-8 text-muted-foreground/50 shrink-0 text-right pr-2">
                    {line.oldNumber ?? ""}
                  </span>
                  <span className="w-8 text-muted-foreground/50 shrink-0 text-right pr-2">
                    {line.newNumber ?? ""}
                  </span>
                  <span className="w-4 shrink-0 text-center">
                    {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{line.content}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
