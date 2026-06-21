"use client";

import { useStore } from "@/store/useStore";
import { PROVIDERS } from "@/lib/providers";
import { toast } from "sonner";

export interface SlashCommandResult {
  handled: boolean;
  output?: string;
  clearInput?: boolean;
}

export function processSlashCommand(
  input: string
): SlashCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { handled: false };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1).join(" ");

  const store = useStore.getState();

  switch (cmd) {
    case "help": {
      const commands = store.customCommands;
      const helpText = `**Kutadgubilgi Code - Komutlar**

${commands
  .map((c) => `**/${c.name}** - ${c.description}`)
  .join("\n")}

**Klavye Kısayolları:**
- \`Cmd+K\` - Komut palette
- \`Cmd+1/2/3\` - Panel switch (mobile)
- \`Ctrl+S\` - Dosya kaydet
- \`Enter\` - Mesaj gönder
- \`Shift+Enter\` - Yeni satır

**AI Tool'ları (AI otomatik kullanır):**
- read_file, write_file, edit_file
- list_directory, bash, grep, glob
- todo_write`;
      return { handled: true, output: helpText, clearInput: true };
    }

    case "clear": {
      if (confirm("Sohbet temizlensin mi?")) {
        store.clearMessages();
        toast.success("Sohbet temizlendi");
      }
      return { handled: true, clearInput: true };
    }

    case "model": {
      if (!args) {
        return {
          handled: true,
          output: `Mevcut: **${PROVIDERS[store.selectedProvider].name}** - ${store.selectedModel}`,
          clearInput: true,
        };
      }
      // /model <provider> [model]
      const [providerName, modelName] = args.split(/\s+/);
      const provider = (Object.keys(PROVIDERS) as Array<keyof typeof PROVIDERS>).find(
        (k) => PROVIDERS[k].name.toLowerCase().includes(providerName.toLowerCase()) || k === providerName.toLowerCase()
      );
      if (!provider) {
        return {
          handled: true,
          output: `Sağlayıcı bulunamadı: ${providerName}\n\nMevcut: ${Object.values(PROVIDERS).map((p) => p.name).join(", ")}`,
          clearInput: true,
        };
      }
      const model = modelName
        ? PROVIDERS[provider].models.find((m) => m.id === modelName || m.name.toLowerCase().includes(modelName.toLowerCase()))
        : PROVIDERS[provider].models[0];
      if (!model) {
        return {
          handled: true,
          output: `Model bulunamadı: ${modelName}\n\nModeller: ${PROVIDERS[provider].models.map((m) => m.id).join(", ")}`,
          clearInput: true,
        };
      }
      store.setSelectedProvider(provider);
      store.setSelectedModel(model.id);
      return {
        handled: true,
        output: `Model değiştirildi: **${PROVIDERS[provider].name}** - ${model.name}`,
        clearInput: true,
      };
    }

    case "cost": {
      const log = store.costLog;
      const total = log.reduce((s, e) => s + e.cost, 0);
      const tokensIn = log.reduce((s, e) => s + e.tokensIn, 0);
      const tokensOut = log.reduce((s, e) => s + e.tokensOut, 0);
      const byProvider: Record<string, { count: number; cost: number }> = {};
      log.forEach((e) => {
        if (!byProvider[e.provider]) byProvider[e.provider] = { count: 0, cost: 0 };
        byProvider[e.provider].count++;
        byProvider[e.provider].cost += e.cost;
      });
      return {
        handled: true,
        output: `**Maliyet Özeti**

Toplam: **$${total.toFixed(4)}**
Token: ${tokensIn.toLocaleString()} in / ${tokensOut.toLocaleString()} out
İstek: ${log.length}

**Sağlayıcı Bazında:**
${Object.entries(byProvider)
  .map(([p, info]) => `- ${PROVIDERS[p as keyof typeof PROVIDERS]?.name ?? p}: ${info.count} istek, $${info.cost.toFixed(4)}`)
  .join("\n") || "(kayıt yok)"}`,
        clearInput: true,
      };
    }

    case "theme": {
      store.setThemePanelOpen(true);
      return { handled: true, clearInput: true };
    }

    case "agent": {
      store.setAgentPanelOpen(true);
      return { handled: true, clearInput: true };
    }

    case "computer":
    case "pc":
    case "screen": {
      store.setComputerUseOpen(true);
      return {
        handled: true,
        output: "🖥️ Computer Use paneli açıldı. Hedefini yazıp Başlat'a bas. AI ekran görüntüsü alıp mouse/keyboard ile PC'ni kontrol eder.",
        clearInput: true,
      };
    }

    case "compare": {
      store.setComparePanelOpen(true);
      return { handled: true, clearInput: true };
    }

    case "checkpoint": {
      const name = args || `Checkpoint ${new Date().toLocaleString("tr-TR")}`;
      store.saveCheckpoint(name);
      return {
        handled: true,
        output: `✓ Checkpoint kaydedildi: **${name}**\n\nGeri yüklemek için: \`/restore\``,
        clearInput: true,
      };
    }

    case "restore": {
      const checkpoints = store.checkpoints;
      if (checkpoints.length === 0) {
        return { handled: true, output: "Checkpoint yok. `/checkpoint` ile kaydet.", clearInput: true };
      }
      if (args) {
        const cp = checkpoints.find((c) => c.id === args || c.name.includes(args));
        if (cp) {
          store.restoreCheckpoint(cp.id);
          return { handled: true, output: `✓ Geri yüklendi: **${cp.name}**`, clearInput: true };
        }
      }
      return {
        handled: true,
        output: `**Checkpoints**\n\n${checkpoints
          .map((c, i) => `${i + 1}. **${c.name}** (${new Date(c.timestamp).toLocaleString("tr-TR")}) - ${c.messages.length} mesaj\n   ID: \`${c.id}\``)
          .join("\n")}\n\n\`/restore <id>\` ile geri yükle`,
        clearInput: true,
      };
    }

    case "export": {
      store.exportChat();
      return { handled: true, output: "✓ Sohbet dışa aktarıldı", clearInput: true };
    }

    case "review": {
      store.setReviewPanelOpen(true);
      return { handled: true, clearInput: true };
    }

    case "rag": {
      store.setRagPanelOpen(true);
      return { handled: true, clearInput: true };
    }

    case "mcp": {
      store.setMcpPanelOpen(true);
      return { handled: true, clearInput: true };
    }

    case "snippet": {
      store.setSnippetsPanelOpen(true);
      return { handled: true, clearInput: true };
    }

    case "files": {
      const files = store.contextFiles;
      return {
        handled: true,
        output:
          files.length === 0
            ? "Context dosyası yok. Dosya ağacından sağ tıkla 'Context'e ekle' veya `/add <path>` kullan."
            : `**Context Dosyaları** (${files.length})\n\n${files.map((f, i) => `${i + 1}. \`${f}\``).join("\n")}`,
        clearInput: true,
      };
    }

    default: {
      // Custom commands
      const custom = store.customCommands.find((c) => c.name === cmd);
      if (custom && !custom.isBuiltIn) {
        return {
          handled: true,
          output: `[Custom command: ${custom.name}]\n\n${custom.command}`,
          clearInput: true,
        };
      }
      return {
        handled: true,
        output: `Bilinmeyen komut: \`/${cmd}\`\n\n\`/help\` ile tüm komutları gör`,
        clearInput: true,
      };
    }
  }
}

// Slash command autocomplete suggestions
export function getSlashCommandSuggestions(input: string): string[] {
  if (!input.startsWith("/")) return [];
  const parts = input.slice(1).split(/\s+/);
  if (parts.length > 1) return [];

  const cmd = parts[0]?.toLowerCase() ?? "";
  const commands = useStore.getState().customCommands;
  return commands
    .filter((c) => c.name.startsWith(cmd))
    .map((c) => `/${c.name} - ${c.description}`);
}
