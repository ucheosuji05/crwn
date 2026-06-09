import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Bridge page: opens in WebBrowser, uses in-browser fetch (JSON) to get the
// OAuth URL, then navigates the browser to it — keeping the entire OAuth flow
// in one browser session so Better Auth's state cookie is present for the callback.
app.get('/api/auth/oauth-start/:provider', (req, res) => {
  const provider = req.params.provider.replace(/[^a-z]/g, '');
  const callbackURL = `${process.env.BETTER_AUTH_URL}/api/auth/mobile-callback`;
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Signing in...</title>
    <style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;background:#1a1a1a;color:#fff}p{opacity:.7}</style>
    </head><body><p id="msg">Redirecting...</p>
    <script>
      fetch('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ provider: '${provider}', callbackURL: '${callbackURL}', disableRedirect: true })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var url = data.url || (data.data && data.data.url);
        if (url) { window.location.href = url; }
        else { document.getElementById('msg').textContent = 'Sign-in failed - close and try again.'; }
      })
      .catch(function() { document.getElementById('msg').textContent = 'Connection error - close and try again.'; });
    </script>
    </body></html>`);
});

// In-browser password reset form. Works from email → Safari without needing
// the app to handle a deep link (which doesn't work in Expo Go from external Safari).
app.get('/api/auth/open-app', (req, res) => {
  const token = (req.query.token || '').replace(/[<>"'\s]/g, '');
  if (!token) return res.status(400).send('Missing token');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Reset CRWN Password</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(160deg,#E8C4B8,#D4A574,#A67B5B);font-family:-apple-system,sans-serif;padding:24px}
      .card{background:#fff;border-radius:20px;padding:32px 24px;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.15)}
      h1{font-size:32px;font-weight:800;text-align:center;color:#A67B5B;letter-spacing:1px;margin-bottom:8px}
      h2{font-size:20px;font-weight:700;color:#222;margin-bottom:8px}
      p{color:#666;font-size:14px;line-height:1.6;margin-bottom:24px}
      label{display:block;font-size:13px;font-weight:600;color:#444;margin-bottom:6px}
      input{display:block;width:100%;padding:14px;border:1.5px solid #ddd;border-radius:10px;font-size:16px;color:#111;margin-bottom:16px;outline:none}
      input:focus{border-color:#A67B5B}
      button{width:100%;padding:16px;background:#A67B5B;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-top:4px}
      button:disabled{opacity:.6}
      .msg{margin-top:16px;padding:12px;border-radius:8px;font-size:14px;text-align:center}
      .msg.error{background:#fee2e2;color:#b91c1c}
      .msg.success{background:#dcfce7;color:#166534}
    </style>
    </head><body>
    <div class="card">
      <h1>crwn</h1>
      <h2>Set new password</h2>
      <p>Choose a password that is at least 6 characters long.</p>
      <div id="form-wrap">
        <label for="pw">New password</label>
        <input id="pw" type="password" placeholder="At least 6 characters" autocomplete="new-password">
        <label for="pw2">Confirm password</label>
        <input id="pw2" type="password" placeholder="Repeat your password" autocomplete="new-password">
        <button id="btn" onclick="submit()">Reset Password</button>
      </div>
      <div id="msg" class="msg" style="display:none"></div>
    </div>
    <script>
      var token = ${JSON.stringify(token)};
      function submit() {
        var pw = document.getElementById('pw').value;
        var pw2 = document.getElementById('pw2').value;
        var msg = document.getElementById('msg');
        msg.style.display = 'none';
        if (pw.length < 6) { show('Password must be at least 6 characters.', true); return; }
        if (pw !== pw2) { show('Passwords do not match.', true); return; }
        var btn = document.getElementById('btn');
        btn.disabled = true; btn.textContent = 'Resetting...';
        fetch('/api/auth/web-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
          body: JSON.stringify({ newPassword: pw, token: token })
        })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
        .then(function(res) {
          if (res.ok && res.d.success) {
            document.getElementById('form-wrap').style.display = 'none';
            show('Password updated! Go back to the CRWN app and sign in with your new password.', false);
          } else {
            btn.disabled = false; btn.textContent = 'Reset Password';
            show(res.d.message || 'Link may have expired. Request a new one in the app.', true);
          }
        })
        .catch(function() {
          btn.disabled = false; btn.textContent = 'Reset Password';
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
    </body></html>`);
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
app.get('/api/auth/mobile-callback', (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;

  if (!token) {
    return res.redirect('crwn://auth/callback?error=no_session');
  }
  res.redirect(`crwn://auth/callback?token=${encodeURIComponent(token)}`);
});

// Better Auth handles all /api/auth/* routes
app.all('/api/auth/*', toNodeHandler(auth));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`CRWN auth server running on port ${PORT}`);
});
