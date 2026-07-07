// Every business has its own separate Railway Postgres, so a new column
// can't be added with one migration the way Wayfinder can. Instead, each
// function that touches intake_data runs this first. "ADD COLUMN IF NOT
// EXISTS" is a no-op on a database that already has the column, so this is
// safe to call on every request — new businesses get it from schema.sql
// directly, existing ones pick it up the next time any function runs.
async function ensureSchema(client) {
  await client.query(`
    ALTER TABLE intake_data
      ADD COLUMN IF NOT EXISTS website_url text,
      ADD COLUMN IF NOT EXISTS color_background text,
      ADD COLUMN IF NOT EXISTS color_accent text,
      ADD COLUMN IF NOT EXISTS color_highlight text,
      ADD COLUMN IF NOT EXISTS color_sparing_accent text,
      ADD COLUMN IF NOT EXISTS source_url_1 text,
      ADD COLUMN IF NOT EXISTS source_url_2 text,
      ADD COLUMN IF NOT EXISTS source_url_3 text;
  `);

  // Retired columns get dropped rather than left orphaned — nothing reads
  // these anymore, and keeping unused columns around just invites drift
  // between what's in the database and what the app actually uses.
  await client.query(`
    ALTER TABLE intake_data
      DROP COLUMN IF EXISTS primary_color,
      DROP COLUMN IF EXISTS secondary_color,
      DROP COLUMN IF EXISTS accent_color,
      DROP COLUMN IF EXISTS source_feeds;
  `);
}

module.exports = { ensureSchema };
