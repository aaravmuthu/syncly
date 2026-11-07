import displacementMap from "./liquid-glass-map.png?inline";

export function LiquidGlassFilter() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute" width="0" height="0">
      <defs>
        {/* Red bends the left/right edges, green bends the top/bottom edges.
            The neutral center keeps the backdrop beneath labels undistorted. */}
        <filter
          id="syncly-liquid-glass"
          x="0"
          y="0"
          width="100%"
          height="100%"
          primitiveUnits="objectBoundingBox"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={displacementMap}
            width="1"
            height="1"
            preserveAspectRatio="none"
            result="lens"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="lens"
            scale="0.14"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
