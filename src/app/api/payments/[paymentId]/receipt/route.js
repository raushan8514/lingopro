import { getAuthContext } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { formatMinorCurrency } from "@/lib/payments/format";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function logReceiptFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

export async function GET(_request, { params }) {
  const { paymentId } = await params;
  if (!UUID_PATTERN.test(String(paymentId || ""))) {
    return new Response("Not found", { status: 404 });
  }

  const auth = await getAuthContext();
  if (!auth.user) return new Response("Authentication required", { status: 401 });
  if (!["student", "admin"].includes(auth.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const client = await createClient({ allowCookieWrites: false });
  const { data: payment, error } = await client
    .from("payments")
    .select(
      "id,student_id,transaction_reference,purchase_description,amount_cents,currency,status,provider_payment_id,receipt_number,paid_at,created_at",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    logReceiptFailure("load the receipt payment", error);
    return new Response("Receipt unavailable", { status: 503 });
  }
  if (!payment || (auth.role !== "admin" && payment.student_id !== auth.user.id)) {
    return new Response("Not found", { status: 404 });
  }
  if (payment.status !== "SUCCEEDED" || !payment.receipt_number) {
    return new Response("A receipt is not available until payment is verified", { status: 409 });
  }

  const { data: customer, error: customerError } = await client
    .from("profiles")
    .select("full_name,email")
    .eq("id", payment.student_id)
    .maybeSingle();
  if (customerError) {
    logReceiptFailure("load the receipt customer", customerError);
    return new Response("Receipt unavailable", { status: 503 });
  }
  if (!customer) return new Response("Not found", { status: 404 });

  const amount = formatMinorCurrency(payment.amount_cents, payment.currency);
  const businessName = process.env.BILLING_BUSINESS_NAME?.trim() || "LingoPro";
  const businessAddress = process.env.BILLING_BUSINESS_ADDRESS?.trim();
  const supportEmail = process.env.BILLING_SUPPORT_EMAIL?.trim();
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(payment.paid_at));
  const rows = [
    ["Issued by", businessName],
    ...(businessAddress ? [["Business address", businessAddress]] : []),
    ...(supportEmail ? [["Support email", supportEmail]] : []),
    ["Receipt number", payment.receipt_number],
    ["Transaction reference", payment.transaction_reference || payment.id],
    ["Provider payment reference", payment.provider_payment_id || "Not available"],
    ["Customer", customer.full_name],
    ["Email", customer.email],
    ["Purchase", payment.purchase_description || "LingoPro purchase"],
    ["Payment date (UTC)", date],
    ["Amount paid", amount],
    ["Status", "Verified payment"],
  ];
  const htmlRows = rows.map(([label, value]) => (
    `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
  )).join("");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(businessName)} payment receipt ${escapeHtml(payment.receipt_number)}</title>
<style>
  :root { color-scheme: light; font-family: Arial, sans-serif; color: #17231f; background: #f7f8f6; }
  body { margin: 0; padding: 2rem 1rem; }
  main { max-width: 46rem; margin: auto; padding: clamp(1.25rem, 5vw, 3rem); background: white; border: 1px solid #dfe6e0; border-radius: 1rem; }
  header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; border-bottom: 1px solid #dfe6e0; padding-bottom: 1.25rem; }
  h1 { margin: 0; font-size: 1.6rem; } p { color: #596860; line-height: 1.55; }
  table { width: 100%; margin-top: 1rem; border-collapse: collapse; } th, td { padding: .8rem 0; border-bottom: 1px solid #e8ede9; text-align: left; vertical-align: top; }
  th { width: 42%; color: #596860; font-weight: 500; } td { overflow-wrap: anywhere; }
  .amount { color: #176b55; font-size: 1.1rem; font-weight: 700; }
  button { border: 0; border-radius: .55rem; background: #176b55; color: white; padding: .7rem 1rem; font-size: .95rem; cursor: pointer; }
  .note { margin-top: 1.5rem; font-size: .85rem; }
  @media print { :root { background: white; } body { padding: 0; } main { border: 0; border-radius: 0; } button { display: none; } }
</style>
</head>
<body>
<main>
  <header><div><h1>${escapeHtml(businessName)} payment receipt</h1><p>Receipt for a provider-verified payment.</p></div><button type="button" onclick="window.print()">Print / Save</button></header>
  <table><tbody>${htmlRows}</tbody></table>
  <p class="note">This payment receipt is not a GST tax invoice. No tax registration details, tax rate, or tax breakdown have been configured.</p>
</main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}
