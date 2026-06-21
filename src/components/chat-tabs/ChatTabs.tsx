"use client";

import { useStore } from "@/store/useStore";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatTabs() {
  const {
    chatTabs,
    activeChatTabId,
    setActiveChatTab,
    addChatTab,
    removeChatTab,
    messages,
  } = useStore();

  // Sync active tab messages
  const activeTab = chatTabs.find((t) => t.id === activeChatTabId);
  if (activeTab && activeTab.messages !== messages) {
    activeTab.messages = messages;
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-secondary/20 border-b border-border overflow-x-auto">
      {chatTabs.map((tab) => {
        const isActive = tab.id === activeChatTabId;
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer whitespace-nowrap group transition-colors ${
              isActive
                ? "bg-background text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveChatTab(tab.id)}
          >
            <span className="max-w-[100px] truncate">{tab.name}</span>
            {tab.messages.length > 0 && (
              <span className="text-[9px] text-muted-foreground bg-secondary px-1 rounded">
                {tab.messages.length}
              </span>
            )}
            {chatTabs.length > 1 && (
              <button
                className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  removeChatTab(tab.id);
                }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => addChatTab()}
        title="Yeni sohbet"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
