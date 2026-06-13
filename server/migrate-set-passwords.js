import { hashPassword } from 'better-auth/crypto';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = 'https://iyfpmxejxgxypjnoivyz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env file!');
  process.exit(1);
}

const DEMO_PASSWORD = 'CrwnDemo123!';

async function main() {
  const hash = await hashPassword(DEMO_PASSWORD);
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  console.log('Fetching users to set their passwords...');

  // Fetch all users from Better Auth's user table
  const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/user?select=id,email`, { headers });
  const users = await fetchRes.json();

  if (!Array.isArray(users)) {
    throw new Error('Failed to fetch users: ' + JSON.stringify(users));
  }

  console.log(`Found ${users.length} users. Applying shared demo password...`);

  let updatedCount = 0;
  for (const u of users) {
    // Brute-force: Update ALL possible locations at once. Better Auth verifies 
    // from the account table, so we cannot stop if the user table succeeds.
    await fetch(`${SUPABASE_URL}/rest/v1/user?id=eq.${u.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ password: hash })
    });
    await fetch(`${SUPABASE_URL}/rest/v1/account?userId=eq.${u.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ password: hash })
    });
    await fetch(`${SUPABASE_URL}/rest/v1/account?user_id=eq.${u.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ password: hash })
    });

    console.log(`  ✅ Forced password update across all tables for: ${u.email}`);
    updatedCount++;
  }

  console.log(`\nDone. ${updatedCount} users now use password: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
