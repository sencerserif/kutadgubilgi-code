"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, GitBranch, GitCommit, Plus, Download } from "lucide-react";
import { useStore } from "@/store/useStore";
import { PROVIDERS } from "@/lib/providers";
import { toast } from "sonner";

interface GitStatus {
  branch: string | null;
  files: Array<{ status: string; file: string }>;
  initialized: boolean;
}

interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export function CostPanel() {
  const {
    costPanelOpen,
    setCostPanelOpen,
    costLog,
    loadCostLog,
    clearCost,
  } = useStore();

  useEffect(() => {
    if (costPanelOpen) loadCostLog();
  }, [costPanelOpen, loadCostLog]);

  const totalCost = costLog.reduce((sum, e) => sum + e.cost, 0);
  const totalTokensIn = costLog.reduce((sum, e) => sum + e.tokensIn, 0);
  const totalTokensOut = costLog.reduce((sum, e) => sum + e.tokensOut, 0);

  const byProvider: Record<string, { count: number; cost: number }> = {};
  costLog.forEach((e) => {
    if (!byProvider[e.provider]) {
      byProvider[e.provider] = { count: 0, cost: 0 };
    }
    byProvider[e.provider].count++;
    byProvider[e.provider].cost += e.cost;
  });

  const exportCost = () => {
    const data = JSON.stringify(costLog, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cost-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Maliyet raporu dışa aktarıldı");
  };

  return (
    <Sheet open={costPanelOpen} onOpenChange={setCostPanelOpen}>
      <SheetContent
        side="right"
        className="w-[450px] sm:w-[540px] p-0 flex flex-col overflow-hidden"
      >
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-amber-500" />
            Maliyet Takibi
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="text-[10px] text-muted-foreground">Toplam Maliyet</div>
              <div className="text-lg font-bold text-amber-500">
                ${totalCost.toFixed(4)}
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="text-[10px] text-muted-foreground">Token (Giriş)</div>
              <div className="text-lg font-bold">
                {totalTokensIn.toLocaleString()}
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="text-[10px] text-muted-foreground">Token (Çıkış)</div>
              <div className="text-lg font-bold">
                {totalTokensOut.toLocaleString()}
              </div>
            </div>
          </div>

          {/* By Provider */}
          {Object.keys(byProvider).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Sağlayıcı Bazında
              </h3>
              <div className="space-y-1">
                {Object.entries(byProvider).map(([id, info]) => {
                  const provider = PROVIDERS[id as keyof typeof PROVIDERS];
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 p-2 rounded-md bg-secondary/30"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: provider?.color }}
                      />
                      <span className="text-sm">{provider?.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {info.count} istek
                      </span>
                      <span className="text-xs font-medium text-amber-500">
                        ${info.cost.toFixed(4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Entries */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Son İşlemler
            </h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {costLog.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Henüz kayıt yok
                </div>
              ) : (
                [...costLog].reverse().slice(0, 50).map((entry) => {
                  const provider = PROVIDERS[entry.provider];
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-secondary/30 text-xs"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: provider?.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{provider?.name}</span>
                          <span className="text-muted-foreground">
                            · {entry.model}
                          </span>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {entry.messagePreview}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-amber-500 font-medium">
                          ${entry.cost.toFixed(4)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {entry.tokensIn}+{entry.tokensOut} tok
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={exportCost}
            disabled={costLog.length === 0}
          >
            <Download className="h-3 w-3 mr-1" />
            Dışa Aktar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs ml-auto text-destructive"
            onClick={() => {
              if (confirm("Tüm maliyet kayıtları silinsin mi?")) {
                clearCost();
                toast.success("Kayıtlar temizlendi");
              }
            }}
            disabled={costLog.length === 0}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Temizle
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function GitPanel() {
  // Built into sidebar - not a separate sheet
  return null;
}
