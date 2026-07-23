// Transactional email via Resend.
//
// Nothing here sends unless RESEND_API_KEY is set — every helper no-ops and
// says so, so a missing key can never crash provisioning. Onboarding a customer
// must not fail because email is misconfigured; you would have created their
// account and lost the credentials.
//
// Setup is in RUNBOOK.md ("Email"). Sender defaults to sales@kgvinc.com and is
// overridable with EMAIL_FROM.

const FROM = process.env.EMAIL_FROM ?? 'Sales Engine <sales@kgvinc.com>';
const APP_URL = process.env.NEXTAUTH_URL ?? 'https://att.soramimarketing.com';

export interface SendResult {
  sent: boolean;
  reason?: string;
  id?: string;
}

async function send(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'RESEND_API_KEY not set — email skipped' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    });
    if (!res.ok) return { sent: false, reason: `Resend returned ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const data = (await res.json()) as { id?: string };
    return { sent: true, id: data.id };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'network error' };
  }
}

// Plain, dark-friendly shell. Deliberately minimal markup: mail clients strip
// most CSS, and a broken layout in Outlook is worse than a plain email.
function shell(heading: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111318;border:1px solid #26272b;border-radius:14px;padding:28px">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#B8860B">Sales Engine</p>
          <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff">${heading}</h1>
          ${body}
          <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #26272b;font-size:12px;color:#6B7280">
            Powered by KGV Inc &middot; Billing and support through KGV Inc
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#E7C24A;color:#1a1400;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;display:inline-block">${label}</a></p>`;

/**
 * Sent when a customer's account is created. Carries the temporary password,
 * so it goes to exactly one recipient and is never BCC'd.
 */
export function sendWelcome(opts: {
  to: string; company: string; tempPassword: string; campaign: string; seats: number;
}): Promise<SendResult> {
  const { to, company, tempPassword, campaign, seats } = opts;
  const body = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6">Your Sales Engine account for <strong style="color:#fff">${company}</strong> is ready.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:0 0 8px">
      <tr><td style="padding:6px 0;color:#9CA3AF">Sign in</td><td style="padding:6px 0;color:#fff">${APP_URL}</td></tr>
      <tr><td style="padding:6px 0;color:#9CA3AF">Email</td><td style="padding:6px 0;color:#fff">${to}</td></tr>
      <tr><td style="padding:6px 0;color:#9CA3AF">Temporary password</td><td style="padding:6px 0;color:#E7C24A;font-family:monospace">${tempPassword}</td></tr>
      <tr><td style="padding:6px 0;color:#9CA3AF">Campaign</td><td style="padding:6px 0;color:#fff">${campaign}</td></tr>
      <tr><td style="padding:6px 0;color:#9CA3AF">Logins included</td><td style="padding:6px 0;color:#fff">${seats}</td></tr>
    </table>
    ${button(APP_URL, 'Sign in and set your password')}
    <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6">
      Change this password as soon as you are in, under <strong style="color:#fff">Settings &rarr; Account</strong>.
      Until you do, the password above is the only thing protecting your numbers.
    </p>`;
  const text = `Your Sales Engine account for ${company} is ready.

Sign in: ${APP_URL}
Email: ${to}
Temporary password: ${tempPassword}
Campaign: ${campaign}
Logins included: ${seats}

Change this password immediately under Settings > Account.

Powered by KGV Inc - Billing and support through KGV Inc`;
  return send(to, `Your Sales Engine account for ${company}`, shell('Your account is ready', body), text);
}

/** Sent to an extra user added under an existing company. */
export function sendSeatInvite(opts: {
  to: string; company: string; tempPassword: string; role: string;
}): Promise<SendResult> {
  const { to, company, tempPassword, role } = opts;
  const access = role === 'VIEWER' ? 'read-only access' : 'edit access';
  const body = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6">You have been given ${access} to <strong style="color:#fff">${company}</strong>&rsquo;s Sales Engine.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px">
      <tr><td style="padding:6px 0;color:#9CA3AF">Sign in</td><td style="padding:6px 0;color:#fff">${APP_URL}</td></tr>
      <tr><td style="padding:6px 0;color:#9CA3AF">Email</td><td style="padding:6px 0;color:#fff">${to}</td></tr>
      <tr><td style="padding:6px 0;color:#9CA3AF">Temporary password</td><td style="padding:6px 0;color:#E7C24A;font-family:monospace">${tempPassword}</td></tr>
      <tr><td style="padding:6px 0;color:#9CA3AF">Access level</td><td style="padding:6px 0;color:#fff">${role}</td></tr>
    </table>
    ${button(APP_URL, 'Sign in')}
    <p style="margin:0;font-size:13px;color:#9CA3AF">Change your password under Settings &rarr; Account once you are in.</p>`;
  const text = `You have been given ${access} to ${company}'s Sales Engine.

Sign in: ${APP_URL}
Email: ${to}
Temporary password: ${tempPassword}
Access level: ${role}

Change your password under Settings > Account.`;
  return send(to, `You have been added to ${company} on Sales Engine`, shell('You have been added', body), text);
}

/** Sent to the vendor when someone requests access from the marketing page. */
export function sendAccessRequest(opts: {
  to: string; fromEmail: string; company: string; note?: string;
}): Promise<SendResult> {
  const { to, fromEmail, company, note } = opts;
  const body = `
    <p style="margin:0 0 14px;font-size:15px">New access request.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px">
      <tr><td style="padding:6px 0;color:#9CA3AF">Company</td><td style="padding:6px 0;color:#fff">${company}</td></tr>
      <tr><td style="padding:6px 0;color:#9CA3AF">Email</td><td style="padding:6px 0;color:#fff">${fromEmail}</td></tr>
      ${note ? `<tr><td style="padding:6px 0;color:#9CA3AF">Note</td><td style="padding:6px 0;color:#fff">${note}</td></tr>` : ''}
    </table>
    <p style="margin:22px 0 0;font-size:13px;color:#9CA3AF;font-family:monospace">
      npm run admin:create -- --email ${fromEmail} --company "${company}"
    </p>`;
  const text = `New access request.\n\nCompany: ${company}\nEmail: ${fromEmail}\n${note ? `Note: ${note}\n` : ''}
npm run admin:create -- --email ${fromEmail} --company "${company}"`;
  return send(to, `Access request: ${company}`, shell('New access request', body), text);
}
