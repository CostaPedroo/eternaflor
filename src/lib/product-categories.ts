import type { Database } from "@/integrations/supabase/types";

export type ProductCategory = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "name" | "slug"
>;
export const PRODUCT_CATEGORY_SELECT = "product_categories(categories(id,name,slug))";
export type CategoryJoin = { product_categories: { categories: ProductCategory | null }[] };

/** A nested product query yields one product row, never one row per membership. */
export function normalizeProductCategories<
  T extends CategoryJoin & { category_id?: string | null },
>(row: T): Omit<T, "product_categories" | "category_id"> & { categories: ProductCategory[] } {
  const { product_categories, category_id: _legacy, ...product } = row;
  const categories = new Map<string, ProductCategory>();
  for (const relation of product_categories) {
    const category = relation.categories;
    if (category)
      categories.set(category.id, { id: category.id, name: category.name, slug: category.slug });
  }
  return {
    ...product,
    categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, "pt")),
  };
}

export function belongsToCategory(product: { categories: ProductCategory[] }, id: string) {
  return product.categories.some((category) => category.id === id);
}

export const selectedCategoryIds = (product: { categories: ProductCategory[] }) =>
  product.categories.map((category) => category.id);
export const categorySelectionError = (ids: string[], categories: ProductCategory[]) =>
  ids.some((id) => !categories.some((category) => category.id === id))
    ? "Uma das categorias selecionadas já não está disponível. Atualiza a página e tenta novamente."
    : null;
