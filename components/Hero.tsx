import type { LatestRelease } from "@/app/api/latest-release/route";

const FALLBACK_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_URL ??
  "https://github.com/chorded/chorded/releases/latest";

async function getLatestRelease(): Promise<LatestRelease> {
  try {
    // Fetch directly from GitHub during server render — same logic as the API route
    const res = await fetch(
      "https://api.github.com/repos/chorded/chorded/releases",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) throw new Error(`GitHub API ${res.status}`);

    const releases = await res.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      throw new Error("No releases found");
    }

    // Sort by published_at date descending to guarantee the newest published release is chosen
    const published = releases.filter((r: { draft?: boolean }) => !r.draft);
    published.sort(
      (a: { published_at?: string }, b: { published_at?: string }) =>
        new Date(b.published_at || 0).getTime() -
        new Date(a.published_at || 0).getTime()
    );

    const latest = published[0] ?? releases[0];

    const exeAsset = latest.assets?.find(
      (a: { name: string; browser_download_url: string }) =>
        a.name.endsWith(".exe") && !a.name.endsWith(".blockmap")
    );

    let downloadCount = 0;
    if (Array.isArray(releases)) {
      downloadCount = releases.reduce((total: number, rel: { assets?: { download_count?: number }[] }) => {
        const relSum = rel.assets?.reduce((sum, a) => sum + (a.download_count || 0), 0) ?? 0;
        return total + relSum;
      }, 0);
    } else if (latest.assets) {
      downloadCount = latest.assets.reduce((sum: number, a: { download_count?: number }) => sum + (a.download_count || 0), 0);
    }

    // Restore downloads lost when a GitHub asset was replaced/re-uploaded
    // (GitHub resets download_count to 0 on asset deletion). Set DOWNLOAD_COUNT_OFFSET in Vercel env vars.
    const offset = parseInt(process.env.DOWNLOAD_COUNT_OFFSET ?? "0", 10);
    if (!isNaN(offset) && offset > 0) downloadCount += offset;

    return {
      version: latest.tag_name ?? "latest",
      downloadUrl: exeAsset?.browser_download_url ?? latest.html_url ?? FALLBACK_URL,
      htmlUrl: latest.html_url ?? FALLBACK_URL,
      downloadCount,
    };
  } catch {
    return {
      version: "",
      downloadUrl: FALLBACK_URL,
      htmlUrl: FALLBACK_URL,
      downloadCount: 0,
    };
  }
}

export default async function Hero() {
  const release = await getLatestRelease();

  // Strip leading "v" for display: "v1.0.0" → "1.0.0"
  const versionDisplay = release.version.replace(/^v/, "");

  return (
    <section
      id="hero"
      className="bg-[#1a2463] text-white py-section-gap px-margin-edge flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[70vh]"
    >
      {/* Decorative radial blur — exact from Stitch export */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl relative z-10 space-y-stack-lg flex flex-col items-center">
        {release.downloadCount >= 100 && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs md:text-sm font-medium text-blue-200 backdrop-blur-md shadow-sm mb-1">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
            </span>
            <span className="material-symbols-outlined text-base text-blue-300">download</span>
            <span>Over <strong className="text-white font-semibold">{release.downloadCount.toLocaleString()}</strong> downloads</span>
          </div>
        )}

        <h1 className="font-display-lg text-display-lg font-bold tracking-tight text-white">
          Write. Organize. Perform
        </h1>

        <p className="font-body-lg text-body-lg text-primary-fixed-dim max-w-2xl mx-auto">
          CHORDED is a powerful desktop app for musicians to write, format, and
          perform chord charts and lyrics all in one place.
        </p>

        <div className="pt-stack-md flex flex-col items-center">
          <a
            href={release.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="custom-button inline-flex items-center gap-2 px-8 py-4 rounded-xl font-label-md text-label-md text-lg shadow-lg hover:shadow-xl transition-all"
          >
            <span className="material-symbols-outlined">download</span>
            Download Chorded for Windows (.exe)
          </a>
          <p className="mt-4 font-label-sm text-label-sm text-on-primary-container">
            {versionDisplay ? `Version ${versionDisplay}` : "Latest version"} | Freemium & ChordedPro Available
          </p>
        </div>
      </div>
    </section>
  );
}
