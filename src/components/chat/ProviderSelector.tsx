"use client";

import { useState } from "react";
import { ChevronDown, Check, Zap } from "lucide-react";
import { useStore } from "@/store/useStore";
import { PROVIDER_LIST, PROVIDERS } from "@/lib/providers";
import { routePrompt } from "@/lib/routing";
import type { ProviderId } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function ProviderSelector({ compact = false }: { compact?: boolean }) {
  const {
    routingMode,
    setRoutingMode,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    settings,
  } = useStore();
  const [open, setOpen] = useState(false);

  const currentProvider = PROVIDERS[selectedProvider];
  const hasKey = (id: ProviderId) => {
    if (id === "ollama") return true;
    return Boolean(settings.apiKeys[id]);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Routing Mode Toggle */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50">
        <Zap
          className={cn(
            "h-3 w-3",
            routingMode === "smart" ? "text-amber-500" : "text-muted-foreground"
          )}
        />
        <span className="text-[10px] text-muted-foreground">Akıllı</span>
        <Switch
          checked={routingMode === "smart"}
          onCheckedChange={(c) => setRoutingMode(c ? "smart" : "manual")}
          className="scale-75"
        />
      </div>

      {/* Provider / Model Selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2 h-7", compact && "px-2")}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: currentProvider.color }}
            />
            <span className="text-xs font-medium">
              {currentProvider.name}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">
              AI Sağlayıcılar
            </div>
            {PROVIDER_LIST.map((provider) => {
              const isSelected = selectedProvider === provider.id;
              const isAvailable = hasKey(provider.id);
              return (
                <div key={provider.id}>
                  <button
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left",
                      isSelected && "bg-accent"
                    )}
                    onClick={() => {
                      setSelectedProvider(provider.id);
                      if (provider.models[0]) {
                        setSelectedModel(provider.models[0].id);
                      }
                    }}
                    disabled={!isAvailable}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: provider.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{provider.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {provider.description}
                      </div>
                    </div>
                    {!isAvailable && (
                      <Badge variant="secondary" className="text-[9px] h-4">
                        Anahtar yok
                      </Badge>
                    )}
                    {isSelected && <Check className="h-3 w-3" />}
                  </button>

                  {isSelected && (
                    <div className="ml-6 pl-2 border-l border-border space-y-0.5 mt-0.5 mb-1">
                      {provider.models.map((model) => (
                        <button
                          key={model.id}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-left",
                            selectedModel === model.id && "bg-accent"
                          )}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setOpen(false);
                          }}
                        >
                          <span className="text-xs flex-1">{model.name}</span>
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1"
                          >
                            {model.tier === "fast"
                              ? "hızlı"
                              : model.tier === "powerful"
                              ? "güçlü"
                              : "dengeli"}
                          </Badge>
                          {model.inputCostPer1k === 0 ? (
                            <span className="text-[9px] text-emerald-500">
                              ücretsiz
                            </span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground">
                              ${model.inputCostPer1k.toFixed(4)}/1k
                            </span>
                          )}
                          {selectedModel === model.id && (
                            <Check className="h-3 w-3" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Akıllı routing için dışarıdan çağrılabilir
export function getRouteForPrompt(
  prompt: string,
  hasImages: boolean,
  fileContext: string,
  apiKeys: Record<ProviderId, string | undefined>
) {
  return routePrompt(
    {
      prompt,
      hasImages,
      fileContext,
      codeLength: fileContext.length,
      isReasoning: false,
    },
    apiKeys
  );
}
