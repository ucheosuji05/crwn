import dotenv from 'dotenv';
dotenv.config(); // load env first, before anything else

import express from 'express';
import cors from 'cors';
//import path from 'path';
//import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});


// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const serverEnvPath = path.join(__dirname, 'server.env');

// const dotenvResult = dotenv.config({ path: serverEnvPath });
// if (dotenvResult.error) {
//   console.warn(`server/index.js: could not load ${serverEnvPath}, falling back to default .env file`);
//   dotenv.config();
// } else {
//   console.log(`server/index.js: loaded environment from ${serverEnvPath}`);
// }

const app = express();
const PORT = process.env.PORT || 3001;

// Short-lived map: nonce → { origin, ts } for web OAuth flows.
// Keyed on a random hex string passed through the callbackURL so mobile-callback
// knows to redirect to the web app instead of the crwn:// deep link.
const pendingWebNonces = new Map();
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000; // 10 min TTL
  for (const [k, v] of pendingWebNonces) {
    if (v.ts < cutoff) pendingWebNonces.delete(k);
  }
}, 60_000);

console.log(`[startup] PORT=${PORT} NODE_ENV=${process.env.NODE_ENV}`);

// Health check first — before CORS and everything else
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path === '/health') {
    return res.json({ status: 'ok' });
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => callback(null, origin || true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-auth-token'],
}));

app.use(express.json());

