import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const marketOwnerId = subscription.metadata.marketOwnerId;

        if (marketOwnerId) {
          const tier = subscription.items.data[0]?.price?.lookup_key?.includes('whitelabel') 
            ? 'WHITE_LABEL' 
            : 'STANDARD';

          await prisma.marketOwner.update({
            where: { id: marketOwnerId },
            data: {
              stripeSubscriptionId: subscription.id,
              subscriptionTier: tier as 'STANDARD' | 'WHITE_LABEL',
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const marketOwnerId = subscription.metadata.marketOwnerId;

        if (marketOwnerId) {
          await prisma.marketOwner.update({
            where: { id: marketOwnerId },
            data: {
              stripeSubscriptionId: null,
              subscriptionTier: 'STANDARD',
            },
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const marketOwnerId = invoice.subscription_details?.metadata?.marketOwnerId;

        if (marketOwnerId) {
          // Could send email notification here
          console.log(`Payment failed for market owner ${marketOwnerId}`);
        }
        break;
      }

      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        if (checkoutSession.mode === 'subscription' && checkoutSession.subscription) {
          const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription as string);
          const marketOwnerId = subscription.metadata.marketOwnerId;

          if (marketOwnerId) {
            const tier = subscription.items.data[0]?.price?.lookup_key?.includes('whitelabel')
              ? 'WHITE_LABEL'
              : 'STANDARD';

            await prisma.marketOwner.update({
              where: { id: marketOwnerId },
              data: {
                stripeSubscriptionId: subscription.id,
                subscriptionTier: tier as 'STANDARD' | 'WHITE_LABEL',
              },
            });
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}