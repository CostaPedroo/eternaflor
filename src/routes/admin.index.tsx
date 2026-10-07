import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Package, Tags, Settings } from "lucide-react";
import { supabase } from "@/integrations/external/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const [p, c] = await Promise.all([
        supabase.from("products").select("active,featured,available"),
        supabase.from("categories").select("id", { count: "exact", head: true }),
      ]);
      if (p.error) throw p.error;
      const rows = p.data ?? [];
      return {
        active: rows.filter((r) => r.active).length,
        featured: rows.filter((r) => r.featured).length,
        unavailable: rows.filter((r) => !r.available).length,
        categories: c.count ?? 0,
      };
    },
  });

  const stats = [
    ["Produtos ativos", data?.active],
    ["Em destaque", data?.featured],
    ["Indisponíveis", data?.unavailable],
    ["Categorias", data?.categories],
  ] as const;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-medium">Olá 👋</h1>
      {isError && <p className="text-sm text-destructive">Não foi possível carregar os indicadores.</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, v]) => (
          <div key={label} className="border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            {isLoading ? <Skeleton className="mt-2 h-8 w-12" /> : <p className="mt-1 text-3xl font-medium">{v ?? 0}</p>}
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Link to="/admin/produtos/novo" className="flex h-16 items-center justify-center gap-2 bg-primary text-base font-medium text-primary-foreground">
          <Plus className="h-5 w-5" /> Novo produto
        </Link>
        <Link to="/admin/produtos" className="flex h-16 items-center justify-center gap-2 border border-border bg-background text-base">
          <Package className="h-5 w-5" /> Gerir produtos
        </Link>
        <Link to="/admin/categorias" className="flex h-16 items-center justify-center gap-2 border border-border bg-background text-base">
          <Tags className="h-5 w-5" /> Categorias
        </Link>
        <Link to="/admin/definicoes" className="flex h-16 items-center justify-center gap-2 border border-border bg-background text-base">
          <Settings className="h-5 w-5" /> Definições
        </Link>
      </div>
    </div>
  );
}
