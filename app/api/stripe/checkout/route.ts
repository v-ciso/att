import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';
import { z } from 'zod';
import { parseBody } from '@/lib/api-validation';

// Extended session user type for API routes
interface SessionUser {
  id: string;
  role: string;
  marketOwnerId: string;
  employeeId?: string;
  email?: string;
  subscriptionTier?: 'STANDARD' | 'WHITE_LABEL';
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const checkoutSchema = z.object({
  tier: z.enum(['STANDARD', 'WHITE_LABEL']),
});

/**
 * Tier -> Stripe price, resolved from the server environment only.
 *
 * Read at request time rather than module load so adding the env var does not
 * require a rebuild to take effect.
 */
const PRICE_BY_TIER: Record<'STANDARD' | 'WHITE_LABEL', string | undefined> = {
  get STANDARD() {
    return process.env.STRIPE_PRICE_STANDARD;
  },
  get WHITE_LABEL() {
    return process.env.STRIPE_PRICE_WHITE_LABEL;
  },
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // The client names a TIER; the server decides what that costs.
    //
    // This previously took a raw `priceId` from the body and handed it straight
    // to Stripe, which let the caller subscribe at any price in the account —
    // a cheaper tier, or a 0-cost test price — no matter what the UI offered
    // them. Price is not a client-supplied value.
    const parsed = await parseBody(request, checkoutSchema);
    if (!parsed.ok) return parsed.response;

    const priceId = PRICE_BY_TIER[parsed.data.tier];
    if (!priceId) {
      // Fail loudly rather than starting a checkout with `price: undefined`,
      // which Stripe would reject with a far less obvious error.
      console.error('[v0] missing price env for tier', parsed.data.tier);
      return NextResponse.json(
        { error: 'That plan is not available for purchase yet' },
        { status: 503 }
      );
    }

    const marketOwner = await prisma.marketOwner.findUnique({
      where: { id: user.marketOwnerId },
      select: { stripeCustomerId: true, name: true },
    });

    if (!marketOwner) {
      return NextResponse.json({ error: 'Market owner not found' }, { status: 404 });
    }

    let customerId = marketOwner.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || 'owner@fieldos.app',
        name: marketOwner.name,
        metadata: { marketOwnerId: user.marketOwnerId },
      });
      customerId = customer.id;
      await prisma.marketOwner.update({
        where: { id: user.marketOwnerId },
        data: { stripeCustomerId: customerId },
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?canceled=true`,
      metadata: { marketOwnerId: user.marketOwnerId },
    }, {
      // A double-clicked upgrade button, or a retry after a network blip, would
      // otherwise open two checkout sessions and risk two subscriptions on one
      // account. Keyed per tenant+tier+day so a genuine later attempt still
      // works, but a burst collapses to one session.
      idempotencyKey: `checkout:${user.marketOwnerId}:${parsed.data.tier}:${new Date().toISOString().slice(0, 10)}`,
    });

    return NextResponse.json({ sessionId: checkoutSession.id, url: checkoutSession.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
