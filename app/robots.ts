import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/chords/', '/chords/*'],
      disallow: ['/api/'],
    },
    sitemap: 'https://chorded.app/sitemap.xml',
  };
}
