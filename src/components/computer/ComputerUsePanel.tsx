"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  Play,
  Square,
  Camera,
  MousePointer2,
  Keyboard,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Cpu,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { COMPUTER_USE_PROVIDERS } from "@/lib/computerUse";
import { PROVIDERS } from "@/lib/providers";
import { toast } from "sonner";

interface Step {
  index: number;
  thought?: string;
  toolCall?: { name: string; arguments: Record<string, unknown> };
  toolResult?: string;
  screenshot?: string;
  status: "thinking" | "acting" | "success" | "failed" | "done";
  timestamp: number;
}

export function ComputerUsePanel() {
  const {
    computerUseOpen,
    setComputerUseOpen,
    settings,
  } = useStore();

  const [goal, setGoal] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [summary, setSummary] = useState("");
  const [selectedProvider, setSelectedProvider] = useState(
    settings.apiKeys.anthropic ? "anthropic" : settings.apiKeys.zhipu ? "zhipu" : settings.apiKeys.openai ? "openai" : "anthropic"
  );
  const [selectedModel, setSelectedModel] = useState("");
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [allowDangerous, setAllowDangerous] = useState(false);
  const [maxSteps, setMaxSteps] = useState(15);

  useEffect(() => {
    const provider = COMPUTER_USE_PROVIDERS.find((p) => p.id === selectedProvider);
    if (provider) {
      setSelectedModel(provider.models[0]);
    }
  }, [selectedProvider]);

  const takeScreenshot = async () => {
    try {
      const res = await fetch("/api/computer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: [{ action: "screenshot" }] }),
      });
      const data = await res.json();
      if (data.results?.[0]?.image) {
        setLiveScreenshot(data.results[0].image);
      } else {
        toast.error(data.results?.[0]?.error ?? "Screenshot alınamadı");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "hata");
    }
  };

  const runGoal = async () => {
    if (!goal.trim()) {
      toast.error("Hedef gerekli");
      return;
    }

    const apiKey = settings.apiKeys[selectedProvider];
    if (selectedProvider !== "ollama" && !apiKey) {
      toast.error(`${PROVIDERS[selectedProvider].name} API anahtarı yok`);
      return;
    }

    setRunning(true);
    setSteps([]);
    setSummary("");

    try {
      const res = await fetch("/api/ai/computer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          apiKey,
          goal: goal.trim(),
          maxSteps,
          allowDangerous,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSteps(data.steps ?? []);
      setSummary(data.summary ?? "");
      if (data.success) {
        toast.success("Görev tamamlandı!");
      } else {
        toast.warning("Görev tamamlanamadı - max adım");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "hata");
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    setRunning(false);
    toast.info("Durduruldu");
  };

  const availableProviders = COMPUTER_USE_PROVIDERS.filter(
    (p) => p.id === "ollama" || settings.apiKeys[p.id]
  );

  return (
    <Sheet open={computerUseOpen} onOpenChange={setComputerUseOpen}>
      <SheetContent side="right" className="w-[600px] sm:w-[700px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            Computer Use
            <Badge variant="outline" className="text-[9px] h-4 bg-amber-500/10 text-amber-500">
              BETA
            </Badge>
          </SheetTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={takeScreenshot}
            disabled={running}
          >
            <Camera className="h-3 w-3 mr-1" />
            Screenshot
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Live screenshot */}
          {liveScreenshot && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 bg-secondary/30 border-b border-border flex items-center justify-between">
                <span>Canlı Ekran</span>
                <button
                  onClick={() => setLiveScreenshot(null)}
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <img
                src={`data:image/png;base64,${liveScreenshot}`}
                alt="Screenshot"
                className="w-full"
              />
            </div>
          )}

          {/* Provider selection */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              AI Sağlayıcı (Computer Use destekli)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {availableProviders.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`flex items-center gap-2 p-2 rounded border text-xs ${
                    selectedProvider === p.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="flex-1 text-left">{p.name}</span>
                  {p.supportsComputerUse ? (
                    <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500">
                      native
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] h-4">
                      vision
                    </Badge>
                  )}
                </button>
              ))}
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full h-8 mt-1.5 rounded-md border border-input bg-background px-2 text-xs"
            >
              {COMPUTER_USE_PROVIDERS.find((p) => p.id === selectedProvider)?.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Goal input */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Hedef (ne yapsın?)
            </div>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="örn: Masaüstündeki tüm dosyaları türüne göre klasörlere ayır (Resimler, Belgeler, Videolar)"
              className="min-h-[80px] text-xs"
            />
          </div>

          {/* Settings */}
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <input
                type="number"
                value={maxSteps}
                onChange={(e) => setMaxSteps(Math.min(50, Math.max(1, parseInt(e.target.value) || 15)))}
                className="w-12 h-7 rounded border border-border px-1"
              />
              <span>max adım</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={allowDangerous}
                onChange={(e) => setAllowDangerous(e.target.checked)}
              />
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Tehlikeli işlemlere izin ver
              </span>
            </label>
          </div>

          {/* Run button */}
          <div className="flex gap-2">
            {running ? (
              <Button variant="destructive" className="flex-1" onClick={stop}>
                <Square className="h-3 w-3 mr-1" />
                Durdur
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={runGoal}
                disabled={!goal.trim() || availableProviders.length === 0}
              >
                <Play className="h-3 w-3 mr-1" />
                Başlat
              </Button>
            )}
          </div>

          {/* Security warning */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2.5 text-[10px] text-amber-600 dark:text-amber-400">
            <strong>⚠️ Güvenlik:</strong> Computer Use modunda AI bilgisayarınızı kontrol edebilir — ekran görüntüsü alır, mouse/keyboard kullanır, dosya sistemi ve komut çalıştırır. Tehlikeli işlemler (rm -rf, format) engellenir ama dikkatli olun.
          </div>

          {/* Steps */}
          {steps.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Adımlar ({steps.length})
              </div>
              {steps.map((step, idx) => (
                <StepCard key={idx} step={step} />
              ))}
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
              <div className="text-[10px] uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" />
                Sonuç
              </div>
              <div className="text-xs">{summary}</div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StepCard({ step }: { step: Step }) {
  const [showScreenshot, setShowScreenshot] = useState(false);

  const statusIcon = {
    thinking: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    acting: <Cpu className="h-3 w-3 text-amber-500 animate-pulse" />,
    success: <Check className="h-3 w-3 text-emerald-500" />,
    failed: <X className="h-3 w-3 text-red-500" />,
    done: <Check className="h-3 w-3 text-primary" />,
  }[step.status];

  const toolIcons: Record<string, React.ReactNode> = {
    computer: <Monitor className="h-3 w-3" />,
    bash: <Cpu className="h-3 w-3" />,
    file_read: <Camera className="h-3 w-3" />,
    file_write: <Camera className="h-3 w-3" />,
    file_list: <Camera className="h-3 w-3" />,
  };

  return (
    <div className="border border-border rounded-md p-2.5 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground font-mono">
          {String(step.index).padStart(2, "0")}
        </span>
        {statusIcon}
        <span className="font-medium capitalize">{step.status}</span>
        {step.toolCall && (
          <Badge variant="outline" className="text-[9px] h-4 ml-auto flex items-center gap-1">
            {toolIcons[step.toolCall.name] ?? <MousePointer2 className="h-2.5 w-2.5" />}
            {step.toolCall.name === "computer"
              ? step.toolCall.arguments.action
              : step.toolCall.name}
          </Badge>
        )}
      </div>
      {step.thought && (
        <div className="text-[10px] text-muted-foreground mb-1 italic">
          {step.thought}
        </div>
      )}
      {step.toolCall && (
        <div className="text-[10px] font-mono text-muted-foreground bg-secondary/30 p-1.5 rounded mb-1">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(step.toolCall.arguments, null, 2).slice(0, 300)}
          </pre>
        </div>
      )}
      {step.toolResult && (
        <div className="text-[10px] text-muted-foreground">
          → {step.toolResult.slice(0, 200)}
        </div>
      )}
      {step.screenshot && (
        <button
          onClick={() => setShowScreenshot(!showScreenshot)}
          className="mt-1 text-[10px] text-primary hover:underline flex items-center gap-1"
        >
          <Camera className="h-2.5 w-2.5" />
          {showScreenshot ? "Gizle" : "Ekran görüntüsü"}
        </button>
      )}
      {showScreenshot && step.screenshot && (
        <img
          src={`data:image/png;base64,${step.screenshot}`}
          alt="Step screenshot"
          className="mt-1 w-full rounded border border-border"
        />
      )}
    </div>
  );
}
