import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = 'https://iyfpmxejxgxypjnoivyz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  console.log('Fetching users to fix their Account IDs...');

  const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/user?select=id,email`, { headers });
  const users = await fetchRes.json();

  let count = 0;
  for (const u of users) {
    // Fix credential account rows so sign-in uses the user's email address.
    await fetch(`${SUPABASE_URL}/rest/v1/account?userId=eq.${u.id}&providerId=eq.credential`, {
      method: 'PATCH', headers, body: JSON.stringify({ accountId: u.email })
    });
    await fetch(`${SUPABASE_URL}/rest/v1/account?user_id=eq.${u.id}&provider_id=eq.credential`, {
      method: 'PATCH', headers, body: JSON.stringify({ account_id: u.email })
    });
    console.log(`  ✅ Fixed account ID mapping for: ${u.email}`);
    count++;
  }
  console.log(`\nDone! Fixed ${count} accounts. You should now be able to sign in.`);
}

main();