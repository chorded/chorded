import { NextResponse } from "next/server";

const GITHUB_REPO = "chorded/chorded";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface LatestRelease {
  version: string;
  downloadUrl: string;
  htmlUrl: string;
  downloadCount: number;
}

export async function GET() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        // Add GITHUB_TOKEN env var to avoid rate limiting in production
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      // Cache for 5 minutes — revalidates in background
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`GitHub API responded with ${res.status}`);
    }

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

    // Find the .exe installer asset (ignore .blockmap, .yml, etc.)
    const exeAsset = latest.assets?.find(
      (a: { name: string; browser_download_url: string }) =>
        a.name.endsWith(".exe") && !a.name.endsWith(".blockmap")
    );

    // Calculate total download count across all releases & assets
    let downloadCount = 0;
    if (Array.isArray(releases)) {
      downloadCount = releases.reduce((total: number, rel: { assets?: { download_count?: number }[] }) => {
        const relSum = rel.assets?.reduce((sum, a) => sum + (a.download_count || 0), 0) ?? 0;
        return total + relSum;
      }, 0);
    } else if (latest.assets) {
      downloadCount = latest.assets.reduce((sum: number, a: { download_count?: number }) => sum + (a.download_count || 0), 0);
    }

    // Add an offset for downloads lost when a GitHub asset is replaced/re-uploaded
    // (GitHub resets download_count to 0 when you delete+reupload an asset)
    // Set DOWNLOAD_COUNT_OFFSET in your Vercel env vars to restore the historical count.
    const offset = parseInt(process.env.DOWNLOAD_COUNT_OFFSET ?? "0", 10);
    if (!isNaN(offset) && offset > 0) downloadCount += offset;

    const release: LatestRelease = {
      version: latest.tag_name ?? latest.name ?? "latest",
      downloadUrl: exeAsset?.browser_download_url ?? latest.html_url,
      htmlUrl: latest.html_url,
      downloadCount,
    };

    return NextResponse.json(release, {
      headers: {
        // Also cache at CDN level for 5 minutes
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[latest-release] Failed to fetch GitHub release:", err);
    return NextResponse.json(
      { error: "Failed to fetch latest release" },
      { status: 502 }
    );
  }
}
