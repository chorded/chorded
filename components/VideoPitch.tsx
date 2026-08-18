const videos = [
  {
    id: "ls_nmhgvigA",
    title: "CHORDED Tutorial Walkthrough | Part 1",
  },
  {
    id: "9N-HbsPyZNs",
    title: "CHORDED Tutorial Walkthrough | Part 2",
  },
  {
    id: "KBtc1Qy2Ibw",
    title: "CHORDED Tutorial Walkthrough | Part 3",
  },
  {
    id: "uo79cIN5gmY",
    title: "CHORDED Tutorial Walkthrough | Part 4",
  },
  {
    id: "bvDXvgpV2_Q",
    title: "CHORDED Tutorial Walkthrough | Part 5",
  },
];

export default function VideoPitch() {
  return (
    <section id="video" className="bg-[#1a2463] py-section-gap px-margin-edge text-white">
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

        {/* Top row — 2 videos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-gutter">
          {videos.slice(0, 2).map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>

        {/* Middle row — 3 videos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-gutter">
          {videos.slice(2, 5).map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoCard({ video }: { video: { id: string; title: string } }) {
  return (
    <div className="space-y-3 group cursor-pointer">
      <div className="relative aspect-video bg-surface-container-lowest rounded-xl overflow-hidden border border-white/10 shadow-lg">
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${video.id}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <p className="font-label-md text-label-md text-primary-fixed-dim group-hover:text-white transition-colors px-1">
        {video.title}
      </p>
    </div>
  );
}
