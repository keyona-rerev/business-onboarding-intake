const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { sessionFromEvent } = require("./_lib/auth");
const { FIELDS } = require("./_lib/fields");
const { scoreRecord } = require("./_lib/scoring");
const { ensureSchema } = require("./_lib/schema-ensure");

const wayfinder = createClient(
  process.env.WAYFINDER_SUPABASE_URL,
  process.env.WAYFINDER_SUPABASE_ANON_KEY
);

const VALID_KEYS = new Set(FIELDS.map((f) => f.key));

// Lets the dashboard edit a single field directly, in place, instead of
// funneling every correction back through the paste-and-extract flow on
// intake.html. Same underlying row, same completeness rule, just a more
// direct path to it for anyone (Keyona or the client) looking at the cards
// and wanting to fix one thing without re-writing a paragraph.
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  const session = sessionFromEvent(event);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not logged in" }) };
  }

  let key, value;
  try {
    ({ key, value } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  // Whitelist check before the key ever touches a query string — this is
  // what makes interpolating it into the SQL below safe.
  if (!VALID_KEYS.has(key)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Unknown field" }) };
  }

  const client = new Client({ connectionString: session.connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let record;
  try {
    await ensureSchema(client);
    await client.query(`update intake_data set ${key} = $1, updated_at = now() where id = 1`, [value ?? null]);
    const { rows } = await client.query("select * from intake_data where id = 1");
    record = rows[0];
  } finally {
    await client.end();
  }

  const { pct, missing } = scoreRecord(record);

  await client.connect().catch(() => {}); // no-op guard; client already ended above intentionally left connectionless below
  const client2 = new Client({ connectionString: session.connectionString, ssl: { rejectUnauthorized: false } });
  await client2.connect();
  try {
    await client2.query(
      "update intake_data set completeness_pct = $1, missing_fields = $2 where id = 1",
      [pct, JSON.stringify(missing.map((f) => ({ label: f.label, section: f.section, required: f.required })))]
    );
  } finally {
    await client2.end();
  }

  await wayfinder
    .from("business_intake_instances")
    .update({ completeness_pct: pct, updated_at: new Date().toISOString() })
    .eq("id", session.businessId);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, value: record[key], completenessPct: pct }),
  };
};
