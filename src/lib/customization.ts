import type { PublicCategory, PublicProduct } from "@/lib/catalog.functions";
import { belongsToCategory } from "@/lib/product-categories";

export const CUSTOMIZATION_BUDGETS = ["Até 15€", "15€–25€", "25€–40€", "40€–60€", "60€+"] as const;
export type CustomizationBudget = (typeof CUSTOMIZATION_BUDGETS)[number];

/** Each upper boundary belongs to the lower range: 15, 25, 40 and 60 are inclusive. */
export function customizationBudget(price: number): CustomizationBudget {
  return CUSTOMIZATION_BUDGETS[
    price <= 15 ? 0 : price <= 25 ? 1 : price <= 40 ? 2 : price <= 60 ? 3 : 4
  ];
}

export function customizationSearch(productId: string, categoryId?: string) {
  const search: Record<string, string> = { personalizar: productId };
  if (categoryId) search["categoria"] = categoryId;
  return search;
}

export function customizationCategory(
  product: PublicProduct,
  categories: PublicCategory[],
  preferred?: string,
) {
  const valid = categories.filter((category) => belongsToCategory(product, category.id));
  return (
    valid.find((category) => category.id === preferred) ??
    [...valid].sort((a, b) => a.name.localeCompare(b.name, "pt") || a.id.localeCompare(b.id))[0]
  );
}

export function initialCustomization(
  products: PublicProduct[],
  categories: PublicCategory[],
  productId?: string,
  categoryId?: string,
) {
  const product = products.find((product) => product.id === productId);
  const category = product
    ? customizationCategory(product, categories, categoryId)
    : categories.find((category) => category.id === categoryId);
  return {
    productId: product?.id ?? "",
    categoryId: category?.id ?? "",
    budget: product ? customizationBudget(product.price) : CUSTOMIZATION_BUDGETS[1],
  };
}
