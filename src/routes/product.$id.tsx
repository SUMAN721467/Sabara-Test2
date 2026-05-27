import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Heart } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { formatPrice, useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/site/ProductCard";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getOrSeedProducts } from "./api/products";

const getProductDetails = createServerFn({ method: "GET" })
  .handler(async ({ data: id }: { data: string }) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);
    const list = await getOrSeedProducts(supabase);
    const product = list.find((p: any) => p.id === id);
    if (!product) return null;
    const related = list.filter((x: any) => x.id !== id && x.category === product.category).slice(0, 3);
    return { product, related };
  });

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params }) => {
    const data = await getProductDetails({ data: params.id });
    if (!data || !data.product) throw notFound();
    return data;
  },
  component: ProductPage,
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.product.name} · Sabara` },
            { name: "description", content: loaderData.product.story },
          ],
        }
      : {},
});

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [bgPos, setBgPos] = useState("0% 0%");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });

  const lensSize = { width: 180, height: 225 }; // aspect-ratio matching aspect-[4/5] (e.g. 180/225 = 4/5)

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkIsDesktop();
    window.addEventListener("resize", checkIsDesktop);
    return () => window.removeEventListener("resize", checkIsDesktop);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDesktop || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate mouse relative coordinates inside container
    let x = e.clientX - rect.left - lensSize.width / 2;
    let y = e.clientY - rect.top - lensSize.height / 2;

    // Constrain lens boundary
    if (x < 0) x = 0;
    if (x > rect.width - lensSize.width) x = rect.width - lensSize.width;
    if (y < 0) y = 0;
    if (y > rect.height - lensSize.height) y = rect.height - lensSize.height;

    setLensPos({ x, y });

    // Calculate background position percentage for zoomed image
    const pX = (x / (rect.width - lensSize.width)) * 100;
    const pY = (y / (rect.height - lensSize.height)) * 100;
    setBgPos(`${pX}% ${pY}%`);

    // Update portal coordinates relative to viewport + scroll
    setCoords({
      left: rect.right + 16 + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    });

    setShowZoom(true);
  };

  const handleMouseLeave = () => {
    setShowZoom(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/5] select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => isDesktop && setShowZoom(true)}
    >
      {/* Image container with rounded corners and overflow hidden */}
      <div className="relative overflow-hidden rounded-2xl bg-secondary/50 w-full h-full cursor-zoom-in">
        {/* Original Image */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover aspect-[4/5]"
        />

        {/* Lens (Desktop only and when hovering) */}
        {isDesktop && showZoom && (
          <div
            style={{
              left: `${lensPos.x}px`,
              top: `${lensPos.y}px`,
              width: `${lensSize.width}px`,
              height: `${lensSize.height}px`,
            }}
            className="absolute pointer-events-none border-2 border-primary/50 bg-primary/10 shadow-sm z-10 transition-none"
          />
        )}
      </div>

      {/* Zoom Window rendered via React Portal (Desktop only and when hovering) */}
      {isDesktop && showZoom && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "absolute",
            left: `${coords.left}px`,
            top: `${coords.top}px`,
            width: `${coords.width * 0.75}px`,
            height: `${coords.height * 0.75}px`,
            backgroundImage: `url(${src})`,
            backgroundPosition: bgPos,
            backgroundSize: `${(coords.width / lensSize.width * 100) / 0.75}% ${(coords.height / lensSize.height * 100) / 0.75}%`,
            backgroundRepeat: "no-repeat",
            pointerEvents: "none"
          }}
          className="z-50 border bg-background rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 duration-200"
        />,
        document.body
      )}
    </div>
  );
}

function ProductPage() {
  const { product, related } = Route.useLoaderData();
  const { add } = useCart();
  const { toggle: toggleWishlist, has: hasWishlist } = useWishlist();
  const isWishlisted = hasWishlist(product.id);
  const [qty, setQty] = useState(1);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
      <Link
        to="/shop"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>

      <div className="mt-6 grid gap-6 md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr] md:gap-8 lg:gap-12 items-start">
        <div className="flex flex-col gap-4">
          <Carousel setApi={setApi} className="w-full relative group">
            <CarouselContent>
              {product.gallery.map((img: string, i: number) => (
                <CarouselItem key={i}>
                  <ZoomableImage src={img} alt={`${product.name} view ${i + 1}`} />
                </CarouselItem>
              ))}
            </CarouselContent>
            {product.gallery.length > 1 && (
              <>
                <CarouselPrevious className="left-4 opacity-0 transition-opacity group-hover:opacity-100" />
                <CarouselNext className="right-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </>
            )}
          </Carousel>
          <div className="grid grid-cols-4 gap-3">
            {product.gallery.map((img: string, i: number) => (
              <button
                key={i}
                onClick={() => api?.scrollTo(i)}
                className={`overflow-hidden rounded-lg bg-secondary/50 transition-all ${
                  current === i
                    ? "ring-2 ring-primary ring-offset-2"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={img}
                  alt={`${product.name} view ${i + 1}`}
                  className="aspect-square h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            {product.category}
          </span>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-foreground md:text-5xl">
            {product.name}
          </h1>
          <div className="mt-3 text-xl text-muted-foreground">{formatPrice(product.price)}</div>

          <p className="mt-6 leading-relaxed text-foreground/80">{product.story}</p>

          <dl className="mt-8 grid grid-cols-2 gap-y-3 border-y border-border/60 py-5 text-sm">
            <dt className="text-muted-foreground">Materials</dt>
            <dd className="text-foreground">{product.materials}</dd>
            <dt className="text-muted-foreground">Dimensions</dt>
            <dd className="text-foreground">{product.dimensions}</dd>
            <dt className="text-muted-foreground">Made</dt>
            <dd className="text-foreground">By hand, in small batches</dd>
            <dt className="text-muted-foreground">Returns</dt>
            <dd className="text-foreground text-emerald-600 dark:text-emerald-400 font-semibold">7 Days Hassle-Free Return</dd>
          </dl>

          <div className="mt-8 flex items-stretch gap-3">
            <div className="inline-flex items-center rounded-full border border-border">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm tabular-nums">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
             <button
              onClick={() => {
                add(product.id, qty);
                toast.success(`${product.name} added to cart`);
              }}
              className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
            >
              Add to cart · {formatPrice(product.price * qty)}
            </button>
            <button
              onClick={() => {
                toggleWishlist(product.id);
                if (isWishlisted) {
                  toast.success(`${product.name} removed from wishlist.`);
                } else {
                  toast.success(`${product.name} added to wishlist!`);
                }
              }}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-all active:scale-90 cursor-pointer",
                isWishlisted
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart className={cn("h-5 w-5", isWishlisted && "fill-current")} />
            </button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Free shipping on all orders</p>

        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="font-serif text-2xl text-foreground md:text-3xl">You might also like</h2>
          <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p: Product) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
