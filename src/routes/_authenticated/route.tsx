import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { syncCatalogInBackground } from "@/lib/offline-catalog";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user) return;
    // Baixa o catálogo completo para uso offline assim que o app abre
    // (e sempre que a conexão voltar), sem travar a navegação.
    syncCatalogInBackground();
    const onOnline = () => syncCatalogInBackground();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
