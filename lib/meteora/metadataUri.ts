/**
 * Build the on-chain metadata URI for a launch. The Metaplex `uri` field has a ~200-byte budget,
 * so fields are dropped in priority order (image, then description) until it fits -- never
 * truncated mid-field, since a cut-off URL or sentence is worse than omitting it.
 */
export function buildMetadataUri(origin: string, input: { name: string; symbol: string; description?: string; imageUrl?: string }): string {
  const attempt = (withDescription: boolean, withImage: boolean) => {
    const q = new URLSearchParams({ name: input.name, symbol: input.symbol });
    if (withDescription && input.description) q.set("description", input.description);
    if (withImage && input.imageUrl) q.set("image", input.imageUrl);
    return `${origin}/api/metadata?${q.toString()}`;
  };

  for (const [d, i] of [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ] as const) {
    const uri = attempt(d, i);
    if (uri.length <= 200) return uri;
  }
  return attempt(false, false); // name + symbol alone always fits
}
