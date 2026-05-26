import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { useHeroSettings } from "@/lib/settings";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { categories as defaultCategories } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/cart";
import {
  ShieldX, Plus, X, Upload, ImagePlus, Loader2, ArrowLeft,
  DollarSign, ShoppingBag, Users, Layers, Search, MapPin, ClipboardList,
} from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

/* ── helpers ──────────────────────────────────────────────────────────────── */

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

const BUCKET = "product-images";

/** Upload a file to Supabase Storage and return the public URL */
async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* ── main page ────────────────────────────────────────────────────────────── */

function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const headers = await getAuthHeaders();
      
      const [pRes, oRes, cRes] = await Promise.all([
        fetch("/api/admin/products", { headers }),
        fetch("/api/admin/orders", { headers }),
        fetch("/api/admin/customers", { headers })
      ]);

      const [pData, oData, cData] = await Promise.all([
        pRes.json(),
        oRes.json(),
        cRes.json()
      ]);

      if (!pRes.ok) throw new Error(pData.error || `Products API returned status ${pRes.status}`);
      if (!oRes.ok) throw new Error(oData.error || `Orders API returned status ${oRes.status}`);
      if (!cRes.ok) throw new Error(cData.error || `Customers API returned status ${cRes.status}`);

      setProducts(pData.products || []);
      setOrders(oData.orders || []);
      setCustomers(cData.customers || []);
    } catch (e: any) {
      console.error("Dashboard fetch error:", e);
      toast.error(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardData();
    }
  }, [isAdmin]);

  if (authLoading || (isAdmin && loading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="font-serif text-3xl text-foreground">Access Denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Admin access is required.
        </p>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          Go back home
        </Button>
      </div>
    );
  }

  // Calculate statistics
  const totalRevenue = orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((sum, o) => sum + o.total, 0);

  const stats = [
    {
      title: "Total Revenue",
      value: formatPrice(totalRevenue),
      icon: <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      bg: "bg-emerald-500/10",
      description: "Excluding cancelled orders"
    },
    {
      title: "Orders Placed",
      value: orders.length,
      icon: <ShoppingBag className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      bg: "bg-indigo-500/10",
      description: "Direct & Guest purchases"
    },
    {
      title: "Unique Customers",
      value: customers.length,
      icon: <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      bg: "bg-amber-500/10",
      description: "Registered & Guests"
    },
    {
      title: "Active Products",
      value: products.length,
      icon: <Layers className="h-5 w-5 text-sky-600 dark:text-sky-400" />,
      bg: "bg-sky-500/10",
      description: "Available in catalog"
    }
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-2 mb-10">
        <h1 className="font-serif text-4xl">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage your catalog, fulfill orders, and view customer summaries.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {stats.map((stat, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
            </div>
            <div className="text-3xl font-semibold font-serif tracking-tight">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="hero">Hero Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductsAdmin initialProducts={products} onRefresh={fetchDashboardData} />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersAdmin initialOrders={orders} onRefresh={fetchDashboardData} />
        </TabsContent>
        <TabsContent value="customers">
          <CustomersAdmin initialCustomers={customers} />
        </TabsContent>
        <TabsContent value="coupons">
          <CouponsAdmin />
        </TabsContent>
        <TabsContent value="hero">
          <HeroAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PRODUCTS ADMIN — product list + inline add/edit form
   ══════════════════════════════════════════════════════════════════════════ */

type FormMode = "list" | "add" | "edit";

function ProductsAdmin({ initialProducts, onRefresh }: { initialProducts: any[], onRefresh: () => Promise<void> }) {
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [mode, setMode] = useState<FormMode>("list");
  const [editTarget, setEditTarget] = useState<any | null>(null);

  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const headers = await getAuthHeaders();
    await fetch(`/api/admin/products?id=${id}`, { method: "DELETE", headers });
    toast.success("Product deleted");
    await onRefresh();
  };

  const handleSave = async (data: any, isEdit: boolean) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/products", {
        method: isEdit ? "PUT" : "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("API error response:", errText);
        let message = "Save failed";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error) message = parsed.error;
        } catch {
          message = errText || "Save failed";
        }
        throw new Error(message);
      }
      toast.success(isEdit ? "Product updated!" : "Product added!");
      setMode("list");
      setEditTarget(null);
      await onRefresh();
    } catch (err: any) {
      console.error("Save catch error:", err);
      toast.error(err.message || "Failed to save product");
      throw err;
    }
  };

  /* ── Inline add / edit form ──────────────────────────────────────────────── */
  if (mode === "add" || mode === "edit") {
    return (
      <ProductForm
        initial={editTarget}
        isEdit={mode === "edit"}
        onSave={handleSave}
        onCancel={() => { setMode("list"); setEditTarget(null); }}
        existingCategories={[...new Set(products.map((p) => p.category))]}
      />
    );
  }

  /* ── Product list ────────────────────────────────────────────────────────── */
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-medium">Manage Products</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {products.length} product{products.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button onClick={() => setMode("add")}>
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Badge</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <img src={p.image} alt={p.name} className="h-10 w-10 rounded object-cover" />
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                    {p.category}
                  </span>
                </TableCell>
                <TableCell>{formatPrice(p.price)}</TableCell>
                <TableCell>
                  {p.stock !== undefined && p.stock !== null ? (
                    p.stock <= 3 ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                        {p.stock} Low
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-300">
                        {p.stock} units
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                      10 units
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {p.badge ? (
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {p.badge}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setEditTarget(p); setMode("edit"); }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(p.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PRODUCT FORM — inline (NOT a dialog)
   ══════════════════════════════════════════════════════════════════════════ */

function ProductForm({
  initial,
  isEdit,
  onSave,
  onCancel,
  existingCategories,
}: {
  initial: any | null;
  isEdit: boolean;
  onSave: (data: any, isEdit: boolean) => Promise<void>;
  onCancel: () => void;
  existingCategories: string[];
}) {
  const allCategories = [...new Set([...defaultCategories, ...existingCategories])];

  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState<number>(initial?.price ?? 0);
  const [category, setCategory] = useState(initial?.category ?? allCategories[0] ?? "");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [materials, setMaterials] = useState(initial?.materials ?? "");
  const [dimensions, setDimensions] = useState(initial?.dimensions ?? "");
  const [story, setStory] = useState(initial?.story ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [stock, setStock] = useState<number>(initial?.stock ?? 10);

  // Images
  const [mainImageUrl, setMainImageUrl] = useState(initial?.image ?? "");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initial?.gallery ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const mainFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  /* ── Image upload handlers ───────────────────────────────────────────────── */
  const handleMainUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setMainImageUrl(url);
      toast.success("Main image uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadImage(file));
      }
      setGalleryUrls((prev) => [...prev, ...urls]);
      toast.success(`${urls.length} image(s) uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
  };

  const removeGallery = (i: number) =>
    setGalleryUrls((prev) => prev.filter((_, idx) => idx !== i));

  /* ── Add custom category ─────────────────────────────────────────────────── */
  const addCustomCategory = () => {
    const cat = customCategory.trim();
    if (!cat) return;
    setCategory(cat);
    setCustomCategory("");
    setShowCustomCat(false);
  };

  /* ── Submit ──────────────────────────────────────────────────────────────── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mainImageUrl) { toast.error("Please upload a main image"); return; }
    setBusy(true);
    try {
      const gallery = galleryUrls.length > 0 ? galleryUrls : [mainImageUrl];
      const payload: any = {
        name, price, category, materials, dimensions, story, badge,
        image: mainImageUrl, gallery, stock,
      };
      if (isEdit && initial?.id) payload.id = initial.id;
      await onSave(payload, isEdit);
    } catch (err) {
      console.error("Form submit failed:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <button
          type="button" onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-xl font-medium">
          {isEdit ? "Edit Product" : "Add New Product"}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* ── Section 1: Basic Info ───────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Basic Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="p-name">Product Name *</Label>
              <Input id="p-name" required placeholder="e.g. Kaira Round Floor Mat"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-price">Price (₹) *</Label>
              <Input id="p-price" type="number" required min={0} placeholder="7400"
                value={price || ""} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-stock">Stock Quantity *</Label>
              <Input id="p-stock" type="number" required min={0} placeholder="10"
                value={stock} onChange={(e) => setStock(Number(e.target.value))} />
            </div>
          </div>

          {/* Category */}
          <div className="mt-4 space-y-2">
            <Label>Category *</Label>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {c}
                </button>
              ))}
              {/* Show custom category if it's not in list */}
              {category && !allCategories.includes(category) && (
                <span className="rounded-full border border-primary bg-primary text-primary-foreground px-3 py-1.5 text-sm">
                  {category}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowCustomCat(!showCustomCat)}
                className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              >
                <Plus className="inline h-3 w-3 mr-1" />
                New Category
              </button>
            </div>
            {showCustomCat && (
              <div className="flex gap-2 mt-2 max-w-xs">
                <Input
                  placeholder="e.g. Outdoor"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCategory(); } }}
                />
                <Button type="button" size="sm" onClick={addCustomCategory}>Add</Button>
              </div>
            )}
          </div>

          {/* Badge */}
          <div className="mt-4 space-y-2">
            <Label htmlFor="p-badge">Badge / Tag (optional)</Label>
            <Input id="p-badge" placeholder="e.g. Handwoven, Set of 4"
              value={badge} onChange={(e) => setBadge(e.target.value)} />
          </div>
        </section>

        {/* ── Section 2: Details ──────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Product Details
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-materials">Materials *</Label>
              <Input id="p-materials" required placeholder="e.g. Jute + cotton, sage trim"
                value={materials} onChange={(e) => setMaterials(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-dimensions">Dimensions *</Label>
              <Input id="p-dimensions" required placeholder="e.g. Ø 90 cm"
                value={dimensions} onChange={(e) => setDimensions(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="p-story">Description / Story *</Label>
            <Textarea id="p-story" required rows={4}
              placeholder="Describe the product's craft, origin, and feel…"
              value={story} onChange={(e) => setStory(e.target.value)} />
          </div>
        </section>

        {/* ── Section 3: Images ──────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Product Images
          </h3>

          {/* Main image */}
          <div className="space-y-2">
            <Label>Main Image *</Label>
            <div className="flex items-start gap-4">
              {mainImageUrl ? (
                <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border">
                  <img src={mainImageUrl} alt="Main" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setMainImageUrl("")}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => mainFileRef.current?.click()}
                  disabled={uploading}
                  className="flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  <span className="text-xs">Upload</span>
                </button>
              )}
              <input ref={mainFileRef} type="file" accept="image/*" className="hidden" onChange={handleMainUpload} />
              <div className="text-xs text-muted-foreground pt-1">
                <p>Upload from your computer.</p>
                <p className="mt-1">Images are stored in Supabase Storage.</p>
                <p className="mt-1">Or paste a URL:</p>
                <Input className="mt-1" placeholder="https://…" value={mainImageUrl}
                  onChange={(e) => setMainImageUrl(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Gallery */}
          <div className="mt-6 space-y-2">
            <Label>Gallery Images</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Add multiple images for the product carousel. You can upload files or paste URLs.
            </p>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {galleryUrls.map((url, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl border bg-secondary/30">
                  <img src={url} alt={`Gallery ${i + 1}`} className="aspect-square w-full object-cover" />
                  <button type="button" onClick={() => removeGallery(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {i + 1}
                  </span>
                </div>
              ))}

              {/* Upload tile */}
              <button type="button" onClick={() => galleryFileRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span className="text-[10px]">Add images</span>
              </button>
            </div>
            <input ref={galleryFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
          </div>
        </section>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={busy || uploading}>
            {busy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> :
              isEdit ? "Update Product" : "Add Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ORDERS ADMIN — live order tracking + shipping details + fulfillment
   ══════════════════════════════════════════════════════════════════════════ */

function OrdersAdmin({ initialOrders, onRefresh }: { initialOrders: any[], onRefresh: () => Promise<void> }) {
  const [orders, setOrders] = useState<any[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const [selectedStatus, setSelectedStatus] = useState("");
  const [courierInput, setCourierInput] = useState("");
  const [trackingNumberInput, setTrackingNumberInput] = useState("");

  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);

  useEffect(() => {
    if (selectedOrder) {
      setSelectedStatus(selectedOrder.status || "");
      setCourierInput(selectedOrder.courier || "");
      setTrackingNumberInput(selectedOrder.trackingNumber || "");
    } else {
      setSelectedStatus("");
      setCourierInput("");
      setTrackingNumberInput("");
    }
  }, [selectedOrder]);

  const handleStatusChange = async (id: string, newStatus: string, courierVal?: string, trackingVal?: string) => {
    setUpdatingId(id);
    try {
      const headers = await getAuthHeaders();
      const payload: any = { id, status: newStatus };
      if (newStatus === "Shipped") {
        payload.courier = courierVal || "";
        payload.trackingNumber = trackingVal || "";
      }
      const res = await fetch("/api/admin/orders", {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update status");
      toast.success("Order status updated!");
      await onRefresh();

      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder((prev: any) => ({
          ...prev,
          status: newStatus,
          courier: newStatus === "Shipped" ? courierVal : null,
          trackingNumber: newStatus === "Shipped" ? trackingVal : null
        }));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) =>
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.customerName.toLowerCase().includes(search.toLowerCase()) ||
    o.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
    o.shippingAddress.city.toLowerCase().includes(search.toLowerCase()) ||
    o.shippingAddress.state.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "Shipped": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "Delivered": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      case "Cancelled": return "bg-destructive/10 text-destructive";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {selectedOrder ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Orders
            </Button>
          </div>

          <div className="grid gap-8 md:grid-cols-[1fr_350px]">
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="text-2xl font-serif">{selectedOrder.orderNumber}</h2>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedOrder.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Ordered Items</h3>
                <ul className="divide-y border-y">
                  {selectedOrder.items.map((item: any, i: number) => (
                    <li key={i} className="flex gap-4 py-4 items-center">
                      <img src={item.productImage} alt={item.productName} className="h-16 w-14 rounded object-cover bg-secondary" />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{item.productName}</h4>
                        <span className="text-xs text-muted-foreground">Quantity: {item.qty}</span>
                      </div>
                      <div className="font-mono text-sm font-medium">{formatPrice(item.price * item.qty)}</div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-between items-center bg-secondary/30 rounded-xl p-4">
                <span className="font-medium">Total Amount:</span>
                <span className="font-serif text-2xl text-primary font-bold">{formatPrice(selectedOrder.total)}</span>
              </div>
            </div>

            <div className="rounded-xl border bg-secondary/10 p-6 space-y-6">
              <h3 className="font-medium text-lg border-b pb-2">Customer & Shipping Details</h3>
              
              <div className="space-y-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block">Customer Name</span>
                  <span className="font-medium">{selectedOrder.customerName}</span>
                </div>
                
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block">Email Address</span>
                  <span className="font-medium text-sm block truncate">{selectedOrder.customerEmail}</span>
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block">Phone Number</span>
                  <span className="font-medium">{selectedOrder.customerPhone || "—"}</span>
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block">Shipping Address</span>
                  <div className="text-sm space-y-1 mt-1 text-foreground">
                    <p>{selectedOrder.shippingAddress.street}</p>
                    <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.zipCode}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <Label htmlFor="status-dropdown" className="text-xs uppercase tracking-wider text-muted-foreground block">Quick Status Update</Label>
                  <select
                    id="status-dropdown"
                    disabled={updatingId === selectedOrder.id}
                    value={selectedStatus}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedStatus(val);
                      if (val !== "Shipped") {
                        handleStatusChange(selectedOrder.id, val);
                      }
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>

                  {selectedStatus === "Shipped" && (
                    <div className="space-y-3 p-3 rounded-lg border bg-background/50 animate-in fade-in duration-200">
                      <div className="space-y-1.5">
                        <Label htmlFor="courier-input" className="text-xs font-semibold text-muted-foreground">Courier Service Name</Label>
                        <Input
                          id="courier-input"
                          placeholder="e.g. Delhivery, BlueDart"
                          value={courierInput}
                          onChange={(e) => setCourierInput(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="tracking-input" className="text-xs font-semibold text-muted-foreground">Tracking Number</Label>
                        <Input
                          id="tracking-input"
                          placeholder="e.g. TRK12345678"
                          value={trackingNumberInput}
                          onChange={(e) => setTrackingNumberInput(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full text-xs h-9 cursor-pointer"
                        disabled={updatingId === selectedOrder.id || !courierInput.trim() || !trackingNumberInput.trim()}
                        onClick={() => handleStatusChange(selectedOrder.id, "Shipped", courierInput, trackingNumberInput)}
                      >
                        {updatingId === selectedOrder.id ? "Saving Details..." : "Save Shipped Details"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-medium">Order Management</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Fulfill orders, track shipping, and update statuses.
              </p>
            </div>
            
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order#, name, city..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{formatDate(order.date)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>{order.items.reduce((sum: number, item: any) => sum + item.qty, 0)} items</TableCell>
                      <TableCell className="font-medium">{formatPrice(order.total)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span>{order.shippingAddress.city}, {order.shippingAddress.state}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          {order.status === "Shipped" && order.courier && (
                            <div className="text-[10px] text-muted-foreground leading-tight">
                              <span className="font-semibold">{order.courier}</span>: {order.trackingNumber}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                          View Details
                        </Button>
                        <select
                          disabled={updatingId === order.id}
                          value={order.status}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "Shipped") {
                              setSelectedOrder(order);
                              toast.info("Please fill in tracking details for the Shipped status.");
                            } else {
                              handleStatusChange(order.id, val);
                            }
                          }}
                          className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CUSTOMERS ADMIN — customer directory + lifetime spending + tags
   ══════════════════════════════════════════════════════════════════════════ */

function CustomersAdmin({ initialCustomers }: { initialCustomers: any[] }) {
  const [search, setSearch] = useState("");

  const filtered = initialCustomers.filter((c) =>
    (c.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.state || "").toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string) => {
    if (!name || typeof name !== "string") return "??";
    return name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-medium">Customer Directory</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registered members and guest accounts who completed checkout.
          </p>
        </div>
        
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, city..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Primary Location</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Total Orders</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-serif text-sm font-semibold text-secondary-foreground">
                        {getInitials(c.fullName)}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{c.fullName}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>
                    {c.street !== "—" ? (
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>{c.city}, {c.state}</span>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.isRegistered ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {c.isRegistered ? "Registered" : "Guest"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{c.totalOrders}</TableCell>
                  <TableCell className="text-right font-medium font-mono">{formatPrice(c.totalSpent)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   COUPONS ADMIN — coupon management (add, edit, list, delete)
   ══════════════════════════════════════════════════════════════════════════ */

function CouponsAdmin() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");

  const fetchCoupons = async () => {
    try {
      const res = await fetch("/api/site-settings?key=coupons");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.value?.coupons) {
          setCoupons(json.value.coupons);
          return;
        }
      }
      // Fallback defaults
      const defaults = [
        { code: "FESTIVE10", discount: 10 },
        { code: "FIRSTORDER", discount: 20 },
        { code: "SABARA15", discount: 15 }
      ];
      setCoupons(defaults);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const saveCoupons = async (updatedList: any[]) => {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/admin/site-settings", {
      method: "POST",
      headers,
      body: JSON.stringify({
        key: "coupons",
        value: { coupons: updatedList }
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Failed to update coupons settings");
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedCode = code.trim().toUpperCase();
    const pct = parseInt(discount, 10);

    if (!formattedCode) {
      toast.error("Please enter a coupon code");
      return;
    }
    if (isNaN(pct) || pct < 1 || pct > 100) {
      toast.error("Please enter a valid discount percentage (1-100)");
      return;
    }

    if (coupons.some((c) => c.code.toUpperCase() === formattedCode)) {
      toast.error("A coupon with this code already exists");
      return;
    }

    setAdding(true);
    const updatedList = [...coupons, { code: formattedCode, discount: pct }];

    try {
      await saveCoupons(updatedList);
      setCoupons(updatedList);
      setCode("");
      setDiscount("");
      toast.success(`Coupon ${formattedCode} added successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add coupon");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCoupon = async (codeToDelete: string) => {
    if (!confirm(`Are you sure you want to delete coupon ${codeToDelete}?`)) {
      return;
    }

    const updatedList = coupons.filter(
      (c) => c.code.toUpperCase() !== codeToDelete.toUpperCase()
    );

    try {
      await saveCoupons(updatedList);
      setCoupons(updatedList);
      toast.success(`Coupon ${codeToDelete} deleted successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete coupon");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* Coupons List */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-medium">Active Discount Coupons</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage coupon codes and their corresponding percentage discount values.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coupon Code</TableHead>
                <TableHead>Discount Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                    No active coupons found. Add one on the right!
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell>
                      <span className="font-mono font-bold text-sm bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded-lg border">
                        {c.code}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                      {c.discount}% Discount
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCoupon(c.code)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Coupon Card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm h-fit">
        <h3 className="text-lg font-medium mb-4">Create New Coupon</h3>
        <form onSubmit={handleAddCoupon} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="couponCode">Coupon Code</Label>
            <Input
              id="couponCode"
              placeholder="e.g. SABARA30"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono uppercase"
            />
            <p className="text-[10px] text-muted-foreground">
              Unique text identifying the discount. Alphanumeric, converted to uppercase.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discountPercent">Discount Percentage (%)</Label>
            <Input
              id="discountPercent"
              type="number"
              min="1"
              max="100"
              placeholder="e.g. 30"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Percentage value between 1 and 100 deducted from the subtotal.
            </p>
          </div>

          <Button type="submit" disabled={adding} className="w-full mt-4 rounded-full">
            {adding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" /> Add Coupon Code
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HERO ADMIN (unchanged)
   ══════════════════════════════════════════════════════════════════════════ */

function HeroAdmin() {
  const { settings, updateSettings, isLoaded } = useHeroSettings();
  if (!isLoaded) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateSettings({
      title: fd.get("title") as string,
      subtitle: fd.get("subtitle") as string,
      badge: fd.get("badge") as string,
      imageUrl: fd.get("imageUrl") as string,
    });
    toast.success("Hero settings updated successfully");
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm max-w-2xl">
      <h2 className="text-xl font-medium mb-6">Edit Hero Section</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="badge">Badge Text</Label>
          <Input id="badge" name="badge" defaultValue={settings.badge} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Main Title</Label>
          <Textarea id="title" name="title" defaultValue={settings.title} className="resize-none" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subtitle">Subtitle / Description</Label>
          <Textarea id="subtitle" name="subtitle" defaultValue={settings.subtitle} rows={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imageUrl">Background Image URL</Label>
          <Input id="imageUrl" name="imageUrl" defaultValue={settings.imageUrl} />
        </div>
        <Button type="submit" className="w-full mt-4">Save Changes</Button>
      </form>
    </div>
  );
}
