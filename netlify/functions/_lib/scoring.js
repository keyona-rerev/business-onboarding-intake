const { FIELDS, isFieldSatisfied } = require("./fields");

// Single place that turns a raw intake_data row into a completeness score.
// Used by completeness.js, update-field.js (so an inline edit can return a
// fresh percentage without a second round trip), and anywhere else that
// needs "how done is this business" going forward.
function scoreRecord(record) {
  const missing = FIELDS.filter((f) => !isFieldSatisfied(f, record[f.key]));
  const filledCount = FIELDS.length - missing.length;
  const pct = Math.round((filledCount / FIELDS.length) * 100);
  return { pct, missing };
}

module.exports = { scoreRecord };
