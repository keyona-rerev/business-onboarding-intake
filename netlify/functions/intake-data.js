const { Client } = require("pg");
const { sessionFromEvent } = require("./_lib/auth");
const { FIELDS, isFieldSatisfied } = require("./_lib/fields");

// Powers the post-login dashboard. Unlike completeness.js (which only ever
// reports what's *missing*), this returns every field's actual value so the
// dashboard can show clients what's already been captured, not just gaps.
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

  const sectionOrder = [];
  const sectionMap = {};

  for (const f of FIELDS) {
    if (!sectionMap[f.section]) {
      sectionMap[f.section] = { name: f.section, fields: [] };
      sectionOrder.push(f.section);
    }
    const value = record[f.key] || null;
    const filled = isFieldSatisfied(f, value);
    sectionMap[f.section].fields.push({
      key: f.key,
      label: f.label,
      required: f.required,
      value,
      filled,
    });
  }

  // Section completion counts every field in the section, required and
  // optional alike — matches completeness.js. A section isn't "done" just
  // because its required fields are filled; the optional ones count too.
  const sections = sectionOrder.map((name) => {
    const s = sectionMap[name];
    const filledCount = s.fields.filter((f) => f.filled).length;
    const pct = Math.round((filledCount / s.fields.length) * 100);
    return { name: s.name, fields: s.fields, sectionPct: pct };
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      businessName: record.business_name || session.businessName,
      status: record.status,
      completenessPct: record.completeness_pct || 0,
      brand: {
        primaryColor: record.primary_color || null,
        secondaryColor: record.secondary_color || null,
        accentColor: record.accent_color || null,
        logoUrl: record.logo_url || null,
        fontNames: record.font_names || null,
      },
      sections,
    }),
  };
};
