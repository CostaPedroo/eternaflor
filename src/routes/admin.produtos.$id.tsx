import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductForm, loadProductImages } from "@/components/admin/ProductForm";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/produtos/$id")({
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: async () => {
      const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (!product) return null;
      const images = await loadProductImages(id, product.main_image);
      return { product, images };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (!data) return (
    <div className="py-10 text-center">
      <p>Este produto já não existe.</p>
      <Link to="/admin/produtos" className="mt-4 inline-block underline">Voltar aos produtos</Link>
    </div>
  );
  return <ProductForm key={data.product.id} product={data.product} initialImages={data.images} />;
}
