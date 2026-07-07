const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { sessionFromEvent } = require("./_lib/auth");

const wayfinder = createClient(
  process.env.WAYFINDER_SUPABASE_URL,
  process.env.WAYFINDER_SUPABASE_ANON_KEY
);

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

// Logos are uploaded directly by the business, never scraped — extraction
// only ever handles colors. Stored in the shared "business-logos" bucket
// under this business's own id, then the public URL gets written into
// THAT business's own Railway Postgres (not Wayfinder), same as any other
// intake field.
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  const session = sessionFromEvent(event);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not logged in" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const { base64, mimeType } = body;
  if (!base64 || !mimeType) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing file data" }) };
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Logo must be PNG, JPG, WEBP, or SVG" }) };
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_BYTES) {
    return { statusCode: 400, body: JSON.stringify({ error: "Logo file is too large (5MB max)" }) };
  }

  const ext = EXT_BY_MIME[mimeType];
  const path = `${session.businessId}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await wayfinder.storage
    .from("business-logos")
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    return { statusCode: 502, body: JSON.stringify({ error: "Upload failed: " + uploadError.message }) };
  }

  const { data: publicUrlData } = wayfinder.storage.from("business-logos").getPublicUrl(path);
  const logoUrl = publicUrlData.publicUrl;

  const client = new Client({ connectionString: session.connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("update intake_data set logo_url = $1, updated_at = now() where id = 1", [logoUrl]);
  } finally {
    await client.end();
  }

  // Invalidate the dashboard cache — the logo just changed.
  await wayfinder
    .from("business_intake_instances")
    .update({ cached_payload: null, updated_at: new Date().toISOString() })
    .eq("id", session.businessId);

  return { statusCode: 200, body: JSON.stringify({ success: true, logoUrl }) };
};
