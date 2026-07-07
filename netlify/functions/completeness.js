const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { sessionFromEvent } = require("./_lib/auth");
const { scoreRecord } = require("./_lib/scoring");
const { ensureSchema } = require("./_lib/schema-ensure");

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
    await ensureSchema(client);
    const { rows } = await client.query("select * from intake_data where id = 1");
    record = rows[0];
  } finally {
    await client.end();
  }

  const { pct, missing } = scoreRecord(record);

  const missingJson = JSON.stringify(missing.map((f) => ({ label: f.label, section: f.section, required: f.required })));
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

  await wayfinder
    .from("business_intake_instances")
    .update({ completeness_pct: pct, updated_at: new Date().toISOString() })
    .eq("id", session.businessId);

  return {
    statusCode: 200,
    body: JSON.stringify({
      completenessPct: pct,
      missing: missing.map((f) => ({ label: f.label, section: f.section, required: f.required })),
      readyToGraduate: pct === 100,
    }),
  };
};
