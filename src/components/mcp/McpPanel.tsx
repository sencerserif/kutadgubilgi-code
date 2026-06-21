"use client";

import { useState, useEffect } from "react";
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
  Server,
  Plus,
  Trash2,
  Wrench,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Plug,
  FolderTree,
  Github,
  Globe,
  Brain,
  Database,
  Code2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";

interface McpServerInfo {
  id: string;
  name: string;
  url: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

const SERVER_ICONS: Record<string, React.ReactNode> = {
  "mcp-filesystem": <FolderTree className="h-4 w-4" />,
  "mcp-github": <Github className="h-4 w-4" />,
  "mcp-fetch": <Globe className="h-4 w-4" />,
  "mcp-memory": <Brain className="h-4 w-4" />,
  "mcp-puppeteer": <Code2 className="h-4 w-4" />,
  "mcp-sqlite": <Database className="h-4 w-4" />,
};

export function McpPanel() {
  const { mcpPanelOpen, setMcpPanelOpen } = useStore();
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newServer, setNewServer] = useState({
    name: "",
    url: "",
    transport: "http" as const,
  });

  useEffect(() => {
    if (mcpPanelOpen) loadServers();
  }, [mcpPanelOpen]);

  const loadServers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp");
      const data = await res.json();
      setServers(data.servers ?? []);
    } catch {
      toast.error("MCP server'lar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const toggleServer = async (id: string, enabled: boolean) => {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled } : s))
    );
    try {
      await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id, enabled }),
      });
      toast.success(enabled ? "Server etkinleştirildi" : "Server devre dışı");
    } catch {
      toast.error("Güncelleme başarısız");
    }
  };

  const addServer = async () => {
    if (!newServer.name || !newServer.url) {
      toast.error("İsim ve URL gerekli");
      return;
    }
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          server: newServer,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setServers((prev) => [...prev, data.server]);
      setNewServer({ name: "", url: "", transport: "http" });
      setShowAdd(false);
      toast.success("MCP server eklendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ekleme başarısız");
    }
  };

  const removeServer = async (id: string) => {
    try {
      await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id }),
      });
      setServers((prev) => prev.filter((s) => s.id !== id));
      toast.success("Server silindi");
    } catch {
      toast.error("Silme başarısız");
    }
  };

  const testTool = async (serverId: string, toolName: string) => {
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "call_tool",
          serverId,
          toolName,
          args: {},
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else if (data.stub) {
        toast.info(data.message);
      } else {
        toast.success(`Tool çağrıldı: ${data.result?.slice(0, 100) ?? "OK"}`);
      }
    } catch {
      toast.error("Test başarısız");
    }
  };

  return (
    <Sheet open={mcpPanelOpen} onOpenChange={setMcpPanelOpen}>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" />
            MCP Server'lar
          </SheetTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowAdd(!showAdd)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Ekle
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={loadServers}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Add new server form */}
              {showAdd && (
                <div className="border border-border rounded-lg p-3 space-y-2 bg-secondary/20">
                  <div className="text-xs font-medium">Yeni MCP Server</div>
                  <div>
                    <Label className="text-xs">İsim</Label>
                    <Input
                      value={newServer.name}
                      onChange={(e) =>
                        setNewServer({ ...newServer, name: e.target.value })
                      }
                      className="h-8 text-xs"
                      placeholder="örn: Custom Server"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">URL</Label>
                    <Input
                      value={newServer.url}
                      onChange={(e) =>
                        setNewServer({ ...newServer, url: e.target.value })
                      }
                      className="h-8 text-xs"
                      placeholder="https:// veya stdio://"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={addServer}>
                      Ekle
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setShowAdd(false)}
                    >
                      İptal
                    </Button>
                  </div>
                </div>
              )}

              {/* Server list */}
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  <div className="p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center text-primary">
                      {SERVER_ICONS[server.id] ?? <Server className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">{server.name}</span>
                        {server.enabled && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500"
                          >
                            <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                            aktif
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px] h-4">
                          {server.transport}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate font-mono">
                        {server.url}
                      </div>
                    </div>
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={(c) => toggleServer(server.id, c)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setExpanded(expanded === server.id ? null : server.id)
                      }
                    >
                      <Wrench className="h-3 w-3" />
                    </Button>
                    {!server.id.startsWith("mcp-") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeServer(server.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {expanded === server.id && (
                    <div className="px-3 pb-3 border-t border-border bg-secondary/10">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2 mb-1">
                        Tools ({server.tools.length})
                      </div>
                      <div className="space-y-1">
                        {server.tools.map((tool) => (
                          <div
                            key={tool.name}
                            className="border border-border/50 rounded p-2 flex items-center gap-2 text-xs"
                          >
                            <Wrench className="h-3 w-3 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-[11px]">{tool.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {tool.description}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px]"
                              onClick={() => testTool(server.id, tool.name)}
                            >
                              Test
                            </Button>
                          </div>
                        ))}
                        {server.tools.length === 0 && (
                          <div className="text-[10px] text-muted-foreground p-2">
                            Tool tanımlı değil
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {!loading && servers.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  <Plug className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  MCP server bulunamadı
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