// OAuth start: server-side proxy that avoids the WKWebView fetch/navigation
// cookie-jar split. Instead of an in-browser fetch (which uses a separate jar),
// this handler calls Better Auth server-side, then forwards the state cookie
// in a 302 redirect — so the browser receives it via navigation and it stays
// present when Google redirects back to the callback.
app.get('/api/auth/oauth-start/:provider', async (req, res) => {
  // Prevent any caching — every OAuth request needs a fresh state cookie.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  const provider = req.params.provider.replace(/[^a-z]/g, '');
  const isWeb = req.query.platform === 'web';
  const webOrigin = isWeb && req.query.origin ? decodeURIComponent(req.query.origin) : null;

  // Always use mobile-callback as the callbackURL — Better Auth reliably follows
  // it. For web flows, append a one-time nonce so mobile-callback can redirect
  // to the web app instead of the crwn:// deep link.
  // Always use mobile-callback (no query params) — Better Auth reliably follows it.
  // For web flows, store origin in a same-domain cookie that survives the Google
  // redirect chain. mobile-callback reads the cookie to decide where to redirect.
  const callbackURL = `${process.env.BETTER_AUTH_URL}/api/auth/mobile-callback`;
  let webNonce = null;
  if (isWeb) {
    webNonce = crypto.randomBytes(16).toString('hex');
    pendingWebNonces.set(webNonce, { origin: webOrigin || process.env.WEB_APP_URL || '', ts: Date.now() });
  }

  console.log(`[oauth-start] provider=${provider} isWeb=${isWeb} webNonce=${webNonce} callbackURL=${callbackURL}`);

  try {
    const authRes = await fetch(`${process.env.BETTER_AUTH_URL}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: process.env.BETTER_AUTH_URL,
      },
      body: JSON.stringify({ provider, callbackURL, disableRedirect: true }),
      redirect: 'manual',
    });

    const body = await authRes.json().catch(() => ({}));
    const oauthUrl = body.url || body.data?.url;

    if (!oauthUrl) {
      console.error('[oauth-start] no URL in response:', JSON.stringify(body));
      return res.status(500).send('OAuth initialization failed');
    }

    // Forward the state cookie(s) Better Auth set, plus our web-flow nonce cookie.
    // SameSite=None lets it survive the cross-site Google redirect.
    const rawCookies = typeof authRes.headers.getSetCookie === 'function'
      ? authRes.headers.getSetCookie()
      : (authRes.headers.get('set-cookie') ? [authRes.headers.get('set-cookie')] : []);

    if (webNonce) {
      rawCookies.push(`_crwn_wcb=${webNonce}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=None`);
    }
    if (rawCookies.length > 0) {
      res.setHeader('Set-Cookie', rawCookies);
    }

    return res.redirect(302, oauthUrl);
  } catch (err) {
    console.error('[oauth-start] error:', err);
    return res.status(500).send('OAuth initialization failed');
  }
});

// In-browser password reset form. Works from email → Safari without needing
// the app to handle a deep link (which doesn't work in Expo Go from external Safari).
app.get('/api/auth/open-app', (req, res) => {
  const token = (req.query.token || '').replace(/[<>"'\s]/g, '');
  if (!token) return res.status(400).send('Missing token');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reset Password — CRWN</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,700;1,400&family=Figtree:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: linear-gradient(160deg, #E8C4B8 0%, #D4A574 50%, #A67B5B 100%);
      font-family: 'Figtree', -apple-system, sans-serif;
    }

    .card {
      background: #fff;
      border-radius: 24px;
      padding: 40px 32px 36px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 12px 40px rgba(93, 58, 26, 0.18);
    }

    .logo-section {
      text-align: center;
      margin-bottom: 28px;
    }
    .logo {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-weight: 700;
      font-size: 48px;
      color: #5D3A1A;
      line-height: 1.1;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-style: italic;
      font-weight: 400;
      font-size: 16px;
      color: #5D3A1A;
      margin-top: 6px;
      opacity: 0.85;
    }

    .divider {
      height: 1px;
      background: rgba(209, 209, 209, 0.6);
      margin-bottom: 28px;
    }

    .form-heading {
      font-family: 'Figtree', sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: #1A1A1A;
      margin-bottom: 6px;
    }
    .form-sub {
      font-size: 14px;
      color: #5E5E5E;
      line-height: 1.55;
      margin-bottom: 24px;
    }

    .input-group { margin-bottom: 18px; }
    label {
      display: block;
      font-size: 13px;
      font-weight: 400;
      color: #5E5E5E;
      margin-bottom: 7px;
      font-family: 'Figtree', sans-serif;
    }
    input[type="password"] {
      display: block;
      width: 100%;
      padding: 13px 16px;
      border: 1.5px solid #D1D1D1;
      border-radius: 10px;
      font-size: 15px;
      font-family: 'Figtree', sans-serif;
      color: #1A1A1A;
      background: #fff;
      outline: none;
      transition: border-color 0.15s;
    }
    input[type="password"]:focus { border-color: #5D1F1F; }

    button {
      display: block;
      width: 100%;
      padding: 17px;
      background: #5D1F1F;
      color: #fff;
      border: none;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      font-family: 'Figtree', sans-serif;
      letter-spacing: 0.3px;
      cursor: pointer;
      margin-top: 8px;
      transition: opacity 0.15s;
    }
    button:hover:not(:disabled) { opacity: 0.88; }
    button:disabled { opacity: 0.55; cursor: default; }

    .msg {
      margin-top: 16px;
      padding: 13px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-family: 'Figtree', sans-serif;
      line-height: 1.5;
      text-align: center;
    }
    .msg.error { background: #fee2e2; color: #991B1B; }
    .msg.success {
      background: #FEF9EC;
      color: #92601A;
      font-weight: 600;
    }

    .rules-title { font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 600; }
    .rule { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #AAAAAA; margin-bottom: 5px; }
    .rule-icon { font-style: normal; width: 16px; text-align: center; }
    .rule.rule-met { color: #3B7A3B; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-section">
      <div class="logo">crwn.</div>
      <div class="tagline">set new password</div>
    </div>
    <div class="divider"></div>

    <div id="form-wrap">
      <p class="form-heading">Choose a new password</p>
      <div class="input-group">
        <label for="pw">New password</label>
        <input id="pw" type="password" placeholder="Create a strong password" autocomplete="new-password" oninput="checkRules()">
      </div>

      <div id="rules" style="display:none;margin-bottom:18px">
        <p class="rules-title">Must contain:</p>
        <div class="rule" id="r-length">   <span class="rule-icon">&#9711;</span> At least 8 characters</div>
        <div class="rule" id="r-upper">    <span class="rule-icon">&#9711;</span> One uppercase letter</div>
        <div class="rule" id="r-lower">    <span class="rule-icon">&#9711;</span> One lowercase letter</div>
        <div class="rule" id="r-number">   <span class="rule-icon">&#9711;</span> One number</div>
        <div class="rule" id="r-special">  <span class="rule-icon">&#9711;</span> One special character</div>
      </div>

      <div class="input-group">
        <label for="pw2">Confirm password</label>
        <input id="pw2" type="password" placeholder="Repeat your password" autocomplete="new-password">
      </div>
      <button id="btn" onclick="submit()">Reset Password</button>
      <div id="msg" class="msg" style="display:none"></div>
    </div>
  </div>

  <script>
    var token = ${JSON.stringify(token)};

    var RULES = [
      { id: 'r-length',  test: function(p){ return p.length >= 8; } },
      { id: 'r-upper',   test: function(p){ return /[A-Z]/.test(p); } },
      { id: 'r-lower',   test: function(p){ return /[a-z]/.test(p); } },
      { id: 'r-number',  test: function(p){ return /[0-9]/.test(p); } },
      { id: 'r-special', test: function(p){ return /[^A-Za-z0-9]/.test(p); } },
    ];

    function checkRules() {
      var pw = document.getElementById('pw').value;
      var rules = document.getElementById('rules');
      rules.style.display = pw.length > 0 ? 'block' : 'none';
      RULES.forEach(function(r) {
        var el = document.getElementById(r.id);
        var met = r.test(pw);
        el.className = 'rule' + (met ? ' rule-met' : '');
        el.querySelector('.rule-icon').innerHTML = met ? '&#10003;' : '&#9711;';
      });
    }

    function isPwStrong(pw) {
      return RULES.every(function(r){ return r.test(pw); });
    }

    function submit() {
      var pw  = document.getElementById('pw').value;
      var pw2 = document.getElementById('pw2').value;
      if (!isPwStrong(pw)) { show('Please meet all password requirements.', true); return; }
      if (pw !== pw2) { show('Passwords do not match.', true); return; }
      var btn = document.getElementById('btn');
      btn.disabled = true;
      btn.textContent = 'Resetting…';
      fetch('/api/auth/web-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pw, token: token })
      })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (res.ok && res.d.success) {
          document.getElementById('form-wrap').innerHTML =
            '<div style="text-align:center;font-size:48px;color:#3B7A3B;margin-bottom:12px">&#10003;</div>' +
            '<p class="form-heading" style="text-align:center;margin-bottom:10px">Password updated!</p>' +
            '<p class="form-sub" style="text-align:center">Go back to the CRWN app and sign in with your new password.</p>';
        } else {
          btn.disabled = false;
          btn.textContent = 'Reset Password';
          show(res.d.message || 'Link may have expired. Request a new one in the app.', true);
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = 'Reset Password';
        show('Could not connect. Check your connection and try again.', true);
      });
    }
    function show(text, isErr) {
      var el = document.getElementById('msg');
      el.textContent = text;
      el.className = 'msg ' + (isErr ? 'error' : 'success');
      el.style.display = 'block';
    }
  </script>
</body>
</html>`);
});

// Server-side proxy for the in-browser password reset form.
// The browser can't call Better Auth's reset endpoint directly because Better Auth
// responds with a 302 redirect to crwn:// — which is invalid in a browser fetch.
// This endpoint makes the call from Node (redirect:'manual'), then returns JSON.
app.post('/api/auth/web-reset', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Missing token or password.' });
  }
  try {
    const response = await fetch(
      `${process.env.BETTER_AUTH_URL}/api/auth/reset-password/${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: process.env.BETTER_AUTH_URL,
        },
        body: JSON.stringify({ newPassword }),
        redirect: 'manual',
      }
    );
    // 2xx = success; 3xx redirect (to crwn://) also means success
    if (response.ok || (response.status >= 300 && response.status < 400)) {
      return res.json({ success: true });
    }
    const text = await response.text().catch(() => '');
    let message = 'The link may have expired. Request a new one in the app.';
    try { message = JSON.parse(text).message || message; } catch (_) {}
    return res.status(400).json({ message });
  } catch (err) {
    console.error('web-reset error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// Custom mobile callback MUST come before the Better Auth catch-all,
// otherwise toNodeHandler consumes the request and this handler is never reached.
app.get('/api/auth/mobile-callback', async (req, res) => {
  const cookieHeader = req.headers.cookie || '';

  // Detect web flow via the _crwn_wcb cookie set in oauth-start.
  // This cookie survives the Google redirect chain independently of callbackURL.
  const wcbMatch = cookieHeader.match(/(?:^|;\s*)_crwn_wcb=([^;]+)/);
  const webNonce = (wcbMatch ? wcbMatch[1].trim() : null) || null;
  const webData = webNonce ? pendingWebNonces.get(webNonce) : null;
  if (webData) pendingWebNonces.delete(webNonce);

  console.log(`[mobile-callback] webNonce=${webNonce} webOrigin=${webData?.origin}`);

  // Resolve the session token
  let token = null;
  try {
    const sessionData = await auth.api.getSession({ headers: { cookie: cookieHeader } });
    if (sessionData?.session?.token) {
      token = sessionData.session.token;
      console.log('[mobile-callback] session via API for:', sessionData.user?.email);
    }
  } catch (err) {
    console.error('[mobile-callback] auth.api.getSession error:', err.message);
  }
  if (!token) {
    const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
      console.log('[mobile-callback] using raw cookie token (fallback)');
    }
  }

  // Web flow → redirect to web app (clear the nonce cookie first)
  if (webData) {
    res.setHeader('Set-Cookie', '_crwn_wcb=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None');
    const base = webData.origin || process.env.WEB_APP_URL || '/';
    if (token) return res.redirect(`${base}?auth_token=${encodeURIComponent(token)}`);
    return res.redirect(`${base}?auth_error=no_session`);
  }

  // Native flow → deep link
  if (token) return res.redirect(`crwn://auth/callback?token=${encodeURIComponent(token)}`);
  console.log('[mobile-callback] no session found');
  res.redirect('crwn://auth/callback?error=no_session');
});

// Web OAuth callback — same logic as mobile-callback but redirects to the web app
// origin with the token as a query param instead of a crwn:// deep link.
app.get('/api/auth/web-callback', async (req, res) => {
  const origin = req.query.origin ? decodeURIComponent(req.query.origin) : null;
  const cookieHeader = req.headers.cookie || '';
  console.log('[web-callback] origin:', origin, 'cookies:', cookieHeader.substring(0, 200));

  const redirect = (token) => {
    const base = origin || process.env.WEB_APP_URL || '/';
    return res.redirect(`${base}?auth_token=${encodeURIComponent(token)}`);
  };

  try {
    const sessionData = await auth.api.getSession({ headers: { cookie: cookieHeader } });
    if (sessionData?.session?.token) {
      console.log('[web-callback] session for:', sessionData.user?.email);
      return redirect(sessionData.session.token);
    }
  } catch (err) {
    console.error('[web-callback] getSession error:', err.message);
  }

  const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
  const rawToken = match ? decodeURIComponent(match[1]) : null;
  if (rawToken) {
    console.log('[web-callback] using cookie fallback token');
    return redirect(rawToken);
  }

  const base = origin || process.env.WEB_APP_URL || '/';
  console.log('[web-callback] no session found');
  res.redirect(`${base}?auth_error=no_session`);
});

// ── Shared helpers ────────────────────────────────────────────────────────────

async function sendEmail({ to, subject, html, replyTo }) {
  const from = process.env.FROM_EMAIL || 'CRWN <onboarding@resend.dev>';
  console.log(`[sendEmail] to=${to} from=${from} key=${process.env.RESEND_API_KEY ? 'set' : 'MISSING'}`);
  if (process.env.RESEND_API_KEY) {
    const payload = { from, to: [to], subject, html };
    if (replyTo) payload.reply_to = Array.isArray(replyTo) ? replyTo : [replyTo];
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (res.ok) {
      console.log('[sendEmail] Resend OK:', body);
    } else {
      console.error('[sendEmail] Resend error', res.status, body);
    }
  } else {
    console.log(`[sendEmail] No API key — To: ${to} | Subject: ${subject}`);
  }
}

async function getUserProfile(userId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=full_name,username,email`,
      { headers: supabaseAdminHeaders() },
    );
    const rows = await res.json();
    return rows?.[0] || {};
  } catch {
    return {};
  }
}

async function getSessionUserId(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const data = await auth.api.getSession({ headers: { authorization: `Bearer ${token}` } });
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

const SUPABASE_URL = 'https://iyfpmxejxgxypjnoivyz.supabase.co';
function supabaseAdminHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signSupabaseJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${signingInput}.${signature}`;
}

// ── Thread upvotes ─────────────────────────────────────────────────────────────
// Client uses anon key (no session) so auth.uid() is null and RLS blocks
// all thread_upvotes writes. These endpoints use the service role key.

// Get thread IDs the current user has upvoted
app.get('/api/threads/upvotes', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.json({ ids: [] });
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/thread_upvotes?user_id=eq.${userId}&select=thread_id`,
      { headers: supabaseAdminHeaders() }
    );
    const rows = await r.json();
    return res.json({ ids: Array.isArray(rows) ? rows.map(row => row.thread_id) : [] });
  } catch {
    return res.json({ ids: [] });
  }
});

// Add upvote
app.post('/api/threads/:threadId/upvote', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/thread_upvotes`, {
      method: 'POST',
      headers: { ...supabaseAdminHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, thread_id: req.params.threadId }),
    });
    if (!r.ok && r.status !== 409) return res.status(r.status).json({ message: 'Failed to upvote' });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Remove upvote
