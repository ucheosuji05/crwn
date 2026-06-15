process.stderr.write('[crwn] server process started\n');

async function main() {
  // Pre-resolve DATABASE_URL hostname to IPv4 before pg Pool is created.
  // Railway Trial containers cannot make outbound IPv6 connections; Supabase
  // hostnames resolve to IPv6 addresses on Railway's DNS resolver, causing
  // ENETUNREACH on every DB call. Resolving to IPv4 here guarantees pg
  // connects directly to an IPv4 address with no DNS lookup at connection time.
  if (process.env.DATABASE_URL) {
    try {
      const { resolve4 } = await import('dns/promises');
      const url = new URL(process.env.DATABASE_URL);
      const [ipv4] = await resolve4(url.hostname);
      url.hostname = ipv4;
      process.env.DATABASE_URL = url.toString();
      process.stderr.write(`[crwn] DB host resolved to IPv4: ${ipv4}\n`);
    } catch (err) {
      process.stderr.write(`[crwn] DNS pre-resolve warning (continuing): ${err.message}\n`);
    }
  }

  await import('./index.js');
}

main().catch((err) => {
  process.stderr.write(`[crwn] FATAL — server failed to start:\n${err?.stack ?? err}\n`);
  process.exit(1);
});
