import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import type { PublicCategory, PublicProduct } from "@/lib/catalog.functions";
import { customizationOrderMessage, formatPrice, wa } from "@/lib/config";
import {
  CUSTOMIZATION_BUDGETS,
  customizationBudget,
  customizationCategory,
  initialCustomization,
} from "@/lib/customization";
import { belongsToCategory } from "@/lib/product-categories";
import { motion } from "@/lib/storefront-motion";
import { OrderDatePicker } from "@/components/site/OrderDatePicker";

const fieldLabel = "block text-[10px] uppercase tracking-[0.2em] text-muted-foreground";
const field =
  "w-full border-b border-border bg-transparent pb-2 pt-1 text-lg font-light outline-none transition-colors focus:border-sage placeholder:text-muted-foreground/50";
const selector = `${field} min-h-11 min-w-0 text-base text-foreground`;

export function CustomizationForm({
  products,
  categories,
}: {
  products: PublicProduct[];
  categories: PublicCategory[];
}) {
  const router = useRouter();
  const history = router.history;
  useSyncExternalStore(
    history.subscribe,
    () => history.location.href,
    () => history.location.href,
  );
  const search = router.options.parseSearch(history.location.search);
  const requestedProduct =
    typeof search["personalizar"] === "string" ? search["personalizar"] : undefined;
  const requestedCategory =
    typeof search["categoria"] === "string" ? search["categoria"] : undefined;
  const source = JSON.stringify([requestedProduct, requestedCategory]);
  const incoming = () => ({
    source,
    ...initialCustomization(products, categories, requestedProduct, requestedCategory),
  });
  const [saved, setSelection] = useState(incoming);
  let selection = saved;
  // Change only the selectors/budget on a new product URL; keep the form and
  // calendar mounted. Modal/calendar parameters never reset the customer's edits.
  if (saved.source !== source) {
    selection = incoming();
    setSelection(selection);
  }
  const category = categories.find((category) => category.id === selection.categoryId);
  const options = category
    ? products.filter((product) => belongsToCategory(product, category.id))
    : products;
  const product = options.find((product) => product.id === selection.productId);
  const missing = selection.productId
    ? !product
    : !!requestedProduct && !products.some((product) => product.id === requestedProduct);

  const choose = (next: Omit<typeof saved, "source">) => {
    const nextSearch = { ...router.options.parseSearch(history.location.search) };
    delete nextSearch["personalizar"];
    delete nextSearch["categoria"];
    if (next.productId) nextSearch["personalizar"] = next.productId;
    if (next.categoryId) nextSearch["categoria"] = next.categoryId;
    setSelection({
      ...next,
      source: JSON.stringify([next.productId || undefined, next.categoryId || undefined]),
    });
    void router.navigate({
      to: ".",
      search: nextSearch,
      hash: true,
      replace: true,
      resetScroll: false,
      hashScrollIntoView: false,
    });
  };
  const changeCategory = (id: string) =>
    choose({
      ...selection,
      categoryId: id,
      productId: product && (!id || belongsToCategory(product, id)) ? product.id : "",
    });
  const changeProduct = (id: string) => {
    const next = options.find((product) => product.id === id);
    choose({
      ...selection,
      productId: next?.id ?? "",
      categoryId: next
        ? (customizationCategory(next, categories, category?.id)?.id ?? "")
        : selection.categoryId,
      budget: next ? customizationBudget(next.price) : selection.budget,
    });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) || "").trim();
    const message = customizationOrderMessage({
      name: get("nome"),
      ...(category ? { category: category.name } : {}),
      ...(product ? { product: product.name } : {}),
      budget: selection.budget,
      colors: get("cores"),
      flowers: get("flores"),
      occasion: get("ocasiao"),
      date: get("data"),
      details: get("detalhes"),
    });
    window.open(wa(message), "_blank");
  };

  return (
    <form
      id="pedido-personalizado"
      data-reveal
      data-reveal-direction="right"
      data-reveal-delay={motion.stagger.item}
      onSubmit={submit}
      className="scroll-mt-24 space-y-8 border border-blush bg-card p-6 md:space-y-10 md:p-16"
    >
      <h3 className="font-serif text-3xl font-light italic md:text-4xl">Formulário de pedido</h3>
      <label className="block">
        <span className={fieldLabel}>Nome</span>
        <input name="nome" required className={field} />
      </label>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className={fieldLabel}>Categoria</span>
          <select
            name="categoria"
            value={category?.id ?? ""}
            onChange={(event) => changeCategory(event.target.value)}
            className={selector}
          >
            <option value="">Sem preferência</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className={fieldLabel}>Produto a personalizar</span>
          <select
            name="produto"
            value={product?.id ?? ""}
            onChange={(event) => changeProduct(event.target.value)}
            className={selector}
          >
            <option value="">Criar de raiz / Tenho outra ideia</option>
            {options.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {missing && (
        <p role="status" className="text-sm font-light text-muted-foreground">
          Este produto já não está disponível. Escolhe outro produto ou cria de raiz.
        </p>
      )}
      {product && (
        <p className="break-words text-sm font-light leading-relaxed text-muted-foreground">
          <span className="block text-foreground">A personalizar: {product.name}</span>
          Preço de referência: {formatPrice(product.price)}. A personalização pode alterar o preço
          final.
        </p>
      )}
      <div className="grid gap-10 sm:grid-cols-2">
        <label className="block">
          <span className={fieldLabel}>Ocasião</span>
          <input name="ocasiao" placeholder="Aniversário, Dia da Mãe…" className={field} />
        </label>
        <OrderDatePicker />
      </div>
      <div>
        <span className={fieldLabel}>Orçamento</span>
        <div className="mt-4 flex flex-wrap gap-3">
          {CUSTOMIZATION_BUDGETS.map((budget) => (
            <button
              type="button"
              key={budget}
              onClick={() => setSelection({ ...selection, budget })}
              aria-pressed={selection.budget === budget}
              className={`border px-6 py-2 text-[10px] uppercase tracking-[0.15em] transition-colors ${selection.budget === budget ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 hover:border-primary"}`}
            >
              {budget}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className={fieldLabel}>Cores preferidas</span>
        <input name="cores" placeholder="Rosa-velho, creme, verde…" className={field} />
      </label>
      <label className="block">
        <span className={fieldLabel}>Flores preferidas</span>
        <input name="flores" placeholder="Rosas, tulipas, margaridas…" className={field} />
      </label>
      <label className="block">
        <span className={fieldLabel}>Detalhes adicionais</span>
        <textarea
          name="detalhes"
          rows={2}
          placeholder="Conta-nos o que gostavas de alterar ou criar: flores, cores, quantidade, embalagem, laço ou outros detalhes..."
          className={`${field} resize-none`}
        />
      </label>
      <button
        data-follow-reveal
        type="submit"
        className="flex w-full items-center justify-center gap-3 bg-whatsapp px-3 py-5 text-xs uppercase tracking-[0.3em] text-primary-foreground transition-opacity hover:opacity-90"
      >
        <MessageCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className="min-w-0 text-center [overflow-wrap:anywhere]">
          <span className="block sm:inline">Pedir</span>{" "}
          <span className="block sm:inline">personalização</span>
        </span>
      </button>
    </form>
  );
}
