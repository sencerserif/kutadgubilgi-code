"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Terminal as TerminalIcon, Loader2, ChevronRight } from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";

export function TerminalSheet() {
  const {
    terminalOpen,
    setTerminalOpen,
    terminalCommands,
    addTerminalCommand,
    clearTerminal,
  } = useStore();
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [terminalOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalCommands]);

  const runCommand = async (cmd: string) => {
    if (!cmd.trim() || running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      addTerminalCommand({
        id: `cmd-${Date.now()}`,
        command: cmd,
        output: data.output ?? data.error ?? "",
        exitCode: data.exitCode ?? 1,
        timestamp: Date.now(),
      });
      if (data.timeout) {
        toast.warning("Komut zaman aşımına uğradı (20sn)");
      }
    } catch (err) {
      toast.error("Terminal hatası");
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCommand(input);
      setInput("");
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      clearTerminal();
    }
  };

  return (
    <Sheet open={terminalOpen} onOpenChange={setTerminalOpen}>
      <SheetContent
        side="bottom"
        className="h-[400px] p-0 flex flex-col bg-zinc-950 border-zinc-800"
      >
        <SheetHeader className="px-3 py-2 border-b border-zinc-800 flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-xs flex items-center gap-2">
            <TerminalIcon className="h-3.5 w-3.5 text-emerald-500" />
            Terminal · /home/z/my-project/workspace
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={clearTerminal}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </SheetHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5"
        >
          {terminalCommands.length === 0 ? (
            <div className="text-zinc-500 text-center py-8">
              <TerminalIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Komut yazıp Enter&apos;a basın</p>
              <p className="text-[10px] mt-1">
                cd, ls, git, npm, bun, python komutları çalışır
              </p>
            </div>
          ) : (
            terminalCommands.map((cmd) => (
              <div key={cmd.id}>
                <div className="flex items-center gap-1 text-emerald-400">
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-zinc-300">{cmd.command}</span>
                  {cmd.exitCode !== 0 && (
                    <span className="ml-auto text-red-400 text-[10px]">
                      exit {cmd.exitCode}
                    </span>
                  )}
                </div>
                <pre className="text-zinc-300 whitespace-pre-wrap mt-0.5 pl-4">
                  {cmd.output}
                </pre>
              </div>
            ))
          )}
          {running && (
            <div className="flex items-center gap-2 text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              çalışıyor...
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 p-2 flex items-center gap-2">
          <ChevronRight className="h-3 w-3 text-emerald-500" />
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="komut yazın..."
            className="border-0 bg-transparent font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={running}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
