"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MessageSquare,
  Ticket,
  Database,
  Figma,
  Code2,
  Trash2,
  Settings2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import type { Plugin } from "@/types";

const PLUGIN_ICONS: Record<string, React.ReactNode> = {
  search: <Search className="h-3.5 w-3.5" />,
  message: <MessageSquare className="h-3.5 w-3.5" />,
  ticket: <Ticket className="h-3.5 w-3.5" />,
  database: <Database className="h-3.5 w-3.5" />,
  figma: <Figma className="h-3.5 w-3.5" />,
  api: <Code2 className="h-3.5 w-3.5" />,
};

export function PluginsPanel() {
  const {
    pluginsPanelOpen,
    setPluginsPanelOpen,
    plugins,
    togglePlugin,
    updatePluginConfig,
  } = useStore();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, unknown>>({});

  const handleTest = async (plugin: Plugin) => {
    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: plugin.id,
          action: "test",
          config: plugin.config,
          input: { query: "test", message: "Kutadgubilgi Code test" },
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else if (data.stub) {
        toast.info(data.message ?? "Stub mode");
      } else {
        toast.success("Plugin çalışıyor");
      }
    } catch {
      toast.error("Test başarısız");
    }
  };

  return (
    <Sheet open={pluginsPanelOpen} onOpenChange={setPluginsPanelOpen}>
      <SheetContent side="right" className="w-[450px] sm:w-[550px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Plugin Yöneticisi
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className="border border-border rounded-lg overflow-hidden"
            >
              <div className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center text-primary">
                  {PLUGIN_ICONS[plugin.icon] ?? <Code2 className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{plugin.name}</span>
                    <Badge variant="outline" className="text-[9px] h-4">
                      v{plugin.version}
                    </Badge>
                    {plugin.enabled && (
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500"
                      >
                        aktif
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {plugin.description}
                  </div>
                </div>
                <Switch
                  checked={plugin.enabled}
                  onCheckedChange={() => togglePlugin(plugin.id)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setExpanded(expanded === plugin.id ? null : plugin.id)
                  }
                >
                  <Settings2 className="h-3 w-3" />
                </Button>
              </div>

              {expanded === plugin.id && (
                <div className="px-3 pb-3 border-t border-border space-y-2 bg-secondary/20">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2">
                    Yapılandırma
                  </div>
                  {plugin.configSchema?.map((field) => (
                    <div key={field.key}>
                      <Label className="text-xs">
                        {field.label}
                        {field.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      <Input
                        type={
                          field.type === "string" && field.key.toLowerCase().includes("token")
                            ? "password"
                            : "text"
                        }
                        value={String(
                          configDraft[`${plugin.id}_${field.key}`] ??
                            plugin.config[field.key] ??
                            field.default ??
                            ""
                        )}
                        onChange={(e) => {
                          setConfigDraft({
                            ...configDraft,
                            [`${plugin.id}_${field.key}`]: e.target.value,
                          });
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const newConfig: Record<string, unknown> = {};
                        plugin.configSchema?.forEach((field) => {
                          const key = `${plugin.id}_${field.key}`;
                          if (configDraft[key] !== undefined) {
                            newConfig[field.key] = configDraft[key];
                          }
                        });
                        updatePluginConfig(plugin.id, newConfig);
                        toast.success(`${plugin.name} kaydedildi`);
                      }}
                    >
                      Kaydet
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleTest(plugin)}
                    >
                      Test Et
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
