"use client";

import { useState, useRef } from "react";
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
  Loader2,
  Bot,
  Check,
  X,
  Clock,
  FileCode,
  Terminal as TerminalIcon,
  Search,
  FileEdit,
  ChevronRight,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import { DiffViewer } from "@/components/diff/DiffViewer";
import type { AgentTask, DiffResult } from "@/types";

export function AgentPanel() {
  const {
    agentPanelOpen,
    setAgentPanelOpen,
    agentTasks,
    addAgentTask,
    updateAgentTask,
    settings,
  } = useStore();

  const [goal, setGoal] = useState("");
  const [running, setRunning] = useState(false);
  const [viewDiff, setViewDiff] = useState<DiffResult | null>(null);

  const runAgent = async () => {
    if (!goal.trim()) {
      toast.error("Hedef gerekli");
      return;
    }

    const available = (Object.keys(settings.apiKeys) as Array<keyof typeof settings.apiKeys>).filter(
      (k) => settings.apiKeys[k]
    );
    if (available.length === 0) {
      toast.error("En az bir API anahtarı gerekli");
      return;
    }

    setRunning(true);
    const task: AgentTask = {
      id: `agent-${Date.now()}`,
      goal: goal.trim(),
      status: "running",
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxSteps: 8,
      currentStep: 0,
    };
    addAgentTask(task);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          apiKeys: settings.apiKeys,
          systemPrompt: settings.systemPrompt,
          maxSteps: 8,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      updateAgentTask(task.id, {
        status: data.status ?? "completed",
        steps: data.steps ?? [],
        result: data.result,
        currentStep: data.steps?.length ?? 0,
      });

      if (data.status === "completed") {
        toast.success("Agent görevi tamamladı");
      }
    } catch (err) {
      updateAgentTask(task.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "Bilinmeyen hata",
      });
      toast.error(err instanceof Error ? err.message : "Agent başarısız");
    } finally {
      setRunning(false);
    }
  };

  const actionIcons: Record<string, React.ReactNode> = {
    plan: <Bot className="h-3.5 w-3.5 text-blue-500" />,
    file_read: <FileCode className="h-3.5 w-3.5 text-amber-500" />,
    file_write: <FileEdit className="h-3.5 w-3.5 text-emerald-500" />,
    file_search: <Search className="h-3.5 w-3.5 text-purple-500" />,
    terminal: <TerminalIcon className="h-3.5 w-3.5 text-zinc-500" />,
    analyze: <Bot className="h-3.5 w-3.5 text-cyan-500" />,
    done: <Check className="h-3.5 w-3.5 text-emerald-500" />,
    summary: <Bot className="h-3.5 w-3.5 text-primary" />,
  };

  const statusColors: Record<string, string> = {
    pending: "text-muted-foreground",
    running: "text-blue-500",
    success: "text-emerald-500",
    failed: "text-red-500",
    skipped: "text-muted-foreground",
  };

  return (
    <>
      <Sheet open={agentPanelOpen} onOpenChange={setAgentPanelOpen}>
        <SheetContent side="right" className="w-[500px] sm:w-[600px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Agent Modu
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Input */}
            <div>
              <label className="text-xs font-medium mb-1.5 block">
                Hedef (ne yapmasını istiyorsun?)
              </label>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="örn: 'src/utils/math.ts'deki tüm fonksiyonlara unit test yaz"
                className="min-h-[80px] text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Agent otomatik planlar, dosyaları okur/yazar, terminal çalıştırır
              </p>
            </div>

            <Button
              onClick={runAgent}
              disabled={running || !goal.trim()}
              className="w-full text-sm"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Agent çalışıyor...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-2" />
                  Agent'ı Başlat
                </>
              )}
            </Button>

            {/* Tasks */}
            <div className="space-y-3">
              {[...agentTasks].reverse().map((task) => (
                <div
                  key={task.id}
                  className="border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <Badge
                      variant="outline"
                      className={
                        task.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : task.status === "failed"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-blue-500/10 text-blue-500"
                      }
                    >
                      {task.status}
                    </Badge>
                    <div className="text-xs flex-1 font-medium">{task.goal}</div>
                  </div>

                  {task.error && (
                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {task.error}
                    </div>
                  )}

                  {task.steps.map((step, idx) => (
                    <div key={step.id} className="text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {String(idx).padStart(2, "0")}
                        </span>
                        {actionIcons[step.action] ?? <ChevronRight className="h-3 w-3" />}
                        <span className="font-medium">{step.description}</span>
                        <span className={`ml-auto ${statusColors[step.status]}`}>
                          {step.status === "running" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {step.status === "success" && <Check className="h-3 w-3" />}
                          {step.status === "failed" && <X className="h-3 w-3" />}
                        </span>
                      </div>
                      {step.output && (
                        <pre className="ml-9 text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {step.output.slice(0, 1000)}
                        </pre>
                      )}
                      {step.diff && (
                        <button
                          className="ml-9 text-[10px] text-primary hover:underline flex items-center gap-1"
                          onClick={() => setViewDiff(step.diff ?? null)}
                        >
                          <FileEdit className="h-2.5 w-2.5" />
                          Diff'i gör ({step.diff.hunks.length} hunk)
                        </button>
                      )}
                    </div>
                  ))}

                  {task.result && (
                    <div className="text-xs bg-primary/5 border border-primary/20 rounded p-2 mt-2">
                      <div className="font-medium text-primary mb-1">
                        Sonuç
                      </div>
                      {task.result}
                    </div>
                  )}
                </div>
              ))}

              {agentTasks.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  <Bot className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Henüz agent görevi yok
                  <p className="mt-1">Bir hedef yaz ve başlat</p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <DiffViewer
        open={!!viewDiff}
        onOpenChange={(v) => !v && setViewDiff(null)}
        diff={viewDiff}
      />
    </>
  );
}
