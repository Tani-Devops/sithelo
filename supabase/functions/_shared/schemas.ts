// ====================================================================
// _shared/schemas.ts
// Shared Zod schemas for edge function request bodies. Validate the
// payload BEFORE touching the database — reject unknown fields,
// oversized strings, malformed UUIDs, invalid enums, before any of it
// reaches a query. `.strict()` on every object rejects unknown fields
// rather than silently ignoring them, which matters here specifically
// because silently-ignored extra fields (like an old `admin_id` client
// still sending it out of habit) are exactly how the previous
// vulnerabilities went unnoticed for a while.
// ====================================================================
import { z } from "https://esm.sh/zod@3.23.8";

const uuid = z.string().uuid();
const shortText = (max = 200) => z.string().trim().min(1).max(max);
const longText = (max = 5000) => z.string().trim().max(max).optional();

export const createOpportunitySchema = z.object({
  title: shortText(200),
  opportunity_type: z.enum(["procurement", "funding", "enterprise_development", "partnership"]),
  category: shortText(100).optional(),
  description: longText(5000),
  province: z.enum([
    "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
    "Mpumalanga", "North West", "Northern Cape", "Western Cape",
  ]).optional(),
  municipality: shortText(100).optional(),
  businesses_needed: z.number().int().positive().max(100000).optional(),
  value_estimate: z.number().nonnegative().max(1_000_000_000_000).optional(),
  closing_date: z.string().date().optional(),
  status: z.enum(["draft", "active", "closed", "awarded", "cancelled"]).optional(),
  requirements: z.record(z.unknown()).optional(),
  institution_id: uuid.optional(), // only honored for admin callers — see create-opportunity/index.ts
}).strict();

export const adminVerificationSchema = z.object({
  verification_id: uuid,
  decision: z.enum(["approve", "reject"]),
  notes: longText(1000),
}).strict();

export const verifyBusinessPassportSchema = z.object({
  passport_id: uuid,
}).strict();

export const generatePassportPdfSchema = z.object({
  passport_id: uuid,
}).strict();

export const bulkImportSchema = z.object({
  // The prior regex (/^[a-zA-Z0-9_\-./]+$/) allowed dots and slashes
  // freely, which means "../../etc/passwd" or "admin/../secret" both
  // passed it — every character in a path-traversal payload is in that
  // allowed set. Found by direct inspection this pass. Fixed by
  // rejecting ".." sequences, leading "/", and "//" explicitly, and
  // requiring the path to start with the fixed "imports/" namespace
  // (matching the pattern documented for the bulk-imports bucket) rather
  // than accepting an arbitrary path shape at all.
  csv_storage_path: z.string()
    .trim()
    .min(1)
    .max(500)
    .regex(/^[a-zA-Z0-9_\-./]+$/, "Invalid storage path characters")
    .refine((p) => !p.includes(".."), "Path traversal sequences are not allowed")
    .refine((p) => !p.startsWith("/"), "Absolute paths are not allowed")
    .refine((p) => !p.includes("//"), "Double slashes are not allowed")
    .refine((p) => p.startsWith("imports/"), 'Path must be within the "imports/" namespace'),
}).strict();

export const notificationRequestSchema = z.object({
  recipient_id: uuid,
  category: z.enum(["verification", "invitation", "application", "approval", "document_expiry", "trust_score"]),
  title: shortText(200),
  body: longText(2000),
  channels: z.array(z.enum(["in_app", "email", "whatsapp", "sms"])).max(4).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export const matchBusinessesSchema = z.object({
  opportunity_id: uuid,
}).strict();

export const calculateTrustScoreSchema = z.object({
  passport_id: uuid,
}).strict();

/**
 * Parses and validates a request body against a schema. Returns either
 * the typed, validated data or a ready-to-return 400 Response — callers
 * do `const parsed = await parseBody(req, schema); if (parsed instanceof
 * Response) return parsed;` to keep every function's error shape
 * consistent.
 */
export async function parseBody<T>(req: Request, schema: z.ZodSchema<T>): Promise<T | Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Request body must be valid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request payload", details: result.error.flatten().fieldErrors }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  return result.data;
}
