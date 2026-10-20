import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use anon key — we rely on the "is_shared" RLS policy for public access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing setlist ID' }, { status: 400 });
  }

  // Fetch setlist — RLS will only allow this if is_shared = true
  const { data: setlist, error: setlistError } = await supabase
    .from('setlists')
    .select('id, title, description, stage_preferences, user_id')
    .eq('id', id)
    .eq('is_shared', true)
    .single();

  if (setlistError || !setlist) {
    return NextResponse.json(
      { error: 'Setlist not found or not shared.' },
      { status: 404 }
    );
  }

  // Fetch songs
  const { data: songs, error: songsError } = await supabase
    .from('setlist_songs')
    .select('id, song_index, title, original_key, current_key, bpm, time_signature, content, raw_text, notes')
    .eq('setlist_id', id)
    .order('song_index', { ascending: true });

  if (songsError) {
    console.error('[setlist-view] Error fetching songs:', songsError);
    return NextResponse.json({ error: 'Failed to load songs.' }, { status: 500 });
  }

  return NextResponse.json(
    { setlist: { ...setlist, songs: songs || [] } },
    {
      headers: {
        // Cache for 30 seconds, stale-while-revalidate for 60
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    }
  );
}
