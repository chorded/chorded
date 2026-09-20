import { supabase } from '@/lib/supabase';
import { parseUploadedSetlistFile, SetlistSong } from '@/lib/setlist-service';

export interface LibrarySong {
  id: string;
  user_id: string;
  title: string;
  artist?: string | null;
  slug?: string | null;
  is_public?: boolean;
  original_key: string;
  current_key: string;
  bpm?: number | null;
  time_signature?: string | null;
  content: any; // TipTap doc JSON
  raw_text?: string;
  notes?: string;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    display_name?: string | null;
    email?: string | null;
  } | null;
}

export interface LibrarySongLight {
  id: string;
  user_id?: string;
  title: string;
  artist?: string | null;
  slug?: string | null;
  is_public?: boolean;
  original_key: string;
  current_key: string;
  bpm?: number | null;
  time_signature?: string | null;
  is_starred: boolean;
  created_at: string;
  profiles?: {
    display_name?: string | null;
    email?: string | null;
  } | null;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function getSongSlug(title: string, artist?: string): string {
  const cleanTitle = slugify(title);
  const cleanArtist = artist ? slugify(artist) : '';
  if (cleanArtist) {
    return `${cleanTitle}-${cleanArtist}-chords`;
  }
  return `${cleanTitle}-chords`;
}

export function getUploaderName(
  song: Partial<LibrarySong>,
  currentUserId?: string
): string {
  if (currentUserId && song.user_id && song.user_id === currentUserId) {
    return 'You';
  }
  if (song.profiles?.display_name && song.profiles.display_name.trim()) {
    return song.profiles.display_name.trim();
  }
  if (song.profiles?.email) {
    return song.profiles.email.split('@')[0];
  }
  return 'CHORDED Community';
}

export async function fetchLibrarySongsLight(): Promise<LibrarySongLight[]> {
  try {
    const { data, error } = await supabase
      .from('library_songs')
      .select('id, user_id, title, artist, slug, is_public, original_key, current_key, bpm, time_signature, is_starred, created_at, profiles:user_id(display_name, email)')
      .order('is_starred', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback query if profiles relationship is unavailable
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('library_songs')
        .select('id, user_id, title, original_key, current_key, bpm, time_signature, is_starred, created_at')
        .order('is_starred', { ascending: false })
        .order('created_at', { ascending: false });

      if (fallbackErr) throw fallbackErr;
      return (fallbackData as LibrarySongLight[]) || [];
    }

    return (data as LibrarySongLight[]) || [];
  } catch (err) {
    console.error('Error fetching library songs (light):', err);
    return [];
  }
}

export async function fetchLibrarySongs(): Promise<LibrarySong[]> {
  const { data, error } = await supabase
    .from('library_songs')
    .select('*, profiles:user_id(display_name, email)')
    .order('created_at', { ascending: false });

  if (error) {
    // Fallback if profiles relation fails
    const { data: fallbackData, error: fallbackErr } = await supabase
      .from('library_songs')
      .select('*')
      .order('created_at', { ascending: false });

    if (fallbackErr) {
      console.error('Error fetching library songs:', fallbackErr);
      throw fallbackErr;
    }
    return (fallbackData as LibrarySong[]) || [];
  }

  return (data as LibrarySong[]) || [];
}

export async function fetchPublicSongs(): Promise<LibrarySong[]> {
  const { data, error } = await supabase
    .from('library_songs')
    .select('*, profiles:user_id(display_name, email)')
    .order('created_at', { ascending: false });

  if (error) {
    // Fallback without profile join if schema differs
    const { data: fallbackData } = await supabase
      .from('library_songs')
      .select('*')
      .order('created_at', { ascending: false });

    const songs = (fallbackData as LibrarySong[]) || [];
    return songs.filter(s => s.is_public !== false);
  }

  // Filter for public songs
  const songs = (data as LibrarySong[]) || [];
  return songs.filter(s => s.is_public !== false);
}

export async function fetchPublicSongBySlug(artistSlug: string, songSlug: string): Promise<LibrarySong | null> {
  const songs = await fetchPublicSongs();
  if (!songs || songs.length === 0) return null;

  const target = songs.find(s => {
    const sArtist = slugify(s.artist || 'traditional');
    const sTitle = slugify(s.title);
    const cleanSongSlug = slugify(songSlug.replace(/-chords$/, ''));

    if (s.slug && s.slug === songSlug) return true;
    return sArtist === slugify(artistSlug) && sTitle === cleanSongSlug;
  });

  return target || songs[0] || null;
}

export async function uploadLibrarySongs(
  userId: string,
  files: { name: string; content: string }[]
): Promise<LibrarySong[]> {
  const results: LibrarySong[] = [];

  // Fetch current user library songs to detect existing titles
  const { data: existingLibrary } = await supabase
    .from('library_songs')
    .select('id, title')
    .eq('user_id', userId);

  const existingMap = new Map((existingLibrary || []).map(s => [s.title.trim().toLowerCase(), s.id]));

  for (const file of files) {
    const parsed = parseUploadedSetlistFile(file.content, file.name);
    for (const song of parsed.songs) {
      const title = song.title || file.name.replace(/\.[^/.]+$/, '');
      const cleanKey = title.trim().toLowerCase();
      const originalKey = song.original_key || song.current_key || 'C';
      const currentKey = song.current_key || song.original_key || 'C';
      const content = song.content || { type: 'doc', content: [] };
      const rawText = song.raw_text || '';
      const notes = song.notes || '';
      const bpm = song.bpm ?? null;
      const timeSignature = song.time_signature ?? null;

      const existingId = existingMap.get(cleanKey);

      if (existingId) {
        // Update existing library song
        const { data: updated, error: updateErr } = await supabase
          .from('library_songs')
          .update({
            title,
            original_key: originalKey,
            current_key: currentKey,
            bpm,
            time_signature: timeSignature,
            content,
            raw_text: rawText,
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
          .select()
          .single();

        if (!updateErr && updated) {
          results.push(updated as LibrarySong);
        }
      } else {
        // Insert new song
        const { data: inserted, error: insertErr } = await supabase
          .from('library_songs')
          .insert({
            user_id: userId,
            title,
            original_key: originalKey,
            current_key: currentKey,
            bpm,
            time_signature: timeSignature,
            content,
            raw_text: rawText,
            notes,
            is_starred: false,
          })
          .select()
          .single();

        if (!insertErr && inserted) {
          results.push(inserted as LibrarySong);
          existingMap.set(cleanKey, inserted.id);
        }
      }

      // Also update any matching setlist_songs with this title so setlists update immediately
      try {
        await supabase
          .from('setlist_songs')
          .update({
            content,
            original_key: originalKey,
            current_key: currentKey,
            bpm,
            time_signature: timeSignature,
            raw_text: rawText,
          })
          .ilike('title', title);
      } catch (err) {
        console.error('Failed to sync setlist_songs for title:', title, err);
      }
    }
  }

  if (results.length === 0) {
    throw new Error('No valid songs were processed from the uploaded files.');
  }

  return results;
}

export async function toggleStarSong(songId: string, isStarred: boolean): Promise<void> {
  const { error } = await supabase
    .from('library_songs')
    .update({ is_starred: isStarred, updated_at: new Date().toISOString() })
    .eq('id', songId);

  if (error) {
    console.error('Error toggling star:', error);
    throw error;
  }
}

export async function deleteLibrarySong(songId: string): Promise<void> {
  // Get the current user to scope the delete to their own songs
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error, count } = await supabase
    .from('library_songs')
    .delete({ count: 'exact' })
    .eq('id', songId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting library song:', error);
    throw error;
  }

  // If count is 0, the row either didn't exist or RLS blocked the delete
  if (count === 0) {
    console.warn('Delete returned 0 rows — RLS may be blocking deletes or the song does not belong to this user.');
    throw new Error('Could not delete song. You may not have permission to delete this item.');
  }
}

export async function addSongToSetlist(
  setlistId: string,
  song: LibrarySong
): Promise<void> {
  // Get max index in setlist
  const { data: existingSongs, error: fetchErr } = await supabase
    .from('setlist_songs')
    .select('song_index')
    .eq('setlist_id', setlistId)
    .order('song_index', { ascending: false })
    .limit(1);

  if (fetchErr) {
    console.error('Error checking setlist songs:', fetchErr);
  }

  const nextIndex = existingSongs && existingSongs.length > 0 ? existingSongs[0].song_index + 1 : 0;

  const { error } = await supabase.from('setlist_songs').insert({
    setlist_id: setlistId,
    song_index: nextIndex,
    title: song.title,
    original_key: song.original_key,
    current_key: song.current_key,
    bpm: song.bpm ?? null,
    time_signature: song.time_signature ?? null,
    content: song.content,
    raw_text: song.raw_text || '',
    notes: song.notes || '',
  });

  if (error) {
    console.error('Error adding song to setlist:', error);
    throw error;
  }
}

/**
 * Downloads song formatted as a .crd JSON score file matching CHORDED desktop SavedDocument format
 */
export function downloadSongAsCrd(song: LibrarySong): void {
  const contentDoc = song.content?.type === 'doc'
    ? song.content
    : { type: 'doc', content: Array.isArray(song.content) ? song.content : [] };

  const fileData = {
    id: song.id,
    title: song.title,
    key: song.current_key || song.original_key || 'C',
    originalKey: song.original_key || 'C',
    currentKey: song.current_key || 'C',
    savedAt: new Date().toISOString(),
    editorContent: contentDoc,
    content: contentDoc.content,
    bpm: song.bpm ?? null,
    timeSignature: song.time_signature ?? null,
    notes: song.notes || '',
    rawText: song.raw_text || '',
  };

  const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${song.title.replace(/[/\\?%*:|"<>]/g, '-')}.crd`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
