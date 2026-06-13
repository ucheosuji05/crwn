import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// profiles.id used to be FK'd to auth.users(id) (Supabase Auth). Better Auth now
// owns identity and writes directly to public.user, which has no corresponding
// auth.users row, so every new signup's profile INSERT failed with a foreign-key
// violation (silently swallowed by the trigger's exception handler). Drop the
// obsolete constraint — nothing else references auth.users via this column.
const DROP_FK_SQL = `
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
`;

const TRIGGER_SQL = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_email    text;
  v_suffix   text;
BEGIN
  -- Top-level guard: a profile-creation error must NEVER block the user insert.
  BEGIN
    v_username := NEW.username;
    IF v_username IS NULL OR length(trim(v_username)) < 3 THEN
      v_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
      IF v_username IS NULL OR length(v_username) < 3 THEN
        v_username := 'user_' || substr(NEW.id, 1, 8);
      END IF;
    END IF;
    v_email := NEW.email;

    BEGIN
      INSERT INTO public.profiles (id, username, full_name, email, avatar_url, location, is_stylist)
      VALUES (NEW.id::uuid, v_username, COALESCE(NEW.name, v_username), v_email, NEW.image, NEW.location,
              COALESCE(NEW."userType" = 'stylist', false))
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN unique_violation OR check_violation THEN
      v_suffix   := substr(NEW.id, 1, 8);
      v_username := 'user_' || v_suffix;
      v_email    := 'user_' || v_suffix || '+' || v_email;
      BEGIN
        INSERT INTO public.profiles (id, username, full_name, email, avatar_url, location, is_stylist)
        VALUES (NEW.id::uuid, v_username, COALESCE(NEW.name, v_username), v_email, NEW.image, NEW.location,
                COALESCE(NEW."userType" = 'stylist', false))
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: failed to create profile for user % (%)', NEW.id, SQLERRM;
      END;
    END;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: unexpected error for user % (%)', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created ON public."user";
CREATE TRIGGER on_user_created
  AFTER INSERT ON public."user"
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
`;

const BACKFILL_SQL = `
DO $$
DECLARE
  u RECORD;
  v_username text;
  v_email    text;
  v_suffix   text;
BEGIN
  FOR u IN
    SELECT usr.* FROM public."user" usr
    LEFT JOIN public.profiles p ON p.id = usr.id::uuid
    WHERE p.id IS NULL
  LOOP
    v_username := u.username;
    IF v_username IS NULL OR length(trim(v_username)) < 3 THEN
      v_username := lower(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
      IF v_username IS NULL OR length(v_username) < 3 THEN
        v_username := 'user_' || substr(u.id, 1, 8);
      END IF;
    END IF;
    v_email := u.email;

    BEGIN
      INSERT INTO public.profiles (id, username, full_name, email, avatar_url, location, is_stylist)
      VALUES (u.id::uuid, v_username, COALESCE(u.name, v_username), v_email, u.image, u.location,
              COALESCE(u."userType" = 'stylist', false))
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN unique_violation OR check_violation THEN
      v_suffix   := substr(u.id, 1, 8);
      v_username := 'user_' || v_suffix;
      v_email    := 'user_' || v_suffix || '+' || v_email;
      BEGIN
        INSERT INTO public.profiles (id, username, full_name, email, avatar_url, location, is_stylist)
        VALUES (u.id::uuid, v_username, COALESCE(u.name, v_username), v_email, u.image, u.location,
                COALESCE(u."userType" = 'stylist', false))
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'backfill: failed to create profile for user % (%)', u.id, SQLERRM;
      END;
    END;
  END LOOP;
END $$;
`;

async function main() {
  console.log('Dropping obsolete profiles_id_fkey -> auth.users(id) constraint...');
  await pool.query(DROP_FK_SQL);
  console.log('Constraint dropped (if it existed).');

  console.log('Creating handle_new_user() trigger function + on_user_created trigger...');
  await pool.query(TRIGGER_SQL);
  console.log('Trigger installed.');

  console.log('Backfilling profiles for existing users missing one...');
  await pool.query(BACKFILL_SQL);
  console.log('Backfill complete.');

  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.username, p.id IS NOT NULL AS has_profile
    FROM public."user" u
    LEFT JOIN public.profiles p ON p.id = u.id::uuid
    ORDER BY u."createdAt"
  `);
  console.log('\nFinal state:');
  for (const row of rows) {
    console.log(`  ${row.has_profile ? 'OK ' : 'MISSING'} ${row.email} (${row.id})`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