app.delete('/api/threads/:threadId/upvote', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/thread_upvotes?user_id=eq.${userId}&thread_id=eq.${req.params.threadId}`,
      { method: 'DELETE', headers: supabaseAdminHeaders() }
    );
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Post delete ────────────────────────────────────────────────────────────────
// Supabase client uses anon key with no session so auth.uid() is null and RLS
// blocks client-side deletes silently. Service role key bypasses RLS;
// ownership is verified against the Better Auth session.
app.delete('/api/posts/:postId', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { postId } = req.params;
  const h = supabaseAdminHeaders();

  try {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&user_id=eq.${userId}&select=id`,
      { headers: h }
    );
    const owned = await checkRes.json();
    if (!Array.isArray(owned) || owned.length === 0) {
      return res.status(403).json({ message: 'Post not found or not yours' });
    }

    await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/post_media?post_id=eq.${postId}`, { method: 'DELETE', headers: h }),
      fetch(`${SUPABASE_URL}/rest/v1/likes?post_id=eq.${postId}`, { method: 'DELETE', headers: h }),
      fetch(`${SUPABASE_URL}/rest/v1/comments?post_id=eq.${postId}`, { method: 'DELETE', headers: h }),
      fetch(`${SUPABASE_URL}/rest/v1/bookmarks?post_id=eq.${postId}`, { method: 'DELETE', headers: h }),
    ]);

    await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&user_id=eq.${userId}`,
      { method: 'DELETE', headers: h }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({ message: 'Failed to delete post' });
  }
});

