// Single source of truth for the intake checklist.
// Used by both intake-submit (extraction target), completeness (scoring),
// and intake-data (dashboard display), so all three can never silently
// drift apart.

const MIN_SOURCE_EXAMPLES = 3;

const FIELDS = [
  { key: "business_name", label: "Business name", section: "Business Identity", required: true },
  { key: "business_description", label: "One-paragraph business description", section: "Business Identity", required: true },
  { key: "industry", label: "Industry / business type", section: "Business Identity", required: true },
  { key: "color_background", label: "Background color", section: "Business Identity", required: false },
  { key: "color_accent", label: "Accent color", section: "Business Identity", required: false },
  { key: "color_highlight", label: "Highlight color", section: "Business Identity", required: false },
  { key: "color_sparing_accent", label: "Sparing accent color", section: "Business Identity", required: false },
  { key: "logo_url", label: "Logo URL", section: "Business Identity", required: false },
  { key: "font_names", label: "Brand fonts", section: "Business Identity", required: false },

  { key: "audience_role", label: "Who reads this (role, industry, seniority)", section: "Audience", required: true },
  { key: "audience_pain_points", label: "Audience pain points / what they care about", section: "Audience", required: true },
  { key: "fit_criteria", label: "Fit criteria (what makes content on-target vs off-target)", section: "Audience", required: true },
  { key: "channels", label: "Channels they publish to", section: "Audience", required: true },
  { key: "audience_sophistication", label: "Audience sophistication / tone expectation", section: "Audience", required: false },

  { key: "tone_descriptors", label: "Tone descriptors (3-5 words)", section: "Voice & Hard Rules", required: true },
  { key: "words_to_avoid", label: "Words/phrases to avoid", section: "Voice & Hard Rules", required: false },
  { key: "forbidden_claims", label: "Forbidden claims (required if regulated industry)", section: "Voice & Hard Rules", required: false },

  { key: "formats", label: "Content formats to publish", section: "Content Structure", required: true },
  { key: "content_lanes", label: "Content lanes / recurring themes (2-3)", section: "Content Structure", required: true },
  { key: "content_natures", label: "Content nature / classification tiers", section: "Content Structure", required: false },

  {
    key: "source_feeds",
    label: `At least ${MIN_SOURCE_EXAMPLES} example sources (paste full articles or just drop the URLs) that show the kind of content the system should go after`,
    section: "Sources",
    required: true,
  },

  { key: "posting_timezone", label: "Timezone", section: "Posting Defaults", required: true },
  { key: "posting_time", label: "Preferred posting time", section: "Posting Defaults", required: true },
  { key: "posting_cadence", label: "Posting cadence (times per week)", section: "Posting Defaults", required: true },
];

const REQUIRED_FIELDS = FIELDS.filter((f) => f.required);

// Values for list-shaped fields are stored as comma-separated strings (see
// intake-submit's extraction prompt). This counts real entries, ignoring
// stray commas/whitespace, so "3 items" actually means 3 items.
function countListEntries(raw) {
  if (!raw) return 0;
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;
}

// Whether a field counts as "done" for completeness purposes. Almost every
// field just needs a non-empty value, but source_feeds has its own bar:
// Keyona wants a minimum number of example sources, not just one, so a
// single pasted URL shouldn't read as "Sources: complete."
function isFieldSatisfied(field, value) {
  if (value === null || value === undefined || value === "") return false;
  if (field.key === "source_feeds") {
    return countListEntries(value) >= MIN_SOURCE_EXAMPLES;
  }
  return true;
}

module.exports = { FIELDS, REQUIRED_FIELDS, isFieldSatisfied, countListEntries, MIN_SOURCE_EXAMPLES };
