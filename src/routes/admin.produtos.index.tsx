import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Copy, Eye, EyeOff, Trash2, ArrowUp, ArrowDown, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { duplicateProduct, friendlyError, resolveImageUrls, type Product } from "@/lib/admin";
import { formatPrice } from "@/lib/config";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/produtos/")({
  component: ProductsPage,
});

const filters = [
  ["all", "Todos"],
  ["active", "Ativos"],
  ["hidden", "Ocultos"],
  ["featured", "Destaques"],
  ["unavailable", "Indisponíveis"],
] as const;

function ProductsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("all");
  const [cat, setCat] = useState("");
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const [p, c] = await Promise.all([
        supabase.from("products").select("*").order("sort_order").order("created_at"),
        supabase.from("categories").select("*").order("sort_order"),
      ]);
      if (p.error) throw p.error;
      const resolve = await resolveImageUrls((p.data ?? []).map((x) => x.main_image));
      return {
        products: (p.data ?? []).map((x) => ({ ...x, img: resolve(x.main_image) })),
        categories: c.data ?? [],
      };
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["public-products"] });
  };

  const list = useMemo(() => {
    let l = data?.products ?? [];
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((p) => p.name.toLowerCase().includes(s));
    if (filter === "active") l = l.filter((p) => p.active);
    if (filter === "hidden") l = l.filter((p) => !p.active);
    if (filter === "featured") l = l.filter((p) => p.featured);
    if (filter === "unavailable") l = l.filter((p) => !p.available);
    if (cat) l = l.filter((p) => p.category_id === cat);
    return l;
  }, [data, q, filter, cat]);

  const catName = (id: string | null) => data?.categories.find((c) => c.id === id)?.name ?? "Sem categoria";

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) { toast.error(friendlyError()); return; }
    toast.success(p.active ? "Produto ocultado." : "Produto publicado com sucesso.");
    refresh();
  };

  const duplicate = async (p: Product) => {
    try {
      const copy = await duplicateProduct(p);
      toast.success("Produto duplicado. Altera o nome e publica quando estiver pronto.");
      refresh();
      navigate({ to: "/admin/produtos/$id", params: { id: copy.id } });
    } catch {
      toast.error(friendlyError());
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const all = data?.products ?? [];
    const a = list[index];
    const b = list[index + dir];
    if (!a || !b) return;
    // Normalise positions over the full list, then swap the pair.
    const ordered = all.map((p, i) => ({ id: p.id, sort_order: (i + 1) * 10 }));
    const ia = ordered.findIndex((o) => o.id === a.id);
    const ib = ordered.findIndex((o) => o.id === b.id);
    [ordered[ia]!.sort_order, ordered[ib]!.sort_order] = [ordered[ib]!.sort_order, ordered[ia]!.sort_order];
    const results = await Promise.all(
      ordered.map((o) => supabase.from("products").update({ sort_order: o.sort_order }).eq("id", o.id)),
    );
    if (results.some((r) => r.error)) toast.error(friendlyError());
    refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("products").delete().eq("id", toDelete.id);
    setToDelete(null);
    if (error) { toast.error(friendlyError()); return; }
    toast.success("Produto eliminado.");
    refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-medium">Produtos</h1>
        <Link to="/admin/produtos/novo" className="inline-flex h-11 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> Novo produto
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar produtos…" className="h-12 w-full border border-border bg-background pl-10 pr-4 text-base outline-none focus:border-primary" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {filters.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`h-10 shrink-0 border px-4 text-sm ${filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
            {l}
          </button>
        ))}
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 shrink-0 border border-border bg-background px-3 text-sm">
          <option value="">Todas as categorias</option>
          {data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading && (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      )}
      {isError && <p className="text-sm text-destructive">Não foi possível carregar os produtos. Atualiza a página.</p>}

      {data && data.products.length === 0 && (
        <div className="border border-dashed border-border bg-background p-10 text-center">
          <p className="text-lg">Ainda não tens produtos.</p>
          <Link to="/admin/produtos/novo" className="mt-4 inline-flex h-12 items-center gap-2 bg-primary px-6 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" /> Criar primeiro produto
          </Link>
        </div>
      )}
      {data && data.products.length > 0 && list.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
      )}

      <ul className="space-y-3">
        {list.map((p, i) => (
          <li key={p.id} className={`border border-border bg-background p-3 ${p.active ? "" : "opacity-70"}`}>
            <div className="flex gap-3">
              <Link to="/admin/produtos/$id" params={{ id: p.id }} className="h-20 w-20 shrink-0 overflow-hidden bg-muted">
                {p.img && <img src={p.img} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </Link>
              <div className="min-w-0 flex-1">
                <Link to="/admin/produtos/$id" params={{ id: p.id }} className="block truncate font-medium">{p.name}</Link>
                <p className="text-sm text-muted-foreground">{catName(p.category_id)} · {formatPrice(p.price)}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  <span className={`px-2 py-0.5 ${p.active ? "bg-sage/20" : "bg-muted"}`}>{p.active ? "Visível" : "Oculto"}</span>
                  {p.featured && <span className="inline-flex items-center gap-1 bg-blush/40 px-2 py-0.5"><Star className="h-3 w-3" />Destaque</span>}
                  {!p.available && <span className="bg-muted px-2 py-0.5">Indisponível</span>}
                  <span className="px-2 py-0.5 text-muted-foreground">Posição {i + 1}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-9 w-9 place-items-center border border-border disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button aria-label="Descer" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="grid h-9 w-9 place-items-center border border-border disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              <Link to="/admin/produtos/$id" params={{ id: p.id }} className="flex h-11 flex-col items-center justify-center border border-border"><Pencil className="h-4 w-4" />Editar</Link>
              <button onClick={() => duplicate(p)} className="flex h-11 flex-col items-center justify-center border border-border"><Copy className="h-4 w-4" />Duplicar</button>
              <button onClick={() => toggleActive(p)} className="flex h-11 flex-col items-center justify-center border border-border">
                {p.active ? <><EyeOff className="h-4 w-4" />Ocultar</> : <><Eye className="h-4 w-4" />Mostrar</>}
              </button>
              <button onClick={() => setToDelete(p)} className="flex h-11 flex-col items-center justify-center border border-border text-destructive"><Trash2 className="h-4 w-4" />Eliminar</button>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Tens a certeza que queres eliminar este produto permanentemente? Se só queres tirá-lo da loja, usa «Ocultar».</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
