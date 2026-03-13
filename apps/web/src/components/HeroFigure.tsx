import { TiltedTiles } from "@/components/ui/tilted-tiles";
import { INTENT_TILES } from "@/lib/intent-tiles";

export function HeroFigure() {
  return (
    <TiltedTiles
      images={INTENT_TILES}
      columns={6}
      tilesPerColumn={3}
      tileAspect={1}
      rowGap={12}
      columnGap={12}
      borderRadius={18}
      rotateX={38}
      rotateY={14}
      rotateZ={-18}
      offsetX={-24}
      planeWidth={180}
      planeHeight={200}
      stagger={18}
      duration={48}
      fadeTop={16}
      fadeBottom={14}
      parallax={false}
      saturation={1.08}
      width="100%"
      height="100%"
    />
  );
}
