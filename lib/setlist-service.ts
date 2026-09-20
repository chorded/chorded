import { supabase } from '@/lib/supabase';

export interface SetlistSong {
  id?: string;
  setlist_id?: string;
  song_index: number;
  title: string;
  artist?: string | null;
  original_key: string;
  current_key: string;
  bpm?: number | null;
  time_signature?: string | null;
  content: any; // TipTap doc JSON
  raw_text?: string;
  notes?: string;
  created_at?: string;
}

export interface Setlist {
  id: string;
  user_id: string;
  title: string;
  description: string;
  stage_preferences?: {
    nashville?: boolean;
    isDarkStage?: boolean;
    zoom?: number;
  };
  created_at: string;
  updated_at: string;
  songs?: SetlistSong[];
}

export async function fetchUserSetlists(): Promise<Setlist[]> {
  const { data: setlists, error } = await supabase
    .from('setlists')
    .select(`
      *,
      songs:setlist_songs(id, title, original_key, current_key, song_index)
    `)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching setlists:', error);
    throw error;
  }

  return (setlists as any[]) || [];
}

export async function fetchSetlistWithSongs(setlistId: string): Promise<Setlist | null> {
  const { data: setlist, error: setlistError } = await supabase
    .from('setlists')
    .select('*')
    .eq('id', setlistId)
    .single();

  if (setlistError || !setlist) {
    console.error('Error fetching setlist:', setlistError);
    return null;
  }

  const { data: songs, error: songsError } = await supabase
    .from('setlist_songs')
    .select('*')
    .eq('setlist_id', setlistId)
    .order('song_index', { ascending: true });

  if (songsError) {
    console.error('Error fetching songs for setlist:', songsError);
  }

  return {
    ...setlist,
    songs: songs || [],
  };
}

export async function createSetlist(
  userId: string,
  title: string,
  description: string = '',
  songs: Partial<SetlistSong>[] = []
): Promise<Setlist> {
  const { data: setlist, error: setlistError } = await supabase
    .from('setlists')
    .insert({
      user_id: userId,
      title,
      description,
      stage_preferences: {
        nashville: false,
        isDarkStage: true,
        zoom: 1.0,
      },
    })
    .select()
    .single();

  if (setlistError || !setlist) {
    throw setlistError || new Error('Failed to create setlist');
  }

  if (songs.length > 0) {
    const songInserts = songs.map((s, index) => ({
      setlist_id: setlist.id,
      song_index: index,
      title: s.title || `Song ${index + 1}`,
      original_key: s.original_key || s.current_key || 'C',
      current_key: s.current_key || s.original_key || 'C',
      bpm: s.bpm || null,
      time_signature: s.time_signature || null,
      content: s.content || { type: 'doc', content: [] },
      raw_text: s.raw_text || '',
      notes: s.notes || '',
    }));

    const { error: songsError } = await supabase
      .from('setlist_songs')
      .insert(songInserts);

    if (songsError) {
      console.error('Error inserting songs:', songsError);
    }
  }

  return fetchSetlistWithSongs(setlist.id) as Promise<Setlist>;
}

export async function deleteSetlist(setlistId: string): Promise<void> {
  const { error } = await supabase
    .from('setlists')
    .delete()
    .eq('id', setlistId);

  if (error) {
    throw error;
  }
}

