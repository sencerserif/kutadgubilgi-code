"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Zap,
  Bot,
  Shield,
  Database,
  GitBranch,
  Puzzle,
  Plug,
  Terminal as TerminalIcon,
  DollarSign,
  Rocket,
  KeyRound,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { PROVIDERS, PROVIDER_LIST } from "@/lib/providers";
import {
  isOnboardingCompleted,
  setOnboardingCompleted as setOnboardingCompletedStorage,
} from "@/lib/storage";
import { toast } from "sonner";
import type { ProviderId } from "@/types";

const STEPS = [
  { id: "welcome", title: "Hoş Geldiniz", icon: Sparkles },
  { id: "providers", title: "API Anahtarları", icon: KeyRound },
  { id: "models", title: "Model Seçimi", icon: Bot },
  { id: "features", title: "Özellikler", icon: Zap },
  { id: "ready", title: "Hazır!", icon: Rocket },
];

export function OnboardingWizard() {
  const {
    onboardingOpen,
    setOnboardingOpen,
    onboardingStep,
    setOnboardingStep,
    settings,
    setApiKey,
    removeApiKey,
    setSelectedProvider,
    setSelectedModel,
    updateSettings,
    onboardingCompleted,
    setOnboardingCompleted,
  } = useStore();

  const [visibleKeys, setVisibleKeys] = useState<Set<ProviderId>>(new Set());
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState<ProviderId | null>(null);
  const [validationResults, setValidationResults] = useState<
    Record<string, { valid: boolean; models?: string[]; error?: string }>
  >({});

  // İlk açılışta kontrol et
  useEffect(() => {
    if (!isOnboardingCompleted() && Object.keys(settings.apiKeys).length === 0) {
      setOnboardingOpen(true);
    }
  }, [settings.apiKeys, setOnboardingOpen]);

  const toggleVisible = (id: ProviderId) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const validateKey = async (provider: ProviderId) => {
    const value = tempKeys[provider];
    if (!value) {
      toast.error("API anahtarı girin");
      return;
    }
    setValidating(provider);
    try {
      const res = await fetch("/api/ai/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: value }),
      });
      const data = await res.json();
      setValidationResults((prev) => ({ ...prev, [provider]: data }));
      if (data.valid) {
        toast.success(`${PROVIDERS[provider].name} doğrulandı`);
        // Otomatik kaydet
        setApiKey(provider, value);
        setTempKeys((p) => ({ ...p, [provider]: "" }));
      } else {
        toast.error(data.error ?? "Doğrulama başarısız");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Doğrulama hatası");
    } finally {
      setValidating(null);
    }
  };

  const next = () => {
    if (onboardingStep < STEPS.length - 1) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      // Tamamla
      setOnboardingCompleted(true);
      setOnboardingCompletedStorage(true);
      setOnboardingOpen(false);
    }
  };

  const prev = () => {
    if (onboardingStep > 0) setOnboardingStep(onboardingStep - 1);
  };

  const skip = () => {
    setOnboardingCompleted(true);
    setOnboardingCompletedStorage(true);
    setOnboardingOpen(false);
  };

  const currentStep = STEPS[onboardingStep];
  const connectedProviders = (Object.keys(PROVIDERS) as ProviderId[]).filter(
    (id) => id === "ollama" || settings.apiKeys[id]
  );

  return (
    <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <a
              href="https://kutadgubilgi.com"
              target="_blank"
              rel="noreferrer"
              className="hover:opacity-80 transition-opacity"
              title="kutadgubilgi.com"
            >
              <Image
                src="/logo.png"
                alt="Kutadgubilgi Code"
                width={28}
                height={28}
                className="rounded-md"
              />
            </a>
            Kutadgubilgi Code
          </DialogTitle>
          <DialogDescription>
            11. yüzyıl bilgesinden ilham alan, çoklu AI destekli kod asistanı
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-1 px-1 mb-2">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = idx === onboardingStep;
            const isPast = idx < onboardingStep;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isPast
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isPast ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 mx-1 ${
                      isPast ? "bg-emerald-500/30" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {currentStep.id === "welcome" && (
            <WelcomeStep />
          )}

          {currentStep.id === "providers" && (
            <div className="space-y-2">
              <div className="text-sm mb-3">
                En az bir AI sağlayıcı için API anahtarı ekleyin.
                Anahtarlar sadece tarayıcınızda saklanır.
              </div>
              {PROVIDER_LIST.map((provider) => {
                const hasKey = Boolean(settings.apiKeys[provider.id]);
                const isVisible = visibleKeys.has(provider.id);
                const tempValue = tempKeys[provider.id] ?? "";
                const validation = validationResults[provider.id];
                const isValidating = validating === provider.id;

                return (
                  <div
                    key={provider.id}
                    className="border border-border rounded-lg p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="h-9 w-9 rounded-md flex items-center justify-center text-sm font-bold shrink-0"
                        style={{
                          backgroundColor: `${provider.color}20`,
                          color: provider.color,
                        }}
                      >
                        {provider.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{provider.name}</span>
                          {hasKey ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500"
                            >
                              <Check className="h-2.5 w-2.5 mr-1" />
                              Bağlı
                            </Badge>
                          ) : provider.id === "ollama" ? (
                            <Badge variant="outline" className="text-[9px] h-4">
                              Anahtar gerekmez
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] h-4">
                              Gerekli
                            </Badge>
                          )}
                          <a
                            href={provider.apiKeyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-auto text-[10px] text-primary hover:underline flex items-center gap-1"
                          >
                            Anahtar al <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">
                          {provider.description}
                        </p>

                        <div className="flex gap-1.5">
                          <Input
                            type={isVisible ? "text" : "password"}
                            placeholder={
                              provider.id === "ollama"
                                ? "http://localhost:11434"
                                : `${provider.name} API anahtarı...`
                            }
                            value={tempValue}
                            onChange={(e) =>
                              setTempKeys((p) => ({
                                ...p,
                                [provider.id]: e.target.value,
                              }))
                            }
                            className="h-8 text-xs"
                            disabled={hasKey && provider.id !== "ollama"}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleVisible(provider.id)}
                          >
                            {isVisible ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => validateKey(provider.id)}
                            disabled={!tempValue || isValidating}
                          >
                            {isValidating ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : null}
                            {hasKey ? "Yeniden Test" : "Test & Kaydet"}
                          </Button>
                          {hasKey && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-destructive"
                              onClick={() => removeApiKey(provider.id)}
                            >
                              Sil
                            </Button>
                          )}
                        </div>

                        {validation && (
                          <div
                            className={`mt-1.5 text-[10px] ${
                              validation.valid
                                ? "text-emerald-500"
                                : "text-destructive"
                            }`}
                          >
                            {validation.valid ? (
                              <span className="flex items-center gap-1">
                                <Check className="h-2.5 w-2.5" />
                                Bağlantı başarılı
                                {validation.models && validation.models.length > 0 && (
                                  <span className="text-muted-foreground">
                                    ({validation.models.length} model bulundu)
                                  </span>
                                )}
                              </span>
                            ) : (
                              validation.error
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {currentStep.id === "models" && (
            <ModelSelectionStep
              connectedProviders={connectedProviders}
              selectedProvider={settings.defaultProvider}
              selectedModel={settings.defaultModel}
              onSelectProvider={(p) => {
                setSelectedProvider(p);
                setSelectedModel(PROVIDERS[p].models[0].id);
                updateSettings({ defaultProvider: p, defaultModel: PROVIDERS[p].models[0].id });
              }}
              onSelectModel={(m) => {
                setSelectedModel(m);
                updateSettings({ defaultModel: m });
              }}
            />
          )}

          {currentStep.id === "features" && <FeaturesStep />}

          {currentStep.id === "ready" && (
            <ReadyStep connectedCount={connectedProviders.length} onSkip={skip} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={skip} className="text-xs">
            Geç
          </Button>
          <div className="flex items-center gap-2">
            {onboardingStep > 0 && (
              <Button variant="outline" size="sm" onClick={prev} className="text-xs">
                <ChevronLeft className="h-3 w-3 mr-1" />
                Geri
              </Button>
            )}
            <Button size="sm" onClick={next} className="text-xs">
              {onboardingStep === STEPS.length - 1 ? (
                <>
                  <Rocket className="h-3 w-3 mr-1" />
                  Başla
                </>
              ) : (
                <>
                  İleri
                  <ChevronRight className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WelcomeStep() {
  return (
    <div className="space-y-4 text-center py-4">
      <a
        href="https://kutadgubilgi.com"
        target="_blank"
        rel="noreferrer"
        className="inline-block hover:opacity-80 transition-opacity"
        title="kutadgubilgi.com"
      >
        <Image
          src="/logo.png"
          alt="Kutadgubilgi Code"
          width={64}
          height={64}
          className="rounded-2xl mx-auto"
        />
      </a>
      <div>
        <h2 className="text-xl font-semibold mb-2">
          Kutadgubilgi Code'a Hoş Geldiniz
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          7 AI sağlayıcıyı tek arayüzde toplayan, akıllı routing, otonom agent,
          vector RAG, MCP server ve daha fazlasını içeren kod asistanı.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        <FeatureMini icon={<Zap className="h-3.5 w-3.5 text-amber-500" />} label="Streaming" />
        <FeatureMini icon={<Bot className="h-3.5 w-3.5 text-primary" />} label="Agent Modu" />
        <FeatureMini icon={<Shield className="h-3.5 w-3.5 text-emerald-500" />} label="Code Review" />
        <FeatureMini icon={<Database className="h-3.5 w-3.5 text-purple-500" />} label="Vector RAG" />
        <FeatureMini icon={<Plug className="h-3.5 w-3.5 text-primary" />} label="MCP Server" />
        <FeatureMini icon={<GitBranch className="h-3.5 w-3.5 text-orange-500" />} label="Git Timeline" />
      </div>

      <div className="text-[10px] text-muted-foreground mt-4 p-3 bg-secondary/30 rounded">
        💡 Bu sihirbaz 3-5 dakika sürer. API anahtarınız yoksa "Geç" deyip
        daha sonra Ayarlar'dan ekleyebilirsiniz.
      </div>
    </div>
  );
}

function FeatureMini({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-secondary/30 text-xs">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ModelSelectionStep({
  connectedProviders,
  selectedProvider,
  selectedModel,
  onSelectProvider,
  onSelectModel,
}: {
  connectedProviders: ProviderId[];
  selectedProvider: ProviderId;
  selectedModel: string;
  onSelectProvider: (p: ProviderId) => void;
  onSelectModel: (m: string) => void;
}) {
  if (connectedProviders.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-30" />
        Önce en az bir API anahtarı ekleyin
      </div>
    );
  }

  const provider = PROVIDERS[selectedProvider];

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium mb-2 block">1. Sağlayıcı Seç</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {connectedProviders.map((id) => {
            const p = PROVIDERS[id];
            const isSelected = selectedProvider === id;
            return (
              <button
                key={id}
                onClick={() => onSelectProvider(id)}
                className={`flex items-center gap-2 p-2.5 rounded-md border transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <div
                  className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: `${p.color}20`,
                    color: p.color,
                  }}
                >
                  {p.name[0]}
                </div>
                <span className="text-xs font-medium text-left">{p.name}</span>
                {isSelected && <Check className="h-3 w-3 text-primary ml-auto" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">
          2. Model Seç ({provider.models.length} model mevcut)
        </Label>
        <div className="space-y-1.5">
          {provider.models.map((m) => {
            const isSelected = selectedModel === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelectModel(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-md border transition-colors text-left ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {m.name}
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-4 ${
                        m.tier === "powerful"
                          ? "bg-purple-500/10 text-purple-500"
                          : m.tier === "fast"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-blue-500/10 text-blue-500"
                      }`}
                    >
                      {m.tier === "powerful" ? "güçlü" : m.tier === "fast" ? "hızlı" : "dengeli"}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>{(m.contextWindow / 1000).toFixed(0)}K context</span>
                    <span>·</span>
                    {m.inputCostPer1k === 0 ? (
                      <span className="text-emerald-500">ücretsiz</span>
                    ) : (
                      <span>${m.inputCostPer1k.toFixed(4)}/1k in</span>
                    )}
                    <span>·</span>
                    <span>
                      {m.capabilities.map((c) => {
                        const labels: Record<string, string> = {
                          code: "kod",
                          reasoning: "akıl",
                          vision: "görüntü",
                          "long-context": "uzun-ctx",
                          fast: "hızlı",
                          creative: "yaratıcı",
                        };
                        return labels[c] ?? c;
                      }).join(", ")}
                    </span>
                  </div>
                </div>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded">
        💡 Akıllı routing açıkken, her prompt için en uygun model otomatik seçilir.
        Manuel modda burada seçtiğiniz model kullanılır.
      </div>
    </div>
  );
}

function FeaturesStep() {
  const features = [
    { icon: <Zap className="h-4 w-4 text-amber-500" />, title: "Streaming", desc: "AI cevapları token token akar" },
    { icon: <Bot className="h-4 w-4 text-primary" />, title: "Agent Modu", desc: "Otonom AI - planla, dosya oku/yaz, terminal" },
    { icon: <Shield className="h-4 w-4 text-emerald-500" />, title: "Code Review", desc: "Güvenlik, performans, bug tespiti" },
    { icon: <Database className="h-4 w-4 text-purple-500" />, title: "Vector RAG", desc: "Doküman yükle, semantic arama" },
    { icon: <Plug className="h-4 w-4 text-primary" />, title: "MCP Server", desc: "Filesystem, GitHub, Puppeteer, SQLite" },
    { icon: <GitBranch className="h-4 w-4 text-orange-500" />, title: "Git Timeline", desc: "Commit geçmişi + AI özet" },
    { icon: <Puzzle className="h-4 w-4 text-cyan-500" />, title: "Plugin'ler", desc: "Slack, Jira, DB, Figma, OpenAPI" },
    { icon: <TerminalIcon className="h-4 w-4" />, title: "Terminal", desc: "Sandbox'lı güvenli komut çalıştırma" },
    { icon: <DollarSign className="h-4 w-4 text-amber-500" />, title: "Maliyet Takibi", desc: "Token bazlı, sağlayıcı bazında" },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm mb-2">
        Kutadgubilgi Code'un tüm özelliklerine Cmd+K (komut palette) ile erişebilirsiniz.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {features.map((f, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-secondary/20"
          >
            <div className="shrink-0 mt-0.5">{f.icon}</div>
            <div className="min-w-0">
              <div className="text-xs font-medium">{f.title}</div>
              <div className="text-[10px] text-muted-foreground">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded">
        ⌨️ <kbd className="bg-background px-1 rounded">Cmd+K</kbd> ile komut palette,
        <kbd className="bg-background px-1 rounded ml-1">Ctrl+S</kbd> ile dosya kaydet
      </div>
    </div>
  );
}

function ReadyStep({
  connectedCount,
  onSkip,
}: {
  connectedCount: number;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-4 text-center py-4">
      <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
        <Rocket className="h-8 w-8 text-emerald-500" />
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Hazırsın!</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {connectedCount > 0
            ? `${connectedCount} sağlayıcı bağlandı. Artık chat'e mesaj yazıp başlayabilirsin.`
            : "API anahtarı eklemeden devam ediyorsun. Ayarlar'dan istediğin zaman ekleyebilirsin."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
        <div className="bg-secondary/30 p-3 rounded-md text-left">
          <div className="text-[10px] text-muted-foreground">İlk sorunu sor</div>
          <div className="text-xs font-medium mt-0.5">"React'te todo yaz"</div>
        </div>
        <div className="bg-secondary/30 p-3 rounded-md text-left">
          <div className="text-[10px] text-muted-foreground">Komut palette</div>
          <div className="text-xs font-medium mt-0.5">
            <kbd className="bg-background px-1 rounded">Cmd+K</kbd>
          </div>
        </div>
      </div>

      <Button onClick={onSkip} className="w-full max-w-xs mx-auto">
        <Sparkles className="h-4 w-4 mr-2" />
        Başla
      </Button>
    </div>
  );
}
