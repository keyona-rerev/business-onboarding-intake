const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { sessionFromEvent } = require("./_lib/auth");
const { FIELDS, SOURCE_URL_KEYS, isValidUrl, CONTENT_NATURE_OPTIONS } = require("./_lib/fields");
const { ensureSchema } = require("./_lib/schema-ensure");

const wayfinder = createClient(
  process.env.WAYFINDER_SUPABASE_URL,
  process.env.WAYFINDER_SUPABASE_ANON_KEY
);

const EXTRACTION_PROMPT = `You are extracting structured business setup information from a raw, unstructured dump of text a business owner wrote about their business, audience, and content needs.

Return ONLY a JSON object (no markdown fences, no preamble) with these exact keys. Use null for anything not mentioned or not inferable — never guess or invent a value that was not actually stated.

${FIELDS.map((f) => `- ${f.key}: ${f.label}`).join("\n")}

For list-shaped fields (channels, formats, content_lanes, tone_descriptors, words_to_avoid), return a comma-separated string, not an array.

For source_url_1, source_url_2, and source_url_3: only fill these if the text contains an actual URL (a real web address, not just a business or publication name). If fewer than 3 real URLs are present, leave the remaining ones null — never invent a URL.

For content_natures: only use values from this exact list, comma-separated, choosing whichever apply: ${CONTENT_NATURE_OPTIONS.join(", ")}. Leave null if none clearly apply.

Text to extract from:
"""
{{RAW_TEXT}}
"""`;

async function extractFields(rawText) {
  const prompt = EXTRACTION_PROMPT.replace("{{RAW_TEXT}}", rawText);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const textBlock = data.content.find((b) => b.type === "text");
  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const session = sessionFromEvent(event);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not logged in" }) };
  }

  let rawText;
  try {
    ({ rawText } = JSON.parse(event.body));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!rawText || rawText.trim().length < 20) {
    return { statusCode: 400, body: JSON.stringify({ error: "Paste more detail before submitting." }) };
  }

  let extracted;
  try {
    extracted = await extractFields(rawText);
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "Extraction failed", details: e.message }) };
  }

  const client = new Client({ connectionString: session.connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await ensureSchema(client);

    // Only overwrite a field if the new extraction actually found something —
    // a second paste (e.g. answering a gap report) should fill gaps, not
    // blank out fields that were already captured on a previous pass.
    // Source fields get an extra bar: even if the model returned something,
    // it only gets saved if it's actually a URL — garbage never lands in
    // the database just because the model guessed at one.
    const setClauses = [];
    const values = [];
    let i = 1;
    for (const f of FIELDS) {
      const val = extracted[f.key];
      if (val === null || val === undefined || val === "") continue;
      if (SOURCE_URL_KEYS.has(f.key) && !isValidUrl(val)) continue;
      setClauses.push(`${f.key} = $${i}`);
      values.push(val);
      i++;
    }
    setClauses.push(`raw_intake_dump = coalesce(raw_intake_dump, '') || $${i} || E'\\n\\n---\\n\\n'`);
    values.push(rawText);
    i++;
    setClauses.push(`updated_at = now()`);

    await client.query(
      `update intake_data set ${setClauses.join(", ")} where id = 1`,
      values
    );

    const { rows } = await client.query("select * from intake_data where id = 1");

    // Invalidate the dashboard cache — fields just changed, so the next
    // dashboard read needs a live fetch to reflect it.
    await wayfinder
      .from("business_intake_instances")
      .update({ cached_payload: null, updated_at: new Date().toISOString() })
      .eq("id", session.businessId);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, record: rows[0] }),
    };
  } finally {
    await client.end();
  }
};
