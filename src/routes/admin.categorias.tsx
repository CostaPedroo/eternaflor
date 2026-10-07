import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trash2, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/external/client";
import { friendlyError, uniqueSlug, type Category } from "@/lib/admin";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/categorias")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [toDelete, setToDelete] = useState<(Category & { count: number }) | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "categories-with-counts"],
    queryFn: async () => {
      const [c, p] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order").order("created_at"),
        supabase.from("products").select("category_id"),
      ]);
      if (c.error) throw c.error;
      return (c.data ?? []).map((cat) => ({ ...cat, count: (p.data ?? []).filter((x) => x.category_id === cat.id).length }));
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  const add = async () => {
    if (!newName.trim()) return;
    const slug = await uniqueSlug("categories", newName);
    const max = Math.max(0, ...(data ?? []).map((c) => c.sort_order));
    const { error } = await supabase.from("categories").insert({ name: newName.trim(), slug, sort_order: max + 1 });
    if (error) { toast.error(friendlyError()); return; }
    setNewName("");
    toast.success("Categoria criada.");
    refresh();
  };

  const update = async (c: Category, patch: Partial<Category>, msg: string) => {
    const { error } = await supabase.from("categories").update(patch).eq("id", c.id);
    if (error) { toast.error(friendlyError()); return; }
    toast.success(msg);
    refresh();
  };

  const rename = async (c: Category, name: string) => {
    if (!name.trim() || name === c.name) return;
    const slug = await uniqueSlug("categories", name, c.id);
    update(c, { name: name.trim(), slug }, "Categoria atualizada.");
  };

  const move = async (i: number, d: -1 | 1) => {
    const list = data ?? [];
    const a = list[i];
    const b = list[i + d];
    if (!a || !b) return;
    await Promise.all(
      list.map((c, k) => {
        const pos = k === i ? i + d : k === i + d ? i : k;
        return supabase.from("categories").update({ sort_order: pos + 1 }).eq("id", c.id);
      }),
    );
    refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("categories").delete().eq("id", toDelete.id);
    setToDelete(null);
    if (error) { toast.error(friendlyError()); return; }
    toast.success("Categoria eliminada.");
    refresh();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-medium">Categorias</h1>
      <div className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nova categoria" className="h-12 flex-1 border border-border bg-background px-4 text-base outline-none focus:border-primary" />
        <button onClick={add} className="inline-flex h-12 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" />Criar</button>
      </div>
      {isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>}
      {isError && <p className="text-sm text-destructive">Não foi possível carregar as categorias.</p>}
      {data?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Ainda não tens categorias.</p>}
      <ul className="space-y-2">
        {data?.map((c, i) => (
          <li key={c.id} className={`border border-border bg-background p-3 ${c.active ? "" : "opacity-70"}`}>
            <div className="flex items-center gap-2">
              <CategoryName c={c} onSave={(n) => rename(c, n)} />
              <button aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-10 w-10 place-items-center border border-border disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button aria-label="Descer" disabled={i === data.length - 1} onClick={() => move(i, 1)} className="grid h-10 w-10 place-items-center border border-border disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{c.count} {c.count === 1 ? "produto" : "produtos"}</span>
              <div className="flex gap-2">
                <button onClick={() => update(c, { active: !c.active }, c.active ? "Categoria desativada." : "Categoria ativada.")} className="h-10 border border-border px-3">
                  {c.active ? "Desativar" : "Ativar"}
                </button>
                <button aria-label="Eliminar" onClick={() => setToDelete(c)} className="grid h-10 w-10 place-items-center border border-border text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && toDelete.count > 0
                ? `Atenção: esta categoria ainda tem ${toDelete.count} ${toDelete.count === 1 ? "produto" : "produtos"}. Os produtos não são apagados, mas ficam sem categoria.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
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

function CategoryName({ c, onSave }: { c: Category; onSave: (n: string) => void }) {
  const [name, setName] = useState(c.name);
  const dirty = name.trim() !== c.name;
  return (
    <div className="flex flex-1 gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSave(name)} className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-base outline-none focus:border-primary" />
      {dirty && <button aria-label="Guardar" onClick={() => onSave(name)} className="grid h-10 w-10 place-items-center bg-primary text-primary-foreground"><Check className="h-4 w-4" /></button>}
    </div>
  );
}
