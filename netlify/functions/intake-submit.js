const { Client } = require("pg");
const { sessionFromEvent } = require("./_lib/auth");
const { FIELDS } = require("./_lib/fields");

const EXTRACTION_PROMPT = `You are extracting structured business setup information from a raw, unstructured dump of text a business owner wrote about their business, audience, and content needs.

Return ONLY a JSON object (no markdown fences, no preamble) with these exact keys. Use null for anything not mentioned or not inferable — never guess or invent a value that was not actually stated.

${FIELDS.map((f) => `- ${f.key}: ${f.label}`).join("\n")}

For list-shaped fields (channels, formats, content_lanes, source_feeds, tone_descriptors, words_to_avoid), return a comma-separated string, not an array.

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
    // Only overwrite a field if the new extraction actually found something —
    // a second paste (e.g. answering a gap report) should fill gaps, not
    // blank out fields that were already captured on a previous pass.
    const setClauses = [];
    const values = [];
    let i = 1;
    for (const f of FIELDS) {
      if (extracted[f.key] !== null && extracted[f.key] !== undefined && extracted[f.key] !== "") {
        setClauses.push(`${f.key} = $${i}`);
        values.push(extracted[f.key]);
        i++;
      }
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
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, record: rows[0] }),
    };
  } finally {
    await client.end();
  }
};
