import { NextResponse } from "next/server";

const GITHUB_REPO = "chorded/chorded";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface LatestRelease {
  version: string;
  downloadUrl: string;
  htmlUrl: string;
}

export async function GET() {
  try {
    const res = await fetch(GITHUB_API, {
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

    const data = await res.json();

    // Find the .exe installer asset (ignore .blockmap, .yml, etc.)
    const exeAsset = data.assets?.find(
      (a: { name: string; browser_download_url: string }) =>
        a.name.endsWith(".exe") && !a.name.endsWith(".blockmap")
    );

    const release: LatestRelease = {
      version: data.tag_name ?? data.name ?? "latest",
      downloadUrl: exeAsset?.browser_download_url ?? data.html_url,
      htmlUrl: data.html_url,
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
