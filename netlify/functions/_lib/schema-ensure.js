// Every business has its own separate Railway Postgres, so a new column
// can't be added with one migration the way Wayfinder can. Instead, each
// function that touches intake_data runs this first. "ADD COLUMN IF NOT
// EXISTS" is a no-op on a database that already has the column, so this is
// safe to call on every request — new businesses get it from schema.sql
// directly, existing ones pick it up the next time any function runs.
async function ensureSchema(client) {
  await client.query(`
    ALTER TABLE intake_data
      ADD COLUMN IF NOT EXISTS website_url text;
  `);
}

module.exports = { ensureSchema };
