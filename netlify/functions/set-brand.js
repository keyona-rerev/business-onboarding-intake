const { Client } = require("pg");
const { sessionFromEvent } = require("./_lib/auth");
const { ensureSchema } = require("./_lib/schema-ensure");

const HEX_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

// Saves the 4 named brand colors and the website URL after the person has
// confirmed (or hand-typed) them — extract-brand-colors.js only ever
// suggests candidates, this is the one function that actually writes.
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

  const { colorBackground, colorAccent, colorHighlight, colorSparingAccent, websiteUrl } = body;
  for (const [label, value] of [
    ["colorBackground", colorBackground],
    ["colorAccent", colorAccent],
    ["colorHighlight", colorHighlight],
    ["colorSparingAccent", colorSparingAccent],
  ]) {
    if (value && !HEX_RE.test(value)) {
      return { statusCode: 400, body: JSON.stringify({ error: `${label} isn't a valid hex color` }) };
    }
  }

  const client = new Client({ connectionString: session.connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await ensureSchema(client);
    await client.query(
      `update intake_data set
         color_background = coalesce($1, color_background),
         color_accent = coalesce($2, color_accent),
         color_highlight = coalesce($3, color_highlight),
         color_sparing_accent = coalesce($4, color_sparing_accent),
         website_url = coalesce($5, website_url),
         updated_at = now()
       where id = 1`,
      [colorBackground || null, colorAccent || null, colorHighlight || null, colorSparingAccent || null, websiteUrl || null]
    );
  } finally {
    await client.end();
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
