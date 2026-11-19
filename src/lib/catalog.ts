import "server-only";
import { byNewest, db, withCategory } from "@/lib/demo/store";
import type { CartProduct } from "@/lib/cart/cart";
import type { Database } from "@/lib/types/database";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type ProductWithCategory = Product & { category: Pick<Category, "name" | "slug"> | null };

export type CatalogQuery = {
  q?: string;
  category?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "name";
};

/** Keeps letters, digits, spaces and dashes so the term is safe to match against. */
export function sanitizeSearchTerm(q: string): string {
  return q
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

const activeProducts = () => db().products.filter((p) => p.is_active);

export async function getCategories(): Promise<Category[]> {
  return [...db().categories].sort((a, b) => a.sort_order - b.sort_order);
}

/** Active products only. */
export async function listProducts(query: CatalogQuery = {}): Promise<ProductWithCategory[]> {
  let products = activeProducts();

  if (query.category) {
    const category = db().categories.find((c) => c.slug === query.category);
    if (!category) return [];
    products = products.filter((p) => p.category_id === category.id);
  }

  const term = query.q ? sanitizeSearchTerm(query.q).toLowerCase() : "";
  if (term) products = products.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(term));

  const sorted = [...products].sort((a, b) => {
    switch (query.sort) {
      case "price-asc":
        return a.price_cents - b.price_cents;
      case "price-desc":
        return b.price_cents - a.price_cents;
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return byNewest(a, b) || a.name.localeCompare(b.name);
    }
  });

  return sorted.slice(0, 60).map(withCategory);
}

export async function getFeaturedProducts(limit = 4): Promise<ProductWithCategory[]> {
  return activeProducts()
    .filter((p) => p.is_featured)
    .sort(byNewest)
    .slice(0, limit)
    .map(withCategory);
}

export async function getProductBySlug(slug: string): Promise<ProductWithCategory | null> {
  const product = activeProducts().find((p) => p.slug === slug);
  return product ? withCategory(product) : null;
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<ProductWithCategory[]> {
  return activeProducts()
    .filter((p) => p.category_id === product.category_id && p.id !== product.id)
    .slice(0, limit)
    .map(withCategory);
}

export function toCartProduct(p: Product): CartProduct {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    priceCents: p.price_cents,
    imageUrl: p.image_url,
    stockQuantity: p.stock_quantity,
    isActive: p.is_active,
  };
}

/** Authoritative product data for the given ids (inactive products are omitted). */
export async function getCartProducts(ids: string[]): Promise<CartProduct[]> {
  return activeProducts()
    .filter((p) => ids.includes(p.id))
    .map(toCartProduct);
}
