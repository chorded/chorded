/**
 * transposer.ts
 * ─────────────
 * Pure chord transposition logic for CHORDED.
 * No external dependencies — safe to import anywhere.
 *
 * Supports: C, Am, G7, F#m, Bbmaj7, Dsus4, Cadd9, G/B, Cmaj7/E, etc.
 */

// ── Chromatic scales ──
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

// Keys whose roots conventionally prefer flat notation
const FLAT_ROOTS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'])

// ── Helpers ──

function noteIndex(note: string): number {
  const si = (SHARPS as readonly string[]).indexOf(note)
  if (si !== -1) return si
  return (FLATS as readonly string[]).indexOf(note)
}

/**
 * Transpose a single note name by `semitones`.
 */
export function transposeNote(note: string, semitones: number, preferFlats: boolean): string {
  const idx = noteIndex(note)
  if (idx === -1) return note
  const newIdx = ((idx + semitones) % 12 + 12) % 12
  return preferFlats ? FLATS[newIdx] : SHARPS[newIdx]
}

// ── Chord Parser ──

/**
 * Parse a chord string into { root, quality, bass }.
 *
 * Examples:
 *   "Am7"    → { root: "A",  quality: "m7"     }
 *   "F#m"    → { root: "F#", quality: "m"      }
 *   "Bbsus4" → { root: "Bb", quality: "sus4"   }
 *   "G/B"    → { root: "G",  quality: "",  bass: "B" }
 *   "Cmaj7/E"→ { root: "C",  quality: "maj7", bass: "E" }
 */
/**
 * Parse a chord string into { root, quality, bass }.
 *
 * Examples:
 *   "Am7"    → { root: "A",  quality: "m7"     }
 *   "F#m"    → { root: "F#", quality: "m"      }
 *   "Bbsus4" → { root: "Bb", quality: "sus4"   }
 *   "G/B"    → { root: "G",  quality: "",  bass: "B" }
 *   "Cmaj7/E"→ { root: "C",  quality: "maj7", bass: "E" }
 */
