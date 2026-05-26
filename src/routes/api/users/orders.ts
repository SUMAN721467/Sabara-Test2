import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

async function resolveSupabaseClient(request: Request, context: any) {
  let supabase = (context as any)?.supabase;
  let userId = (context as any)?.userId;

  if (!supabase || !userId) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (supabaseUrl && supabaseKey) {
        try {
          const client = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: {
              storage: undefined,
              persistSession: false,
              autoRefreshToken: false,
            }
          });
          const { data } = await client.auth.getClaims(token);
          if (data?.claims?.sub) {
            supabase = client;
            userId = data.claims.sub;
          }
        } catch (e) {
          console.error("[resolveSupabaseClient fallback error]", e);
        }
      }
    }
  }

  return { supabase, userId };
}

export const Route = createFileRoute("/api/users/orders")({
  server: {
    middlewares: [requireSupabaseAuth],
    handlers: {
      GET: async ({ request, context }) => {
        try {
          const { supabase, userId } = await resolveSupabaseClient(request, context);

          if (!supabase || !userId) {
            return Response.json({ success: false, error: "Unauthorized: Missing session" }, { status: 401 });
          }

          // Fetch orders for this user with order items
          const { data: dbOrders, error } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (error) {
            console.error("[users/orders GET]", error.message);
            return Response.json({ success: false, error: error.message }, { status: 500 });
          }

          const formatted = (dbOrders || []).map((o: any) => {
            const streetParts = (o.shipping_street || "").split("|");
            const baseStreet = streetParts[0];
            const courier = streetParts[1] || null;
            const trackingNumber = streetParts[2] || null;

            return {
              id: o.id,
              orderNumber: o.order_number,
              customerName: o.customer_name,
              customerEmail: o.customer_email,
              customerPhone: o.customer_phone,
              total: Number(o.total),
              status: o.status,
              courier,
              trackingNumber,
              date: o.created_at,
              shippingAddress: {
                street: baseStreet,
                city: o.shipping_city,
                state: o.shipping_state,
                zipCode: o.shipping_zip_code
              },
              items: (o.order_items || []).map((item: any) => ({
                productId: item.product_id,
                productName: item.product_name,
                productImage: item.product_image,
                qty: item.qty,
                price: Number(item.price)
              }))
            };
          });

          return Response.json({ success: true, orders: formatted });
        } catch (err: any) {
          console.error("[users/orders GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
