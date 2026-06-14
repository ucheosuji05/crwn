// Thin wrapper: dynamic import catches ESM initialization errors that would
// otherwise crash silently (before process.on handlers are registered).
process.stderr.write('[crwn] server process started\n');

import('./index.js').catch((err) => {
  process.stderr.write(`[crwn] FATAL — server failed to start:\n${err?.stack ?? err}\n`);
  process.exit(1);
});
