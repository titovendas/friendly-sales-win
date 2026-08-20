import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // getSession() lê a sessão salva localmente (funciona offline). Usamos
    // ela primeiro para não travar o app sem internet; getUser() (que
    // revalida no servidor) só é chamado depois, em segundo plano, quando
    // há conexão — sem bloquear a navegação se falhar.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    if (typeof navigator === "undefined" || navigator.onLine) {
      supabase.auth
        .getUser()
        .then(({ data: { user: revalidated } }) => {
          if (mounted && revalidated) setUser(revalidated);
        })
        .catch(() => {
          /* sem internet ou erro momentâneo — mantém a sessão local */
        });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
