import { Link } from "@tanstack/react-router";
import { customizationSearch } from "@/lib/customization";

export function ProductCustomizationLink({
  productId,
  categoryId,
  fromModal = false,
  className,
}: {
  productId: string;
  categoryId?: string;
  fromModal?: boolean;
  className: string;
}) {
  return (
    <Link
      to="/"
      search={customizationSearch(productId, categoryId)}
      hash="pedido-personalizado"
      replace={fromModal}
      state={{}}
      className={className}
    >
      Personalizar
    </Link>
  );
}
