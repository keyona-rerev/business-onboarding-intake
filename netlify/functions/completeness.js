const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { sessionFromEvent } = require("./_lib/auth");
const { REQUIRED_FIELDS, isFieldSatisfied } = require("./_lib/fields");

const wayfinder = createClient(
  process.env.WAYFINDER_SUPABASE_URL,
  process.env.WAYFINDER_SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  const session = sessionFromEvent(event);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not logged in" }) };
  }

  const client = new Client({ connectionString: session.connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let record;
  try {
    const { rows } = await client.query("select * from intake_data where id = 1");
    record = rows[0];
  } finally {
    await client.end();
  }

  const missing = REQUIRED_FIELDS.filter((f) => !isFieldSatisfied(f, record[f.key]));
  const filledCount = REQUIRED_FIELDS.length - missing.length;
  const pct = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);

  // Deterministic, not AI-judged — a field either meets its bar or it
  // doesn't (and for source_feeds, that bar is a minimum count, not just
  // "non-empty"). Cache the result on the row so the "spin up" tooling and
  // any future dashboard can read it without recomputing.
  const missingJson = JSON.stringify(missing.map((f) => f.label));
  const client2 = new Client({ connectionString: session.connectionString, ssl: { rejectUnauthorized: false } });
  await client2.connect();
  try {
    await client2.query(
      "update intake_data set completeness_pct = $1, missing_fields = $2, updated_at = now() where id = 1",
      [pct, missingJson]
    );
  } finally {
    await client2.end();
  }

  // Keep Wayfinder's mapping row in sync so Keyona can see completeness
  // across all businesses without logging into each one individually.
  await wayfinder
    .from("business_intake_instances")
    .update({ completeness_pct: pct, updated_at: new Date().toISOString() })
    .eq("id", session.businessId);

  return {
    statusCode: 200,
    body: JSON.stringify({
      completenessPct: pct,
      missing: missing.map((f) => ({ label: f.label, section: f.section })),
      readyToGraduate: pct === 100,
    }),
  };
};
