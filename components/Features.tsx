const features = [
  {
    icon: "edit",
    title: "Smart Paste",
    description:
      "Copy chord sheets from anywhere on the web and paste them directly into CHORDED. The app automatically detects and formats the chords and lyrics, ready for you to edit and clean up in seconds.",
  },
  {
    icon: "tag",
    title: "Transposing & Nashville Number System",
    description:
      "Instantly transpose your entire song up or down with a single click, no manual rewriting needed.",
  },
  {
    icon: "search",
    title: "Find & Replace Chords",
    description:
      "Spot a chord that needs fixing throughout the song? Use find & Replace (CTRL+H) to locate every instance instantly and update them all at once, so you spend less time hunting and more time playing.",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="bg-white py-section-gap px-margin-edge flex-grow"
    >
      <div className="max-w-container-max-width mx-auto">
        {/* Section header */}
        <div className="text-center mb-section-gap">
          <h2 className="font-headline-lg text-headline-lg text-surface-container-lowest">
            Engineered for Workflow
          </h2>
          <p className="font-body-md text-body-md text-surface-variant mt-4 max-w-2xl mx-auto">
            Everything you need to prepare your setlist with absolute precision.
          </p>
        </div>

        {/* 3-column card grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-surface-dim p-8 rounded-xl border border-surface-container hover:border-outline-variant transition-colors group"
            >
              {/* Icon box */}
              <div className="w-12 h-12 bg-[#1a2463] rounded-lg flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-white">
                  {feature.icon}
                </span>
              </div>

              <h3 className="font-headline-md text-headline-md text-on-background mb-4">
                {feature.title}
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
