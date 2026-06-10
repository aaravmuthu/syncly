/** One-shot diagonal light beam that skates across a glass card's border.
 * Place inside a `position: relative` card and bump `trigger` to replay. */
export function ShimmerBeam({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  return <span key={trigger} className="shimmer-beam" aria-hidden />;
}
