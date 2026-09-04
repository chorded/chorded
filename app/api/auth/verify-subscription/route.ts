import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ verified: false, error: 'Valid email address is required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const token = process.env.GUMROAD_ACCESS_TOKEN || process.env.NEXT_PUBLIC_GUMROAD_ACCESS_TOKEN;

    if (!token) {
      console.warn('GUMROAD_ACCESS_TOKEN is missing in environment variables.');
      return NextResponse.json({
        verified: false,
        error: 'Gumroad API token is not configured on the server. Please set GUMROAD_ACCESS_TOKEN in .env.local.'
      }, { status: 500 });
    }

    // Call Gumroad Sales API to check purchases/subscriptions for this email
    const response = await fetch(`https://api.gumroad.com/v2/sales?email=${encodeURIComponent(normalizedEmail)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gumroad API error:', response.status, errText);
      return NextResponse.json({
        verified: false,
        error: 'Unable to verify subscription with Gumroad at this time. Please try again later.'
      }, { status: 502 });
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.sales)) {
      return NextResponse.json({
        verified: false,
        error: 'Unexpected response from Gumroad API.'
      }, { status: 500 });
    }

    // Filter sales to find any valid active subscription or purchase
    const sales = data.sales;
    const hasValidSubscription = sales.some((sale: any) => {
      // Must not be refunded or chargebacked
      if (sale.refunded || sale.chargebacked) return false;

      // If subscription ended date exists and is in the past, it's expired
      if (sale.subscription_ended_at) {
        const endedAt = new Date(sale.subscription_ended_at).getTime();
        if (endedAt < Date.now()) return false;
      }

      // If subscription payment failed and ended
      if (sale.subscription_failed_at && sale.subscription_ended_at) {
        return false;
      }

      return true;
    });

    if (!hasValidSubscription) {
      return NextResponse.json({
        verified: false,
        error: 'No active Gumroad subscription found for this email address. Please make sure you purchased with this email.'
      }, { status: 200 });
    }

    return NextResponse.json({ verified: true });
  } catch (error: any) {
    console.error('Verify subscription error:', error);
    return NextResponse.json({ verified: false, error: 'Internal server error while verifying subscription.' }, { status: 500 });
  }
}
