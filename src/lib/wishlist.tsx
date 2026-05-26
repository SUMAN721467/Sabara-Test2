import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "@/data/products";

type WishlistCtx = {
  wishlist: string[];
  detailed: Product[];
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
  count: number;
  loading: boolean;
};

const Ctx = createContext<WishlistCtx | null>(null);
const STORAGE_KEY = "sabara-wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Hydrate wishlist from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setWishlist(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  // 2. Persist wishlist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    } catch {}
  }, [wishlist, hydrated]);

  // 3. Fetch products dynamically from the database
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          const json = await res.json();
          if (json?.products) {
            setDbProducts(json.products);
          }
        }
      } catch (e) {
        console.error("[WishlistProvider db fetch error]", e);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const value = useMemo<WishlistCtx>(() => {
    const detailed = wishlist
      .map((id) => dbProducts.find((p) => p.id === id))
      .filter(Boolean) as Product[];

    return {
      wishlist,
      detailed,
      loading,
      count: wishlist.length,
      add: (id) =>
        setWishlist((prev) => (prev.includes(id) ? prev : [...prev, id])),
      remove: (id) => setWishlist((prev) => prev.filter((item) => item !== id)),
      toggle: (id) =>
        setWishlist((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        ),
      has: (id) => wishlist.includes(id),
      clear: () => setWishlist([]),
    };
  }, [wishlist, dbProducts, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWishlist must be used within WishlistProvider");
  return v;
}
