import type { ApiKeys, AppSettings, CostEntry } from "@/types";

const KEYS = {
  API_KEYS: "aicode_api_keys",
  SETTINGS: "aicode_settings",
  COST_LOG: "aicode_cost_log",
  CHAT_HISTORY: "aicode_chat_history",
  ONBOARDING_COMPLETED: "aicode_onboarding_completed",
} as const;

// API Keys
export function getApiKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEYS.API_KEYS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveApiKeys(keys: ApiKeys): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.API_KEYS, JSON.stringify(keys));
}

// Settings
const DEFAULT_SETTINGS: AppSettings = {
  apiKeys: {},
  defaultProvider: "anthropic",
  defaultModel: "claude-3-5-sonnet-20241022",
  routingMode: "smart",
  workspacePath: "/home/z/my-project/workspace",
  theme: "dark",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt:
    "Sen uzman bir yazılım geliştirici asistanısın. Claude Code gibi davran: kod yaz, dosyaları oku ve düzenle, hataları ayıkla. Türkçe yanıt ver. Kod bloklarını markdown formatında ver.",
};

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  if (typeof window === "undefined") return;
  const current = getSettings();
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
}

// Cost tracking
export function getCostLog(): CostEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.COST_LOG);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addCostEntry(entry: CostEntry): void {
  if (typeof window === "undefined") return;
  const log = getCostLog();
  log.push(entry);
  // Son 1000 kaydı tut
  const trimmed = log.slice(-1000);
  localStorage.setItem(KEYS.COST_LOG, JSON.stringify(trimmed));
}

export function clearCostLog(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.COST_LOG);
}

// Chat history
export function getChatHistory(chatId = "default") {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${KEYS.CHAT_HISTORY}_${chatId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: unknown[], chatId = "default") {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `${KEYS.CHAT_HISTORY}_${chatId}`,
    JSON.stringify(messages)
  );
}

// Onboarding
export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEYS.ONBOARDING_COMPLETED) === "true";
}

export function setOnboardingCompleted(v: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.ONBOARDING_COMPLETED, v ? "true" : "false");
}