export function parseChord(chord: string): { root: string; quality: string; bass?: string } | null {
  if (!chord) return null
  let trimmed = chord.trim()
  if (!trimmed) return null

  // Special case: No-chord markers
  if (/^(N\.?C\.?)$/i.test(trimmed)) {
    return { root: 'N.C.', quality: '' }
  }

  // Replace unicode flat/sharp symbols
  trimmed = trimmed.replace(/♭/g, 'b').replace(/♯/g, '#')

  // Match root: A-G or a-g followed by optional # or b
  const rootMatch = trimmed.match(/^([A-Ga-g][b#]?)(.*)$/)
  if (!rootMatch) return null

  const [, rootStr, rest] = rootMatch
  const root = rootStr.charAt(0).toUpperCase() + rootStr.slice(1)
  if (noteIndex(root) === -1) return null

  // Check for slash chord (e.g., G/B or Cmaj7/E or C/Bb)
  const slashIdx = rest.lastIndexOf('/')
  if (slashIdx !== -1) {
    const quality = rest.slice(0, slashIdx)
    const bassStr = rest.slice(slashIdx + 1)
    const bassMatch = bassStr.match(/^([A-Ga-g][b#]?)$/)
    if (bassMatch) {
      const bass = bassMatch[1].charAt(0).toUpperCase() + bassMatch[1].slice(1)
      if (noteIndex(bass) !== -1) {
        return { root, quality, bass }
      }
    }
  }

  return { root, quality: rest }
}

/**
 * Transpose a chord string by `semitones` half-steps.
 *
 * @param chord      e.g. "Am7", "F#m", "Bb", "G/B"
 * @param semitones  Positive = up, negative = down
 * @param preferFlats  Force flat/sharp notation; auto-infers from direction if undefined
 * @returns          Transposed chord, or original if unrecognised
 */
export function transposeChord(chord: string, semitones: number, preferFlats?: boolean): string {
  const trimmed = chord.trim()
  const parsed = parseChord(trimmed)
  if (!parsed) return chord
  if (parsed.root === 'N.C.') return 'N.C.'

  const useFlats = preferFlats !== undefined ? preferFlats : semitones < 0

  const newRoot = transposeNote(parsed.root, semitones, useFlats)
  const newBass = parsed.bass
    ? transposeNote(parsed.bass, semitones, useFlats)
    : undefined

  return newRoot + parsed.quality + (newBass ? '/' + newBass : '')
}

/**
 * Transpose a key name string.
 * e.g. "C" + 2 → "D"
 *      "Bbm" - 1 → "Am"
 */
export function transposeKey(key: string, semitones: number): string {
  const parsed = parseChord(key.trim())
  if (!parsed) return key
  if (parsed.root === 'N.C.') return key
  const useFlats = semitones < 0 || FLAT_ROOTS.has(parsed.root)
  const newRoot = transposeNote(parsed.root, semitones, useFlats)
  return newRoot + parsed.quality + (parsed.bass ? '/' + parsed.bass : '')
}

/**
 * Returns true if the string is a recognisable chord.
 */
export function isValidChord(str: string): boolean {
  const parsed = parseChord(str.trim())
  return parsed !== null
}

/**
 * Convert a chord string to Nashville Number System (1, 2, 3...) based on the key.
 */
export function chordToNashville(chordStr: string, keyStr: string): string {
  const parsedChord = parseChord(chordStr);
  const parsedKey = parseChord(keyStr);
  if (!parsedChord || !parsedKey || parsedChord.root === 'N.C.') return chordStr;
  
  const keyIdx = noteIndex(parsedKey.root);
  if (keyIdx === -1) return chordStr;
  
  const chordIdx = noteIndex(parsedChord.root);
  if (chordIdx === -1) return chordStr;
  
  const diff = (chordIdx - keyIdx + 12) % 12;
  
  const NNS_MAP = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  const nnsRoot = NNS_MAP[diff];
  
  let bassNns = '';
  if (parsedChord.bass) {
    const bassIdx = noteIndex(parsedChord.bass);
    if (bassIdx !== -1) {
      const bDiff = (bassIdx - keyIdx + 12) % 12;
      bassNns = '/' + NNS_MAP[bDiff];
    } else {
      bassNns = '/' + parsedChord.bass;
    }
  }
  
  return nnsRoot + parsedChord.quality + bassNns;
}

const COMMON_SECTION_WORDS = new Set([
  'INTRO', 'VERSE', 'CHORUS', 'BRIDGE', 'OUTRO', 'PRECHORUS', 'PRE-CHORUS',
  'INTERLUDE', 'SOLO', 'HOOK', 'ENDING', 'REFRAIN', 'TAB', 'CAPO', 'INSTRUMENTAL',
  'TAG', 'CODA', 'PART', 'VERSE1', 'VERSE2', 'VERSE3', 'CHORUS1', 'CHORUS2'
])

const COMMON_NON_CHORD_WORDS = new Set([
  'AND', 'ARE', 'ALL', 'ABOUT', 'ABOVE', 'AFTER', 'AGAIN', 'AGAINST', 'ALSO', 'ALWAYS', 'ANOTHER', 'ANY',
  'BE', 'BY', 'BUT', 'BEFORE', 'BEEN', 'BECAUSE', 'BETWEEN', 'BOTH', 'BOY',
  'CAN', 'COULD', 'COME', 'CALL', 'CAME', 'CANT', "CAN'T",
  'DO', 'DID', 'DOWN', 'DONT', "DON'T", 'DOES', 'DONE',
  'EVERY', 'EACH', 'EVEN', 'EVER', 'EVERYTHING',
  'FOR', 'FROM', 'FIND', 'FIRST', 'FEEL', 'FORGET',
  'GO', 'GET', 'GIVE', 'GOOD', 'GIRL', 'GOT', 'GREAT',
  'HE', 'HIS', 'HER', 'HERE', 'HOW', 'HAVE', 'HAS', 'HAD',
  'IN', 'IF', 'IS', 'IT', 'INTO', 'ITS',
  'JUST',
  'KNOW',
  'LIKE', 'LOVE', 'LOOK', 'LET', 'LETS',
  'ME', 'MY', 'MORE', 'MAKE', 'MANY', 'MUCH',
  'NO', 'NOT', 'NOW', 'NEVER', 'NEW',
  'ON', 'OR', 'OUT', 'ONE', 'OUR', 'ONLY', 'OVER', 'OTHER',
  'SO', 'SOME', 'SEE', 'SAY', 'SAID', 'SHE',
  'TO', 'THE', 'THIS', 'THAT', 'THEY', 'THERE', 'THEN', 'THEM', 'THESE', 'TWO', 'TAKE', 'TIME',
  'US', 'UP', 'USE',
  'WE', 'WITH', 'WAS', 'WHAT', 'WHEN', 'WHERE', 'WHO', 'WHY', 'WILL', 'WOULD', 'WAY', 'WANT',
  'YOU', 'YOUR'
])

const VALID_QUALITY_REGEX = /^(m|min|minor|M|maj|major|aug|dim|sus[24]?|add[0-9]*|mmaj|m\/maj|\+|-|o|°|ø|0|Δ)?([0-9]|10|11|12|13|6\/9|7\/9|7\/11)?(sus[24]?)?([#b♭♯\+-]?[0-9]+)*(\([^)]+\))?$/i

/**
 * Strips surrounding brackets, pipes, or punctuation from a token.
 */
export function cleanToken(token: string): string {
  return token.replace(/^[\[\({<|]+|[\]\)}>|:,.]+$/g, '')
}

/**
 * Returns true if the token looks like a guitar/piano chord.
 * Stricter than isValidChord — rejects normal words like "And", "But", etc.
 * Only accepts qualities made of known chord-quality characters/abbreviations.
 */
export function isLikelyChord(token: string): boolean {
  const cleaned = cleanToken(token.trim())
  if (!cleaned) return false

  const upper = cleaned.toUpperCase()
  if (upper === 'N.C.' || upper === 'NC') return true
  if (COMMON_SECTION_WORDS.has(upper) || COMMON_NON_CHORD_WORDS.has(upper)) return false

  const parsed = parseChord(cleaned)
  if (!parsed) return false

  return VALID_QUALITY_REGEX.test(parsed.quality)
}

/**
 * Detects whether a string line represents a music section header.
 * Examples: "Verse", "Verse 1", "[Chorus]", "Pre-Chorus:", "(Bridge 2)", "Guitar Solo", "Intro", "Outro - Quiet"
 */
export function isMusicSectionHeader(text: string): boolean {
  if (!text) return false
  const rawTrimmed = text.trim()
  if (!rawTrimmed || rawTrimmed.length > 50) return false

  // 1. Strip outer enclosing brackets/parentheses/braces/quotes/colons first
  // e.g. "[Bridge]" -> "Bridge", "(Chorus 1)" -> "Chorus 1", "[Verse 1]:" -> "Verse 1"
  let cleaned = rawTrimmed.replace(/^[\[\(\{'"\s]+|[\]\)\}'"\s:]+$/g, '').trim()
  if (!cleaned) return false

  // Section keywords regex
  const sectionKeywordsRegex = /^(verse|chorus|pre-chorus|pre\s+chorus|prechorus|post-chorus|post\s+chorus|postchorus|bridge|intro|introduction|outro|ending|interlude|instrumental|inst|solo|guitar\s+solo|piano\s+solo|keyboard\s+solo|sax\s+solo|refrain|hook|tag|turnaround|breakdown|coda|vamp|part|section|v[0-9]+|c[0-9]+|pc[0-9]+|b[0-9]+)\b/i

  if (sectionKeywordsRegex.test(cleaned)) {
    // Extract suffix after keyword
    const afterKeyword = cleaned.replace(sectionKeywordsRegex, '').trim()

    // If nothing remains e.g. "[Bridge]", "[Chorus]", "Verse", "Intro" -> TRUE
    if (!afterKeyword) return true

    // Suffix check for numbers/letters/notes e.g. "1", "A", "(2x)"
    if (afterKeyword.length <= 25) {
      const invalidSentenceWords = /\b(of|the|over|under|in|on|at|with|by|from|to|for|is|are|was|were|my|your|his|her|our|their|and|but|or)\b/i
      if (!invalidSentenceWords.test(afterKeyword)) {
        const validSuffixRegex = /^[:\-–—#/0-9\sA-Za-z\(\)\[\]xX]+$/
        if (validSuffixRegex.test(afterKeyword)) return true
      }
    }
  }

  // 2. If raw text contains inline bracketed chords before text, e.g. "[C] [G] Verse 1"
  // Strip only valid inline chords but preserve section keywords
  const textWithoutInlineChords = rawTrimmed.replace(/\[\s*([A-Ga-g][b#♭♯]?[^\]]*)\s*\]/g, (match, innerToken) => {
    const cleanToken = innerToken.trim().toLowerCase()
    if (/^(verse|chorus|pre-chorus|pre\s+chorus|prechorus|bridge|intro|outro|interlude|instrumental|solo|tag|ending)/.test(cleanToken)) {
      return match // keep section header intact
    }
    return '' // strip chord
  }).replace(/^[\[\(\{'"\s]+|[\]\)\}'"\s:]+$/g, '').trim()

  if (textWithoutInlineChords && textWithoutInlineChords !== cleaned) {
    return isMusicSectionHeader(textWithoutInlineChords)
  }

  return false
}

/**
 * Returns true if the line consists primarily of chord tokens.
 * Used to detect chord-only lines when parsing pasted lyrics+chords.
 */
export function isChordOnlyLine(line: string): boolean {
  const expanded = line.replace(/\t/g, '    ').trim()
  if (!expanded) return false

  // Reject section header lines like [Intro], [Verse 1], Chorus:
  if (isMusicSectionHeader(expanded)) {
    return false
  }

  const rawTokens = expanded.split(/\s+/)
  const tokens = rawTokens
    .map(cleanToken)
    .filter(t => t.length > 0 && !/^[\/|:%.\-]+$/.test(t))

  if (tokens.length === 0) return false

  const validCount = tokens.filter(isLikelyChord).length
  return validCount > 0 && (validCount / tokens.length) >= 0.7
}

/**
 * Detects if a line contains inline bracketed chords, e.g. "[C]Amazing [F]grace"
 */
export function hasInlineBracketedChords(line: string): boolean {
  const BRACKET_RE = /[\[\({<]([A-Ga-g][b#♭♯]?[^\]\)}>]*)[\]\)}>]/g
  let match: RegExpExecArray | null
  let count = 0
  while ((match = BRACKET_RE.exec(line)) !== null) {
    if (isLikelyChord(match[1].trim())) {
      count++
    }
  }
  return count > 0
}

export interface InlineChordItem {
  chord: string
  col: number
}

/**
 * Parses a line containing inline bracketed chords.
 * Strips the brackets from the line text and calculates the exact column position
 * for each chord in the resulting clean lyric string.
 */
export function parseInlineBracketedLine(line: string): { lyric: string; chords: InlineChordItem[] } {
  const BRACKET_RE = /[\[\({<]([A-Ga-g][b#♭♯]?[^\]\)}>]*)[\]\)}>]/g
  const chords: InlineChordItem[] = []
  let lyric = ''
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = BRACKET_RE.exec(line)) !== null) {
    const rawContent = match[1].trim()
    if (isLikelyChord(rawContent)) {
      lyric += line.slice(lastIdx, match.index)
      const parsed = parseChord(rawContent)
      const formattedChord = parsed
        ? parsed.root + parsed.quality + (parsed.bass ? '/' + parsed.bass : '')
        : rawContent

      chords.push({ chord: formattedChord, col: lyric.length })
      lastIdx = match.index + match[0].length
    }
  }

  lyric += line.slice(lastIdx)
  return { lyric, chords }
}

/**
 * Extracts chord tokens and their column positions from a chord-only line.
 * e.g. "G   Em  C   D" → [{chord:'G',col:0},{chord:'Em',col:4}, …]
 */
export function parseChordLine(line: string): Array<{ chord: string; col: number }> {
  const result: Array<{ chord: string; col: number }> = []
  const expanded = line.replace(/\t/g, '    ')
  const TOKEN_RE = /\S+/g
  let match: RegExpExecArray | null
  while ((match = TOKEN_RE.exec(expanded)) !== null) {
    const cleaned = cleanToken(match[0])
    if (isLikelyChord(cleaned)) {
      const parsed = parseChord(cleaned)
      const formattedChord = parsed
        ? parsed.root + parsed.quality + (parsed.bass ? '/' + parsed.bass : '')
        : cleaned
      result.push({ chord: formattedChord, col: match.index })
    }
  }
  return result
}

/**
 * A curated list of common chord suggestions for the insert modal.
 */
export const COMMON_CHORDS: string[] = [
  // Triads
  'C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm',
  'G', 'Gm', 'A', 'Am', 'B', 'Bm',
  // Sevenths
  'C7', 'Cmaj7', 'Cm7',
  'D7', 'Dmaj7', 'Dm7',
  'E7', 'Emaj7', 'Em7',
  'F7', 'Fmaj7', 'Fm7',
  'G7', 'Gmaj7', 'Gm7',
  'A7', 'Amaj7', 'Am7',
  'B7', 'Bmaj7', 'Bm7',
  // Accidentals
  'F#', 'F#m', 'C#', 'C#m',
  'Bb', 'Bbm', 'Eb', 'Ebm', 'Ab', 'Abm',
  // Sus / Add
  'Csus2', 'Csus4', 'Dsus2', 'Dsus4', 'Asus2', 'Asus4',
  'Cadd9', 'Dadd9', 'Gadd9', 'Aadd9',
  // Diminished / Augmented
  'Cdim', 'Ddim', 'Edim', 'Gdim', 'Adim',
  'Caug', 'Daug', 'Eaug', 'Aaug',
  // Slash chords
  'G/B', 'C/E', 'D/F#', 'Am/G', 'F/A'
]
