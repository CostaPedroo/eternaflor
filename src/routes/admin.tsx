import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Package, Tags, LogOut, Settings } from "lucide-react";
import { supabase } from "@/integrations/external/client";
import { isCurrentUserAdmin } from "@/lib/admin";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    if (!(await isCurrentUserAdmin())) throw redirect({ to: "/admin/login" });
  },
  head: () => ({
    meta: [
      { title: "Administração — Eterna Flor" },
      { name: "description", content: "Gestão de produtos e categorias da Eterna Flor." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const links = [
  { to: "/admin", label: "Início", icon: LayoutGrid, exact: true },
  { to: "/admin/produtos", label: "Produtos", icon: Package, exact: false },
  { to: "/admin/categorias", label: "Categorias", icon: Tags, exact: false },
  { to: "/admin/definicoes", label: "Definições", icon: Settings, exact: false },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/40 pb-24 font-sans md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-8">
          <Link to="/admin" className="leading-tight">
            <span className="block font-serif text-xl italic">Eterna Flor</span>
            <span className="block text-xs text-muted-foreground">Administração</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.to} to={l.to} activeOptions={{ exact: l.exact }} className="px-3 py-2 text-sm text-muted-foreground" activeProps={{ className: "text-foreground font-medium" }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <button onClick={signOut} className="inline-flex h-10 items-center gap-2 border border-border px-3 text-sm">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Terminar sessão</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background md:hidden">
        {links.map((l) => (
          <Link key={l.to} to={l.to} activeOptions={{ exact: l.exact }} className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            <l.icon className="h-5 w-5" />
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
