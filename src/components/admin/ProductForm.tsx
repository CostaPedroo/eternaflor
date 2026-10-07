import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, Star, ArrowLeft, ArrowRight, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, resolveImageUrls, uniqueSlug, uploadProductImage, type Product } from "@/lib/admin";

type Img = { key: string; path?: string; file?: File; preview: string };

type Props = { product?: Product; initialImages?: { path: string; preview: string }[] };

export function ProductForm({ product, initialImages = [] }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [images, setImages] = useState<Img[]>(initialImages.map((i) => ({ key: i.path, path: i.path, preview: i.preview })));
  const [v, setV] = useState({
    name: product?.name ?? "",
    category_id: product?.category_id ?? "",
    short_description: product?.short_description ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price) : "",
    old_price: product?.old_price != null ? String(product.old_price) : "",
    available: product?.available ?? true,
    active: product?.active ?? true,
    featured: product?.featured ?? false,
    customizable: product?.customizable ?? true,
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  const { data: categories } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setImages((s) => [...s, ...list.map((f) => ({ key: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) }))]);
    if (list.length) toast.success(list.length > 1 ? `${list.length} fotografias adicionadas.` : "Fotografia adicionada.");
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };
  const moveImg = (i: number, d: -1 | 1) =>
    setImages((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  const makeMain = (i: number) => setImages((s) => [s[i]!, ...s.filter((_, k) => k !== i)]);
  const removeImg = (i: number) => setImages((s) => s.filter((_, k) => k !== i));

  const save = async (publish: boolean) => {
    if (!v.name.trim()) { toast.error("Escreve o nome do produto."); return; }
    const price = Number(v.price.replace(",", "."));
    if (!v.price || Number.isNaN(price) || price < 0) { toast.error("Indica um preço válido."); return; }
    const oldPrice = v.old_price ? Number(v.old_price.replace(",", ".")) : null;
    setSaving(true);
    try {
      const slug = await uniqueSlug("products", v.name, product?.id);
      const payload = {
        name: v.name.trim(),
        slug,
        category_id: v.category_id || null,
        short_description: v.short_description.trim() || null,
        description: v.description.trim() || null,
        price,
        old_price: oldPrice != null && !Number.isNaN(oldPrice) ? oldPrice : null,
        available: v.available,
        active: publish ? true : v.active,
        featured: v.featured,
        customizable: v.customizable,
      };
      let id = product?.id;
      if (id) {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data: last } = await supabase.from("products").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
        const { data, error } = await supabase
          .from("products")
          .insert({ ...payload, sort_order: (last?.sort_order ?? 0) + 10 })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }
      // Upload new photos and store the final order.
      const paths: string[] = [];
      for (const img of images) {
        paths.push(img.path ?? (await uploadProductImage(id!, img.file!)));
      }
      await supabase.from("product_images").delete().eq("product_id", id!);
      if (paths.length) {
        const { error } = await supabase.from("product_images").insert(
          paths.map((p, i) => ({ product_id: id!, image_url: p, alt_text: payload.name, sort_order: i })),
        );
        if (error) throw error;
      }
      const { error: mErr } = await supabase.from("products").update({ main_image: paths[0] ?? null }).eq("id", id!);
      if (mErr) throw mErr;

      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["public-products"] });
      toast.success(publish ? "Produto publicado com sucesso." : product ? "Produto atualizado." : "Produto guardado com sucesso.");
      navigate({ to: "/admin/produtos" });
    } catch (e) {
      console.error(e);
      toast.error(friendlyError());
      setSaving(false);
    }
  };

  const input = "mt-2 h-12 w-full border border-border bg-background px-4 text-base outline-none focus:border-primary";
  const label = "block text-sm font-medium";

  return (
    <div className="space-y-6 pb-28">
      <h1 className="text-2xl font-medium">{product ? "Editar produto" : "Novo produto"}</h1>

      {/* Photos first: fastest path from the phone camera */}
      <section className="space-y-3 border border-border bg-background p-4">
        <p className={label}>Fotografias</p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`grid grid-cols-2 gap-2 border-2 border-dashed p-3 ${dragOver ? "border-primary bg-muted" : "border-border"}`}
        >
          <button type="button" onClick={() => cameraRef.current?.click()} className="flex h-24 flex-col items-center justify-center gap-1 bg-muted text-sm">
            <Camera className="h-6 w-6" /> Tirar fotografia
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-24 flex-col items-center justify-center gap-1 bg-muted text-sm">
            <ImagePlus className="h-6 w-6" /> Escolher da galeria
          </button>
          <p className="col-span-2 hidden text-center text-xs text-muted-foreground md:block">ou arrasta as fotografias para aqui</p>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        {images.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 md:grid-cols-5">
            {images.map((img, i) => (
              <li key={img.key} className="relative">
                <div className={`aspect-square overflow-hidden bg-muted ${i === 0 ? "ring-2 ring-primary" : ""}`}>
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                </div>
                {i === 0 && <span className="absolute left-1 top-1 bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">Principal</span>}
                <button type="button" aria-label="Remover" onClick={() => removeImg(i)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center bg-background/90"><X className="h-4 w-4" /></button>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  <button type="button" aria-label="Mover para a esquerda" disabled={i === 0} onClick={() => moveImg(i, -1)} className="grid h-8 place-items-center border border-border disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Definir como principal" disabled={i === 0} onClick={() => makeMain(i)} className="grid h-8 place-items-center border border-border disabled:opacity-30"><Star className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Mover para a direita" disabled={i === images.length - 1} onClick={() => moveImg(i, 1)} className="grid h-8 place-items-center border border-border disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-5 border border-border bg-background p-4">
        <label className={label}>
          Nome do produto
          <input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Bouquet Gerberas Rosa" className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Preço (€)
            <input value={v.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" placeholder="25" className={input} />
          </label>
          <label className={label}>
            Preço anterior <span className="font-normal text-muted-foreground">(promoção)</span>
            <input value={v.old_price} onChange={(e) => set("old_price", e.target.value)} inputMode="decimal" placeholder="Opcional" className={input} />
          </label>
        </div>
        <label className={label}>
          Categoria
          <select value={v.category_id} onChange={(e) => set("category_id", e.target.value)} className={input}>
            <option value="">Sem categoria</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className={label}>
          Descrição curta <span className="font-normal text-muted-foreground">(aparece no cartão)</span>
          <input value={v.short_description} onChange={(e) => set("short_description", e.target.value)} className={input} />
        </label>
        <label className={label}>
          Descrição completa
          <textarea value={v.description} onChange={(e) => set("description", e.target.value)} rows={4} className={`${input} h-auto py-3`} />
        </label>
      </section>

      <section className="divide-y divide-border border border-border bg-background">
        <YesNo label="Produto disponível?" value={v.available} onChange={(b) => set("available", b)} />
        <YesNo label="Mostrar no site?" value={v.active} onChange={(b) => set("active", b)} />
        <YesNo label="Produto em destaque?" value={v.featured} onChange={(b) => set("featured", b)} />
        <YesNo label="Permite personalização?" value={v.customizable} onChange={(b) => set("customizable", b)} />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto grid max-w-5xl grid-cols-[auto_1fr_1fr] gap-2">
          <Link to="/admin/produtos" className="flex h-12 items-center justify-center border border-border px-4 text-sm">Cancelar</Link>
          <button disabled={saving} onClick={() => save(false)} className="h-12 border border-primary text-sm font-medium disabled:opacity-60">
            Guardar produto
          </button>
          <button disabled={saving} onClick={() => save(true)} className="inline-flex h-12 items-center justify-center gap-2 bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar e publicar
          </button>
        </div>
      </div>
    </div>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid grid-cols-2 border border-border">
        {[true, false].map((b) => (
          <button key={String(b)} type="button" onClick={() => onChange(b)} className={`h-10 w-16 text-sm ${value === b ? "bg-primary text-primary-foreground" : ""}`}>
            {b ? "Sim" : "Não"}
          </button>
        ))}
      </div>
    </div>
  );
}

export async function loadProductImages(productId: string, mainImage: string | null) {
  const { data } = await supabase.from("product_images").select("*").eq("product_id", productId).order("sort_order");
  let paths = (data ?? []).map((d) => d.image_url);
  if (!paths.length && mainImage) paths = [mainImage];
  const resolve = await resolveImageUrls(paths);
  return paths.map((p) => ({ path: p, preview: resolve(p) ?? "" }));
}
