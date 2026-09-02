// ====================================================================
// verify-business-passport
// Validates a passport's compliance completeness and returns a
// structured verification report + "recommended next step" — the
// logic powering the "Ready For" / "Recommended Next Step" panel on
// the Business Passport page.
//
// SECURITY: authorization now uses has_passport_relationship() (migration
// 015) instead of a blanket is_published check — an institution needs an
// actual shortlist/application relationship with this business, not just
// "the passport happens to be published," consistent with
// get_passport_detail() and list_passport_documents(). Previously this
// function granted any institution access to any published passport's
// verification detail, which was a real inconsistency with the rest of
// the graduated-access model — found and fixed this pass, not assumed
// from a prior description.
//
// Also fixed this pass: a duplicate `const supabase = createClient(...)`
// declaration in the same block scope, which would have failed at Deno
// deploy/runtime. Edge functions are outside `tsc --noEmit`'s scope
// (excluded in tsconfig.json), so this went undetected by the typecheck
// this repo otherwise relies on as a safety net — worth remembering that
// "tsc passed" has never covered this directory.
//
// Invoke: POST { passport_id: string }
// Authorization: Bearer <the calling user's access token>
// This does NOT itself mark documents/verifications as verified — that
// is a human decision made via admin-verification. This function reads
// current state and produces a readiness report.
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { requireRole } from "../_shared/auth.ts";
import { verifyBusinessPassportSchema, parseBody } from "../_shared/schemas.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REQUIRED_FOR_PROCUREMENT = ["cipc", "sars", "vat", "municipal_supplier"];
const REQUIRED_FOR_FUNDING = ["cipc", "sars", "bank"];
const REQUIRED_FOR_EXPORT = ["cipc", "sars", "vat", "bbbee"];

Deno.serve(async (req) => {
  const auth = await requireRole(req, ["entrepreneur", "institution", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const parsed = await parseBody(req, verifyBusinessPassportSchema);
    if (parsed instanceof Response) return parsed;
    const { passport_id } = parsed;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: passport } = await supabase
      .from("business_passports")
      .select("owner_id, is_published")
      .eq("id", passport_id)
      .single();
    if (!passport) return json({ error: "Passport not found" }, 404);

    const isOwner = passport.owner_id === auth.user.id;
    const isAdmin = auth.user.role === "admin";

    let isAuthorizedInstitution = false;
    if (auth.user.role === "institution" && auth.user.institutionId && passport.is_published) {
      const { data: hasRelationship } = await supabase.rpc("has_passport_relationship", {
        p_institution_id: auth.user.institutionId,
        p_passport_id: passport_id,
      });
      isAuthorizedInstitution = hasRelationship === true;
    }

    if (!isOwner && !isAdmin && !isAuthorizedInstitution) {
      return json({ error: "Not authorized to view this passport's verification detail" }, 403);
    }

    const { data: verifications, error: vErr } = await supabase
      .from("verifications")
      .select("verification_type, status, expiry_date")
      .eq("passport_id", passport_id);
    if (vErr) throw vErr;

    const verifiedTypes = new Set(
      (verifications ?? [])
        .filter((v) => v.status === "verified" && (!v.expiry_date || new Date(v.expiry_date) > new Date()))
        .map((v) => v.verification_type)
    );

    const readyFor = (requirements: string[]) => requirements.every((r) => verifiedTypes.has(r));

    const readiness = {
      procurement: readyFor(REQUIRED_FOR_PROCUREMENT),
      funding: readyFor(REQUIRED_FOR_FUNDING),
      export: readyFor(REQUIRED_FOR_EXPORT),
    };

    const missingCounts: Record<string, number> = {};
    for (const [category, reqs] of [
      ["procurement", REQUIRED_FOR_PROCUREMENT],
      ["funding", REQUIRED_FOR_FUNDING],
      ["export", REQUIRED_FOR_EXPORT],
    ] as [string, string[]][]) {
      if (readiness[category as keyof typeof readiness]) continue;
      for (const r of reqs) {
        if (!verifiedTypes.has(r)) missingCounts[r] = (missingCounts[r] ?? 0) + 1;
      }
    }
    const recommended = Object.entries(missingCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return json({
      passport_id,
      verified_types: Array.from(verifiedTypes),
      ready_for: readiness,
      recommended_next_step: recommended,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
