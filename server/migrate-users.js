import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://iyfpmxejxgxypjnoivyz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const restHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

// ── Supabase Auth Admin API ────────────────────────────────────────────────
async function getSupabaseUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    if (!res.ok) throw new Error(`Auth API error: ${res.status} ${await res.text()}`);
    const { users: batch = [] } = await res.json();
    users.push(...batch);
    if (batch.length < 1000) break;
    page++;
  }
  return users;
}

// ── Supabase REST API helpers ──────────────────────────────────────────────
async function restGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders });
  if (!res.ok) throw new Error(`REST GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function restPost(table, rows, prefer = 'resolution=ignore-duplicates') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...restHeaders, Prefer: prefer },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`REST POST ${table}: ${res.status} ${body}`);
  }
  return res;
}

// Detect whether Better Auth tables use camelCase or snake_case columns
async function detectColumnStyle() {
  // Fetch the OpenAPI schema PostgREST exposes
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) return 'snake'; // default to snake_case on failure
  const spec = await res.json();
  const userDef = spec?.definitions?.user || spec?.components?.schemas?.user;
  if (!userDef) return 'snake';
  const keys = Object.keys(userDef.properties || {});
  return keys.includes('emailVerified') ? 'camel' : 'snake';
}

async function main() {
  console.log('Fetching users from Supabase Auth...');
  const supabaseUsers = await getSupabaseUsers();
  console.log(`Found ${supabaseUsers.length} Supabase Auth users`);

  console.log('Fetching profiles...');
  const profileRows = await restGet('profiles?select=*');
  const profiles = {};
  for (const p of profileRows) profiles[p.id] = p;

  console.log('Detecting Better Auth column style...');
  const style = await detectColumnStyle();
  console.log(`Using ${style === 'camel' ? 'camelCase' : 'snake_case'} column names`);
  const c = style === 'camel'
    ? { emailVerified: 'emailVerified', image: 'image', createdAt: 'createdAt', updatedAt: 'updatedAt', userType: 'userType', username: 'username', location: 'location', accountId: 'accountId', providerId: 'providerId', userId: 'userId' }
    : { emailVerified: 'email_verified', image: 'image', createdAt: 'created_at', updatedAt: 'updated_at', userType: 'user_type', username: 'username', location: 'location', accountId: 'account_id', providerId: 'provider_id', userId: 'user_id' };

  console.log('Fetching existing Better Auth users...');
  const existingRows = await restGet('user?select=email');
  const existingEmails = new Set(existingRows.map(r => r.email));

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  const usersToInsert = [];
  const accountsToInsert = [];

  for (const sbUser of supabaseUsers) {
    const email = sbUser.email;
    if (!email) { skipped++; continue; }

    if (existingEmails.has(email)) {
      console.log(`  Skipping ${email} — already in Better Auth`);
      skipped++;
      continue;
    }

    const profile = profiles[sbUser.id] || {};
    const now = new Date().toISOString();
    const name =
      profile.full_name ||
      `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
      email.split('@')[0];

    usersToInsert.push({
      id: sbUser.id,
      name,
      email,
      [c.emailVerified]: sbUser.email_confirmed_at ? true : false,
      [c.image]: profile.avatar_url || null,
      [c.createdAt]: sbUser.created_at || now,
      [c.updatedAt]: now,
      [c.userType]: profile.is_stylist ? 'stylist' : 'explorer',
      [c.username]: profile.username || null,
      [c.location]: profile.location || null,
    });

    accountsToInsert.push({
      id: randomUUID(),
      [c.accountId]: sbUser.id,
      [c.providerId]: 'credential',
      [c.userId]: sbUser.id,
      [c.createdAt]: now,
      [c.updatedAt]: now,
    });
  }

  if (usersToInsert.length === 0) {
    console.log('\nAll users already migrated.');
    process.exit(0);
  }

  console.log(`\nInserting ${usersToInsert.length} users...`);
  try {
    await restPost('user', usersToInsert);
    migrated = usersToInsert.length;
    console.log(`  Users inserted.`);
  } catch (err) {
    console.error('  Error inserting users:', err.message);
    errors++;
  }

  console.log(`Inserting ${accountsToInsert.length} account records...`);
  try {
    await restPost('account', accountsToInsert);
    console.log(`  Accounts inserted.`);
  } catch (err) {
    console.error('  Error inserting accounts:', err.message);
    errors++;
  }

  console.log('\n── Migration complete ──────────────────');
  console.log(`  Migrated : ${migrated}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Errors   : ${errors}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
