const VIDEO_ID = process.env.NEXT_PUBLIC_YOUTUBE_VIDEO_ID ?? "";

const thumbnails = [
  { label: "Live Performance Demo" },
  { label: "Advanced Editing Tips" },
  { label: "Cloud Sync Setup" },
];

export default function VideoPitch() {
  return (
    <section className="bg-[#1a2463] py-section-gap px-margin-edge text-white">
      <div className="max-w-container-max-width mx-auto">
        {/* Section header */}
        <div className="text-center mb-section-gap">
          <h2 className="font-headline-lg text-headline-lg text-white">
            See it in Action
          </h2>
          <p className="font-body-md text-body-md text-primary-fixed-dim mt-4 max-w-2xl mx-auto">
            Watch how Chorded transforms your performance workflow from
            preparation to the stage.
          </p>
        </div>

        {/* Main video player */}
        <div className="relative max-w-4xl mx-auto aspect-video bg-surface-container-lowest rounded-xl overflow-hidden border border-white/10 shadow-2xl group cursor-pointer mb-stack-lg">
          {VIDEO_ID ? (
            /* Real YouTube embed when env var is set */
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${VIDEO_ID}`}
              title="Chorded — Quick Start Guide"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            /* Stitch-export styled placeholder */
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span
                    className="material-symbols-outlined text-4xl"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    play_arrow
                  </span>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <p className="font-label-md text-label-md">
                  Quick Start Guide: Creating your first setlist
                </p>
              </div>
            </>
          )}
        </div>

        {/* Thumbnail grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter max-w-4xl mx-auto">
          {thumbnails.map((thumb) => (
            <div key={thumb.label} className="space-y-2 cursor-pointer group">
              <div className="aspect-video bg-surface-container rounded-lg overflow-hidden border border-white/5">
                <div className="w-full h-full bg-primary/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary/40">
                    movie
                  </span>
                </div>
              </div>
              <p className="font-label-sm text-label-sm text-primary-fixed-dim group-hover:text-white transition-colors">
                {thumb.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
