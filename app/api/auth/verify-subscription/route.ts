import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, licenseKey } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ verified: false, error: 'A valid email address is required.' }, { status: 400 });
    }

    if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.trim()) {
      return NextResponse.json({ verified: false, error: 'A Gumroad license key is required.' }, { status: 400 });
    }

    const cleanKey = licenseKey.trim();
    const inputEmail = email.trim().toLowerCase();
    const token = process.env.GUMROAD_ACCESS_TOKEN || process.env.NEXT_PUBLIC_GUMROAD_ACCESS_TOKEN;

    console.log(`[Verify Subscription] Verifying key "${cleanKey}" for email "${inputEmail}"`);

    let verifiedPurchase: any = null;
    let mismatchEmail: string | null = null;

    // ─────────────────────────────────────────────────────────────
    // STRATEGY 1: Check via Gumroad Sales API (if GUMROAD_ACCESS_TOKEN is available)
    // ─────────────────────────────────────────────────────────────
    if (token) {
      try {
        console.log('[Verify Subscription] Querying Gumroad Sales API...');
        const salesRes = await fetch(`https://api.gumroad.com/v2/sales?email=${encodeURIComponent(inputEmail)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (salesRes.ok) {
          const salesData = await salesRes.json();
          if (salesData.success && Array.isArray(salesData.sales)) {
            console.log(`[Verify Subscription] Found ${salesData.sales.length} sales for email ${inputEmail}`);
            for (const sale of salesData.sales) {
              const saleKey = (sale.license_key || '').trim();
              if (saleKey && saleKey.toLowerCase() === cleanKey.toLowerCase()) {
                verifiedPurchase = sale;
                break;
              }
            }

            if (!verifiedPurchase && salesData.sales.length > 0) {
              for (const sale of salesData.sales) {
                const saleKey = (sale.license_key || '').trim();
                if (saleKey && (saleKey.toLowerCase() === cleanKey.toLowerCase() || !cleanKey)) {
                  verifiedPurchase = sale;
                  break;
                }
              }
            }
          }
        } else {
          console.warn('[Verify Subscription] Sales API returned status:', salesRes.status);
        }
      } catch (err) {
        console.error('[Verify Subscription] Error checking Sales API:', err);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STRATEGY 2: Check via Gumroad Licenses Verify API
    // ─────────────────────────────────────────────────────────────
    if (!verifiedPurchase) {
      const permalinksEnv = process.env.GUMROAD_PRODUCT_PERMALINKS || process.env.GUMROAD_PRODUCT_PERMALINK || '1month,1year';
      const permalinks = permalinksEnv
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      console.log('[Verify Subscription] Trying License Verify API with permalinks:', permalinks);

      for (const permalink of permalinks) {
        const body = new URLSearchParams({
          product_permalink: permalink,
          license_key: cleanKey,
          increment_uses_count: 'false',
        });

        const headers: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        try {
          const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
            method: 'POST',
            headers,
            body: body.toString(),
            cache: 'no-store',
          });

          const data = await response.json();
          console.log(`[Verify Subscription] Verify API response for permalink "${permalink}":`, JSON.stringify(data));

          if (data.success && data.purchase) {
            verifiedPurchase = data.purchase;
            break;
          } else if (data.purchase) {
            verifiedPurchase = data.purchase;
            break;
          }
        } catch (err) {
          console.error(`[Verify Subscription] License verify error for permalink ${permalink}:`, err);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STRATEGY 3: Query all sales with GUMROAD_ACCESS_TOKEN to find matching license key (handles email mismatch)
    // ─────────────────────────────────────────────────────────────
    if (!verifiedPurchase && token) {
      try {
        console.log('[Verify Subscription] Querying all recent sales to search key directly...');
        const allSalesRes = await fetch('https://api.gumroad.com/v2/sales', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (allSalesRes.ok) {
          const allSalesData = await allSalesRes.json();
          if (allSalesData.success && Array.isArray(allSalesData.sales)) {
            const foundSale = allSalesData.sales.find((s: any) =>
              (s.license_key || '').trim().toLowerCase() === cleanKey.toLowerCase()
            );

            if (foundSale) {
              const actualEmail = (foundSale.email || '').trim().toLowerCase();
              if (actualEmail !== inputEmail) {
                mismatchEmail = actualEmail;
              } else {
                verifiedPurchase = foundSale;
              }
            }
          }
        }
      } catch (err) {
        console.error('[Verify Subscription] All sales query error:', err);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // VALIDATION & RESPONSE
    // ─────────────────────────────────────────────────────────────
    if (mismatchEmail) {
      return NextResponse.json({
        verified: false,
        error: `This license key is registered to a different email address. Please sign in with the email used during purchase.`,
      }, { status: 200 });
    }

    if (!verifiedPurchase) {
      return NextResponse.json({
        verified: false,
        error: 'Invalid or inactive Gumroad license key. Please check your key and email address.',
      }, { status: 200 });
    }

    // Validate purchase email if available
    const purchaseEmail = (verifiedPurchase.email || '').trim().toLowerCase();
    if (purchaseEmail && purchaseEmail !== inputEmail) {
      return NextResponse.json({
        verified: false,
        error: 'The email address provided does not match the purchase email for this license key.',
      }, { status: 200 });
    }

    // Check if refunded or chargebacked
    if (verifiedPurchase.refunded || verifiedPurchase.chargebacked || verifiedPurchase.disputed) {
      return NextResponse.json({
        verified: false,
        error: 'This license key has been refunded or chargebacked and is no longer active.',
      }, { status: 200 });
    }

    // Check if subscription has ended / expired
    if (verifiedPurchase.subscription_ended_at) {
      const endedAt = new Date(verifiedPurchase.subscription_ended_at).getTime();
      if (endedAt < Date.now()) {
        return NextResponse.json({
          verified: false,
          error: 'Your Chorded Pro subscription for this license key has expired. Please renew on Gumroad to regain access.',
        }, { status: 200 });
      }
    }

    // Check if subscription is cancelled and already past end date
    if (verifiedPurchase.subscription_cancelled_at) {
      const cancelledAt = new Date(verifiedPurchase.subscription_cancelled_at).getTime();
      const endedAt = verifiedPurchase.subscription_ended_at
        ? new Date(verifiedPurchase.subscription_ended_at).getTime()
        : cancelledAt;

      if (endedAt < Date.now()) {
        return NextResponse.json({
          verified: false,
          error: 'Your Chorded Pro subscription was cancelled and has expired. Please renew to regain access.',
        }, { status: 200 });
      }
    }

    console.log(`[Verify Subscription] SUCCESS! Verified active license key for ${purchaseEmail || inputEmail}`);
    return NextResponse.json({ verified: true, email: purchaseEmail || inputEmail });
  } catch (error: any) {
    console.error('[Verify Subscription] Internal error:', error);
    return NextResponse.json({ verified: false, error: 'Internal server error while verifying license.' }, { status: 500 });
  }
}
