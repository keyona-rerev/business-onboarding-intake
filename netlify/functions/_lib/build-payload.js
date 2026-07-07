const { FIELDS, isFieldSatisfied } = require("./fields");

// Turns a raw intake_data row into the exact shape the dashboard consumes.
// Single source of truth so the cache-populating path (in intake-data.js)
// and the live path can never quietly diverge.
function buildDashboardPayload(record, fallbackBusinessName) {
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

  const sections = sectionOrder.map((name) => {
    const s = sectionMap[name];
    const filledCount = s.fields.filter((f) => f.filled).length;
    const pct = Math.round((filledCount / s.fields.length) * 100);
    return { name: s.name, fields: s.fields, sectionPct: pct };
  });

  return {
    businessName: record.business_name || fallbackBusinessName,
    status: record.status,
    completenessPct: record.completeness_pct || 0,
    websiteUrl: record.website_url || null,
    brand: {
      backgroundColor: record.color_background || null,
      accentColor: record.color_accent || null,
      highlightColor: record.color_highlight || null,
      sparingAccentColor: record.color_sparing_accent || null,
      logoUrl: record.logo_url || null,
      fontNames: record.font_names || null,
    },
    sections,
  };
}

module.exports = { buildDashboardPayload };