export async function updateSetlist(
  setlistId: string,
  title: string,
  description: string = '',
  songs: Partial<SetlistSong>[] = []
): Promise<Setlist> {
  const { error: setlistError } = await supabase
    .from('setlists')
    .update({
      title: title.trim(),
      description: description.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', setlistId);

  if (setlistError) {
    console.error('Error updating setlist:', setlistError);
    throw setlistError;
  }

  // Clear existing songs in setlist
  const { error: deleteError } = await supabase
    .from('setlist_songs')
    .delete()
    .eq('setlist_id', setlistId);

  if (deleteError) {
    console.error('Error clearing old setlist songs:', deleteError);
    throw deleteError;
  }

  // Insert updated songs
  if (songs.length > 0) {
    const songInserts = songs.map((s, index) => ({
      setlist_id: setlistId,
      song_index: index,
      title: s.title || `Song ${index + 1}`,
      original_key: s.original_key || s.current_key || 'C',
      current_key: s.current_key || s.original_key || 'C',
      bpm: s.bpm ?? null,
      time_signature: s.time_signature ?? null,
      content: s.content || { type: 'doc', content: [] },
      raw_text: s.raw_text || '',
      notes: s.notes || '',
    }));

    const { error: songsError } = await supabase
      .from('setlist_songs')
      .insert(songInserts);

    if (songsError) {
      console.error('Error inserting updated songs:', songsError);
      throw songsError;
    }
  }

  const updated = await fetchSetlistWithSongs(setlistId);
  if (!updated) {
    throw new Error('Failed to retrieve updated setlist');
  }
  return updated;
}

import { buildContentFromLines } from '@/components/tiptap/ChordExtension';

/**
 * Parses raw text / ChordPro formatted .crd content into a structured song
 */
function parseRawCrdText(text: string, defaultTitle: string): Partial<SetlistSong> & { title: string } {
  const lines = text.split(/\r?\n/);
  let title = defaultTitle;
  let artist: string | null = null;
  let key = 'C';
  let bpm: number | null = null;
  let timeSignature: string | null = null;
  let notes = '';
  const bodyLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // ChordPro directives: {title: Foo}, {t: Foo}, {artist: Bar}, {a: Bar}, {author: Bar}, {key: G}, {k: G}, {tempo: 120}, {bpm: 120}, {time: 4/4}
    const chordProMatch = line.match(/^\{([a-zA-Z]+)\s*:\s*(.*?)\}$/);
    if (chordProMatch) {
      const tag = chordProMatch[1].toLowerCase();
      const val = chordProMatch[2].trim();
      if (['title', 't'].includes(tag) && val) {
        title = val;
      } else if (['artist', 'a', 'author', 'by'].includes(tag) && val) {
        artist = val;
      } else if (['key', 'k'].includes(tag) && val) {
        key = val;
      } else if (['bpm', 'tempo'].includes(tag) && !isNaN(Number(val))) {
        bpm = Number(val);
      } else if (['time', 'timesignature'].includes(tag) && val) {
        timeSignature = val;
      } else if (['comment', 'c'].includes(tag) && val) {
        notes += (notes ? '\n' : '') + val;
      }
      continue;
    }

    // Common text headers at top of .crd files:
    // Title: Amazing Grace
    // Artist: John Newton
    // Key: G
    // BPM: 120
    const headerMatch = line.match(/^(title|key|bpm|tempo|time\s*signature|artist|author|by|notes?)\s*:\s*(.+)$/i);
    if (headerMatch && bodyLines.length === 0) {
      const headerName = headerMatch[1].toLowerCase();
      const headerVal = headerMatch[2].trim();
      if (headerName === 'title' && headerVal) {
        title = headerVal;
      } else if ((headerName === 'artist' || headerName === 'author' || headerName === 'by') && headerVal) {
        artist = headerVal;
      } else if (headerName === 'key' && headerVal) {
        key = headerVal;
      } else if ((headerName === 'bpm' || headerName === 'tempo') && !isNaN(Number(headerVal))) {
        bpm = Number(headerVal);
      } else if (headerName.includes('time') && headerVal) {
        timeSignature = headerVal;
      } else if (headerName.startsWith('note')) {
        notes += (notes ? '\n' : '') + headerVal;
      }
      continue;
    }

    bodyLines.push(rawLine);
  }

  const contentNodes = buildContentFromLines(bodyLines);
  const content = {
    type: 'doc',
    content: contentNodes.length > 0 ? contentNodes : [{ type: 'paragraph' }],
  };

  return {
    song_index: 0,
    title,
    artist,
    original_key: key,
    current_key: key,
    bpm,
    time_signature: timeSignature,
    content,
    raw_text: text,
    notes,
  };
}

function extractDocContent(raw: any, rawText?: string): { type: 'doc'; content: any[] } {
  if (!raw) {
    if (rawText && rawText.trim()) {
      return { type: 'doc', content: buildContentFromLines(rawText.split(/\r?\n/)) };
    }
    return { type: 'doc', content: [] };
  }

  let data = raw;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        data = JSON.parse(trimmed);
      } catch {
        // failed parse
      }
    }
  }

  // Handle CHORDED desktop SavedDocument format with editorContent
  if (data && typeof data === 'object' && data.editorContent) {
    data = data.editorContent;
  }

  // Handle bare array of TipTap blocks
  if (Array.isArray(data)) {
    if (data.length === 0 && rawText && rawText.trim()) {
      return { type: 'doc', content: buildContentFromLines(rawText.split(/\r?\n/)) };
    }
    return { type: 'doc', content: data };
  }

  // Handle JSON doc object
  if (data && typeof data === 'object') {
    if (data.type === 'doc' && Array.isArray(data.content)) {
      if (data.content.length === 0 && rawText && rawText.trim()) {
        return { type: 'doc', content: buildContentFromLines(rawText.split(/\r?\n/)) };
      }
      return data;
    }
    if (Array.isArray(data.content)) {
      return { type: 'doc', content: data.content };
    }
  }

  if (rawText && rawText.trim()) {
    return { type: 'doc', content: buildContentFromLines(rawText.split(/\r?\n/)) };
  }

  return { type: 'doc', content: [] };
}

