import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublicSongBySlug, slugify, getSongArtist } from '@/lib/library-service';
import PublicSongDetailClient from './PublicSongDetailClient';

interface PageProps {
  params: Promise<{
    artist: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const song = await fetchPublicSongBySlug(resolvedParams.artist, resolvedParams.slug);

  if (!song) {
    return {
      title: 'Chord Chart Not Found | CHORDED',
    };
  }

  const artistName = getSongArtist(song);
  const keyName = song.current_key || song.original_key || 'C';

  return {
    title: `${song.title} Chords by ${artistName} - Key of ${keyName} | CHORDED`,
    description: `Accurate guitar chords and lyrics for ${song.title} by ${artistName}. Key of ${keyName}. Transpose keys, view Nashville numbers, auto-scroll, and print .crd chart.`,
    openGraph: {
      title: `${song.title} Chords by ${artistName} | CHORDED`,
      description: `Accurate guitar chords and lyrics for ${song.title} by ${artistName}. Transpose keys instantly on CHORDED.`,
      type: 'music.song',
    },
    alternates: {
      canonical: `https://chorded.app/chords/${slugify(artistName)}/${resolvedParams.slug}`,
    },
  };
}

export default async function PublicSongDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const song = await fetchPublicSongBySlug(resolvedParams.artist, resolvedParams.slug);

  if (!song) {
    notFound();
  }

  const artistName = getSongArtist(song);
  const keyName = song.current_key || song.original_key || 'C';

  // Schema.org MusicComposition JSON-LD for Search Engines (Google SEO)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicComposition',
    name: song.title,
    composer: {
      '@type': 'MusicGroup',
      name: artistName,
    },
    musicalKey: keyName,
    text: song.raw_text || '',
    url: `https://chorded.app/chords/${slugify(artistName)}/${resolvedParams.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicSongDetailClient song={song} />
    </>
  );
}
