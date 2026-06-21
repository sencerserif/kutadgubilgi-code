"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Eye, EyeOff, Check, KeyRound, Trash2, Loader2, Zap, AlertCircle, Plus, FileText } from "lucide-react";
import { useStore } from "@/store/useStore";
import { PROVIDER_LIST, PROVIDERS } from "@/lib/providers";
import type { ProviderId } from "@/types";
import { toast } from "sonner";

export function SettingsDialog() {
  const {
    settingsOpen,
    setSettingsOpen,
    settings,
    setApiKey,
    removeApiKey,
    updateSettings,
    routingMode,
    setRoutingMode,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    permissions,
    updatePermissions,
  } = useStore();

  const [tab, setTab] = useState("providers");
  const [visibleKeys, setVisibleKeys] = useState<Set<ProviderId>>(new Set());
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState<ProviderId | null>(null);
  const [validationStatus, setValidationStatus] = useState<
    Record<string, { valid: boolean; models?: string[]; error?: string }>
  >({});

  // Reset temp keys when dialog opens (event-based, not effect-based)
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setTempKeys({});
      setValidationStatus({});
    }
    setSettingsOpen(open);
  };

  const toggleVisible = (id: ProviderId) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleValidate = async (id: ProviderId) => {
    const value = tempKeys[id];
    if (!value) {
      toast.error("Önce API anahtarını girin");
      return;
    }
    setValidating(id);
    try {
      const res = await fetch("/api/ai/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id, apiKey: value }),
      });
      const data = await res.json();
      setValidationStatus((prev) => ({ ...prev, [id]: data }));
      if (data.valid) {
        toast.success(`${PROVIDERS[id].name} bağlantısı başarılı`);
      } else {
        toast.error(data.error ?? "Bağlantı başarısız");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test hatası");
    } finally {
      setValidating(null);
    }
  };

  const handleSaveKey = (id: ProviderId) => {
    const value = tempKeys[id];
    if (!value) {
      toast.error("API anahtarı boş");
      return;
    }
    setApiKey(id, value);
    setTempKeys((p) => ({ ...p, [id]: "" }));
    toast.success(`${PROVIDERS[id].name} anahtarı kaydedildi`);
  };

  const handleRemoveKey = (id: ProviderId) => {
    removeApiKey(id);
    toast.success(`${PROVIDERS[id].name} anahtarı silindi`);
  };

  return (
    <Dialog open={settingsOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Ayarlar
          </DialogTitle>
          <DialogDescription>
            API anahtarlarınız tarayıcınızda localStorage&apos;da saklanır.
            Sunucuya gönderilmez (sadece AI sağlayıcısına proxy olarak iletilir).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="providers">Sağlayıcılar</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="general">Genel</TabsTrigger>
            <TabsTrigger value="permissions">İzinler</TabsTrigger>
            <TabsTrigger value="commands">Komutlar</TabsTrigger>
          </TabsList>

          {/* Providers Tab */}
          <TabsContent
            value="providers"
            className="flex-1 overflow-y-auto space-y-2 mt-2"
          >
            {PROVIDER_LIST.map((provider) => {
              const hasKey = Boolean(settings.apiKeys[provider.id]);
              const isVisible = visibleKeys.has(provider.id);
              const tempValue = tempKeys[provider.id] ?? "";

              return (
                <div
                  key={provider.id}
                  className="border border-border rounded-lg p-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-8 w-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: `${provider.color}20`,
                        color: provider.color,
                      }}
                    >
                      {provider.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {provider.name}
                        </span>
                        {hasKey ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500"
                          >
                            <Check className="h-2.5 w-2.5 mr-1" />
                            Aktif
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4"
                          >
                            Anahtar yok
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
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {provider.description}
                      </p>

                      <div className="flex gap-1.5 mt-2">
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
                          className="h-7 text-xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleVisible(provider.id)}
                        >
                          {isVisible ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleValidate(provider.id)}
                          disabled={!tempValue || validating === provider.id}
                        >
                          {validating === provider.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3 mr-1" />
                          )}
                          Test
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSaveKey(provider.id)}
                          disabled={!tempValue}
                        >
                          Kaydet
                        </Button>
                        {hasKey && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleRemoveKey(provider.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Validation status */}
                      {validationStatus[provider.id] && (
                        <div
                          className={`mt-1.5 text-[10px] flex items-center gap-1 ${
                            validationStatus[provider.id].valid
                              ? "text-emerald-500"
                              : "text-destructive"
                          }`}
                        >
                          {validationStatus[provider.id].valid ? (
                            <>
                              <Check className="h-2.5 w-2.5" />
                              Bağlantı başarılı
                              {validationStatus[provider.id].models && (
                                <span className="text-muted-foreground">
                                  · {validationStatus[provider.id].models.length} model bulundu
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-2.5 w-2.5" />
                              {validationStatus[provider.id].error}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* Model & Routing Tab */}
          <TabsContent
            value="model"
            className="flex-1 overflow-y-auto space-y-4 mt-2"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Akıllı Routing</Label>
                <Switch
                  checked={routingMode === "smart"}
                  onCheckedChange={(c) => setRoutingMode(c ? "smart" : "manual")}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Akıllı routing açıkken, promptunuz analiz edilir ve en uygun
                sağlayıcı/model otomatik seçilir. Manuel modda her seferinde
                seçtiğiniz model kullanılır.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Varsayılan Sağlayıcı (Manuel mod)</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedProvider}
                onChange={(e) => {
                  const p = e.target.value as ProviderId;
                  setSelectedProvider(p);
                  setSelectedModel(PROVIDERS[p].models[0].id);
                }}
              >
                {PROVIDER_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Varsayılan Model</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {PROVIDERS[selectedProvider].models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.inputCostPer1k === 0 ? "(ücretsiz)" : `$${m.inputCostPer1k}/1k`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Sıcaklık (Temperature): {settings.temperature.toFixed(2)}
              </Label>
              <Slider
                value={[settings.temperature]}
                onValueChange={(v) => updateSettings({ temperature: v[0] })}
                min={0}
                max={2}
                step={0.05}
              />
              <p className="text-xs text-muted-foreground">
                Düşük: daha deterministik | Yüksek: daha yaratıcı
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Maksimum Token: {settings.maxTokens}
              </Label>
              <Slider
                value={[settings.maxTokens]}
                onValueChange={(v) => updateSettings({ maxTokens: v[0] })}
                min={256}
                max={16384}
                step={256}
              />
            </div>
          </TabsContent>

          {/* General Tab */}
          <TabsContent value="general" className="flex-1 overflow-y-auto space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-sm">Sistem Promptu Preset'leri</Label>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {useStore.getState().systemPromptPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      updateSettings({ systemPrompt: preset.prompt });
                      toast.success(`"${preset.name}" uygulandı`);
                    }}
                    className="text-left p-2 rounded border border-border hover:bg-accent text-xs"
                  >
                    <div className="font-medium flex items-center gap-1">
                      {preset.name}
                      {preset.isBuiltIn && (
                        <Badge variant="outline" className="text-[9px] h-3.5">
                          builtin
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {preset.prompt.slice(0, 60)}...
                    </div>
                  </button>
                ))}
              </div>

              <Label className="text-sm">Sistem Promptu</Label>
              <Textarea
                value={settings.systemPrompt}
                onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                className="min-h-[120px] text-xs"
                placeholder="AI'ya verilecek sistem promptu..."
              />
              <p className="text-xs text-muted-foreground">
                AI&apos;nın davranışını özelleştirmek için kullanılır. Yukarıdaki preset&apos;lerden birini seçebilir veya kendiniz yazabilirsiniz.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Workspace Yolu</Label>
              <Input
                value={settings.workspacePath}
                onChange={(e) => updateSettings({ workspacePath: e.target.value })}
                className="text-xs"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Dosya işlemleri bu klasörde yapılır (şu anda değiştirilemez)
              </p>
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="flex-1 overflow-y-auto space-y-3 mt-2">
            <div className="text-sm mb-2">
              AI Tool Use için izinleri yönet. AI tool modunda dosya okuyabilir, düzenleyebilir, komut çalıştırabilir.
            </div>
            <PermissionToggle
              label="Dosya Okuma"
              description="AI otomatik dosya okuyabilir (read_file, list_directory)"
              checked={permissions.autoApproveReads}
              onChange={(v) => updatePermissions({ autoApproveReads: v })}
            />
            <PermissionToggle
              label="Dosya Yazma"
              description="AI otomatik dosya yazabilir/düzenleyebilir (write_file, edit_file)"
              checked={permissions.autoApproveWrites}
              onChange={(v) => updatePermissions({ autoApproveWrites: v })}
              warning={!permissions.autoApproveWrites && "Kapalı - AI yazma işlemi için onay ister"}
            />
            <PermissionToggle
              label="Komut Çalıştırma"
              description="AI bash komutu çalıştırabilir (sandbox içinde, güvenlik kontrollü)"
              checked={permissions.autoApproveBash}
              onChange={(v) => updatePermissions({ autoApproveBash: v })}
              warning={!permissions.autoApproveBash && "Kapalı - AI komut için onay ister"}
            />
            <PermissionToggle
              label="Arama"
              description="AI dosya içeriğinde arama yapabilir (grep, glob)"
              checked={permissions.autoApproveSearch}
              onChange={(v) => updatePermissions({ autoApproveSearch: v })}
            />

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 text-xs text-amber-600 dark:text-amber-400 mt-3">
              <strong>⚠️ Güvenlik Notu:</strong> Yazma ve komut izinlerini açtığınızda AI otomatik olarak
              dosya değiştirebilir/komut çalıştırabilir. Hassas projelerde kapalı tutmanız önerilir.
            </div>

            <div className="bg-secondary/30 rounded-md p-3 text-xs">
              <div className="font-medium mb-1">Context Files</div>
              <div className="text-muted-foreground mb-2">
                AI'a ek context sağlamak için dosya ekleyin. Bu dosyalar her mesajla birlikte gönderilir.
              </div>
              <ContextFilesManager />
            </div>
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="flex-1 overflow-y-auto space-y-3 mt-2">
            <CustomCommandsEditor />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={() => setSettingsOpen(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionToggle({
  label,
  description,
  checked,
  onChange,
  warning,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warning?: string;
}) {
  return (
    <div className="border border-border rounded-lg p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{description}</div>
        {warning && (
          <div className="text-[10px] text-amber-500 mt-1">{warning}</div>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ContextFilesManager() {
  const {
    contextFiles,
    addContextFile,
    removeContextFile,
    clearContextFiles,
    fileTree,
  } = useStore();
  const [input, setInput] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="dosya yolu (örn: src/index.ts)"
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              addContextFile(input.trim());
              setInput("");
            }
          }}
        />
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            if (input.trim()) {
              addContextFile(input.trim());
              setInput("");
            }
          }}
        >
          Ekle
        </Button>
      </div>

      {contextFiles.length > 0 ? (
        <div className="space-y-1">
          {contextFiles.map((path) => (
            <div
              key={path}
              className="flex items-center gap-2 p-1.5 rounded border border-border text-xs"
            >
              <FileText className="h-3 w-3 text-primary shrink-0" />
              <code className="flex-1 truncate font-mono text-[10px]">{path}</code>
              <button
                onClick={() => removeContextFile(path)}
                className="text-destructive hover:text-destructive/80"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={clearContextFiles}
            className="text-[10px] text-destructive hover:underline"
          >
            Tümünü temizle
          </button>
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground">
          Henüz context dosyası yok
        </div>
      )}
    </div>
  );
}

function CustomCommandsEditor() {
  const {
    customCommands,
    addCustomCommand,
    removeCustomCommand,
  } = useStore();
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");

  const handleAdd = () => {
    if (!name.trim() || !command.trim()) {
      toast.error("İsim ve komut gerekli");
      return;
    }
    addCustomCommand({
      name: name.trim().replace(/^\//, ""),
      command: command.trim(),
      description: description.trim(),
    });
    setName("");
    setCommand("");
    setDescription("");
    toast.success("Komut eklendi");
  };

  return (
    <div className="space-y-3">
      <div className="text-sm">
        Slash komutları ekle/düzenle. <code className="bg-secondary px-1 rounded">/komut-adi</code> ile çağrılır.
      </div>

      {/* Add new command */}
      <div className="border border-border rounded-lg p-3 space-y-2 bg-secondary/20">
        <div className="text-xs font-medium">Yeni Komut</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">İsim (olmadan /)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn: deploy"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px]">Açıklama</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Açıklama (opsiyonel)"
              className="h-7 text-xs"
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Komut çıktısı (AI'a mesaj olarak gönderilir)</Label>
          <Textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="örn: Deploy başlatılıyor... build && npm run deploy"
            className="min-h-[60px] text-xs"
          />
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>
          <Plus className="h-3 w-3 mr-1" />
          Ekle
        </Button>
      </div>

      {/* List existing commands */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Komutlar ({customCommands.length})
        </div>
        <div className="space-y-1">
          {customCommands.map((cmd) => (
            <div
              key={cmd.id}
              className="flex items-start gap-2 p-2 rounded border border-border text-xs"
            >
              <code className="text-primary font-mono shrink-0">/{cmd.name}</code>
              <div className="flex-1 min-w-0">
                {cmd.description && (
                  <div className="text-[10px] text-muted-foreground">
                    {cmd.description}
                  </div>
                )}
                {!cmd.isBuiltIn && (
                  <div className="text-[10px] text-muted-foreground truncate font-mono">
                    {cmd.command}
                  </div>
                )}
              </div>
              {cmd.isBuiltIn ? (
                <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                  builtin
                </Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 text-destructive"
                  onClick={() => removeCustomCommand(cmd.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}