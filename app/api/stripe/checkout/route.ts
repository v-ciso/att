import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

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

    const { priceId } = await request.json();

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
    });

    return NextResponse.json({ sessionId: checkoutSession.id, url: checkoutSession.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}