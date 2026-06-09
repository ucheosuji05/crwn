import { getMigrations } from 'better-auth/db/migration';
import { auth } from './auth.js';

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);

if (!toBeCreated.length && !toBeAdded.length) {
  console.log('Database is already up to date.');
  process.exit(0);
}

if (toBeCreated.length) {
  console.log('Creating tables:', toBeCreated.map(t => t.table).join(', '));
}
if (toBeAdded.length) {
  console.log('Adding columns to:', toBeAdded.map(t => t.table).join(', '));
}

await runMigrations();
console.log('Migration complete!');
process.exit(0);
