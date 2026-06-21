"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Shield,
  Bug,
  Gauge,
  Code,
  AlertTriangle,
  Info,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import type { ReviewIssue } from "@/types";

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  critical: { color: "text-red-500 bg-red-500/10", icon: <AlertTriangle className="h-3 w-3" />, label: "Kritik" },
  warning: { color: "text-amber-500 bg-amber-500/10", icon: <AlertTriangle className="h-3 w-3" />, label: "Uyarı" },
  info: { color: "text-blue-500 bg-blue-500/10", icon: <Info className="h-3 w-3" />, label: "Bilgi" },
  suggestion: { color: "text-purple-500 bg-purple-500/10", icon: <Lightbulb className="h-3 w-3" />, label: "Öneri" },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  security: <Shield className="h-3 w-3" />,
  performance: <Gauge className="h-3 w-3" />,
  bug: <Bug className="h-3 w-3" />,
  style: <Code className="h-3 w-3" />,
  "best-practice": <CheckCircle2 className="h-3 w-3" />,
};

export function ReviewPanel({
  code,
  filename,
  language,
}: {
  code: string;
  filename?: string;
  language?: string;
}) {
  const {
    reviewPanelOpen,
    setReviewPanelOpen,
    settings,
    reviews,
    addReview,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [currentReview, setCurrentReview] = useState<typeof reviews[0] | null>(null);

  const runReview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          filename,
          language,
          apiKeys: settings.apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const review = {
        id: `review-${Date.now()}`,
        filePath: filename ?? "code",
        timestamp: Date.now(),
        provider: data.provider,
        model: data.model,
        issues: data.issues,
        summary: data.summary,
        score: data.score,
      };
      addReview(review);
      setCurrentReview(review);
      toast.success(`Review tamamlandı - Skor: ${data.score}/100`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={reviewPanelOpen} onOpenChange={setReviewPanelOpen}>
      <SheetContent side="right" className="w-[450px] sm:w-[550px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            AI Code Review
          </SheetTitle>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={runReview}
            disabled={loading || !code}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Shield className="h-3 w-3 mr-1" />
            )}
            {loading ? "İnceleniyor..." : "Review Yap"}
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!currentReview && reviews.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Henüz review yapılmadı
              <p className="mt-1">"Review Yap" butonuna bas</p>
            </div>
          )}

          {currentReview && (
            <>
              {/* Score */}
              <div className="bg-secondary/30 rounded-lg p-3 flex items-center gap-3">
                <div className="text-3xl font-bold">
                  {currentReview.score}
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium mb-1">Kod Kalite Skoru</div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        currentReview.score >= 80
                          ? "bg-emerald-500"
                          : currentReview.score >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${currentReview.score}%` }}
                    />
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px]">
                  {currentReview.provider}
                </Badge>
              </div>

              {/* Summary */}
              {currentReview.summary && (
                <div className="text-xs bg-primary/5 border border-primary/20 rounded p-3">
                  {currentReview.summary}
                </div>
              )}

              {/* Issues */}
              <div>
                <div className="text-xs font-medium mb-2">
                  Bulunan Sorunlar ({currentReview.issues.length})
                </div>
                <div className="space-y-2">
                  {currentReview.issues.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} />
                  ))}
                  {currentReview.issues.length === 0 && (
                    <div className="text-xs text-emerald-500 bg-emerald-500/10 p-3 rounded flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Sorun bulunamadı, kod temiz görünüyor!
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function IssueCard({ issue }: { issue: ReviewIssue }) {
  const sev = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.info;
  return (
    <div className="border border-border rounded-md p-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <Badge variant="outline" className={`text-[9px] h-4 ${sev.color}`}>
          {sev.icon}
          {sev.label}
        </Badge>
        <Badge variant="outline" className="text-[9px] h-4">
          {CATEGORY_ICONS[issue.category]}
          {issue.category}
        </Badge>
        {issue.line && (
          <span className="text-[10px] text-muted-foreground">Satır {issue.line}</span>
        )}
      </div>
      <div className="text-xs font-medium mb-1">{issue.title}</div>
      <div className="text-[11px] text-muted-foreground mb-1">
        {issue.description}
      </div>
      {issue.suggestion && (
        <div className="text-[11px] bg-secondary/30 p-1.5 rounded mt-1.5">
          <span className="text-primary">Öneri: </span>
          <code className="font-mono">{issue.suggestion}</code>
        </div>
      )}
    </div>
  );
}