// ── Post create ───────────────────────────────────────────────────────────────
// Same RLS issue as above: the anon client can't insert into posts/post_media
// or upload to the post-media bucket (its INSERT policies require auth.uid()
// or the `authenticated` role, which the anon client never has).

app.post('/api/posts', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { title, description, stylistId, tags } = req.body || {};
  if (!title) return res.status(400).json({ message: 'Title is required' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
      method: 'POST',
      headers: { ...supabaseAdminHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        title,
        description: description || '',
        stylist_id: stylistId || null,
        tags: tags || [],
        is_public: true,
      }),
    });
    if (!r.ok) {
      console.error('Create post error:', await r.text());
      return res.status(r.status).json({ message: 'Failed to create post' });
    }
    const [post] = await r.json();
    return res.json({ post });
  } catch (err) {
    console.error('Create post error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Upload one image for a post and create its post_media row.
// Body: raw image bytes; query: ?ext=jpg&position=0
app.post('/api/posts/:postId/media', express.raw({ type: '*/*', limit: '20mb' }), async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { postId } = req.params;
  const ext = (req.query.ext || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  const position = parseInt(req.query.position, 10) || 0;
  const contentType = req.headers['content-type'] || 'image/jpeg';
  const h = supabaseAdminHeaders();

  try {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&user_id=eq.${userId}&select=id`,
      { headers: h }
    );
    const owned = await checkRes.json();
    if (!Array.isArray(owned) || owned.length === 0) {
      return res.status(403).json({ message: 'Post not found or not yours' });
    }

    const fileName = `${userId}/${postId}/${Date.now()}-${position}.${ext}`;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/post-media/${fileName}`, {
      method: 'POST',
      headers: { apikey: h.apikey, Authorization: h.Authorization, 'Content-Type': contentType },
      body: req.body,
    });
    if (!uploadRes.ok) {
      console.error('Media upload error:', await uploadRes.text());
      return res.status(uploadRes.status).json({ message: 'Failed to upload image' });
    }

    const mediaUrl = `${SUPABASE_URL}/storage/v1/object/public/post-media/${fileName}`;
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/post_media`, {
      method: 'POST',
      headers: { ...h, Prefer: 'return=representation' },
      body: JSON.stringify({ post_id: postId, media_url: mediaUrl, media_type: 'image', position }),
    });
    if (!insertRes.ok) {
      console.error('post_media insert error:', await insertRes.text());
      return res.status(insertRes.status).json({ message: 'Failed to save image' });
    }
    const [media] = await insertRes.json();
    return res.json({ media });
  } catch (err) {
    console.error('Post media error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Thread create ────────────────────────────────────────────────────────────
// threads' INSERT policies also require auth.uid() = user_id.
app.post('/api/threads', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { category, title, body } = req.body || {};
  if (!category || !title || !body) {
    return res.status(400).json({ message: 'category, title, and body are required' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/threads`, {
      method: 'POST',
      headers: { ...supabaseAdminHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, category, title, body }),
    });
    if (!r.ok) {
      console.error('Create thread error:', await r.text());
      return res.status(r.status).json({ message: 'Failed to create thread' });
    }
    const [thread] = await r.json();
    return res.json({ thread });
  } catch (err) {
    console.error('Create thread error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Import Instagram photos as posts ─────────────────────────────────────────
// Stores photo URLs directly in post_media — no file upload needed.

app.post('/api/import-instagram-posts', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { posts, photoUrls, businessName } = req.body || {};
  // Accept new `posts: [{ url, description }]` format or legacy `photoUrls: string[]`
  const postItems = posts
    || (Array.isArray(photoUrls) ? photoUrls.map(url => ({ url, description: '' })) : null);
  if (!postItems?.length) {
    return res.status(400).json({ message: 'posts array required' });
  }

  const h = supabaseAdminHeaders();
  const postTitle = businessName || 'Portfolio';
  const created = [];

  try {
    for (const { url, description } of postItems) {
      const postRes = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
        method: 'POST',
        headers: { ...h, Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: userId, title: postTitle, description: description || '', tags: [], is_public: true }),
      });
      if (!postRes.ok) { console.error('[import-instagram] post error:', await postRes.text()); continue; }
      const [post] = await postRes.json();

      const mediaRes = await fetch(`${SUPABASE_URL}/rest/v1/post_media`, {
        method: 'POST',
        headers: { ...h, Prefer: 'return=representation' },
        body: JSON.stringify({ post_id: post.id, media_url: url, media_type: 'image', position: 0 }),
      });
      if (!mediaRes.ok) { console.error('[import-instagram] media error:', await mediaRes.text()); continue; }

      created.push(post.id);
    }
    return res.json({ created: created.length });
  } catch (err) {
    console.error('[import-instagram] error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Post likes ────────────────────────────────────────────────────────────────
app.post('/api/posts/:postId/like', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/likes`, {
      method: 'POST',
      headers: { ...supabaseAdminHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, post_id: req.params.postId }),
    });
    return res.json({ success: r.ok });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

app.delete('/api/posts/:postId/like', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/likes?user_id=eq.${userId}&post_id=eq.${req.params.postId}`,
      { method: 'DELETE', headers: supabaseAdminHeaders() }
    );
    return res.json({ success: true });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

// ── Post bookmarks ────────────────────────────────────────────────────────────
app.post('/api/posts/:postId/bookmark', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookmarks`, {
      method: 'POST',
      headers: { ...supabaseAdminHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, post_id: req.params.postId }),
    });
    return res.json({ success: r.ok });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

app.delete('/api/posts/:postId/bookmark', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/bookmarks?user_id=eq.${userId}&post_id=eq.${req.params.postId}`,
      { method: 'DELETE', headers: supabaseAdminHeaders() }
    );
    return res.json({ success: true });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

// ── Comments ──────────────────────────────────────────────────────────────────
app.post('/api/posts/:postId/comments', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { content, parentId } = req.body || {};
  if (!content) return res.status(400).json({ message: 'content is required' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: 'POST',
      headers: { ...supabaseAdminHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, post_id: req.params.postId, content, parent_id: parentId || null }),
    });
    if (!r.ok) return res.status(r.status).json({ message: 'Failed to add comment' });
    const [comment] = await r.json();
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?id=eq.${comment.id}&select=*,profiles:user_id(id,username,avatar_url,full_name)`,
      { headers: supabaseAdminHeaders() }
    );
    const [full] = await pr.json().catch(() => [comment]);

    // ── Mention notifications ─────────────────────────────────────────────────
    const mentionMatches = [...content.matchAll(/@(\w+)/g)];
    if (mentionMatches.length > 0) {
      const usernames = [...new Set(mentionMatches.map(m => m[1]))];
      const profilesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?username=in.(${usernames.join(',')})&select=id`,
        { headers: supabaseAdminHeaders() }
      ).catch(() => null);
      if (profilesRes?.ok) {
        const mentioned = await profilesRes.json().catch(() => []);
        const notifs = mentioned
          .filter(p => p.id !== userId)
          .map(p => ({ user_id: p.id, actor_id: userId, type: 'mention', post_id: req.params.postId, comment_id: comment.id, is_read: false }));
        if (notifs.length > 0) {
          await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
            method: 'POST',
            headers: { ...supabaseAdminHeaders(), Prefer: 'return=minimal' },
            body: JSON.stringify(notifs),
          }).catch(() => {});
        }
      }
    }

    return res.json({ data: full || comment });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

