import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function getServerSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables on server");
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function getOrSeedProducts(supabase: any) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[getOrSeedProducts] fetch error:", error.message);
      return [];
    }

    return data || [];
  } catch (e: any) {
    console.error("[getOrSeedProducts] Try-catch error:", e);
    return [];
  }
}

export const Route = createFileRoute("/api/products")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const q = url.searchParams.get("q")?.toLowerCase().trim() ?? "";
          const category = url.searchParams.get("category") ?? "";

          const supabase = getServerSupabase();
          const dbProducts = await getOrSeedProducts(supabase);

          let list = dbProducts;
          if (category && category !== "All") {
            list = list.filter((p: any) => p.category === category);
          }
          if (q) {
            list = list.filter(
              (p: any) =>
                p.name.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                p.materials.toLowerCase().includes(q) ||
                p.story.toLowerCase().includes(q),
            );
          }

          return Response.json(
            { products: list },
            { headers: { "cache-control": "public, max-age=5" } },
          );
        } catch (err: any) {
          console.error("[api/products GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
