// ====================================================================
// generate-business-passport-pdf
// STATUS: STRUCTURED, NOT FULLY IMPLEMENTED.
// Deno edge functions don't have a drop-in equivalent of Node's pdf-lib
// story used elsewhere in Zenzele Holdings projects (Ubulula's worksheet
// export). Two real options, deliberately not picked for you silently:
//   (a) Use `pdf-lib` via esm.sh (works in Deno) — draw text/boxes manually.
//   (b) Render an HTML template and rasterize with a headless-browser
//       service (e.g. Browserless) called from this function — much
//       higher fidelity for a document this visual (QR code, badges,
//       trust score ring), but adds an external dependency.
// Given the Business Passport PDF needs to visually match the in-app
// design system closely, (b) is the better long-term choice. This stub
// implements (a) minimally so the endpoint is callable end-to-end today,
// and documents the upgrade path.
//
// Invoke: POST { passport_id: string }
// Returns: { path: string } — storage path in the 'generated-pdfs' bucket
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { requireRole } from "../_shared/auth.ts";
import { generatePassportPdfSchema, parseBody } from "../_shared/schemas.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const auth = await requireRole(req, ["entrepreneur", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const parsed = await parseBody(req, generatePassportPdfSchema);
    if (parsed instanceof Response) return parsed;
    const { passport_id } = parsed;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: ownerCheck } = await supabase.from("business_passports").select("owner_id").eq("id", passport_id).single();
    if (!ownerCheck) return json({ error: "Passport not found" }, 404);
    if (ownerCheck.owner_id !== auth.user.id && auth.user.role !== "admin") {
      return json({ error: "Not authorized to generate this passport's PDF" }, 403);
    }

    const allowed = await checkRateLimit(`generate-pdf:${auth.user.id}`, 10, 3600);
    if (!allowed) return rateLimitResponse();

    const { data: passport, error } = await supabase
      .from("business_passports")
      .select("*")
      .eq("id", passport_id)
      .single();
    if (error || !passport) return json({ error: "Passport not found" }, 404);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const forest = rgb(0x1b / 255, 0x3a / 255, 0x2b / 255);

    page.drawRectangle({ x: 0, y: 792, width: 595, height: 50, color: forest });
    page.drawText("Zenzele Business Passport", { x: 24, y: 810, size: 16, font, color: rgb(1, 1, 1) });

    page.drawText(passport.business_name, { x: 24, y: 750, size: 22, font });
    page.drawText(`Trust Score: ${passport.trust_score}`, { x: 24, y: 720, size: 12, font: bodyFont });
    page.drawText(`Registration No: ${passport.registration_number ?? "—"}`, { x: 24, y: 700, size: 12, font: bodyFont });
    page.drawText(`Industry: ${passport.industry ?? "—"}`, { x: 24, y: 682, size: 12, font: bodyFont });
    page.drawText(`Location: ${passport.municipality ?? ""}, ${passport.province ?? ""}`, { x: 24, y: 664, size: 12, font: bodyFont });
    page.drawText(`Passport ID: ${passport.passport_code}`, { x: 24, y: 40, size: 9, font: bodyFont, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(
      "Full verification detail, QR code and document appendix pending upgrade to the HTML-render pipeline (see file header).",
      { x: 24, y: 620, size: 10, font: bodyFont, color: rgb(0.4, 0.4, 0.4) }
    );

    const pdfBytes = await pdfDoc.save();
    const path = `${passport.owner_id}/${passport_id}-${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage.from("generated-pdfs").upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadErr) throw uploadErr;

    return json({ path });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