app.delete('/api/comments/:commentId', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/comments?id=eq.${req.params.commentId}&user_id=eq.${userId}`,
      { method: 'DELETE', headers: supabaseAdminHeaders() }
    );
    return res.json({ success: true });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

// ── Comment likes ─────────────────────────────────────────────────────────────
app.post('/api/comments/:commentId/like', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/comment_likes`, {
      method: 'POST',
      headers: { ...supabaseAdminHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, comment_id: req.params.commentId }),
    });
    return res.json({ success: true });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

app.delete('/api/comments/:commentId/like', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/comment_likes?user_id=eq.${userId}&comment_id=eq.${req.params.commentId}`,
      { method: 'DELETE', headers: supabaseAdminHeaders() }
    );
    return res.json({ success: true });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

// ── Thread delete ─────────────────────────────────────────────────────────────
app.delete('/api/threads/:threadId', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/threads?id=eq.${req.params.threadId}&user_id=eq.${userId}`,
      { method: 'DELETE', headers: supabaseAdminHeaders() }
    );
    return res.json({ success: true });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

// ── Thread replies ────────────────────────────────────────────────────────────
app.post('/api/threads/:threadId/replies', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { body: replyBody, parentId } = req.body || {};
  if (!replyBody) return res.status(400).json({ message: 'body is required' });
  try {
    const insertData = { user_id: userId, thread_id: req.params.threadId, body: replyBody };
    if (parentId) insertData.parent_id = parentId;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/thread_replies`, {
      method: 'POST',
      headers: { ...supabaseAdminHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(insertData),
    });
    if (!r.ok) return res.status(r.status).json({ message: 'Failed to create reply' });
    const [reply] = await r.json();
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/thread_replies?id=eq.${reply.id}&select=*,profiles:user_id(id,username,full_name,avatar_url,is_stylist),upvotes:thread_reply_upvotes(count)`,
      { headers: supabaseAdminHeaders() }
    );
    const [full] = await pr.json().catch(() => [reply]);
    return res.json({ data: full || reply });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

app.delete('/api/replies/:replyId', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/thread_replies?id=eq.${req.params.replyId}&user_id=eq.${userId}`,
      { method: 'DELETE', headers: supabaseAdminHeaders() }
    );
    return res.json({ success: true });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

// ── Reply upvotes ─────────────────────────────────────────────────────────────
app.post('/api/replies/:replyId/upvote', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/thread_reply_upvotes`, {
      method: 'POST',
      headers: { ...supabaseAdminHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, reply_id: req.params.replyId }),
    });
    return res.json({ success: true });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

