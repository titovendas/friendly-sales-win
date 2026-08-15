import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  syncCatalog,
  getCatalogSyncedAt,
  getOfflineCatalogCount,
} from "@/lib/offline-catalog";
import { syncPendingData, pendingCount } from "@/lib/offline-queue";

function formatSyncedAt(iso: string | null) {
  if (!iso) return "nunca sincronizado";
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `hoje às ${time}`;
  return `${date.toLocaleDateString("pt-BR")} às ${time}`;
}

export function CatalogSyncStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshStatus = async () => {
    setSyncedAt(await getCatalogSyncedAt());
    setCount(await getOfflineCatalogCount());
    setPending(await pendingCount());
  };

  useEffect(() => {
    refreshStatus();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(refreshStatus, 5000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncCatalog();
      await syncPendingData();
      await refreshStatus();
    } catch {
      /* sem internet ou erro momentâneo */
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-1.5 rounded-md border border-border bg-muted/40 p-2.5 text-xs">
      <div className="flex items-center gap-1.5">
        {online ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-amber-600" />
        )}
        <span className="font-medium text-foreground">
          {online ? "Online" : "Modo offline"}
        </span>
      </div>
      <p className="text-muted-foreground">
        Catálogo local: {count > 0 ? `${count} produtos` : "vazio"}
      </p>
      <p className="text-muted-foreground">
        Atualizado {formatSyncedAt(syncedAt)}
      </p>
      {pending > 0 && (
        <p className="font-medium text-amber-700">
          {pending} {pending === 1 ? "item" : "itens"} aguardando
          sincronização
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-full text-xs"
        onClick={handleSync}
        disabled={syncing || !online}
      >
        <RefreshCw className={`mr-1.5 h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando..." : "Sincronizar agora"}
      </Button>
    </div>
  );
}
