export type HazardZone = { pos: [number, number, number]; size: [number, number] };

export const getBumperPositions = (boxSize: number): [number, number, number][] => {
  const half = boxSize / 2;
  const inner = Math.max(2.5, half * 0.45);
  const outer = Math.max(3.5, half * 0.72);

  const positions: [number, number, number][] = [
    [-inner, 0.4, -inner],
    [inner, 0.4, -inner],
    [-inner, 0.4, inner],
    [inner, 0.4, inner],
    [0, 0.4, 0],
  ];

  if (boxSize >= 16) {
    positions.push([0, 0.4, -outer], [0, 0.4, outer], [-outer, 0.4, 0], [outer, 0.4, 0]);
  }
  if (boxSize >= 28) {
    const diag = Math.max(4, half * 0.82);
    positions.push([-diag, 0.4, -diag], [diag, 0.4, -diag], [-diag, 0.4, diag], [diag, 0.4, diag]);
  }
  return positions;
};

export const getSpikePositions = (boxSize: number): [number, number, number][] => {
  const half = boxSize / 2;
  const edge = Math.max(4.5, half * 0.82);
  const positions: [number, number, number][] = [
    [-edge, 0.3, 0],
    [edge, 0.3, 0],
    [0, 0.3, -edge],
    [0, 0.3, edge],
  ];
  if (boxSize >= 22) {
    const edge2 = Math.max(6, half * 0.65);
    positions.push([-edge2, 0.3, -edge2], [edge2, 0.3, -edge2], [-edge2, 0.3, edge2], [edge2, 0.3, edge2]);
  }
  return positions;
};

export const getHazardZones = (boxSize: number): HazardZone[] => {
  const half = boxSize / 2;
  const corner = Math.max(4.5, half * 0.75);
  const size: [number, number] = boxSize >= 22 ? [2.5, 2.5] : [2, 2];

  const zones: HazardZone[] = [
    { pos: [-corner, 0, -corner], size },
    { pos: [corner, 0, corner], size },
  ];

  if (boxSize >= 28) {
    zones.push({ pos: [corner, 0, -corner], size }, { pos: [-corner, 0, corner], size });
  }

  return zones;
};
