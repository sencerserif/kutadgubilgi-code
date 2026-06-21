"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Code,
  FileText,
  Bug,
  RefreshCw,
  TestTube,
  Plus,
  Trash2,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import type { Snippet } from "@/types";

const ICONS: Record<string, React.ReactNode> = {
  code: <Code className="h-3.5 w-3.5" />,
  review: <Bug className="h-3.5 w-3.5" />,
  test: <TestTube className="h-3.5 w-3.5" />,
  refactor: <RefreshCw className="h-3.5 w-3.5" />,
  doc: <BookOpen className="h-3.5 w-3.5" />,
  custom: <Sparkles className="h-3.5 w-3.5" />,
};

export function SnippetsPanel({
  onApply,
}: {
  onApply?: (prompt: string) => void;
}) {
  const {
    snippetsPanelOpen,
    setSnippetsPanelOpen,
    snippets,
    addSnippet,
    removeSnippet,
    incrementSnippetUse,
    activeFile,
    openFiles,
  } = useStore();

  const [showNew, setShowNew] = useState(false);
  const [newSnippet, setNewSnippet] = useState<Partial<Snippet>>({
    title: "",
    description: "",
    prompt: "",
    category: "custom",
  });

  const handleApply = (snippet: Snippet) => {
    let prompt = snippet.prompt;
    // Aktif dosya varsa {{code}} placeholder'ını doldur
    if (activeFile) {
      const file = openFiles.find((f) => f.path === activeFile);
      if (file && prompt.includes("{{code}}")) {
        prompt = prompt.replace("{{code}}", file.content);
      }
    }
    incrementSnippetUse(snippet.id);
    onApply?.(prompt);
    setSnippetsPanelOpen(false);
    toast.success(`"${snippet.title}" uygulandı`);
  };

  const handleSave = () => {
    if (!newSnippet.title || !newSnippet.prompt) {
      toast.error("Başlık ve prompt gerekli");
      return;
    }
    addSnippet({
      title: newSnippet.title!,
      description: newSnippet.description ?? "",
      prompt: newSnippet.prompt!,
      category: (newSnippet.category as Snippet["category"]) ?? "custom",
      isBuiltIn: false,
    });
    setNewSnippet({ title: "", description: "", prompt: "", category: "custom" });
    setShowNew(false);
    toast.success("Snippet eklendi");
  };

  const grouped = snippets.reduce(
    (acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    },
    {} as Record<string, Snippet[]>
  );

  return (
    <Sheet open={snippetsPanelOpen} onOpenChange={setSnippetsPanelOpen}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Snippet'ler & Templates
          </SheetTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setShowNew(!showNew)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Yeni
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {showNew && (
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div>
                <Label className="text-xs">Başlık</Label>
                <Input
                  value={newSnippet.title}
                  onChange={(e) =>
                    setNewSnippet({ ...newSnippet, title: e.target.value })
                  }
                  className="h-8 text-xs"
                  placeholder="örn: TypeScript interface oluştur"
                />
              </div>
              <div>
                <Label className="text-xs">Açıklama</Label>
                <Input
                  value={newSnippet.description}
                  onChange={(e) =>
                    setNewSnippet({ ...newSnippet, description: e.target.value })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Kategori</Label>
                <Select
                  value={newSnippet.category}
                  onValueChange={(v) =>
                    setNewSnippet({ ...newSnippet, category: v as Snippet["category"] })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="code">Kod</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="refactor">Refactor</SelectItem>
                    <SelectItem value="doc">Doc</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">
                  Prompt ({"{{code}}"} placeholder aktif dosyayı ekler)
                </Label>
                <Textarea
                  value={newSnippet.prompt}
                  onChange={(e) =>
                    setNewSnippet({ ...newSnippet, prompt: e.target.value })
                  }
                  className="min-h-[100px] text-xs"
                  placeholder="Prompt yazın..."
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={handleSave}>
                  Kaydet
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setShowNew(false)}
                >
                  İptal
                </Button>
              </div>
            </div>
          )}

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {category} ({items.length})
              </div>
              <div className="space-y-1">
                {items.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="border border-border rounded-md p-2.5 hover:bg-accent/50 group"
                  >
                    <div className="flex items-start gap-2">
                      <div className="text-primary mt-0.5">
                        {ICONS[snippet.category] ?? <Sparkles className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium flex items-center gap-1.5">
                          {snippet.title}
                          {snippet.isBuiltIn && (
                            <Badge variant="outline" className="text-[9px] h-3.5">
                              builtin
                            </Badge>
                          )}
                          {snippet.useCount > 0 && (
                            <span className="text-[9px] text-muted-foreground">
                              {snippet.useCount}x kullanıldı
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {snippet.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => handleApply(snippet)}
                        >
                          Uygula
                        </Button>
                        {!snippet.isBuiltIn && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => removeSnippet(snippet.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
