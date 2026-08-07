const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? "#";

export default function Hero() {
  return (
    <section
      id="hero"
      className="bg-[#1a2463] text-white py-section-gap px-margin-edge flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[70vh]"
    >
      {/* Decorative radial blur — exact from Stitch export */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl relative z-10 space-y-stack-lg">
        <h1 className="font-display-lg text-display-lg font-bold tracking-tight text-white">
          Write. Organize. Perform
        </h1>

        <p className="font-body-lg text-body-lg text-primary-fixed-dim max-w-2xl mx-auto">
          CHORDED is a powerful desktop app for musicians to write, format, and
          perform chord charts and lyrics all in one place.
        </p>

        <div className="pt-stack-md">
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="custom-button inline-flex items-center gap-2 px-8 py-4 rounded-xl font-label-md text-label-md text-lg shadow-lg hover:shadow-xl transition-all"
          >
            <span className="material-symbols-outlined">download</span>
            Download Chorded for Windows (.exe)
          </a>
          <p className="mt-4 font-label-sm text-label-sm text-on-primary-container">
            Version 1.2.0 | Free to try
          </p>
        </div>
      </div>
    </section>
  );
}
