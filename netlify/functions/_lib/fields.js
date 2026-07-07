// Single source of truth for the intake checklist.
// Used by both intake-submit (extraction target) and completeness (scoring),
// so the two can never silently drift apart.

const FIELDS = [
  { key: "business_name", label: "Business name", section: "Business Identity", required: true },
  { key: "business_description", label: "One-paragraph business description", section: "Business Identity", required: true },
  { key: "industry", label: "Industry / business type", section: "Business Identity", required: true },
  { key: "primary_color", label: "Primary brand color", section: "Business Identity", required: false },
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

  { key: "source_feeds", label: "Starting newsletters / RSS feeds / sites", section: "Sources", required: false },

  { key: "posting_timezone", label: "Timezone", section: "Posting Defaults", required: true },
  { key: "posting_time", label: "Preferred posting time", section: "Posting Defaults", required: true },
  { key: "posting_cadence", label: "Posting cadence (times per week)", section: "Posting Defaults", required: true },
];

const REQUIRED_FIELDS = FIELDS.filter((f) => f.required);

module.exports = { FIELDS, REQUIRED_FIELDS };
