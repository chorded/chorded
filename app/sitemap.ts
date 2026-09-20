import { MetadataRoute } from 'next';
import { fetchPublicSongs, slugify, getSongSlug, getSongArtist } from '@/lib/library-service';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://chorded.app';

  // Static routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/chords`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/library`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  try {
    const songs = await fetchPublicSongs();
    const songRoutes: MetadataRoute.Sitemap = songs.map((song) => {
      const artistName = getSongArtist(song);
      const artistSlug = slugify(artistName);
      const songSlug = getSongSlug(song.title, song.artist || artistName);

      return {
        url: `${baseUrl}/chords/${artistSlug}/${songSlug}`,
        lastModified: song.updated_at ? new Date(song.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      };
    });

    return [...routes, ...songRoutes];
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return routes;
  }
}
