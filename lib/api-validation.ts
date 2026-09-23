import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Shared request-body validation for route handlers.
 *
 * Routes were each doing their own ad-hoc checks (`if (!body.id) ...`), which
 * meant every field nobody thought to check went straight through to Prisma or
 * Stripe. This centralises the "reject malformed input at the edge" step so a
 * handler only ever sees a fully-typed, in-range body.
 */

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Parse and validate a JSON body against a schema.
 *
 * Returns a discriminated union rather than throwing, so handlers stay explicit
 * about the failure path instead of relying on a catch-all `try` that would
 * report a validation problem as a 500.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Surface which fields failed so a client can correct the call, but keep it
    // to paths and messages — never echo the submitted values back, since a
    // rejected body can contain a password or token.
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Invalid request',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.') || '(root)',
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Common field shapes, so limits are defined once instead of drifting between
 * routes. The caps are deliberate: unbounded strings are a cheap way to bloat a
 * tenant's storage or push a pathological value into a downstream API.
 */
export const fields = {
  /** A cuid from our own tables. Bounded to stop a megabyte-long "id". */
  id: z.string().trim().min(1).max(64),
  email: z.string().trim().toLowerCase().email().max(320),
  /** Display names: people, companies, stores. */
  name: z.string().trim().min(1).max(200),
  /**
   * Minimum 12 characters. Long-and-simple beats short-and-cryptic, and this is
   * the one place a weak choice affects every other control in the app.
   */
  password: z.string().min(12).max(200),
  /** Seat counts and similar: positive, whole, and sanely bounded. */
  count: z.number().int().positive().max(10_000),
};

/**
 * Make a field optional in the way HTML forms actually behave.
 *
 * An untouched text input submits `''`, not `undefined`. A plain `.optional()`
 * therefore still rejects it, and the admin console's add-user form sends both
 * `name: ''` and `password: ''` for the "let the server generate it" case —
 * so validating those as required strings would have broken creating a user
 * outright. Treat blank as absent, then apply the real rules to actual input.
 */
export function blankAsUndefined<S extends z.ZodTypeAny>(schema: S) {
  return z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    schema.optional()
  );
}
