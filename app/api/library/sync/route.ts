import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSongSlug } from '@/lib/library-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function parseCrdFile(content: string, fileName: string) {
  const defaultTitle = fileName.replace(/\.[^/.]+$/, '');
  try {
    const parsed = JSON.parse(content);
    function extractContent(raw: any) {
      if (!raw) return { type: 'doc', content: [] };
      if (raw.type === 'doc') return raw;
      if (Array.isArray(raw)) return { type: 'doc', content: raw };
      if (typeof raw === 'string') return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: raw }] }] };
      return { type: 'doc', content: [] };
    }
    const songTitle = parsed.title || defaultTitle;
    const rawContent = parsed.editorContent || parsed.content;
    const rawText = parsed.rawText || parsed.raw_text || '';
    const contentDoc = extractContent(rawContent);

    let songArtist = parsed.artist || parsed.artistName || parsed.author || parsed.metadata?.artist || parsed.metadata?.artistName || parsed.metadata?.author || parsed.metadata?.by || null;
    if (!songArtist && rawText) {
      const match = rawText.match(/^\{(?:artist|a|author|by)\s*:\s*(.*?)\}$/m) || rawText.match(/^(?:artist|author|by)\s*:\s*(.+)$/im);
      if (match && match[1].trim()) songArtist = match[1].trim();
    }

    const songKey = parsed.key || parsed.originalKey || parsed.original_key || 'C';
    const currentKey = parsed.currentKey || parsed.current_key || songKey;
    const bpm = parsed.bpm ?? parsed.tempo ?? parsed.metadata?.tempo ?? null;
    const timeSignature = parsed.timeSignature ?? parsed.time_signature ?? parsed.metadata?.timeSignature ?? null;
    const notes = parsed.notes || (parsed.metadata?.author ? `Author: ${parsed.metadata.author}` : parsed.artist ? `Artist: ${parsed.artist}` : '');
    return { title: songTitle, artist: songArtist, original_key: songKey, current_key: currentKey, bpm, time_signature: timeSignature, content: contentDoc, raw_text: rawText, notes };
  } catch {
    // If text / ChordPro
    const match = content.match(/^\{(?:artist|a|author|by)\s*:\s*(.*?)\}$/m) || content.match(/^(?:artist|author|by)\s*:\s*(.+)$/im);
    const songArtist = match ? match[1].trim() : null;
    return { title: defaultTitle, artist: songArtist, original_key: 'C', current_key: 'C', bpm: null, time_signature: null, content: { type: 'doc', content: [] }, raw_text: content, notes: '' };
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) return NextResponse.json({ error: 'Invalid or expired session. Please log in again on chorded-xi.vercel.app.' }, { status: 401 });

  let scores: Array<{ name: string; content: string }> = [];
  try {
    const body = await req.json();
    scores = body.scores;
    if (!Array.isArray(scores) || scores.length === 0) return NextResponse.json({ error: 'No scores provided.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { data: existingLibrary } = await supabase.from('library_songs').select('id, title').eq('user_id', user.id);
  const existingMap = new Map((existingLibrary || []).map((s: any) => [s.title.trim().toLowerCase(), s.id as string]));

  let synced = 0, failed = 0;
  const errors: string[] = [];

  for (const file of scores) {
    const song = parseCrdFile(file.content, file.name);
    if (!song) { failed++; errors.push(`Could not parse: ${file.name}`); continue; }
    const cleanKey = song.title.trim().toLowerCase();
    const slug = getSongSlug(song.title, song.artist);
    const existingId = existingMap.get(cleanKey);
    if (existingId) {
      const { error } = await supabase.from('library_songs').update({ title: song.title, artist: song.artist, slug, original_key: song.original_key, current_key: song.current_key, bpm: song.bpm, time_signature: song.time_signature, content: song.content, raw_text: song.raw_text, notes: song.notes, updated_at: new Date().toISOString() }).eq('id', existingId);
      if (error) { failed++; errors.push(`Update failed for "${song.title}": ${error.message}`); } else synced++;
    } else {
      const { data: inserted, error } = await supabase.from('library_songs').insert({ user_id: user.id, title: song.title, artist: song.artist, slug, original_key: song.original_key, current_key: song.current_key, bpm: song.bpm, time_signature: song.time_signature, content: song.content, raw_text: song.raw_text, notes: song.notes, is_starred: false }).select('id').single();
      if (error) { failed++; errors.push(`Insert failed for "${song.title}": ${error.message}`); } else { synced++; if (inserted) existingMap.set(cleanKey, inserted.id); }
    }
  }

  return NextResponse.json({ success: synced > 0, synced, failed, errors: errors.length > 0 ? errors : undefined });
}
