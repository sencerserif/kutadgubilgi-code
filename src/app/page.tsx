"use client";

import { useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileTree } from "@/components/files/FileTree";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { TerminalSheet } from "@/components/terminal/TerminalSheet";
import { CostPanel } from "@/components/cost/CostPanel";
import { ComparePanel } from "@/components/compare/ComparePanel";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { SnippetsPanel } from "@/components/snippets/SnippetsPanel";
import { WorkspaceTabs } from "@/components/workspace/WorkspaceTabs";
import { GitTimeline } from "@/components/git/GitTimeline";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { RagPanel } from "@/components/rag/RagPanel";
import { PluginsPanel } from "@/components/plugins/PluginsPanel";
import { DiffViewer } from "@/components/diff/DiffViewer";
import { McpPanel } from "@/components/mcp/McpPanel";
import { CommandPalette } from "@/components/command/CommandPalette";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ThemePanel } from "@/components/theme/ThemePanel";
import { CollabPanel } from "@/components/collab/CollabPanel";
import { HistorySearch } from "@/components/history/HistorySearch";
import { StatusBar } from "@/components/statusbar/StatusBar";
import { ChatTabs } from "@/components/chat-tabs/ChatTabs";
import { ComputerUsePanel } from "@/components/computer/ComputerUsePanel";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/useStore";
import type { DiffResult } from "@/types";
import { Folder, MessageSquare, Code2, Command as CommandIcon, Sparkles } from "lucide-react";

export default function Home() {
  const {
    loadSettings,
    loadCostLog,
    sidebarVisible,
    editorVisible,
    activeFile,
    openFiles,
    setCommandPaletteOpen,
    activeMobilePanel,
    setActiveMobilePanel,
  } = useStore();

  const [viewDiff, setViewDiff] = useState<DiffResult | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    loadSettings();
    loadCostLog();
  }, [loadSettings, loadCostLog]);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + 1/2/3 → mobile panel switch
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveMobilePanel("files");
        } else if (e.key === "2") {
          e.preventDefault();
          setActiveMobilePanel("chat");
        } else if (e.key === "3") {
          e.preventDefault();
          setActiveMobilePanel("editor");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveMobilePanel]);

  const currentFile = activeFile
    ? openFiles.find((f) => f.path === activeFile)
    : null;

  // Mobile layout: single panel with bottom tabs
  if (isMobile) {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
        <WorkspaceTabs />
        <ChatTabs />

        <div className="flex-1 overflow-hidden">
          {activeMobilePanel === "files" && <FileTree />}
          {activeMobilePanel === "chat" && (
            <ChatPanel
              onViewDiff={(diff: DiffResult) => setViewDiff(diff)}
            />
          )}
          {activeMobilePanel === "editor" && <EditorPanel />}
        </div>

        <StatusBar />

        {/* Mobile bottom nav */}
        <div className="border-t border-border bg-background flex items-center justify-around py-1">
          <MobileNavButton
            active={activeMobilePanel === "files"}
            onClick={() => setActiveMobilePanel("files")}
            icon={<Folder className="h-4 w-4" />}
            label="Dosyalar"
          />
          <MobileNavButton
            active={activeMobilePanel === "chat"}
            onClick={() => setActiveMobilePanel("chat")}
            icon={<MessageSquare className="h-4 w-4" />}
            label="Sohbet"
          />
          <MobileNavButton
            active={activeMobilePanel === "editor"}
            onClick={() => setActiveMobilePanel("editor")}
            icon={<Code2 className="h-4 w-4" />}
            label="Editör"
          />
          <MobileNavButton
            active={false}
            onClick={() => setCommandPaletteOpen(true)}
            icon={<CommandIcon className="h-4 w-4" />}
            label="Komut"
          />
        </div>

        {/* All modals & sheets */}
        <AllModals viewDiff={viewDiff} setViewDiff={setViewDiff} currentFile={currentFile} />
      </div>
    );
  }

  // Desktop layout: split view
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      <WorkspaceTabs />
      <ChatTabs />

      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {sidebarVisible && (
          <>
            <ResizablePanel defaultSize={18} minSize={12} maxSize={30} className="bg-sidebar">
              <FileTree />
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        <ResizablePanel defaultSize={42} minSize={25}>
          <ChatPanel
            onViewDiff={(diff: DiffResult) => setViewDiff(diff)}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {editorVisible && (
          <ResizablePanel defaultSize={40} minSize={25}>
            <EditorPanel />
          </ResizablePanel>
        )}
      </ResizablePanelGroup>

      <StatusBar />

      <AllModals viewDiff={viewDiff} setViewDiff={setViewDiff} currentFile={currentFile} />
    </div>
  );
}

function AllModals({
  viewDiff,
  setViewDiff,
  currentFile,
}: {
  viewDiff: DiffResult | null;
  setViewDiff: (d: DiffResult | null) => void;
  currentFile: { name: string; content: string; language: string } | null;
}) {
  return (
    <>
      <OnboardingWizard />
      <SettingsDialog />
      <TerminalSheet />
      <CostPanel />
      <ComparePanel />
      <AgentPanel />
      <SnippetsPanel onApply={() => {}} />
      <GitTimeline />
      <RagPanel />
      <PluginsPanel />
      <McpPanel />
      <CommandPalette />
      <ThemePanel />
      <CollabPanel />
      <HistorySearch />
      <ComputerUsePanel />
      <ReviewPanel
        code={currentFile?.content ?? ""}
        filename={currentFile?.name}
        language={currentFile?.language}
      />

      <DiffViewer
        open={!!viewDiff}
        onOpenChange={(v) => !v && setViewDiff(null)}
        diff={viewDiff}
      />
    </>
  );
}

function MobileNavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md transition-colors ${
        active
          ? "text-primary bg-primary/10"
          : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
