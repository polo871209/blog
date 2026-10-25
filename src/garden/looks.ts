import { Vector3 } from "three";

export const ATLAS_CELL = { blossom: 0, dab: 1, leaf: 2 } as const;
export const ATLAS_CELLS = 3;

function hexToVector(hex: string): Vector3 {
  const value = parseInt(hex.slice(1), 16);
  return new Vector3(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  );
}

const mossLight = hexToVector("#b7d0ae");

export const LOOK = {
  crown: ["#957fb8", "#d27e99", "#e6a0b0", "#f4c9c9"].map(hexToVector),
  crownShape: ATLAS_CELL.blossom,
  crownDabShare: 0.35,
  moss: [
    hexToVector("#6a9589"),
    hexToVector("#7aa89f"),
    mossLight,
    mossLight.clone().lerp(new Vector3(1, 1, 1), 0.3),
  ],
  mossShape: ATLAS_CELL.dab,
  mossDabShare: 1,
  ground: hexToVector("#f2ecbc"),
  gravel: hexToVector("#ece5b6"),
  rake: hexToVector("#e5ddb0"),
  shadow: hexToVector("#a09cac"),
  bark: hexToVector("#938aa9"),
  barkShade: hexToVector("#766b90"),
  rock: hexToVector("#c9cbd1"),
  rockShade: hexToVector("#a09cac"),
  sun: hexToVector("#fff8e6"),
};
