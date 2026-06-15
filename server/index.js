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

// ── Shared helpers ────────────────────────────────────────────────────────────

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

// Better Auth handles all /api/auth/* routes
app.all('/api/auth/*', toNodeHandler(auth));

// app.listen(PORT, () => {
//   console.log(`CRWN auth server running on port ${PORT}`);
// });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CRWN auth server running on port ${PORT}`);
});