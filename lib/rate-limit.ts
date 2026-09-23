import { prisma } from '@/lib/db';

/**
 * Login throttling, backed by the LoginAttempt table.
 *
 * Two independent counters, because the two attacks look different:
 *   - per EMAIL  — someone guessing one account's password from anywhere.
 *   - per IP     — someone spraying one password across many accounts.
 * Tripping either one is enough to refuse the attempt.
 *
 * This is database-backed on purpose. An in-memory counter is per-instance, so
 * on any multi-instance deploy an attacker just gets N times the budget and the
 * limit silently stops meaning anything. Correct-but-slower beats fast-and-
 * decorative for a security control.
 */

/** Failures allowed per email inside the window before it locks. */
const MAX_PER_EMAIL = 8;
/** Failures allowed per IP inside the window. Higher: NAT shares addresses. */
const MAX_PER_IP = 25;
/** Rolling window. Also how long a lockout lasts, since it is the same window. */
const WINDOW_MINUTES = 15;

export type ThrottleVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number; reason: 'email' | 'ip' };

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_MINUTES * 60_000);
}

/** Normalise so casing/padding cannot be used to dodge the per-email counter. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Should this attempt be allowed? Counts only FAILURES in the window: a
 * successful sign-in should not count against the next one, or a busy shared
 * office would throttle itself.
 *
 * Fails OPEN. If the counter query itself errors we return allowed, because a
 * database blip must not become a company-wide lockout — the password check
 * still has to pass on its own merits either way.
 */
export async function checkLoginThrottle(email: string, ip: string | null): Promise<ThrottleVerdict> {
  const since = windowStart();
  const addr = ip ?? 'unknown';
  try {
    const [byEmail, byIp] = await Promise.all([
      prisma.loginAttempt.count({
        where: { email: normaliseEmail(email), success: false, createdAt: { gte: since } },
      }),
      prisma.loginAttempt.count({
        where: { ip: addr, success: false, createdAt: { gte: since } },
      }),
    ]);

    if (byEmail >= MAX_PER_EMAIL) {
      return { allowed: false, retryAfterMinutes: WINDOW_MINUTES, reason: 'email' };
    }
    if (byIp >= MAX_PER_IP) {
      return { allowed: false, retryAfterMinutes: WINDOW_MINUTES, reason: 'ip' };
    }
    return { allowed: true };
  } catch (err) {
    console.error('[rate-limit] check failed, failing open', err);
    return { allowed: true };
  }
}

/** Record an attempt. Never throws — see lib/audit.ts for the same reasoning. */
export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  success: boolean,
): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: { email: normaliseEmail(email), ip: ip ?? 'unknown', success },
    });
  } catch (err) {
    console.error('[rate-limit] record failed', err);
  }
}

/**
 * Clear an account's failures after a genuine sign-in, so a user who fumbled
 * their password twice then got it right starts from a clean slate instead of
 * carrying strikes for the rest of the window.
 */
export async function clearLoginFailures(email: string): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({
      where: { email: normaliseEmail(email), success: false },
    });
  } catch (err) {
    console.error('[rate-limit] clear failed', err);
  }
}

/**
 * Drop rows older than the window. Called opportunistically on sign-in rather
 * than from a cron, so the table cannot grow without bound in a deploy that has
 * no scheduler wired up.
 */
export async function pruneLoginAttempts(): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
    });
  } catch {
    // Pruning is housekeeping; a failure here is not worth a log line.
  }
}
