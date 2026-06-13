import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = 'https://iyfpmxejxgxypjnoivyz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env file!');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function detectColumnStyle() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
  if (!res.ok) return 'snake';
  const schema = await res.json();
  const userDef = schema?.definitions?.user || schema?.components?.schemas?.user;
  if (!userDef) return 'snake';
  const keys = Object.keys(userDef.properties || {});
  return keys.includes('emailVerified') ? 'camel' : 'snake';
}

async function restGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    throw new Error(`REST GET ${path}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const style = await detectColumnStyle();
  const c = style === 'camel'
    ? { accountId: 'accountId', providerId: 'providerId', userId: 'userId' }
    : { accountId: 'account_id', providerId: 'provider_id', userId: 'user_id' };

  console.log(`Detected column style: ${style === 'camel' ? 'camelCase' : 'snake_case'}`);

  const rawUsers = await restGet(`user?select=id,email`);
  const users = new Map(rawUsers.map(u => [u.id, u.email]));

  const rawAccounts = await restGet(
    `account?select=id,${c.userId},${c.accountId},${c.providerId}&${c.providerId}=eq.credential`
  );

  const missingUsers = [];
  const mismatchedAccounts = [];

  for (const account of rawAccounts) {
    const userId = account[c.userId];
    const expectedEmail = users.get(userId);
    if (!expectedEmail) {
      missingUsers.push(account);
      continue;
    }

    if (account[c.accountId] !== expectedEmail) {
      mismatchedAccounts.push({
        accountId: account.id,
        userId,
        storedAccountId: account[c.accountId],
        expectedEmail,
      });
    }
  }

  console.log(`Found ${rawAccounts.length} credential account row(s).`);
  console.log(`  ➜ ${missingUsers.length} row(s) missing a matching user record.`);
  console.log(`  ➜ ${mismatchedAccounts.length} row(s) where accountId does not match user email.`);

  if (missingUsers.length > 0) {
    console.log('\nSample missing-user rows:');
    missingUsers.slice(0, 10).forEach((row) => console.log(JSON.stringify(row)));
  }

  if (mismatchedAccounts.length > 0) {
    console.log('\nSample mismatched account rows:');
    mismatchedAccounts.slice(0, 10).forEach((row) => console.log(JSON.stringify(row)));
    console.log('\nThese rows should be corrected so credential sign-in works using the email address.');
    process.exit(2);
  }

  console.log('\nLooks good: credential account rows are matched to email addresses.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
