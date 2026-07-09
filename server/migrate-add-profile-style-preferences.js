import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Onboarding's "What styles speak to you?" mosaic was writing its picks into
// hair_profiles.goals, which is meant to hold actual hair goals shown on the
// Profile screen (growth, health, etc). Style picks are an Explore-feed
// concept, not a hair attribute, so they get their own home on profiles
// instead. Additive only — does not touch hair_profiles.goals or its data.
const SQL = `
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS style_preferences text[] DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
`;

async function main() {
  console.log('Adding style_preferences column to profiles...');
  await pool.query(SQL);
  console.log('Done.');

  const { rows } = await pool.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
    ORDER BY ordinal_position
  `);
  console.log(rows.map(r => `${r.column_name} ${r.data_type}${r.column_default ? ' DEFAULT ' + r.column_default : ''}`).join('\n'));

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
