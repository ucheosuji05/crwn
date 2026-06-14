import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// Send via Resend if key is present, otherwise log the link to console (dev)
async function sendEmail({ to, subject, html }) {
  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'CRWN <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log('Resend OK, email id:', data.id);
    } else {
      const err = await res.text();
      console.error('Resend error:', err);
    }
  } else {
    console.log(`\n── Password Reset (no email provider configured) ───`);
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:    ${html.replace(/<[^>]+>/g, '')}`);
    console.log(`───────────────────────────────────────────────────\n`);
  }
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,

  // Allow crwn:// deep links and the server's own origin (browser form POSTs from the bridge page)
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    'crwn://',
    'crwn://reset-password',
    'crwn://auth/callback',
    // Production Railway URL
    'https://crwn-production.up.railway.app',
    // Local dev IPs — phone on same Wi-Fi network
    'http://10.107.11.194:3001',
    'http://172.24.192.1:3001',
    'http://localhost:3001',
    // Expo web dev server origins
    'http://localhost:8081',
    'http://localhost:19006',
    'http://localhost:19000',
  ].filter(Boolean),

  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  // Generate UUIDs (in JS) for all Better Auth records so public.user.id stays
  // compatible with profiles.id (uuid) and auth.uid() (casts the JWT `sub` to uuid).
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
  },

  // Email + password sign up / sign in
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    sendResetPassword: async ({ user, url }) => {
      console.log('\n── sendResetPassword called ────────────────────────');
      console.log('   user:', user.email);
      console.log('   raw url from Better Auth:', url);

      let emailLink = url;
      try {
        const parsed = new URL(url);
        // Better Auth puts the token as the last path segment:
        // /api/auth/reset-password/TOKEN?callbackURL=...
        const pathToken = parsed.pathname.split('/').filter(Boolean).pop();
        console.log('   extracted token:', pathToken ? pathToken.substring(0, 20) + '...' : 'NONE');
        if (pathToken) {
          emailLink = `${process.env.BETTER_AUTH_URL}/api/auth/open-app?token=${encodeURIComponent(pathToken)}`;
        }
      } catch (e) {
        console.error('   URL parse error:', e.message);
      }

      console.log('   emailLink:', emailLink);
      console.log('────────────────────────────────────────────────────\n');

      await sendEmail({
        to: user.email,
        subject: 'Reset your CRWN password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2>Reset your password</h2>
            <p>Tap the button below to set a new CRWN password. This link expires in 1 hour.</p>
            <a href="${emailLink}" style="display:inline-block;background:#A67B5B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
              Reset Password
            </a>
            <p style="color:#999;font-size:13px;margin-top:24px">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    },
  },

  socialProviders: {
    // google: {
    //   clientId: process.env.GOOGLE_CLIENT_ID,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // },
    facebook: {
      clientId: process.env.META_CLIENT_ID,
      clientSecret: process.env.META_CLIENT_SECRET,
      scopes: ['email', 'public_profile', 'instagram_basic'],
    },
  },

  plugins: [bearer()],

  // Store extra fields on the user record
  user: {
    additionalFields: {
      userType: { type: 'string', required: false },   // 'explorer' | 'stylist'
      username: { type: 'string', required: false },
      location: { type: 'string', required: false },
      hairType: { type: 'string', required: false },
      hairPorosity: { type: 'string', required: false },
    },
  },
});
