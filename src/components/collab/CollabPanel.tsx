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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Copy, LogOut, RefreshCw, Send } from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";

interface CollabUser {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

interface CollabMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  timestamp: number;
}

export function CollabPanel() {
  const {
    collabPanelOpen,
    setCollabPanelOpen,
    collabSessionId,
    setCollabSessionId,
    collabUserName,
    setCollabUserName,
  } = useStore();

  const [sessions, setSessions] = useState<Array<{ id: string; name: string; userCount: number; messageCount: number }>>([]);
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [messages, setMessages] = useState<CollabMessage[]>([]);
  const [input, setInput] = useState("");
  const [newSessionName, setNewSessionName] = useState("");
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentUserId, setCurrentUserId] = useState("user-anonymous");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Client-side user ID init
  useEffect(() => {
    if (typeof window !== "undefined") {
      let id = localStorage.getItem("kutadgubilgi_user_id");
      if (!id) {
        id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem("kutadgubilgi_user_id", id);
      }
      setCurrentUserId(id);
    }
  }, []);

  useEffect(() => {
    if (collabPanelOpen) {
      loadSessions();
      if (collabSessionId) joinSession(collabSessionId);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [collabPanelOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const res = await fetch("/api/collab?action=list");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      // ignore
    }
  };

  const createSession = async () => {
    if (!newSessionName.trim()) {
      toast.error("İsim gerekli");
      return;
    }
    try {
      const res = await fetch("/api/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newSessionName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCollabSessionId(data.session.id);
      setNewSessionName("");
      await joinSession(data.session.id);
      loadSessions();
      toast.success(`Session oluşturuldu: ${data.session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "hata");
    }
  };

  const joinSession = async (sessionId: string) => {
    try {
      const res = await fetch("/api/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          sessionId,
          userId: currentUserId,
          userName: collabUserName,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCollabSessionId(sessionId);
      setUsers(data.session.users ?? []);
      setMessages(data.session.messages ?? []);

      // Polling (5 sn)
      if (pollInterval) clearInterval(pollInterval);
      const interval = setInterval(() => pollSession(sessionId), 5000);
      setPollInterval(interval);
      toast.success("Session'a katıldınız");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "hata");
    }
  };

  const pollSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/collab?action=get&session=${sessionId}`);
      const data = await res.json();
      if (data.session) {
        setUsers(data.session.users ?? []);
        setMessages(data.session.messages ?? []);
      }
      // Heartbeat
      fetch("/api/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "heartbeat",
          sessionId,
          userId: currentUserId,
        }),
      });
    } catch {
      // ignore
    }
  };

  const leaveSession = async () => {
    if (!collabSessionId) return;
    try {
      await fetch("/api/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          sessionId: collabSessionId,
          userId: currentUserId,
        }),
      });
    } catch {
      // ignore
    }
    if (pollInterval) clearInterval(pollInterval);
    setPollInterval(null);
    setCollabSessionId(null);
    setUsers([]);
    setMessages([]);
    toast.success("Session'tan ayrıldınız");
  };

  const sendMessage = async () => {
    if (!input.trim() || !collabSessionId) return;
    try {
      const res = await fetch("/api/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          sessionId: collabSessionId,
          userId: currentUserId,
          content: input,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(data.session.messages ?? []);
      setInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "hata");
    }
  };

  const copyInviteLink = () => {
    if (!collabSessionId) return;
    const url = `${window.location.origin}/?collab=${collabSessionId}`;
    navigator.clipboard.writeText(url);
    toast.success("Davet linki kopyalandı");
  };

  return (
    <Sheet open={collabPanelOpen} onOpenChange={setCollabPanelOpen}>
      <SheetContent side="right" className="w-[450px] sm:w-[550px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            İşbirliği
            {users.length > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500">
                {users.length} aktif
              </Badge>
            )}
          </SheetTitle>
          {collabSessionId && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={copyInviteLink}
                title="Davet linkini kopyala"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={leaveSession}
                title="Ayrıl"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* User name */}
          <div>
            <Label className="text-xs">Adınız</Label>
            <Input
              value={collabUserName}
              onChange={(e) => setCollabUserName(e.target.value)}
              className="h-8 text-xs"
              placeholder="Adınız"
            />
          </div>

          {!collabSessionId ? (
            <>
              {/* Create session */}
              <div className="border border-border rounded-lg p-3 bg-secondary/20">
                <div className="text-xs font-medium mb-2">Yeni Session Oluştur</div>
                <div className="flex gap-2">
                  <Input
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    placeholder="Session adı"
                    className="h-8 text-xs"
                  />
                  <Button size="sm" className="h-8 text-xs" onClick={createSession}>
                    <Plus className="h-3 w-3 mr-1" />
                    Oluştur
                  </Button>
                </div>
              </div>

              {/* Available sessions */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Açık Sessionlar</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={loadSessions}
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                  </Button>
                </div>
                {sessions.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    Henüz session yok
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => joinSession(s.id)}
                        className="w-full text-left p-2 rounded border border-border hover:bg-accent text-xs"
                      >
                        <div className="font-medium">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {s.userCount} kullanıcı · {s.messageCount} mesaj · ID: {s.id}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Active users */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Aktif Kullanıcılar
                </div>
                <div className="space-y-1">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 p-1.5 rounded text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: u.color }}
                      />
                      <span>{u.name}</span>
                      {u.id === currentUserId && (
                        <Badge variant="outline" className="text-[9px] h-4 ml-1">
                          siz
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Sohbet
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      Mesaj yok, ilk mesajı gönderin
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          m.userId === currentUserId ? "items-end" : "items-start"
                        }`}
                      >
                        <div className="text-[9px] text-muted-foreground mb-0.5 flex items-center gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: m.userColor }}
                          />
                          {m.userName !== collabUserName && m.userName}
                          <span>· {new Date(m.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div
                          className={`text-xs rounded-lg px-2.5 py-1.5 max-w-[80%] ${
                            m.userId === currentUserId
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary border border-border"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Input */}
        {collabSessionId && (
          <div className="border-t border-border p-2 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Mesaj yazın..."
              className="h-8 text-xs"
            />
            <Button size="sm" className="h-8 text-xs" onClick={sendMessage}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
