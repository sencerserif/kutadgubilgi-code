"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { PROVIDERS } from "@/lib/providers";
import {
  Activity,
  DollarSign,
  GitBranch,
  AlertTriangle,
  Zap,
  Brain,
} from "lucide-react";

export function StatusBar() {
  const {
    statusBarVisible,
    selectedProvider,
    selectedModel,
    routingMode,
    costLog,
    isStreaming,
    reasoningMode,
    streamingEnabled,
    budgetLimit,
    budgetPeriod,
    activeFile,
    openFiles,
  } = useStore();

  const { todayCost, sessionCost } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayTotal = costLog
      .filter((e) => e.timestamp >= today)
      .reduce((s, e) => s + e.cost, 0);
    const sessionTotal = costLog.reduce((s, e) => s + e.cost, 0);
    return { todayCost: todayTotal, sessionCost: sessionTotal };
  }, [costLog]);

  if (!statusBarVisible) return null;

  const provider = PROVIDERS[selectedProvider];
  const currentCost = budgetPeriod === "daily" ? todayCost : sessionCost;
  const budgetExceeded = budgetLimit > 0 && currentCost >= budgetLimit;
  const budgetWarning = budgetLimit > 0 && currentCost >= budgetLimit * 0.8 && !budgetExceeded;

  const activeFileObj = activeFile
    ? openFiles.find((f) => f.path === activeFile)
    : null;
  const lineCount = activeFileObj?.content.split("\n").length ?? 0;

  return (
    <div className="border-t border-border bg-secondary/30 px-3 py-1 flex items-center gap-3 text-[10px] text-muted-foreground overflow-x-auto">
      {/* Provider + Model */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: provider.color }}
        />
        <span className="font-medium text-foreground">{provider.name}</span>
        <span>·</span>
        <span>{selectedModel}</span>
      </div>

      <div className="h-3 w-px bg-border shrink-0" />

      {/* Routing mode */}
      <div className="flex items-center gap-1 shrink-0">
        <Zap className={`h-2.5 w-2.5 ${routingMode === "smart" ? "text-amber-500" : ""}`} />
        <span>{routingMode === "smart" ? "Akıllı" : "Manuel"}</span>
      </div>

      {/* Streaming */}
      <div className="flex items-center gap-1 shrink-0">
        <Activity className={`h-2.5 w-2.5 ${streamingEnabled ? "text-emerald-500" : ""}`} />
        <span>{streamingEnabled ? "Stream" : "Batch"}</span>
      </div>

      {/* Tool mode - skip, it's local state in ChatPanel */}

      {/* Reasoning mode */}
      {reasoningMode && (
        <div className="flex items-center gap-1 shrink-0 text-purple-500">
          <Brain className="h-2.5 w-2.5" />
          <span>Reasoning</span>
        </div>
      )}

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-1 shrink-0 text-blue-500">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span>Aktif</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Active file */}
      {activeFile && (
        <div className="flex items-center gap-1.5 shrink-0">
          <GitBranch className="h-2.5 w-2.5" />
          <span className="truncate max-w-[150px]">{activeFile.split("/").pop()}</span>
          <span>· {lineCount} satır</span>
        </div>
      )}

      <div className="h-3 w-px bg-border shrink-0" />

      {/* Cost */}
      <div className={`flex items-center gap-1 shrink-0 ${budgetExceeded ? "text-red-500" : budgetWarning ? "text-amber-500" : ""}`}>
        <DollarSign className="h-2.5 w-2.5" />
        <span>
          {budgetPeriod === "daily" ? "Bugün" : "Session"}: ${currentCost.toFixed(4)}
        </span>
        {budgetLimit > 0 && (
          <span className="text-muted-foreground">
            / ${budgetLimit.toFixed(2)}
          </span>
        )}
      </div>

      {/* Budget warning */}
      {budgetExceeded && (
        <div className="flex items-center gap-1 shrink-0 text-red-500 font-medium">
          <AlertTriangle className="h-2.5 w-2.5" />
          <span>Limit aşımı!</span>
        </div>
      )}
      {budgetWarning && (
        <div className="flex items-center gap-1 shrink-0 text-amber-500">
          <AlertTriangle className="h-2.5 w-2.5" />
          <span>%80</span>
        </div>
      )}

      {/* Total requests */}
      <div className="shrink-0">
        {costLog.length} istek
      </div>
    </div>
  );
}