app.delete('/api/replies/:replyId/upvote', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/thread_reply_upvotes?user_id=eq.${userId}&reply_id=eq.${req.params.replyId}`,
      { method: 'DELETE', headers: supabaseAdminHeaders() }
    );
    return res.json({ success: true });
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

// ── Supabase token sync ─────────────────────────────────────────────────────
// Mints a short-lived Supabase-compatible JWT from the Better Auth session so
// supabase-js (via the `accessToken` option) can make auth.uid() resolve for
// RLS-gated tables. Must be registered before the Better Auth catch-all below.
app.get('/api/auth/supabase-token', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    console.error('SUPABASE_JWT_SECRET is not set');
    return res.status(500).json({ message: 'Server misconfiguration' });
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1 hour

  const token = signSupabaseJWT(
    { sub: userId, role: 'authenticated', aud: 'authenticated', iat: now, exp },
    secret
  );

  return res.json({ token, exp });
});

// ── User / content reports ────────────────────────────────────────────────────
app.post('/api/reports', async (req, res) => {
  console.log('[reports] POST hit, auth header:', req.headers.authorization ? 'present' : 'MISSING');
  const userId = await getSessionUserId(req);
  console.log('[reports] resolved userId:', userId);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { reason, notes, reportedUserId, reportedPostId, targetName, type } = req.body || {};
  if (!reason) return res.status(400).json({ message: 'reason is required' });

  try {
    const [reporterProfile, reportedProfile] = await Promise.all([
      getUserProfile(userId),
      reportedUserId ? getUserProfile(reportedUserId) : Promise.resolve({}),
    ]);

    const reporterDisplay = reporterProfile.full_name
      ? `${reporterProfile.full_name} (@${reporterProfile.username || 'unknown'})`
      : `@${reporterProfile.username || userId}`;
    const reporterEmail = reporterProfile.email || null;

    const reportedDisplay = reportedProfile.full_name
      ? `${reportedProfile.full_name} (@${reportedProfile.username || 'unknown'})`
      : targetName || (reportedUserId ? `@${reportedProfile.username || reportedUserId}` : '(unknown)');

    // Insert into user_reports via service role (bypasses RLS)
    await fetch(`${SUPABASE_URL}/rest/v1/user_reports`, {
      method: 'POST',
      headers: supabaseAdminHeaders(),
      body: JSON.stringify({
        reporter_id: userId,
        reported_user_id: reportedUserId || null,
        reported_post_id: reportedPostId || null,
        reason,
        notes: notes || null,
      }),
    });

    const typeLabel = type === 'post' ? 'Post' : type === 'user' ? 'User' : 'Content';
    const reportSubject = `[CRWN Report] ${typeLabel} reported by ${reporterDisplay} — ${reason}`;
    const reportQuote = [
      ``,
      ``,
      `--- Original Report ---`,
      `From: ${reporterDisplay}${reporterEmail ? ` <${reporterEmail}>` : ''}`,
      `Reported ${typeLabel}: ${reportedDisplay}`,
      `Reason: ${reason}`,
      notes ? `Notes: ${notes}` : '',
    ].filter(Boolean).join('\n');
    const reportReplyButton = reporterEmail
      ? `<a href="mailto:${reporterEmail}?subject=Re: ${encodeURIComponent(reportSubject)}&body=${encodeURIComponent(reportQuote)}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#5D1F1F;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">Reply to Reporter</a>`
      : '';

    await sendEmail({
      to: 'crwn@crwnhq.com',
      subject: reportSubject,
      replyTo: reporterEmail,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#5D1F1F">New ${typeLabel} Report</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#666;width:140px">Reported by</td><td style="padding:8px 0"><strong>${reporterDisplay}</strong>${reporterEmail ? ` &lt;${reporterEmail}&gt;` : ''}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Reported ${typeLabel}</td><td style="padding:8px 0"><strong>${reportedDisplay}</strong></td></tr>
            ${reportedPostId ? `<tr><td style="padding:8px 0;color:#666">Post ID</td><td style="padding:8px 0;font-family:monospace;font-size:12px">${reportedPostId}</td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#666">Reason</td><td style="padding:8px 0"><strong>${reason}</strong></td></tr>
            ${notes ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top">Notes</td><td style="padding:8px 0">${notes}</td></tr>` : ''}
          </table>
          ${reportReplyButton}
        </div>
      `,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[reports] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/feedback', async (req, res) => {
  console.log('[feedback] POST hit, auth header:', req.headers.authorization ? 'present' : 'MISSING');
  const userId = await getSessionUserId(req);
  console.log('[feedback] resolved userId:', userId);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { kind, feedbackType, message } = req.body || {};
  if (!message) return res.status(400).json({ message: 'message is required' });

  const isSupport = kind === 'support';

  try {
    const profile = await getUserProfile(userId);
    const userDisplay = profile.full_name
      ? `${profile.full_name} (@${profile.username || 'unknown'})`
      : `@${profile.username || userId}`;
    const userEmail = profile.email || null;

    const subjectLine = isSupport
      ? `[CRWN Support] Request from ${userDisplay}`
      : `[CRWN Feedback] ${feedbackType || 'General'} from ${userDisplay}`;

    const replyQuote = [
      ``,
      ``,
      `--- Original Message ---`,
      `From: ${userDisplay}${userEmail ? ` <${userEmail}>` : ''}`,
      isSupport ? `Type: Support Request` : `Type: ${feedbackType || 'General'}`,
      ``,
      message,
    ].join('\n');
    const replyButton = userEmail
      ? `<a href="mailto:${userEmail}?subject=Re: ${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(replyQuote)}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#5D1F1F;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">Reply to ${profile.full_name || userDisplay}</a>`
      : '';

    await sendEmail({
      to: 'crwn@crwnhq.com',
      subject: subjectLine,
      replyTo: userEmail,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#5D1F1F">${isSupport ? 'Support Request' : 'User Feedback'}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#666;width:140px">From</td><td style="padding:8px 0"><strong>${userDisplay}</strong>${userEmail ? ` &lt;${userEmail}&gt;` : ''}</td></tr>
            ${!isSupport ? `<tr><td style="padding:8px 0;color:#666">Type</td><td style="padding:8px 0"><strong>${feedbackType || 'General'}</strong></td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#666;vertical-align:top">Message</td><td style="padding:8px 0;white-space:pre-wrap">${message}</td></tr>
          </table>
          ${replyButton}
        </div>
      `,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[feedback] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Booking page scraper ──────────────────────────────────────────────────────

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes('styleseat.com'))                            return 'styleseat';
  if (u.includes('vagaro.com'))                               return 'vagaro';
  if (u.includes('squareup.com') || u.includes('square.site')) return 'square';
  if (u.includes('calendly.com'))                             return 'calendly';
  if (u.includes('booksy.com'))                               return 'booksy';
  if (u.includes('fresha.com'))                               return 'fresha';
  if (u.includes('acuityscheduling.com'))                     return 'acuity';
  if (u.includes('mindbodyonline.com'))                       return 'mindbody';
  return 'unknown';
}

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function extractJsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(([, content]) => {
      try {
        const json = JSON.parse(content);
        return Array.isArray(json) ? json : [json];
      } catch { return []; }
    });
}

function extractMeta(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
           || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, 'i'));
  return m?.[1] || '';
}

// Recursively walk a nested object looking for an array that resembles service listings
function findServicesDeep(obj, depth = 0) {
  if (depth > 10 || !obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj.slice(0, 3).every(item =>
      item && typeof item === 'object' && !Array.isArray(item) &&
      (item.name || item.sName || item.title || item.service_name ||
       item.ServiceName || item.displayName || item.slug)
    )) return obj;
    for (const item of obj) {
      const found = findServicesDeep(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of ['services', 'service_list', 'serviceList', 'items', 'eventTypes',
                      'event_types', 'offerings', 'catalogItems', 'catalog_items']) {
    if (Array.isArray(obj[key]) && obj[key].length > 0) {
      const found = findServicesDeep(obj[key], depth);
      if (found) return found;
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      const found = findServicesDeep(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function normalizeService(item) {
  const name = (item.name || item.sName || item.title || item.service_name ||
                item.ServiceName || item.displayName || '').trim();
  if (!name) return null;

  let price = '';
  const raw = item.price ?? item.priceMin ?? item.min_price ?? item.starting_price;
  if (raw !== undefined && raw !== null) {
    const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    if (!isNaN(n) && n > 0) {
      price = n > 500 ? `$${(n / 100).toFixed(0)}` : `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
    } else if (typeof raw === 'string' && raw.trim()) {
      price = raw.includes('$') ? raw.trim() : `$${raw.trim()}`;
    }
  }
  if (!price && item.priceRange)  price = item.priceRange;
  if (!price && item.price_range) price = item.price_range;

  return {
    name,
    price,
    description: (item.description || item.details || item.sDescription || item.description_plain || '').trim(),
  };
}

