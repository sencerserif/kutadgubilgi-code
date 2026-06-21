import type {
  ProviderId,
  ProviderConfig,
  ModelCapability,
  RoutingDecision,
  ApiKeys,
} from "@/types";
import { PROVIDERS } from "./providers";

interface RouteContext {
  prompt: string;
  hasImages: boolean;
  fileContext?: string;
  codeLength: number;
  isReasoning: boolean;
}

/**
 * Akıllı routing: prompt'a göre en uygun sağlayıcı/model seçer
 * Hesaplama faktörleri:
 * - Kod ağırlıklı mı?
 * - Uzun context gerekiyor mu?
 * - Görsel var mı?
 * - Akıl yürütme gerekiyor mu?
 * - Maliyet optimizasyonu
 */
export function routePrompt(
  ctx: RouteContext,
  apiKeys: ApiKeys
): RoutingDecision {
  const prompt = ctx.prompt.toLowerCase();
  const availableProviders = getAvailableProviders(apiKeys);

  if (availableProviders.length === 0) {
    return {
      provider: "openai",
      model: "gpt-4o-mini",
      reason: "Hiç API anahtarı yok - varsayılan",
      confidence: 0,
    };
  }

  // Görev tipini tespit et
  const taskType = detectTaskType(ctx);

  // Her sağlayıcı için bir skor hesapla
  const scores = availableProviders.map((providerId) => {
    const provider = PROVIDERS[providerId];
    const bestModel = pickBestModel(provider.models, taskType, ctx);
    const score = scoreProvider(provider, bestModel, taskType, ctx);
    return { providerId, model: bestModel, score, reason: buildReason(taskType, provider, bestModel) };
  });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  return {
    provider: best.providerId,
    model: best.model.id,
    reason: best.reason,
    confidence: Math.min(1, best.score / 100),
  };
}

function getAvailableProviders(apiKeys: ApiKeys): ProviderId[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).filter((id) => {
    if (id === "ollama") return true; // Ollama key gerektirmez
    return Boolean(apiKeys[id]);
  });
}

type TaskType =
  | "code-generation"
  | "code-review"
  | "reasoning"
  | "creative"
  | "vision"
  | "long-context"
  | "quick-chat"
  | "general";

function detectTaskType(ctx: RouteContext): TaskType {
  const p = ctx.prompt.toLowerCase();

  if (ctx.hasImages) return "vision";

  if (ctx.codeLength > 50000 || (ctx.fileContext?.length ?? 0) > 50000) {
    return "long-context";
  }

  if (
    p.includes("debug") ||
    p.includes("hata") ||
    p.includes("error") ||
    p.includes("fix") ||
    p.includes("düzelt") ||
    p.includes("review") ||
    p.includes("incele")
  ) {
    return "code-review";
  }

  if (
    p.includes("yaz") ||
    p.includes("oluştur") ||
    p.includes("implement") ||
    p.includes("create") ||
    p.includes("generate") ||
    p.includes("fonksiyon") ||
    p.includes("component") ||
    p.includes("class")
  ) {
    return "code-generation";
  }

  if (
    p.includes("neden") ||
    p.includes("nedeniyle") ||
    p.includes("açıkla") ||
    p.includes("explain") ||
    p.includes("mantık") ||
    p.includes("reason") ||
    p.includes("analiz") ||
    p.includes("analyze") ||
    p.includes("karşılaştır")
  ) {
    return "reasoning";
  }

  if (
    p.includes("hikaye") ||
    p.includes("şiir") ||
    p.includes("story") ||
    p.includes("creative") ||
    p.includes("yaratıcı")
  ) {
    return "creative";
  }

  if (p.length < 100) return "quick-chat";

  return "general";
}

function pickBestModel(
  models: ProviderConfig["models"],
  taskType: TaskType,
  ctx: RouteContext
) {
  const requiredCaps = getRequiredCapabilities(taskType);

  // Önce yetenekleri eşleşenleri bul
  const capable = models.filter((m) =>
    requiredCaps.every((cap) => m.capabilities.includes(cap))
  );

  const candidates = capable.length > 0 ? capable : models;

  // Task tipine göre tier seç
  if (taskType === "reasoning" || taskType === "code-review") {
    const powerful = candidates.find((m) => m.tier === "powerful");
    if (powerful) return powerful;
  }

  if (taskType === "quick-chat") {
    const fast = candidates.find((m) => m.tier === "fast");
    if (fast) return fast;
  }

  // Maliyet/performans dengesi - balanced tercih et
  const balanced = candidates.find((m) => m.tier === "balanced");
  if (balanced) return balanced;

  return candidates[0];
}

function getRequiredCapabilities(taskType: TaskType): ModelCapability[] {
  switch (taskType) {
    case "code-generation":
    case "code-review":
      return ["code"];
    case "vision":
      return ["vision"];
    case "long-context":
      return ["long-context"];
    case "reasoning":
      return ["reasoning"];
    case "creative":
      return ["creative"];
    case "quick-chat":
      return ["fast"];
    default:
      return [];
  }
}

function scoreProvider(
  provider: ProviderConfig,
  model: ProviderConfig["models"][number],
  taskType: TaskType,
  ctx: RouteContext
): number {
  let score = 50;

  // Tier match
  if (taskType === "reasoning" || taskType === "code-review") {
    if (model.tier === "powerful") score += 30;
    else if (model.tier === "balanced") score += 15;
  } else if (taskType === "quick-chat") {
    if (model.tier === "fast") score += 30;
    else if (model.tier === "balanced") score += 15;
  } else {
    if (model.tier === "balanced") score += 25;
    else if (model.tier === "powerful") score += 15;
    else if (model.tier === "fast") score += 20;
  }

  // Maliyet cezası (düşük maliyet = yüksek skor)
  const totalCost = model.inputCostPer1k + model.outputCostPer1k;
  if (totalCost === 0) score += 15; // Yerel (ücretsiz)
  else if (totalCost < 0.001) score += 12;
  else if (totalCost < 0.005) score += 8;
  else if (totalCost < 0.02) score += 4;
  else score -= 5;

  // Long-context ihtiyacı
  if (taskType === "long-context") {
    if (model.contextWindow >= 1000000) score += 20;
    else if (model.contextWindow >= 200000) score += 10;
    else if (model.contextWindow < 64000) score -= 20;
  }

  // Kod işlerinde kod specialty
  if (
    (taskType === "code-generation" || taskType === "code-review") &&
    model.capabilities.includes("code")
  ) {
    score += 10;
  }

  // Sağlayıcı bias - kodda güçlü olanlar
  if (taskType === "code-generation") {
    if (provider.id === "anthropic") score += 8;
    if (provider.id === "deepseek") score += 6;
  }
  if (taskType === "reasoning") {
    if (provider.id === "openai") score += 6;
    if (provider.id === "deepseek") score += 4;
  }

  return score;
}

function buildReason(
  taskType: TaskType,
  provider: ProviderConfig,
  model: ProviderConfig["models"][number]
): string {
  const taskLabels: Record<TaskType, string> = {
    "code-generation": "kod üretimi",
    "code-review": "kod inceleme",
    reasoning: "akıl yürütme",
    creative: "yaratıcı yazım",
    vision: "görsel analiz",
    "long-context": "uzun context",
    "quick-chat": "hızlı sohbet",
    general: "genel görev",
  };

  const tierLabels: Record<string, string> = {
    fast: "hızlı",
    balanced: "dengeli",
    powerful: "güçlü",
  };

  return `${taskLabels[taskType]} görevi için ${provider.name} ${model.name} (${tierLabels[model.tier]}) seçildi`;
}
