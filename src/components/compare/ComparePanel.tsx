"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, Zap, Trophy } from "lucide-react";
import { useStore } from "@/store/useStore";
import { PROVIDERS } from "@/lib/providers";
import type { ProviderId, CompareResult } from "@/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export function ComparePanel() {
  const {
    comparePanelOpen,
    setComparePanelOpen,
    compareResults,
    setCompareResults,
    compareLoading,
    setCompareLoading,
    compareProviders,
    setCompareProviders,
    settings,
  } = useStore();

  const [prompt, setPrompt] = useState("");

  const hasKey = (id: ProviderId) =>
    id === "ollama" || Boolean(settings.apiKeys[id]);

  const runCompare = async () => {
    if (!prompt.trim()) {
      toast.error("Prompt gerekli");
      return;
    }
    const available = compareProviders.filter((p) => hasKey(p.provider));
    if (available.length < 2) {
      toast.error("En az 2 sağlayıcı gerekli (API anahtarı olan)");
      return;
    }

    setCompareLoading(true);
    setCompareResults([]);
    try {
      const res = await fetch("/api/ai/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          providers: available,
          apiKey: JSON.stringify(settings.apiKeys),
          systemPrompt: settings.systemPrompt,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCompareResults(data.results ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Karşılaştırma başarısız");
    } finally {
      setCompareLoading(false);
    }
  };

  const addProvider = () => {
    if (compareProviders.length >= 4) {
      toast.info("Maksimum 4 sağlayıcı");
      return;
    }
    // İlk boşta olanı ekle
    const all = Object.keys(PROVIDERS) as ProviderId[];
    const used = new Set(compareProviders.map((p) => p.provider));
    const next = all.find((id) => hasKey(id) && !used.has(id));
    if (!next) {
      toast.info("Eklenebilecek sağlayıcı yok");
      return;
    }
    setCompareProviders([
      ...compareProviders,
      { provider: next, model: PROVIDERS[next].models[0].id },
    ]);
  };

  const removeProvider = (idx: number) => {
    setCompareProviders(compareProviders.filter((_, i) => i !== idx));
  };

  const updateProvider = (idx: number, provider: ProviderId) => {
    const newProviders = [...compareProviders];
    newProviders[idx] = {
      provider,
      model: PROVIDERS[provider].models[0].id,
    };
    setCompareProviders(newProviders);
  };

  const updateModel = (idx: number, model: string) => {
    const newProviders = [...compareProviders];
    newProviders[idx] = { ...newProviders[idx], model };
    setCompareProviders(newProviders);
  };

  // En hızlı ve en ucuz
  const fastest = compareResults.filter((r) => !r.error).sort((a, b) => a.duration - b.duration)[0];
  const cheapest = compareResults.filter((r) => !r.error).sort((a, b) => a.cost - b.cost)[0];
  const longest = compareResults.filter((r) => !r.error).sort((a, b) => b.content.length - a.content.length)[0];

  return (
    <Sheet open={comparePanelOpen} onOpenChange={setComparePanelOpen}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Çoklu Sağlayıcı Karşılaştırma
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Prompt */}
          <div>
            <label className="text-xs font-medium mb-1.5 block">Prompt</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Aynı promptu birden fazla AI'a paralel gönderin..."
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Providers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium">
                Sağlayıcılar ({compareProviders.length})
              </label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={addProvider}
              >
                <Plus className="h-3 w-3 mr-1" />
                Ekle
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {compareProviders.map((p, idx) => {
                const provider = PROVIDERS[p.provider];
                const available = hasKey(p.provider);
                return (
                  <div
                    key={idx}
                    className={`border rounded-md p-2 ${
                      available ? "border-border" : "border-destructive/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: provider.color }}
                      />
                      <select
                        value={p.provider}
                        onChange={(e) =>
                          updateProvider(idx, e.target.value as ProviderId)
                        }
                        className="text-xs bg-transparent flex-1 outline-none cursor-pointer"
                      >
                        {(Object.keys(PROVIDERS) as ProviderId[])
                          .filter((id) => hasKey(id))
                          .map((id) => (
                            <option key={id} value={id}>
                              {PROVIDERS[id].name}
                            </option>
                          ))}
                      </select>
                      <button onClick={() => removeProvider(idx)}>
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                    <select
                      value={p.model}
                      onChange={(e) => updateModel(idx, e.target.value)}
                      className="text-[10px] bg-transparent w-full outline-none cursor-pointer"
                    >
                      {provider.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Run */}
          <div className="flex items-center gap-2">
            <Button
              onClick={runCompare}
              disabled={compareLoading || !prompt.trim()}
              className="text-xs"
            >
              {compareLoading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Karşılaştırılıyor...
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3 mr-1" />
                  Paralel Çalıştır
                </>
              )}
            </Button>
            {compareResults.length > 0 && !compareLoading && (
              <div className="flex items-center gap-2 ml-auto text-[10px]">
                {fastest && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500">
                    <Trophy className="h-2.5 w-2.5 mr-1" />
                    En hızlı: {PROVIDERS[fastest.provider].name} ({fastest.duration}ms)
                  </Badge>
                )}
                {cheapest && cheapest.cost > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500">
                    En ucuz: ${cheapest.cost.toFixed(5)}
                  </Badge>
                )}
                {longest && (
                  <Badge variant="outline">
                    En uzun: {longest.content.length} karakter
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Results */}
          {compareResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {compareResults.map((r, idx) => (
                <CompareCard key={idx} result={r} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CompareCard({ result }: { result: CompareResult }) {
  const provider = PROVIDERS[result.provider];
  return (
    <div className="border border-border rounded-lg overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: provider.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium">{provider.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {result.model}
          </div>
        </div>
        {result.error ? (
          <Badge variant="destructive" className="text-[9px]">Hata</Badge>
        ) : (
          <>
            {result.duration < 2000 && (
              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-500">
                {result.duration}ms
              </Badge>
            )}
          </>
        )}
      </div>

      <div className="p-3 flex-1 overflow-y-auto max-h-96">
        {result.error ? (
          <div className="text-xs text-destructive">{result.error}</div>
        ) : (
          <div className="markdown-body text-xs">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !className;
                  return !isInline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ margin: 0, fontSize: "0.75rem" }}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {result.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {!result.error && (
        <div className="px-3 py-1.5 border-t border-border bg-secondary/30 text-[10px] text-muted-foreground flex items-center gap-2">
          <span>{result.tokensIn}+{result.tokensOut} tok</span>
          <span>·</span>
          <span>{result.duration}ms</span>
          {result.cost > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-500">${result.cost.toFixed(5)}</span>
            </>
          )}
          <button
            className="ml-auto hover:text-foreground"
            onClick={() => {
              navigator.clipboard.writeText(result.content);
              toast.success("Kopyalandı");
            }}
          >
            Kopyala
          </button>
        </div>
      )}
    </div>
  );
}