// Recursively walk for a business/owner entity object
function findBusinessDeep(obj, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  for (const key of ['pro', 'stylist', 'profile', 'business', 'businessInfo',
                      'merchant', 'seller', 'owner', 'provider', 'venue', 'location']) {
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) return obj[key];
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = findBusinessDeep(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function extractBizName(obj) {
  if (!obj) return '';
  for (const k of ['name', 'displayName', 'businessName', 'business_name', 'bName', 'organization', 'company_name']) {
    if (typeof obj[k] === 'string' && obj[k].trim()) return obj[k].trim();
  }
  return '';
}

// Core extractor — works on any platform's embedded JSON
function extractFromJson(data) {
  if (!data) return { businessName: '', bio: '', services: [] };
  const biz = findBusinessDeep(data);
  const rawServices = findServicesDeep(data);
  return {
    businessName: extractBizName(biz),
    bio: (biz?.bio || biz?.description || biz?.about || '').trim(),
    services: (rawServices || []).map(normalizeService).filter(Boolean),
  };
}

function scrapeStyleSeat(_html, nextData) {
  return extractFromJson(nextData);
}

function scrapeVagaro(html, nextData) {
  const result = extractFromJson(nextData);
  // Vagaro sometimes also uses a Nuxt state blob
  if (result.services.length === 0) {
    const m = html.match(/window\.__NUXT__\s*=\s*([\s\S]*?);<\/script>/);
    if (m) {
      try { return extractFromJson(JSON.parse(m[1])); } catch {}
    }
  }
  return result;
}

async function scrapeCalendly(_html, nextData, url) {
  // Calendly's undocumented public booking API returns event types reliably
  const username = url.match(/calendly\.com\/([^/?#]+)/)?.[1];
  if (username && !['d', 'event_types', 'api', 'app'].includes(username)) {
    try {
      const apiRes = await fetch(`https://calendly.com/api/booking/profiles/${username}`, {
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        },
      });
      if (apiRes.ok) {
        const d = await apiRes.json();
        const owner = d.owner || d;
        const events = d.event_types || d.eventTypes || [];
        if (owner.name || events.length > 0) {
          return {
            businessName: owner.name || owner.full_name || '',
            bio: owner.description || '',
            services: events.map(e => ({
              name: e.name || '',
              price: '',
              description: [e.duration ? `${e.duration} min` : '', e.description_plain || ''].filter(Boolean).join(' — '),
            })).filter(s => s.name),
          };
        }
      }
    } catch {}
  }
  return extractFromJson(nextData);
}

function scrapeSquare(html, nextData) {
  const patterns = [
    /window\.__SQUARE_INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*(?:window|<\/script>)/,
    /window\.__SQUARE_MARKETPLACE_STATE__\s*=\s*({[\s\S]*?});\s*(?:window|<\/script>)/,
    /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});\s*(?:window|<\/script>)/,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      try {
        const r = extractFromJson(JSON.parse(m[1]));
        if (r.businessName || r.services.length > 0) return r;
      } catch {}
    }
  }
  return extractFromJson(nextData);
}

function scrapeBooksy(html, nextData) {
  const result = extractFromJson(nextData);
  if (result.services.length === 0) {
    const m = html.match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?);\s*<\/script>/);
    if (m) {
      try {
        const r = extractFromJson(JSON.parse(m[1]));
        if (r.services.length > 0 || r.businessName) return r;
      } catch {}
    }
  }
  return result;
}

function scrapeFallback(html, nextData) {
  if (nextData) {
    const result = extractFromJson(nextData);
    if (result.businessName || result.services.length > 0) return result;
  }
  const ld = extractJsonLd(html);
  const bizLd = ld.find(o => ['LocalBusiness', 'HairSalon', 'BeautySalon', 'HealthAndBeautyBusiness'].includes(o['@type']));
  const offerLd = ld.filter(o => ['Offer', 'Service', 'Product'].includes(o['@type']));
  return {
    businessName: bizLd?.name || '',
    bio: bizLd?.description || '',
    services: offerLd.map(o => ({
      name: o.name || '',
      price: o.price ? `$${o.price}` : (o.priceRange || ''),
      description: o.description || '',
    })).filter(s => s.name),
  };
}

app.post('/api/scrape-booking', async (req, res) => {
  let { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });

  // Normalize — add protocol if missing
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.json({ error: `Page returned ${response.status}`, businessName: '', bio: '', services: [] });
    }

    const html = await response.text();
    const platform = detectPlatform(url);
    const nextData = extractNextData(html);

    let result;
    switch (platform) {
      case 'styleseat': result = scrapeStyleSeat(html, nextData); break;
      case 'vagaro':    result = scrapeVagaro(html, nextData); break;
      case 'calendly':  result = await scrapeCalendly(html, nextData, url); break;
      case 'square':    result = scrapeSquare(html, nextData); break;
      case 'booksy':    result = scrapeBooksy(html, nextData); break;
      default:          result = scrapeFallback(html, nextData);
    }

    if (!result.businessName) result.businessName = extractMeta(html, 'og:title').split(/[|—\-]/)[0].trim();
    if (!result.bio)          result.bio = extractMeta(html, 'og:description');

    return res.json({ platform, ...result });
  } catch (err) {
    console.error('[scrape-booking] error:', err.message);
    return res.status(200).json({ error: err.message, businessName: '', bio: '', services: [] });
  }
});

// ── Google Calendar OAuth ─────────────────────────────────────────────────────

const GCAL_REDIRECT_URI = `${process.env.BETTER_AUTH_URL}/api/calendar/google/callback`;
const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

app.get('/api/calendar/google/auth-url', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const state = Buffer.from(JSON.stringify({ stylistId: userId })).toString('base64');
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  GCAL_REDIRECT_URI,
    response_type: 'code',
    scope:         GCAL_SCOPE,
    access_type:   'offline',
    prompt:        'consent',
    state,
  });
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

