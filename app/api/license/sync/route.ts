import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { licenseKey } = await req.json();

    if (!licenseKey || typeof licenseKey !== 'string') {
      return NextResponse.json({ error: 'Valid license key is required' }, { status: 400 });
    }

    const { data: existing, error: selectError } = await supabase
      .from('license_activations')
      .select('activated_at')
      .eq('license_key', licenseKey)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Supabase select error:', selectError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ activatedAt: existing.activated_at });
    }

    const now = new Date().toISOString();
    const { error: insertError } = await supabase
      .from('license_activations')
      .insert({ license_key: licenseKey, activated_at: now });

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json({ error: 'Could not record activation' }, { status: 500 });
    }

    return NextResponse.json({ activatedAt: now });

  } catch (error) {
    console.error('License sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
