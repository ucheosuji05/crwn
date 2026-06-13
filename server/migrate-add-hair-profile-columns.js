import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// App code (OnboardingScreen, EditProfileScreen, authService) reads/writes
// hair_profiles.goals (text[], like characteristics) and hair_profiles.length
// (text), but neither column exists yet — PostgREST returns PGRST204
// ("Could not find the 'goals' column ... in the schema cache").
const SQL = `
ALTER TABLE public.hair_profiles
  ADD COLUMN IF NOT EXISTS goals text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS length text;

NOTIFY pgrst, 'reload schema';
`;

async function main() {
  console.log('Adding goals/length columns to hair_profiles...');
  await pool.query(SQL);
  console.log('Done.');

  const { rows } = await pool.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hair_profiles'
    ORDER BY ordinal_position
  `);
  console.log(rows.map(r => `${r.column_name} ${r.data_type}${r.column_default ? ' DEFAULT ' + r.column_default : ''}`).join('\n'));

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