function calendarCallbackPage(params) {
  const deepLink = `crwn://calendar-callback?${new URLSearchParams(params)}`;
  const isSuccess = params.success === 'true';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CRWN Calendar</title>
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a1a;color:#fff}
  .box{text-align:center;padding:32px}.icon{font-size:48px;margin-bottom:16px}
  p{color:#aaa;margin:8px 0 0}</style></head><body>
  <div class="box">
    <div class="icon">${isSuccess ? '✅' : '❌'}</div>
    <h2>${isSuccess ? 'Google Calendar connected!' : 'Connection failed'}</h2>
    <p>${isSuccess ? 'You can close this window and return to CRWN.' : 'Please close this window and try again.'}</p>
  </div>
  <script>
    try { window.location.href = ${JSON.stringify(deepLink)}; } catch(e) {}
    setTimeout(function(){ try { window.close(); } catch(e) {} }, 800);
  </script></body></html>`;
}

app.get('/api/calendar/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.send(calendarCallbackPage({ error: error || 'cancelled' }));
  }

  let stylistId;
  try {
    stylistId = JSON.parse(Buffer.from(state, 'base64').toString()).stylistId;
  } catch {
    return res.send(calendarCallbackPage({ error: 'invalid_state' }));
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  GCAL_REDIRECT_URI,
        grant_type:    'authorization_code',
        code,
      }).toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('[calendar/callback] token error:', tokenData);
      return res.send(calendarCallbackPage({ error: 'token_failed' }));
    }

    const tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
    const h = supabaseAdminHeaders();

    await fetch(`${SUPABASE_URL}/rest/v1/stylist_calendar_integrations`, {
      method: 'POST',
      headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        stylist_id:          stylistId,
        provider:            'google',
        access_token:        tokenData.access_token,
        refresh_token:       tokenData.refresh_token || null,
        token_expiry:        tokenExpiry,
        google_calendar_id:  'primary',
        updated_at:          new Date().toISOString(),
      }),
    });

    return res.send(calendarCallbackPage({ success: 'true' }));
  } catch (err) {
    console.error('[calendar/callback] error:', err.message);
    return res.send(calendarCallbackPage({ error: 'server_error' }));
  }
});

app.get('/api/calendar/google/status', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ connected: false });
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/stylist_calendar_integrations?stylist_id=eq.${userId}&select=google_calendar_id,connected_at`,
      { headers: supabaseAdminHeaders() }
    );
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return res.json({ connected: true, connectedAt: rows[0].connected_at });
    }
    return res.json({ connected: false });
  } catch {
    return res.json({ connected: false });
  }
});

app.delete('/api/calendar/google/disconnect', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/stylist_calendar_integrations?stylist_id=eq.${userId}`,
      { method: 'DELETE', headers: supabaseAdminHeaders() }
    );
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

async function refreshGCalToken(userId, refreshToken) {
  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }).toString(),
  });
  const data = await refreshRes.json();
  if (!data.access_token) return null;
  const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await fetch(
    `${SUPABASE_URL}/rest/v1/stylist_calendar_integrations?stylist_id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: { ...supabaseAdminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ access_token: data.access_token, token_expiry: newExpiry, updated_at: new Date().toISOString() }),
    }
  );
  return data.access_token;
}

app.post('/api/calendar/google/create-event', async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { bookingId, title, startDateTime, endDateTime, description, attendeeEmail } = req.body || {};
  if (!startDateTime || !endDateTime) {
    return res.status(400).json({ message: 'startDateTime and endDateTime are required' });
  }

  const h = supabaseAdminHeaders();
  try {
    const tokensRes = await fetch(
      `${SUPABASE_URL}/rest/v1/stylist_calendar_integrations?stylist_id=eq.${userId}&select=*`,
      { headers: h }
    );
    const tokens = await tokensRes.json();
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.status(404).json({ message: 'Google Calendar not connected' });
    }

    let { access_token, refresh_token, token_expiry, google_calendar_id } = tokens[0];

    if (new Date(token_expiry) <= new Date() && refresh_token) {
      access_token = await refreshGCalToken(userId, refresh_token) || access_token;
    }

    const event = {
      summary:     title || 'Appointment',
      description: description || '',
      start: { dateTime: startDateTime, timeZone: 'UTC' },
      end:   { dateTime: endDateTime,   timeZone: 'UTC' },
    };
    if (attendeeEmail) event.attendees = [{ email: attendeeEmail }];

    const calendarId = google_calendar_id || 'primary';
    const eventRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }
    );
    const eventData = await eventRes.json();

    if (!eventRes.ok) {
      console.error('[calendar/create-event] Google API error:', eventData);
      return res.status(eventRes.status).json({ message: eventData.error?.message || 'Calendar API error' });
    }

    if (bookingId) {
      await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`, {
        method: 'PATCH',
        headers: { ...h, Prefer: 'return=minimal' },
        body: JSON.stringify({ google_event_id: eventData.id }),
      });
    }

    return res.json({ success: true, eventId: eventData.id });
  } catch (err) {
    console.error('[calendar/create-event] error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Instagram OAuth ───────────────────────────────────────────────────────────

app.get('/api/instagram/auth-url', (_req, res) => {
  const redirectUri = `${process.env.BETTER_AUTH_URL}/api/instagram/callback`;
  const url = `https://www.instagram.com/oauth/authorize?client_id=${encodeURIComponent(process.env.INSTAGRAM_APP_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=instagram_business_basic&response_type=code`;
  res.json({ url });
});

app.get('/api/instagram/callback', async (req, res) => {
  const { code, error } = req.query;
  const appScheme = 'crwn://instagram-callback';

  if (error || !code) {
    return res.redirect(`${appScheme}?error=${encodeURIComponent(error || 'cancelled')}`);
  }

  try {
    const redirectUri = `${process.env.BETTER_AUTH_URL}/api/instagram/callback`;
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        grant_type:    'authorization_code',
        redirect_uri:  redirectUri,
        code,
      }).toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('[instagram/callback] token error:', tokenData);
      return res.redirect(`${appScheme}?error=token_failed`);
    }

    const mediaRes = await fetch(
      `https://graph.instagram.com/me/media?fields=id,media_type,media_url,caption&limit=20&access_token=${tokenData.access_token}`
    );
    const mediaData = await mediaRes.json();

    const photos = (mediaData.data || [])
      .filter(m => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM')
      .slice(0, 12)
      .map(m => ({ url: m.media_url, caption: m.caption || '' }))
      .filter(p => p.url);

    return res.redirect(`${appScheme}?photos=${encodeURIComponent(JSON.stringify(photos))}`);
  } catch (err) {
    console.error('[instagram/callback] error:', err.message);
    return res.redirect(`${appScheme}?error=server_error`);
  }
});

// Better Auth handles all /api/auth/* routes
app.all('/api/auth/*', (req, res, next) => {
  Promise.resolve(toNodeHandler(auth)(req, res)).catch((err) => {
    console.error('[better-auth crash]', err);
    if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
  });
});

// app.listen(PORT, () => {
//   console.log(`CRWN auth server running on port ${PORT}`);
// });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CRWN auth server running on port ${PORT}`);
});