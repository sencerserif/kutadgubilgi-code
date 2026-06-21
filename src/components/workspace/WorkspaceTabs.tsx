"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, X, Folder } from "lucide-react";
import { toast } from "sonner";

export function WorkspaceTabs() {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    addWorkspace,
    removeWorkspace,
  } = useStore();

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("/home/z/my-project/workspace");

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("İsim gerekli");
      return;
    }
    addWorkspace(name.trim(), path);
    setName("");
    setShowNew(false);
    toast.success(`Workspace oluşturuldu: ${name}`);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-secondary/30 border-b border-border overflow-x-auto">
      {workspaces.map((ws) => (
        <div
          key={ws.id}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer whitespace-nowrap group transition-colors ${
            activeWorkspaceId === ws.id
              ? "bg-background text-foreground border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveWorkspace(ws.id)}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: ws.color }}
          />
          <Folder className="h-3 w-3" />
          <span>{ws.name}</span>
          {workspaces.length > 1 && (
            <button
              className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`"${ws.name}" workspace silinsin mi?`)) {
                  removeWorkspace(ws.id);
                }
              }}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setShowNew(true)}
      >
        <Plus className="h-3 w-3" />
      </Button>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium">İsim</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="örn: Backend Proje"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Yol (path)</label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/home/z/my-project/workspace"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Şimdilik tüm workspace'ler aynı fiziksel klasörü kullanır
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNew(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate}>Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
