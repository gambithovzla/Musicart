// Cover Art Archive: portadas ligadas a MusicBrainz. Sin API key.

export async function getCoverUrl(releaseGroupMbid: string): Promise<string | null> {
  const url = `https://coverartarchive.org/release-group/${releaseGroupMbid}/front-500`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}
