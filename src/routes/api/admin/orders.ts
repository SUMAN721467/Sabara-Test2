import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

function getAdminEmails(): Set<string> {
  const envEmails = process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || "";
  const emails = new Set(
    envEmails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
  emails.add("contact.sabara@gmail.com");
  return emails;
}

async function assertAdmin(request: Request, context: any) {
  let claims = context?.claims;
  
  if (!claims) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data } = await supabase.auth.getClaims(token);
          if (data?.claims) {
            claims = data.claims;
          }
        } catch (e) {
          console.error("[assertAdmin fallback orders authentication failed]", e);
        }
      }
    }
  }

  const email = (
    claims?.email || 
    claims?.user_metadata?.email || 
    ""
  ).toLowerCase().trim();
  
  const adminSet = getAdminEmails();

  if (!email || !adminSet.has(email)) {
    throw new Error(`Forbidden: Admin access required.`);
  }
}

export const Route = createFileRoute("/api/admin/orders")({
  server: {
    middlewares: [requireSupabaseAuth],
    handlers: {
      GET: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const authHeader = request.headers.get("authorization");
          const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          
          const supabase = token 
            ? createClient(supabaseUrl!, supabaseKey!, {
                global: { headers: { Authorization: `Bearer ${token}` } }
              })
            : createClient(supabaseUrl!, supabaseKey!);

          const { data: dbOrders, error: ordersError } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .order("created_at", { ascending: false });

          if (ordersError) throw new Error(ordersError.message);

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
          console.error("[api/admin/orders GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
      PUT: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const body = await request.json();
          const { id, status, courier, trackingNumber } = body;
          
          if (!id || !status) {
            return Response.json({ success: false, error: "Missing id or status" }, { status: 400 });
          }

          const authHeader = request.headers.get("authorization");
          const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          
          const supabase = token 
            ? createClient(supabaseUrl!, supabaseKey!, {
                global: { headers: { Authorization: `Bearer ${token}` } }
              })
            : createClient(supabaseUrl!, supabaseKey!);

          // Get current shipping street to preserve address and get base street
          const { data: currentOrder, error: fetchErr } = await supabase
            .from("orders")
            .select("shipping_street")
            .eq("id", id)
            .single();

          if (fetchErr) throw new Error(fetchErr.message);

          let updatedStreet = currentOrder?.shipping_street || "";
          if (status === "Shipped" && courier && trackingNumber) {
            const baseStreet = (currentOrder?.shipping_street || "").split("|")[0];
            updatedStreet = `${baseStreet}|${courier.trim()}|${trackingNumber.trim()}`;
          }

          // Update status and shipping_street
          const { error: updateError } = await supabase
            .from("orders")
            .update({ status, shipping_street: updatedStreet })
            .eq("id", id);

          if (updateError) throw new Error(updateError.message);

          const { data: dbOrders, error: ordersError } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .order("created_at", { ascending: false });

          if (ordersError) throw new Error(ordersError.message);

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
          console.error("[api/admin/orders PUT error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      }
    }
  }
});
