const { sessionFromEvent } = require("./_lib/auth");

// Pulls candidate brand colors from a business's own website so onboarding
// doesn't start from a blank color picker. Deliberately does NOT try to
// pull a logo — Keyona wants businesses uploading their own logo file
// directly, not something scraped and possibly wrong.
//
// Heuristic, not exact: fetches the page HTML plus up to 2 same-origin
// linked stylesheets, tallies every hex color found, and drops the most
// generic near-white/near-black/gray values that show up on almost any
// site and don't actually say anything about brand identity. Whatever's
// left is a reasonable starting guess — the person still confirms or
// overrides every value before it's saved, nothing here writes to the
// database on its own.
const GENERIC_HEX = new Set([
  "#fff", "#ffffff", "#000", "#000000", "#fafafa", "#f5f5f5", "#f0f0f0",
  "#e5e5e5", "#eee", "#eeeeee", "#ccc", "#cccccc", "#ddd", "#dddddd",
  "#333", "#333333", "#666", "#666666", "#999", "#999999",
]);

function extractHexColors(text) {
  const matches = text.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || [];
  const tally = {};
  for (const raw of matches) {
    const hex = raw.toLowerCase();
    if (GENERIC_HEX.has(hex)) continue;
    tally[hex] = (tally[hex] || 0) + 1;
  }
  return tally;
}

function resolveUrl(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  const session = sessionFromEvent(event);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not logged in" }) };
  }

  let url;
  try {
    ({ url } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Enter a full URL, starting with http:// or https://" }) };
  }

  let html;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; IntakeColorBot/1.0)" } });
    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: `Couldn't load that page (status ${res.status}). You can still enter colors manually below.` }) };
    }
    html = await res.text();
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "Couldn't reach that URL. You can still enter colors manually below." }) };
  }

  const tally = extractHexColors(html);

  // Pull colors from up to 2 same-origin linked stylesheets too — most of a
  // site's real brand palette usually lives in CSS, not inline in the HTML.
  const linkMatches = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)].slice(0, 2);
  for (const linkTag of linkMatches) {
    const hrefMatch = linkTag[0].match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const cssUrl = resolveUrl(url, hrefMatch[1]);
    if (!cssUrl) continue;
    try {
      const cssRes = await fetch(cssUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; IntakeColorBot/1.0)" } });
      if (cssRes.ok) {
        const cssText = await cssRes.text();
        const cssTally = extractHexColors(cssText);
        for (const [hex, count] of Object.entries(cssTally)) {
          tally[hex] = (tally[hex] || 0) + count;
        }
      }
    } catch {
      // A failed stylesheet fetch just means fewer candidates, not a hard error.
    }
  }

  const candidates = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hex, count]) => ({ hex, count }));

  if (candidates.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ candidates: [], note: "Couldn't find distinct brand colors on that page. Enter them manually below." }),
    };
  }

  return { statusCode: 200, body: JSON.stringify({ candidates }) };
};