/**
 * Parses uploaded .crd score files, JSON setlists, or raw chord files into structured setlist & songs.
 * Works with Chorded desktop .crd score files, JSON exports, and ChordPro sheets.
 */
export function parseUploadedSetlistFile(fileContent: string, fileName: string): {
  title: string;
  songs: Partial<SetlistSong>[];
} {
  const defaultTitle = fileName.replace(/\.[^/.]+$/, '');

  // 1. Try parsing as JSON (standard Chorded .crd or JSON export)
  try {
    const parsed = JSON.parse(fileContent);

    // Format A: Setlist bundle with songs array: { title?: string, songs: [...] }
    if (parsed.songs && Array.isArray(parsed.songs)) {
      const title = parsed.title || defaultTitle;
      const songs: Partial<SetlistSong>[] = parsed.songs.map((s: any, idx: number) => {
        const rawText = s.rawText || s.raw_text || '';
        const rawContent = s.editorContent || s.content;
        const songArtist = s.artist || s.artistName || s.author || s.metadata?.artist || s.metadata?.artistName || s.metadata?.author || s.metadata?.by || null;
        return {
          song_index: s.songIndex ?? s.song_index ?? idx,
          title: s.title || `Song ${idx + 1}`,
          artist: songArtist,
          original_key: s.key || s.originalKey || s.original_key || 'C',
          current_key: s.currentKey || s.current_key || s.key || s.originalKey || 'C',
          bpm: s.bpm ?? s.tempo ?? (s.metadata?.tempo ?? null),
          time_signature: s.timeSignature ?? s.time_signature ?? (s.metadata?.timeSignature ?? null),
          content: extractDocContent(rawContent, rawText),
          raw_text: rawText,
          notes: s.notes || (s.metadata?.author ? `Author: ${s.metadata.author}` : (s.artist ? `Artist: ${s.artist}` : '')),
        };
      });
      return { title, songs };
    }

    // Format B: Array of songs directly: [ { title, key, content/editorContent, ... }, ... ]
    if (Array.isArray(parsed)) {
      const title = defaultTitle;
      const songs: Partial<SetlistSong>[] = parsed.map((s: any, idx: number) => {
        const rawText = s.rawText || s.raw_text || '';
        const rawContent = s.editorContent || s.content;
        const songArtist = s.artist || s.artistName || s.author || s.metadata?.artist || s.metadata?.artistName || s.metadata?.author || s.metadata?.by || null;
        return {
          song_index: s.songIndex ?? s.song_index ?? idx,
          title: s.title || `Song ${idx + 1}`,
          artist: songArtist,
          original_key: s.key || s.originalKey || s.original_key || 'C',
          current_key: s.currentKey || s.current_key || s.key || s.originalKey || 'C',
          bpm: s.bpm ?? s.tempo ?? (s.metadata?.tempo ?? null),
          time_signature: s.timeSignature ?? s.time_signature ?? (s.metadata?.timeSignature ?? null),
          content: extractDocContent(rawContent, rawText),
          raw_text: rawText,
          notes: s.notes || (s.metadata?.author ? `Author: ${s.metadata.author}` : (s.artist ? `Artist: ${s.artist}` : '')),
        };
      });
      return { title, songs };
    }

    // Format C: Single song score file (.crd) in Chorded desktop format (SavedDocument)
    if (
      parsed.editorContent ||
      parsed.type === 'doc' ||
      parsed.content ||
      parsed.key ||
      parsed.originalKey ||
      parsed.original_key ||
      parsed.title ||
      parsed.rawText ||
      parsed.raw_text
    ) {
      const songTitle = parsed.title || defaultTitle;
      const rawText = parsed.rawText || parsed.raw_text || '';
      let rawContent = parsed.editorContent || parsed.content;
      if (!rawContent && parsed.type === 'doc') {
        rawContent = parsed;
      }
      const content = extractDocContent(rawContent, rawText);

      let songArtist = parsed.artist || parsed.artistName || parsed.author || parsed.metadata?.artist || parsed.metadata?.artistName || parsed.metadata?.author || parsed.metadata?.by || null;
      if (!songArtist && rawText) {
        const match = rawText.match(/^\{(?:artist|a|author|by)\s*:\s*(.*?)\}$/m) || rawText.match(/^(?:artist|author|by)\s*:\s*(.+)$/im);
        if (match && match[1].trim()) {
          songArtist = match[1].trim();
        }
      }

      const songKey = parsed.key || parsed.originalKey || parsed.original_key || 'C';
      const currentKey = parsed.currentKey || parsed.current_key || songKey;
      const bpm = parsed.bpm ?? parsed.tempo ?? (parsed.metadata?.tempo ?? null);
      const timeSignature = parsed.timeSignature ?? parsed.time_signature ?? (parsed.metadata?.timeSignature ?? null);
      const notes = parsed.notes || (parsed.metadata?.author ? `Author: ${parsed.metadata.author}` : (parsed.artist ? `Artist: ${parsed.artist}` : ''));

      return {
        title: songTitle,
        songs: [
          {
            song_index: 0,
            title: songTitle,
            artist: songArtist,
            original_key: songKey,
            current_key: currentKey,
            bpm,
            time_signature: timeSignature,
            content,
            raw_text: rawText,
            notes,
          },
        ],
      };
    }
  } catch {
    // If JSON.parse fails, file is raw text / ChordPro format
  }

  // 2. Fallback: Parse as raw chord text / ChordPro format
  try {
    const parsedSong = parseRawCrdText(fileContent, defaultTitle);
    return {
      title: parsedSong.title,
      songs: [parsedSong],
    };
  } catch (err: any) {
    throw new Error(`Failed to parse .crd file: ${err.message}`);
  }
}

/**
 * Handles multiple uploaded .crd score files and combines them into one setlist
 */
export function parseUploadedFiles(
  files: { name: string; content: string }[]
): { title: string; songs: Partial<SetlistSong>[] } {
  if (files.length === 0) {
    throw new Error('No files provided.');
  }

  if (files.length === 1) {
    return parseUploadedSetlistFile(files[0].content, files[0].name);
  }

  const allSongs: Partial<SetlistSong>[] = [];
  files.forEach((file) => {
    const res = parseUploadedSetlistFile(file.content, file.name);
    res.songs.forEach((s) => {
      allSongs.push({
        ...s,
        song_index: allSongs.length,
      });
    });
  });

  const title = `Imported Setlist (${allSongs.length} Songs)`;
  return { title, songs: allSongs };
}
