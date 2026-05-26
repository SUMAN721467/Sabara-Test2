import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

interface EmailPayload {
  order: {
    id: string;
    order_number?: string;
    orderNumber?: string;
    customer_name?: string;
    customerName?: string;
    customer_email?: string;
    customerEmail?: string;
    customer_phone?: string;
    customerPhone?: string;
    total: number;
    shipping_street?: string;
    shippingStreet?: string;
    shipping_city?: string;
    shippingCity?: string;
    shipping_state?: string;
    shippingState?: string;
    shipping_zip_code?: string;
    shippingZipCode?: string;
    created_at?: string;
    couponCode?: string | null;
    discountAmount?: number;
  };
  items: Array<{
    productName?: string;
    product_name?: string;
    productImage?: string;
    product_image?: string;
    qty: number;
    price: number;
  }>;
  origin?: string;
}

const ADMIN_EMAIL = "contact.sabara@gmail.com";

/**
 * Sends order confirmation emails to the customer and a notification email to the admin.
 * Uses Resend API via server-side fetch.
 */
export async function sendOrderEmails({ order, items, origin }: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const fromName = "Sabara";
  const fromHeader = `${fromName} <${fromEmail}>`;
  const siteOrigin = origin || process.env.SITE_URL || "https://sabara.in";

  const orderNum = order.order_number || order.orderNumber || order.id.substring(0, 8);
  const custName = order.customer_name || order.customerName || "Customer";
  const custEmail = order.customer_email || order.customerEmail;
  const custPhone = order.customer_phone || order.customerPhone || "—";
  const totalAmount = Number(order.total);
  const couponCodeApplied = order.couponCode || null;
  const discountVal = order.discountAmount || 0;
  const subtotalAmount = items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);

  const street = order.shipping_street || order.shippingStreet || "—";
  const city = order.shipping_city || order.shippingCity || "—";
  const state = order.shipping_state || order.shippingState || "—";
  const zip = order.shipping_zip_code || order.shippingZipCode || "—";
  const shippingAddressStr = `${street}, ${city}, ${state} ${zip}`;

  if (!apiKey) {
    console.warn("[Email Service] RESEND_API_KEY is not defined. Skipping email dispatch. Order ID:", order.id);
    
    // Save email previews locally for testing/verification
    try {
      const dir = path.join(process.cwd(), "sent-emails");
      await fs.mkdir(dir, { recursive: true });
      
      const custFile = path.join(dir, `customer-order-${orderNum}.html`);
      const adminFile = path.join(dir, `admin-notification-${orderNum}.html`);
      
      await fs.writeFile(custFile, customerHtml, "utf-8");
      await fs.writeFile(adminFile, adminHtml, "utf-8");
      
      console.log(`[Email Service] Saved local email previews to: ${dir}`);
      console.log(`  - Customer Email: ${custFile}`);
      console.log(`  - Admin Email: ${adminFile}`);
    } catch (fsErr) {
      console.error("[Email Service] Failed to save local email previews", fsErr);
    }

    return { success: false, error: "RESEND_API_KEY is missing from environment variables. Email previews saved locally." };
  }

  if (!custEmail) {
    console.error("[Email Service] Customer email is missing. Cannot send order confirmation. Order ID:", order.id);
    return { success: false, error: "Customer email is missing." };
  }

  // Helper to format currency
  const formatVal = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  // Build items rows for HTML table
  const itemsHtml = items
    .map((item) => {
      const name = item.productName || item.product_name || "Handcrafted Product";
      const img = item.productImage || item.product_image || "";
      const price = Number(item.price);
      const qty = Number(item.qty);
      const subtotal = price * qty;
      
      const imgTag = img 
        ? `<td style="padding: 12px 0; vertical-align: middle; width: 60px;">
             <img src="${img}" alt="${name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb;" />
           </td>`
        : "";

      return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          ${imgTag}
          <td style="padding: 12px 8px; vertical-align: middle;">
            <div style="font-weight: 600; color: #1f2937; font-size: 14px;">${name}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Qty: ${qty} &times; ${formatVal(price)}</div>
          </td>
          <td style="padding: 12px 0; text-align: right; font-weight: 600; color: #111827; font-family: monospace; font-size: 14px; vertical-align: middle;">
            ${formatVal(subtotal)}
          </td>
        </tr>
      `;
    })
    .join("");

  // Common styles
  const emailStyle = `
    font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #374151;
    background-color: #fafaf9;
    padding: 24px 12px;
    margin: 0;
  `;

  // ── Template 1: Customer Order Confirmation ─────────────────────────────────
  const customerHtml = `
    <div style="${emailStyle}">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f3f4f4; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);">
        <!-- Header banner -->
        <tr>
          <td align="center" style="background-color: #faf7f2; padding: 40px 20px; border-bottom: 1px solid #f1ece4;">
            <div style="font-family: 'Cormorant Garamond', serif; font-size: 28px; letter-spacing: 0.1em; color: #3d3a35; text-transform: uppercase; font-weight: 500;">
              S A B A R A
            </div>
            <div style="font-size: 12px; letter-spacing: 0.2em; color: #8c857b; text-transform: uppercase; margin-top: 4px;">
              Woven with Tradition
            </div>
          </td>
        </tr>
        
        <!-- Main body -->
        <tr>
          <td style="padding: 32px 32px 24px 32px;">
            <h1 style="font-family: 'Cormorant Garamond', serif; font-size: 24px; color: #111827; margin: 0 0 16px 0; font-weight: 600; text-align: center;">
              Order Congrats Placed Successfully!
            </h1>
            <p style="font-size: 15px; color: #4b5563; margin: 0 0 24px 0; text-align: center; line-height: 1.6;">
              Dear ${custName}, thank you for choosing Sabara. We are delighted to confirm that your order has been placed successfully and is currently being processed. Here are the details of your purchase:
            </p>
            
            <!-- Order Number & Info -->
            <div style="background-color: #fcfbf9; border-radius: 8px; border: 1px solid #f5f2eb; padding: 16px; margin-bottom: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 13px; color: #6b7280; font-weight: 500;">Order ID</td>
                  <td align="right" style="font-size: 14px; font-weight: 700; color: #111827; font-family: monospace;">${orderNum}</td>
                </tr>
                <tr style="height: 8px;"><td></td><td></td></tr>
                <tr>
                  <td style="font-size: 13px; color: #6b7280; font-weight: 500;">Date</td>
                  <td align="right" style="font-size: 13px; color: #374151;">${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</td>
                </tr>
              </table>
            </div>

            <!-- Items list -->
            <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">
              Items Ordered
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
              ${itemsHtml}
              <!-- Totals -->
              <tr>
                <td colspan="2" style="padding: 16px 8px 8px 8px; font-weight: 600; color: #4b5563; font-size: 14px;">Subtotal</td>
                <td align="right" style="padding: 16px 0 8px 0; font-weight: 600; color: #111827; font-family: monospace; font-size: 14px;">${formatVal(subtotalAmount)}</td>
              </tr>
              ${discountVal > 0 ? `
              <tr>
                <td colspan="2" style="padding: 8px 8px; font-weight: 600; color: #10b981; font-size: 14px;">Discount (${couponCodeApplied})</td>
                <td align="right" style="padding: 8px 0; font-weight: 600; color: #10b981; font-family: monospace; font-size: 14px;">-${formatVal(discountVal)}</td>
              </tr>` : ""}
              <tr>
                <td colspan="2" style="padding: 8px 8px; font-weight: 600; color: #4b5563; font-size: 14px;">Shipping</td>
                <td align="right" style="padding: 8px 0; font-weight: 600; color: #10b981; font-size: 13px;">FREE</td>
              </tr>
              <tr style="border-top: 2px solid #e5e7eb;">
                <td colspan="2" style="padding: 16px 8px; font-size: 16px; font-weight: 700; color: #111827; border-top: 1px solid #e5e7eb;">Total</td>
                <td align="right" style="padding: 16px 0; font-size: 20px; font-weight: 700; color: #c49a6c; font-family: monospace; border-top: 1px solid #e5e7eb;">
                  ${formatVal(totalAmount)}
                </td>
              </tr>
            </table>

            <!-- Shipping Information -->
            <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">
              Delivery Information
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
              <tr>
                <td style="font-size: 13px; color: #6b7280; font-weight: 500; padding: 4px 0; width: 120px;">Recipient</td>
                <td style="font-size: 14px; color: #374151; font-weight: 600; padding: 4px 0;">${custName}</td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #6b7280; font-weight: 500; padding: 4px 0;">Phone</td>
                <td style="font-size: 13px; color: #374151; padding: 4px 0;">${custPhone}</td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #6b7280; font-weight: 500; padding: 4px 0; vertical-align: top;">Address</td>
                <td style="font-size: 13px; color: #374151; padding: 4px 0; line-height: 1.5;">${shippingAddressStr}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="background-color: #fafaf9; padding: 24px 32px; border-top: 1px solid #f3f3f2; text-align: center;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              If you have any questions, please contact us at support@sabara.com.
            </p>
            <p style="font-size: 11px; color: #bcaaa4; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em;">
              Sabara &copy; 2026 - Handcrafted Heritage
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  // ── Template 2: Admin Notification ──────────────────────────────────────────
  const adminHtml = `
    <div style="${emailStyle}">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f3f4f4; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);">
        <!-- Admin Notification Header -->
        <tr>
          <td align="center" style="background-color: #111827; padding: 30px 20px; text-align: center;">
            <div style="font-family: sans-serif; font-size: 14px; font-weight: 700; color: #10b981; letter-spacing: 0.2em; text-transform: uppercase;">
              Admin Notification
            </div>
            <div style="font-family: 'Cormorant Garamond', serif; font-size: 24px; color: #ffffff; margin-top: 6px; font-weight: 500;">
              New Order Received
            </div>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td style="padding: 32px 32px 24px 32px;">
            <p style="font-size: 15px; color: #1f2937; margin: 0 0 20px 0; font-weight: 500;">
              Hello Administrator,
            </p>
            <p style="font-size: 14px; color: #4b5563; margin: 0 0 24px 0; line-height: 1.5;">
              A new order has been placed on the Sabara catalog. Here are the order and fulfillment details:
            </p>

            <!-- Customer Overview -->
            <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">
              Customer Details
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; font-size: 13px;">
              <tr>
                <td style="color: #6b7280; font-weight: 500; padding: 4px 0; width: 120px;">Name</td>
                <td style="color: #111827; font-weight: 600; padding: 4px 0;">${custName}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; font-weight: 500; padding: 4px 0;">Email</td>
                <td style="color: #111827; padding: 4px 0;"><a href="mailto:${custEmail}" style="color: #c49a6c; text-decoration: none;">${custEmail}</a></td>
              </tr>
              <tr>
                <td style="color: #6b7280; font-weight: 500; padding: 4px 0;">Phone</td>
                <td style="color: #111827; padding: 4px 0;">${custPhone}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; font-weight: 500; padding: 4px 0; vertical-align: top;">Shipping Address</td>
                <td style="color: #374151; padding: 4px 0; line-height: 1.4;">${shippingAddressStr}</td>
              </tr>
            </table>

            <!-- Order Info Summary -->
            <div style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6; padding: 16px; margin-bottom: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                <tr>
                  <td style="color: #6b7280; font-weight: 500;">Order ID (DB Key)</td>
                  <td align="right" style="font-weight: 600; color: #111827; font-family: monospace;">${order.id}</td>
                </tr>
                <tr style="height: 8px;"><td></td><td></td></tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 500;">Sequential Order No.</td>
                  <td align="right" style="font-weight: 700; color: #111827;">${orderNum}</td>
                </tr>
                <tr style="height: 8px;"><td></td><td></td></tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 500;">Total Captured</td>
                  <td align="right" style="font-weight: 700; color: #c49a6c; font-size: 15px; font-family: monospace;">${formatVal(totalAmount)}</td>
                </tr>
              </table>
            </div>

            <!-- Items Ordered list -->
            <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">
              Ordered Items
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
              ${itemsHtml}
            </table>
          </td>
        </tr>

        <!-- Action Banner -->
        <tr>
          <td align="center" style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="font-size: 12px; color: #6b7280; margin: 0 0 12px 0;">
              Please open the administration dashboard to fulfill and manage this order.
            </p>
            <a href="${siteOrigin}/admin" style="background-color: #111827; color: #ffffff; padding: 10px 20px; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
              View in Admin Dashboard
            </a>
          </td>
        </tr>
      </table>
    </div>
  `;

  // Dispatch both emails using Promise.allSettled to prevent failures in one email blocking the other
  const results = await Promise.allSettled([
    // Send to Customer
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [custEmail],
        subject: `Order Confirmation - ${orderNum} Placed Successfully!`,
        html: customerHtml
      })
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Customer email failed with status ${res.status}: ${text}`);
      }
      return res.json();
    }),

    // Send to Admin
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [ADMIN_EMAIL],
        subject: `🚨 Alert: New Order Received - ${orderNum}`,
        html: adminHtml
      })
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Admin email failed with status ${res.status}: ${text}`);
      }
      return res.json();
    })
  ]);

  const customerResult = results[0];
  const adminResult = results[1];

  console.log("[Email Service] Dispatch complete.", {
    customerSuccess: customerResult.status === "fulfilled",
    adminSuccess: adminResult.status === "fulfilled",
    customerError: customerResult.status === "rejected" ? (customerResult as any).reason.message : null,
    adminError: adminResult.status === "rejected" ? (adminResult as any).reason.message : null
  });

  return {
    success: customerResult.status === "fulfilled" && adminResult.status === "fulfilled",
    customer: customerResult.status === "fulfilled" ? (customerResult as any).value : null,
    admin: adminResult.status === "fulfilled" ? (adminResult as any).value : null
  };
}
