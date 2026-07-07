const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { sessionFromEvent } = require("./_lib/auth");
const { ensureSchema } = require("./_lib/schema-ensure");
const { buildDashboardPayload } = require("./_lib/build-payload");

const wayfinder = createClient(
  process.env.WAYFINDER_SUPABASE_URL,
  process.env.WAYFINDER_SUPABASE_ANON_KEY
);

// The real query, straight to this business's own Railway Postgres.
// Also repopulates the Wayfinder cache so the next cache-first read is fast.
async function liveFetch(session) {
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

  const payload = buildDashboardPayload(record, session.businessName);

  await wayfinder
    .from("business_intake_instances")
    .update({ cached_payload: payload })
    .eq("id", session.businessId);

  return payload;
}

// Powers the post-login dashboard. Cache-first: reads the last-known
// payload from Wayfinder instead of round-tripping to Railway Postgres on
// every single page load (that round trip is what caused the visible
// load flicker). Every write endpoint invalidates this cache the moment it
// changes anything, so a cache hit here always means "nothing's changed
// since the last real read," not "possibly stale forever."
//
// Pass ?fresh=true to skip the cache and force a live read — used by the
// dashboard for its background revalidation after the fast paint.
exports.handler = async (event) => {
  const session = sessionFromEvent(event);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not logged in" }) };
  }

  const forceFresh = event.queryStringParameters && event.queryStringParameters.fresh === "true";

  if (!forceFresh) {
    const { data, error } = await wayfinder
      .from("business_intake_instances")
      .select("cached_payload")
      .eq("id", session.businessId)
      .single();

    if (!error && data && data.cached_payload) {
      return { statusCode: 200, body: JSON.stringify(data.cached_payload) };
    }
    // No cache yet (first load ever for this business) — fall through to
    // a live fetch, which also populates the cache for next time.
  }

  const payload = await liveFetch(session);
  return { statusCode: 200, body: JSON.stringify(payload) };
};
