import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/external/client";
import { isCurrentUserAdmin } from "@/lib/admin";

export const Route = createFileRoute("/admin_/login")({
  ssr: false,
  beforeLoad: async () => {
    if (await isCurrentUserAdmin()) throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: "Entrar — Administração Eterna Flor" },
      { name: "description", content: "Acesso reservado à gestão da loja Eterna Flor." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    if (error) {
      setLoading(false);
      setError("Email ou palavra-passe incorretos.");
      return;
    }
    if (!(await isCurrentUserAdmin())) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Esta conta não tem acesso à administração.");
      return;
    }
    navigate({ to: "/admin", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6">
        <div>
          <p className="font-serif text-3xl italic">Eterna Flor</p>
          <p className="mt-1 text-sm text-muted-foreground">Administração</p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full border border-border bg-card px-4 text-base outline-none focus:border-primary" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Palavra-passe</span>
          <input name="password" type="password" required autoComplete="current-password" className="mt-2 h-12 w-full border border-border bg-card px-4 text-base outline-none focus:border-primary" />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button disabled={loading} className="h-12 w-full bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">
          {loading ? "A entrar…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
