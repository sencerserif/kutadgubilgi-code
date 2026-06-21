import type { ProviderId } from "@/types";

// Provider'ların Computer Use / Vision yetenekleri
export interface ComputerUseProvider {
  id: ProviderId;
  name: string;
  supportsComputerUse: boolean; // Native computer_use tool (Anthropic)
  supportsVision: boolean; // Image input (fallback için)
  models: string[];
  color: string;
}

export const COMPUTER_USE_PROVIDERS: ComputerUseProvider[] = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    supportsComputerUse: true, // Claude 3.5 Sonnet computer_use beta
    supportsVision: true,
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-sonnet-20240620"],
    color: "#d97757",
  },
  {
    id: "zhipu",
    name: "Zhipu GLM-4V",
    supportsComputerUse: false,
    supportsVision: true, // GLM-4V vision destekli
    models: ["glm-4v", "glm-4v-plus", "glm-4-plus"],
    color: "#3b82f6",
  },
  {
    id: "openai",
    name: "OpenAI GPT-4o",
    supportsComputerUse: false,
    supportsVision: true, // GPT-4o vision
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    color: "#10a37f",
  },
  {
    id: "google",
    name: "Google Gemini",
    supportsComputerUse: false,
    supportsVision: true, // Gemini 1.5/2.0 vision
    models: ["gemini-1.5-pro", "gemini-2.0-flash", "gemini-1.5-flash"],
    color: "#4285f4",
  },
  {
    id: "openrouter",
    name: "OpenRouter (Qwen-2.5-VL)",
    supportsComputerUse: false,
    supportsVision: true,
    models: ["qwen/qwen-2.5-vl-72b-instruct", "meta-llama/llama-3.2-90b-vision-instruct"],
    color: "#8b5cf6",
  },
];

// Computer Use tool tanımları (Anthropic formatında)
export const COMPUTER_USE_TOOLS = [
  {
    name: "computer",
    description:
      "Bilgisayarı kontrol et: ekran görüntüsü al, mouse ile tıkla, klavyeyle yaz, scroll yap. Ekrandaki öğeleri coordinate (x, y) ile belirt.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "screenshot",
            "mouse_move",
            "left_click",
            "right_click",
            "double_click",
            "triple_click",
            "left_click_drag",
            "type",
            "key",
            "scroll",
            "wait",
            "cursor_position",
          ],
          description: "Yapılacak aksiyon",
        },
        coordinate: {
          type: "array",
          items: { type: "number" },
          description: "[x, y] koordinatı (screenshot çözünürlüğünde)",
        },
        text: {
          type: "string",
          description: "type aksiyonu için yazılacak metin, key aksiyonu için tuş kombinasyonu (örn: 'Return', 'control+l')",
        },
        scroll_direction: {
          type: "string",
          enum: ["up", "down", "left", "right"],
        },
        scroll_amount: {
          type: "number",
          description: "Scroll miktarı (1-10)",
        },
        duration: {
          type: "number",
          description: "wait aksiyonu için saniye",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "bash",
    description: "Bash komutu çalıştır (tüm PC erişimi). Örn: ls ~/Desktop, mkdir -p ~/Documents/Arşiv, mv file.txt folder/",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" },
      },
      required: ["command"],
    },
  },
  {
    name: "file_read",
    description: "Dosya oku (tüm PC erişimi)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Tam dosya yolu (örn: /home/user/Desktop/file.txt)" },
      },
      required: ["path"],
    },
  },
  {
    name: "file_write",
    description: "Dosyaya yaz (tüm PC erişimi)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "file_list",
    description: "Dizin listele (tüm PC erişimi)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Boş = home dizini" },
      },
    },
  },
];

// Vision fallback prompt (GLM-4V, GPT-4o, Gemini için)
export const VISION_COMPUTER_USE_PROMPT = `Sen bir bilgisayar kontrol asistanısın. Kullanıcının bilgisayarını kontrol ederek görevleri yerine getiriyorsun.

Mevcut yeteneklerin:
- screenshot: Ekran görüntüsü al (parametre yok)
- mouse_move: Mouse'u [x,y] koordinatına taşı
- left_click: Sol tıkla (coordinate gerekli)
- right_click: Sağ tıkla (coordinate gerekli)
- double_click: Çift tıkla (coordinate gerekli)
- type: Metin yaz (text parametresi)
- key: Tuşa bas (text: 'Return', 'Escape', 'control+c', 'alt+tab', vb.)
- scroll: Kaydır (scroll_direction: up/down/left/right, scroll_amount: 1-10)
- wait: Bekle (duration: saniye)
- bash: Komut çalıştır (command)
- file_read: Dosya oku (path)
- file_write: Dosya yaz (path, content)
- file_list: Dizin listele (path)

ÖNEMLİ KURALLAR:
1. Her adımda SADECE BİR tool kullan
2. Tool çağrısı formatı: <tool_call>{"name": "tool_adi", "arguments": {...}}</tool_call>
3. Tool sonucunu bekle, sonra devam et
4. Görev tamamlanınca "GÖREV TAMAMLANDI: [özet]" yaz
5. Tehlikeli işlemler (silme, format) için önce sor: "Bu işlemi yapacağım, onaylıyor musun? <confirm>onay</confirm>"

Kullanıcının ekranı 1920x1080 çözünürlüğünde. Koordinatları buna göre ver.`;
