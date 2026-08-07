const moreFeatures = [
  "Chord Dragging",
  "Multi-tab Editor",
  "JPG/PDF Export",
  "Backup/Import Library",
  "Setlist Creator/Presenter",
  "Dark Mode",
];

export default function MoreFeatures() {
  return (
    <section className="bg-surface py-section-gap px-margin-edge">
      <div className="max-w-container-max-width mx-auto">
        {/* Section header */}
        <div className="text-center mb-stack-lg">
          <h2 className="font-headline-lg text-headline-lg text-on-background">
            More Features
          </h2>
        </div>

        {/* 2×3 pill grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-stack-md">
          {moreFeatures.map((label) => (
            <div
              key={label}
              className="bg-surface-container p-6 rounded-xl border border-surface-container-high hover:border-outline-variant transition-colors flex items-center justify-center text-center"
            >
              <span className="font-headline-md text-headline-md text-on-surface">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
