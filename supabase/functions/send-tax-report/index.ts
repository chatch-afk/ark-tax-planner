import "@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API = "https://api.resend.com/emails";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Strategy {
  name: string;
  description?: string;
  savingsRange?: { low: number; high: number };
  details?: string;
  consultationOnly?: boolean;
}

interface TaxReportPayload {
  client: {
    firstName?: string;
    lastName?: string;
    businessName?: string;
    email?: string;
    phone?: string;
    state?: string;
    legalEntity?: string;
    taxTreatment?: string;
  };
  financials: {
    revenue?: number;
    netIncome?: number;
    w2Wages?: number;
    ownerW2?: number;
    marginalRate?: number;
  };
  strategies: Strategy[];
  totalSavingsLow: number;
  totalSavingsHigh: number;
  strategyCount: number;
  inputs?: Record<string, unknown>;
  notes?: string;
}

function money(n: number): string {
  if (!n && n !== 0) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function buildEmailHTML(data: TaxReportPayload): string {
  const { client, financials, strategies, totalSavingsLow, totalSavingsHigh } = data;
  const clientName = `${client.firstName || ""} ${client.lastName || ""}`.trim() || "Client";
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const estimatedStrategies = strategies.filter(s => !s.consultationOnly);
  const consultationStrategies = strategies.filter(s => s.consultationOnly);

  const strategyRows = estimatedStrategies.map(s => {
    const range = s.savingsRange
      ? `${money(s.savingsRange.low)} – ${money(s.savingsRange.high)}`
      : "—";
    return `
      <tr>
        <td style="padding:10px 14px; border-bottom:1px solid #e8ecf0;">
          <strong style="color:#133B54;">${esc(s.name)}</strong>
          ${s.description ? `<br><span style="font-size:12px; color:#6b7b8a;">${esc(s.description)}</span>` : ""}
          ${s.details ? `<br><span style="font-size:12px; color:#6b7b8a;">${esc(s.details)}</span>` : ""}
        </td>
        <td style="padding:10px 14px; border-bottom:1px solid #e8ecf0; text-align:right; font-weight:700; color:#133B54; white-space:nowrap;">
          ${range}
        </td>
      </tr>`;
  }).join("");

  const consultationRows = consultationStrategies.map(s => `
    <tr>
      <td style="padding:10px 14px; border-bottom:1px solid #e8ecf0;">
        <strong style="color:#133B54;">${esc(s.name)}</strong>
        ${s.details ? `<br><span style="font-size:12px; color:#6b7b8a;">${esc(s.details)}</span>` : ""}
      </td>
      <td style="padding:10px 14px; border-bottom:1px solid #e8ecf0; text-align:right; font-weight:700; color:#A98A5E; white-space:nowrap;">
        Consultation Recommended
      </td>
    </tr>`).join("");

  const kv = (label: string, value: string) =>
    value ? `<tr><td style="padding:6px 0; color:#6b7b8a; font-size:13px;">${esc(label)}</td><td style="padding:6px 0; font-weight:600; font-size:13px; text-align:right;">${esc(value)}</td></tr>` : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f4f5f7; font-family:'DM Sans',Helvetica,Arial,sans-serif; color:#133B54;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7; padding:24px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(19,59,84,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#133B54,#386FA4); padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:22px; font-weight:900; color:#ffffff; letter-spacing:-0.02em;">ARK Academy</div>
                  <div style="font-size:13px; color:rgba(255,255,255,.75); margin-top:4px;">Tax Planning LITE — Strategy Report</div>
                </td>
                <td align="right" style="vertical-align:top;">
                  <div style="font-size:12px; color:rgba(255,255,255,.65);">${esc(dateStr)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Savings banner -->
        <tr>
          <td style="background:#A98A5E; padding:18px 32px; text-align:center;">
            <div style="font-size:12px; color:rgba(255,255,255,.85); text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Estimated Annual Tax Savings</div>
            <div style="font-size:28px; font-weight:900; color:#ffffff; margin-top:4px;">${money(totalSavingsLow)} – ${money(totalSavingsHigh)}</div>
            <div style="font-size:12px; color:rgba(255,255,255,.75); margin-top:4px;">${data.strategyCount} strategies identified</div>
          </td>
        </tr>

        <!-- Client info -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; font-weight:700; color:#A98A5E; margin-bottom:12px;">Client & Business</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
              ${kv("Name", clientName)}
              ${kv("Business", client.businessName || "")}
              ${kv("Email", client.email || "")}
              ${kv("Phone", client.phone || "")}
              ${kv("State", client.state || "")}
              ${kv("Entity", client.legalEntity || "")}
              ${kv("Tax Treatment", client.taxTreatment || "")}
            </table>
          </td>
        </tr>

        <!-- Financials -->
        <tr>
          <td style="padding:16px 32px 8px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; font-weight:700; color:#A98A5E; margin-bottom:12px;">Financial Snapshot</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
              ${kv("Annual Revenue", money(financials.revenue || 0))}
              ${kv("Net Profit", money(financials.netIncome || 0))}
              ${kv("W-2 Wages (Owner + Staff)", money(financials.w2Wages || 0))}
              ${kv("Owner W-2", money(financials.ownerW2 || 0))}
              ${kv("Marginal Tax Rate", financials.marginalRate ? `${Math.round(financials.marginalRate * 100)}%` : "—")}
            </table>
          </td>
        </tr>

        <!-- Strategies with dollar estimates -->
        ${estimatedStrategies.length > 0 ? `
        <tr>
          <td style="padding:20px 32px 8px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; font-weight:700; color:#A98A5E; margin-bottom:12px;">Strategy Breakdown</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; border:1px solid #e8ecf0; border-radius:10px; overflow:hidden;">
              ${strategyRows}
            </table>
          </td>
        </tr>` : ""}

        <!-- Consultation strategies -->
        ${consultationStrategies.length > 0 ? `
        <tr>
          <td style="padding:20px 32px 8px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; font-weight:700; color:#A98A5E; margin-bottom:12px;">Strategies Requiring CPA Review</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; border:1px solid #e8ecf0; border-radius:10px; overflow:hidden;">
              ${consultationRows}
            </table>
          </td>
        </tr>` : ""}

        ${data.notes ? `
        <tr>
          <td style="padding:16px 32px 8px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; font-weight:700; color:#A98A5E; margin-bottom:8px;">Notes</div>
            <p style="font-size:13px; color:#6b7b8a; margin:0;">${esc(data.notes)}</p>
          </td>
        </tr>` : ""}

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px; border-top:2px solid #e8ecf0; margin-top:16px;">
            <p style="font-size:12px; color:#6b7b8a; line-height:1.5; margin:0;">
              <strong>Important:</strong> This report is a conservative preview for planning purposes. Actual eligibility and savings require a full advisor review and proper documentation.
            </p>
            <p style="font-size:12px; color:#6b7b8a; line-height:1.5; margin:12px 0 0;">
              <strong>To explore these strategies further or schedule a full advisor review, contact us at <strong>academy@arkfinancial.com</strong>.
            </p>
          </td>
        </tr>

        <!-- Brand bar -->
        <tr>
          <td style="background:#133B54; padding:16px 32px; text-align:center;">
            <div style="font-size:13px; font-weight:700; color:#A98A5E;">ARK Academy</div>
            <div style="font-size:11px; color:rgba(255,255,255,.55); margin-top:4px;">You sit at the head of the table.</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// =========================================================
// STORE SUBMISSION IN PORTAL DATABASE
// =========================================================
async function storeSubmission(data: TaxReportPayload): Promise<string | null> {
  const PORTAL_URL = Deno.env.get("PORTAL_SUPABASE_URL");
  const PORTAL_KEY = Deno.env.get("PORTAL_SERVICE_ROLE_KEY");

  if (!PORTAL_URL || !PORTAL_KEY) {
    console.warn("Portal credentials not configured — skipping DB write");
    return null;
  }

  const row = {
    first_name: data.client.firstName || null,
    last_name: data.client.lastName || null,
    business_name: data.client.businessName || null,
    email: data.client.email || null,
    phone: data.client.phone || null,
    state: data.client.state || null,
    entity_type: data.client.legalEntity || null,
    tax_treatment: data.client.taxTreatment || null,
    inputs: data.inputs || {},
    results: data.strategies,
    total_savings_low: data.totalSavingsLow || 0,
    total_savings_high: data.totalSavingsHigh || 0,
    strategy_count: data.strategyCount || 0,
    status: "new",
  };

  const res = await fetch(`${PORTAL_URL}/rest/v1/tax_submissions`, {
    method: "POST",
    headers: {
      "apikey": PORTAL_KEY,
      "Authorization": `Bearer ${PORTAL_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Portal DB write failed:", res.status, err);
    return null;
  }

  const inserted = await res.json();
  return inserted?.[0]?.id || null;
}

// =========================================================
// MAIN HANDLER
// =========================================================
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "academy@arkfinancial.com";
    const TO_EMAIL = Deno.env.get("TO_EMAIL") || "academy@arkfinancial.com";

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const data: TaxReportPayload = await req.json();
    const clientName = `${data.client.firstName || ""} ${data.client.lastName || ""}`.trim() || "Client";
    const subject = `ARK Tax Planning LITE Results: ${data.client.businessName || clientName}`;
    const html = buildEmailHTML(data);

    // 1. Store in Portal database (non-blocking — don't fail if DB write fails)
    const submissionId = await storeSubmission(data).catch(err => {
      console.error("DB store error:", err);
      return null;
    });

    // 2. Send email — internal only, no client CC
    const emailPayload = {
      from: `ARK Academy <${FROM_EMAIL}>`,
      to: [TO_EMAIL],
      subject,
      html,
    };

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const resBody = await res.json();

    if (!res.ok) {
      console.error("Resend error:", JSON.stringify(resBody));
      return new Response(
        JSON.stringify({ success: false, error: resBody, submissionId }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: resBody.id, submissionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
