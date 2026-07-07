const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const { signSession } = require("./_lib/auth");

// Wayfinder is the router: it holds the mapping from a business's login
// to that business's own disposable Railway Postgres connection string.
// This function never touches business data directly, only the mapping.
const wayfinder = createClient(
  process.env.WAYFINDER_SUPABASE_URL,
  process.env.WAYFINDER_SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let username, password;
  try {
    ({ username, password } = JSON.parse(event.body));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!username || !password) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing username or password" }) };
  }

  const { data, error } = await wayfinder
    .from("business_intake_instances")
    .select("id, business_name, password_hash, railway_connection_string, status")
    .eq("login_username", username.trim())
    .single();

  if (error || !data) {
    // Same generic error whether the username doesn't exist or the password
    // is wrong, so a login attempt can't be used to enumerate business names.
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid login" }) };
  }

  const valid = await bcrypt.compare(password, data.password_hash);
  if (!valid) {
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid login" }) };
  }

  const token = signSession({
    businessId: data.id,
    businessName: data.business_name,
    connectionString: data.railway_connection_string,
  });

  const cookie = `intake_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;

  return {
    statusCode: 200,
    headers: { "Set-Cookie": cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, businessName: data.business_name, status: data.status }),
  };
};
