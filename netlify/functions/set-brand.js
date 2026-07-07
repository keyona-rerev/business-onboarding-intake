const { Client } = require("pg");
const { sessionFromEvent } = require("./_lib/auth");
const { ensureSchema } = require("./_lib/schema-ensure");

const HEX_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

// Saves brand colors and the website URL after the person has confirmed
// (or hand-typed) them — extract-brand-colors.js only ever suggests
// candidates, this is the one function that actually writes them.
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

  const { primaryColor, secondaryColor, accentColor, websiteUrl } = body;
  for (const [label, value] of [["primaryColor", primaryColor], ["secondaryColor", secondaryColor], ["accentColor", accentColor]]) {
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
         primary_color = coalesce($1, primary_color),
         secondary_color = coalesce($2, secondary_color),
         accent_color = coalesce($3, accent_color),
         website_url = coalesce($4, website_url),
         updated_at = now()
       where id = 1`,
      [primaryColor || null, secondaryColor || null, accentColor || null, websiteUrl || null]
    );
  } finally {
    await client.end();
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
