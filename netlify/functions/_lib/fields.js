// Single source of truth for the intake checklist.
// Used by both intake-submit (extraction target), completeness (scoring),
// and intake-data (dashboard display), so all three can never silently
// drift apart.

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
  { key: "forbidden_claims", label: "Forbidden claims (if in a regulated industry)", section: "Voice & Hard Rules", required: false },

  { key: "formats", label: "Content formats to publish", section: "Content Structure", required: true },
  { key: "content_lanes", label: "Content lanes / recurring themes (2-3)", section: "Content Structure", required: true },
  { key: "content_natures", label: "Content nature / classification tiers", section: "Content Structure", required: false },

  // Three discrete required URL fields instead of one lumped-together list —
  // each is validated as an actual URL on save, nothing else is accepted.
  { key: "source_url_1", label: "Source 1 (URL)", section: "Sources", required: true },
  { key: "source_url_2", label: "Source 2 (URL)", section: "Sources", required: true },
  { key: "source_url_3", label: "Source 3 (URL)", section: "Sources", required: true },

  { key: "posting_timezone", label: "Timezone", section: "Posting Defaults", required: true },
  { key: "posting_time", label: "Preferred posting time", section: "Posting Defaults", required: true },
  { key: "posting_cadence", label: "Posting cadence (times per week)", section: "Posting Defaults", required: true },
];

const REQUIRED_FIELDS = FIELDS.filter((f) => f.required);

const SOURCE_URL_KEYS = new Set(["source_url_1", "source_url_2", "source_url_3"]);

// Deliberately generic starter taxonomy for "content nature" — the same
// shape of categories any content-marketing program would recognize
// (stat, framework, story, etc.), with anything Prismm-specific left out
// since this list has to work for any business onboarded through this
// tool, not just Prismm. Keyona can swap this for a business-specific list
// at any time; it's just a starting point so clients aren't picking blind.
const CONTENT_NATURE_OPTIONS = [
  "Stat / Data Point",
  "Field Note",
  "Framework",
  "Contrarian",
  "Case Study",
  "Trend Take",
  "Explainer",
  "Behind the Build",
  "Story",
  "Announcement",
  "News Reaction",
];

// Same rationale as content nature above — generic starter list, swappable.
const FORMAT_OPTIONS = [
  "LinkedIn Post",
  "Blog Article",
  "Newsletter",
  "Video Script",
  "Instagram Post",
  "Twitter/X Post",
  "Case Study",
  "Whitepaper",
  "Podcast Script",
  "Email Sequence",
];

// Common IANA zones, US-first (most clients onboarded so far are US-based)
// with a few international ones. Kept short and mirrored on the frontend
// exactly like FONT_OPTIONS and CONTENT_NATURE_OPTIONS.
const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "Europe/London",
  "Europe/Berlin",
  "UTC",
];

const CADENCE_OPTIONS = [
  "1x per week",
  "2x per week",
  "3x per week",
  "4x per week",
  "5x per week (weekdays)",
  "Daily",
  "2x per day",
];

// Accepts with or without a scheme (adds https:// before validating if
// missing) so "sistergolfonline.com" and "https://sistergolfonline.com"
// both pass, but plain text with no domain shape gets rejected outright.
function isValidUrl(value) {
  if (!value || typeof value !== "string") return false;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    return /\./.test(parsed.hostname) && parsed.hostname.length > 3;
  } catch {
    return false;
  }
}

// Values for list-shaped fields are stored as comma-separated strings (see
// intake-submit's extraction prompt). This counts real entries, ignoring
// stray commas/whitespace.
function countListEntries(raw) {
  if (!raw) return 0;
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;
}

// Whether a field counts as "done" for completeness purposes. Almost every
// field just needs a non-empty value, but the three source fields have
// their own bar: a real URL, not just any text.
function isFieldSatisfied(field, value) {
  if (value === null || value === undefined || value === "") return false;
  if (SOURCE_URL_KEYS.has(field.key)) {
    return isValidUrl(value);
  }
  return true;
}

module.exports = {
  FIELDS,
  REQUIRED_FIELDS,
  isFieldSatisfied,
  countListEntries,
  isValidUrl,
  SOURCE_URL_KEYS,
  CONTENT_NATURE_OPTIONS,
  FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
  CADENCE_OPTIONS,
};
