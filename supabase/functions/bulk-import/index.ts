// ====================================================================
// bulk-import
// Admin-only: imports businesses from a CSV uploaded to storage first.
//
// Atomicity model (see migration 013 for the full reasoning): whole-file
// atomicity is not achievable because inviteUserByEmail() is an external
// Auth API call, not something a SQL transaction can wrap. What this
// function DOES guarantee:
//   1. The ENTIRE file is structurally validated before a single invite
//      is sent or a single row is written — a malformed row anywhere in
//      the file rejects the whole import up front, with a full report,
//      rather than partially processing and failing midway.
//   2. Each row's database writes (profile update + passport insert +
//      activity log) happen in one transaction via create_imported_business()
//      — no row can end up half-written.
// ====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Papa from "https://esm.sh/papaparse@5.4.1";
import { requireRole } from "../_shared/auth.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { bulkImportSchema, parseBody } from "../_shared/schemas.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REQUIRED_COLUMNS = [
  "business_name", "registration_number", "business_type", "industry",
  "province", "municipality", "owner_full_name", "owner_email", "owner_cell_number",
];

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_ROWS = 2000;
const MAX_FIELD_LENGTH = 500;
const VALID_BUSINESS_TYPES = ["sole_proprietor", "private_company", "close_corporation", "partnership", "npo", "cooperative"];
const VALID_PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return auth.response;
  const adminId = auth.user.id;

  const allowed = await checkRateLimit(`bulk-import:${adminId}`, 5, 3600, true); // fail closed — see _shared/rateLimit.ts
  if (!allowed) return rateLimitResponse();

  try {
    const parsed = await parseBody(req, bulkImportSchema);
    if (parsed instanceof Response) return parsed;
    const { csv_storage_path } = parsed;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: file, error: downloadErr } = await supabase.storage.from("bulk-imports").download(csv_storage_path);
    if (downloadErr || !file) return json({ error: "Could not read CSV from storage" }, 404);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return json({ error: `CSV exceeds maximum file size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` }, 400);
    }

    const text = await file.text();
    const parseResult = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      transform: (v: string) => sanitizeField(v.trim()),
    });

    if (parseResult.errors.length > 0) {
      return json({
        error: "CSV could not be parsed",
        details: parseResult.errors.slice(0, 10).map((e: { row: number; message: string }) => ({ row: e.row, message: e.message })),
      }, 400);
    }

    const rows = parseResult.data;
    if (rows.length === 0) return json({ error: "CSV is empty" }, 400);
    if (rows.length > MAX_ROWS) {
      return json({ error: `CSV exceeds maximum row count of ${MAX_ROWS} (has ${rows.length})` }, 400);
    }

    const headers = Object.keys(rows[0]);
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    if (missing.length > 0) return json({ error: `CSV missing columns: ${missing.join(", ")}` }, 400);

    // ---- PASS 1: validate the ENTIRE file before writing anything ----
    // No invite is sent, no row is written, until every row in the file
    // has passed structural validation. This is the "validate entire
    // file first" half of the atomicity requirement — the half that's
    // actually achievable.
    const validationErrors: { row: number; error: string }[] = [];
    const emailsInFile = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const err = validateRow(rows[i]);
      if (err) {
        validationErrors.push({ row: rowNumber, error: err });
        continue;
      }
      const email = rows[i].owner_email.toLowerCase();
      if (emailsInFile.has(email)) {
        validationErrors.push({ row: rowNumber, error: `Duplicate owner_email within this file: ${email}` });
      }
      emailsInFile.add(email);
    }

    if (validationErrors.length > 0) {
      return json({
        error: `CSV failed validation — ${validationErrors.length} row(s) invalid. No rows were imported.`,
        validation_errors: validationErrors.slice(0, 50),
        total_invalid: validationErrors.length,
      }, 400);
    }

    // Check against existing profiles up front too, so we skip
    // known-duplicate rows without ever inviting them.
    const { data: existingProfiles } = await supabase
      .from("profiles")
      .select("email")
      .in("email", Array.from(emailsInFile));
    const existingEmails = new Set((existingProfiles ?? []).map((p) => p.email.toLowerCase()));

    // ---- PASS 2: process each row (invite -> atomic DB write) ----
    const results = { created: 0, failed: 0, skipped_duplicates: 0, errors: [] as { row: number; error: string }[] };

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const row = rows[i];
      const email = row.owner_email.toLowerCase();

      if (existingEmails.has(email)) {
        results.skipped_duplicates++;
        continue;
      }

      try {
        const { data: authUser, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email);
        if (inviteErr) throw inviteErr;

        const { error: rpcErr } = await supabase.rpc("create_imported_business", {
          p_owner_id: authUser.user.id,
          p_full_name: row.owner_full_name,
          p_cell_number: row.owner_cell_number,
          p_business_name: row.business_name,
          p_registration_number: row.registration_number,
          p_business_type: row.business_type,
          p_industry: row.industry,
          p_province: row.province,
          p_municipality: row.municipality,
        });
        if (rpcErr) throw rpcErr;

        results.created++;
      } catch (rowErr) {
        results.failed++;
        results.errors.push({ row: rowNumber, error: (rowErr as Error).message });
      }
    }

    await supabase.from("audit_logs").insert({
      actor_id: adminId, action: "bulk_import.completed", entity_type: "bulk_import",
      metadata: {
        created: results.created, failed: results.failed,
        skipped_duplicates: results.skipped_duplicates, source: csv_storage_path,
      },
    });

    return json(results);
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function validateRow(row: Record<string, string>): string | null {
  if (!row.owner_email || !EMAIL_RE.test(row.owner_email)) return "owner_email is missing or not a valid email address";
  if (!row.business_name || row.business_name.length === 0) return "business_name is required";
  if (!row.owner_full_name || row.owner_full_name.length === 0) return "owner_full_name is required";
  if (row.business_type && !VALID_BUSINESS_TYPES.includes(row.business_type)) {
    return `business_type must be one of: ${VALID_BUSINESS_TYPES.join(", ")}`;
  }
  if (row.province && !VALID_PROVINCES.includes(row.province)) {
    return `province must be one of the 9 South African provinces (got "${row.province}")`;
  }
  for (const [key, value] of Object.entries(row)) {
    if (value && value.length > MAX_FIELD_LENGTH) {
      return `${key} exceeds maximum length of ${MAX_FIELD_LENGTH} characters`;
    }
  }
  return null;
}

// CSV/formula injection prevention: a cell starting with =, +, -, or @
// is interpreted as a formula by Excel/Google Sheets if this data is
// ever exported back to a spreadsheet. Prefixing with a single quote
// neutralizes it while keeping the visible text intact.
function sanitizeField(value: string): string {
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
