import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = { id: string; qty: number };

type CartCtx = {
  lines: CartLine[];
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  detailed: Array<CartLine & { product: any }>;
  loading: boolean;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "handcraft-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Hydrate cart lines from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  // 2. Persist cart lines to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines, hydrated]);

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
        console.error("[CartProvider db fetch error]", e);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const value = useMemo<CartCtx>(() => {
    const detailed = lines
      .map((l) => {
        const product = dbProducts.find((p) => p.id === l.id);
        return product ? { ...l, product } : null;
      })
      .filter(Boolean) as Array<CartLine & { product: any }>;

    return {
      lines,
      detailed,
      loading,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: detailed.reduce((s, l) => s + l.product.price * l.qty, 0),
      add: (id, qty = 1) =>
        setLines((prev) => {
          const product = dbProducts.find((p) => p.id === id);
          const maxStock = product?.stock !== undefined && product?.stock !== null ? Number(product.stock) : 10;
          const found = prev.find((l) => l.id === id);
          if (found) {
            const newQty = Math.min(maxStock, found.qty + qty);
            if (newQty === found.qty && found.qty >= maxStock) {
              return prev;
            }
            return prev.map((l) => (l.id === id ? { ...l, qty: newQty } : l));
          }
          return [...prev, { id, qty: Math.min(maxStock, qty) }];
        }),
      setQty: (id, qty) =>
        setLines((prev) => {
          const product = dbProducts.find((p) => p.id === id);
          const maxStock = product?.stock !== undefined && product?.stock !== null ? Number(product.stock) : 10;
          const targetQty = Math.min(maxStock, qty);
          return targetQty <= 0 ? prev.filter((l) => l.id !== id) : prev.map((l) => (l.id === id ? { ...l, qty: targetQty } : l));
        }),
      remove: (id) => setLines((prev) => prev.filter((l) => l.id !== id)),
      clear: () => setLines([]),
    };
  }, [lines, dbProducts, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used within CartProvider");
  return v;
}

export function formatPrice(n: number) {
  return `\u20B9${n.toLocaleString("en-IN")}`;
}
