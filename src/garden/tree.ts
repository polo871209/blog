import { Box3, Vector3 } from "three";
import { createRng, type Rng } from "./rng";

export interface Branch {
  points: Vector3[];
  radii: number[];
  along: number[];
  arrival: number[];
  depth: number;
  length: number;
}

export interface Leaf {
  position: Vector3;
  normal: Vector3;
  size: number;
  angle: number;
  rnd: number;
  arrival: number;
  exposure: number;
}

export interface Tree {
  branches: Branch[];
  leaves: Leaf[];
  bounds: Box3;
  crown: Vector3;
}

export interface TreeShape {
  seed: number;
  size: number;
  spread: number;
  gnarl: number;
  lean: number;
  density: number;
}

interface Station {
  position: Vector3;
  direction: Vector3;
  radius: number;
  arrival: number;
}

interface LimbSpec {
  direction: Vector3;
  length: number;
  steps?: number;
  radiusStart: number;
  radiusEnd: number;
  taper?: number;
  flare?: number;
  wander?: number;
  droop?: number;
  bend?: (direction: Vector3, t: number) => void;
}

interface ClusterSpec {
  center: Vector3;
  radii: Vector3;
  density: number;
  arrival: number;
}

const TAU = Math.PI * 2;

function perpendicular(v: Vector3): Vector3 {
  const helper =
    Math.abs(v.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  return helper.cross(v).normalize();
}

function tilt(direction: Vector3, angle: number, azimuth: number): Vector3 {
  const axis = perpendicular(direction).applyAxisAngle(direction, azimuth);
  return direction.clone().applyAxisAngle(axis, angle).normalize();
}

class TreeBuilder {
  readonly branches: Branch[] = [];
  readonly leaves: Leaf[] = [];

  constructor(readonly rng: Rng) {}

  range(min: number, max: number): number {
    return min + (max - min) * this.rng();
  }

  gaussian(): number {
    let sum = 0;
    for (let i = 0; i < 4; i++) sum += this.rng();
    return (sum - 2) / 0.577;
  }

  direction(): Vector3 {
    const v = new Vector3(this.gaussian(), this.gaussian(), this.gaussian());
    return v.lengthSq() < 1e-6 ? new Vector3(0, 1, 0) : v.normalize();
  }

  trunk(spec: LimbSpec): Branch {
    return this.walk(new Vector3(), spec, 0, 0);
  }

  sprout(parent: Branch, t: number, spec: LimbSpec): Branch {
    const at = station(parent, t);
    return this.walk(
      at.position,
      { ...spec, radiusStart: Math.min(spec.radiusStart, at.radius * 0.92) },
      parent.depth + 1,
      at.arrival + 0.05,
    );
  }

  private walk(
    origin: Vector3,
    spec: LimbSpec,
    depth: number,
    arrivalStart: number,
  ): Branch {
    const steps = Math.max(3, Math.round(spec.steps ?? spec.length / 0.16));
    const stepLength = spec.length / steps;
    const heading = spec.direction.clone().normalize();
    const side = perpendicular(heading);
    const points = [origin.clone()];
    const radii = [spec.radiusStart];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      spec.bend?.(heading, t);
      heading.normalize();
      if (spec.wander) {
        side.applyAxisAngle(heading, 0.9 * this.range(-1, 1)).normalize();
        heading
          .addScaledVector(side, spec.wander * this.range(-0.6, 1))
          .normalize();
      }
      if (spec.droop) heading.y -= spec.droop * t;
      heading.normalize();
      points.push(points[i - 1].clone().addScaledVector(heading, stepLength));
      radii.push(
        spec.radiusStart +
          (spec.radiusEnd - spec.radiusStart) * Math.pow(t, spec.taper ?? 1),
      );
    }
    if (spec.flare) {
      for (let i = 0; i < radii.length; i++)
        radii[i] *= 1 + spec.flare * Math.exp(-(i / steps) * 9);
    }
    const along = [0];
    for (let i = 1; i < points.length; i++)
      along.push(along[i - 1] + points[i].distanceTo(points[i - 1]));
    const branch: Branch = {
      points,
      radii,
      along,
      arrival: along.map((d) => arrivalStart + d),
      depth,
      length: along[along.length - 1],
    };
    this.branches.push(branch);
    return branch;
  }

  cluster({ center, radii, density, arrival }: ClusterSpec): void {
    const { x: rx, y: ry, z: rz } = radii;
    const area = (rx * ry + ry * rz + rx * rz) / 3;
    const count = Math.round(2.4 * density * Math.max(0.5, area / 0.3));
    for (let i = 0; i < count; i++) {
      const dir = this.direction();
      const depth = Math.cbrt(this.rng());
      this.leaves.push({
        position: new Vector3(
          dir.x * rx * depth,
          dir.y * ry * depth,
          dir.z * rz * depth,
        ).add(center),
        normal: new Vector3(dir.x / rx, dir.y / ry, dir.z / rz).normalize(),
        size: this.range(0.65, 1.4),
        angle: this.range(0, TAU),
        rnd: this.rng(),
        arrival: arrival + this.range(0, 0.35),
        exposure: depth,
      });
    }
  }
}

function station(branch: Branch, t: number): Station {
  const target = t * branch.length;
  let i = 1;
  while (i < branch.along.length - 1 && branch.along[i] < target) i++;
  const span = Math.max(1e-6, branch.along[i] - branch.along[i - 1]);
  const f = (target - branch.along[i - 1]) / span;
  return {
    position: branch.points[i - 1].clone().lerp(branch.points[i], f),
    direction: branch.points[i]
      .clone()
      .sub(branch.points[i - 1])
      .normalize(),
    radius: branch.radii[i - 1] + (branch.radii[i] - branch.radii[i - 1]) * f,
    arrival:
      branch.arrival[i - 1] + (branch.arrival[i] - branch.arrival[i - 1]) * f,
  };
}

function tip(branch: Branch): Station {
  const n = branch.points.length;
  return {
    position: branch.points[n - 1].clone(),
    direction: branch.points[n - 1]
      .clone()
      .sub(branch.points[n - 2])
      .normalize(),
    radius: branch.radii[n - 1],
    arrival: branch.arrival[n - 1],
  };
}

function ellipsoid(r: number, flat: number): Vector3 {
  return new Vector3(r * 1.1, r * flat, r * 1.1);
}

function growCherry(b: TreeBuilder, shape: TreeShape): void {
  const { size, spread, gnarl, lean, density } = shape;
  const leafCount = 54 * density;
  const trunk = b.trunk({
    direction: new Vector3(
      0.18 * lean + b.range(-0.06, 0.06),
      1,
      b.range(-0.06, 0.06),
    ),
    length: 1.45 * size,
    radiusStart: 0.17 * size,
    radiusEnd: 0.12 * size,
    wander: 0.05 * gnarl,
    flare: 0.5,
    steps: 7,
  });
  const limbCount = b.rng() < 0.5 ? 5 : 4;
  const phase = b.range(0, TAU);
  for (let i = 0; i < limbCount; i++) {
    const azimuth = phase + (i / limbCount) * TAU + b.range(-0.3, 0.3);
    const direction = tilt(tip(trunk).direction, b.range(0.45, 0.9), azimuth);
    const limbLength = b.range(2, 2.6) * size * (0.85 + 0.15 * spread);
    const limb = b.sprout(trunk, b.range(0.88, 1), {
      direction,
      length: limbLength,
      radiusStart: 0.11 * size,
      radiusEnd: 0.035 * size,
      wander: 0.09 * gnarl,
      taper: 0.8,
      bend: (heading, t) => {
        const outward = new Vector3(heading.x, 0, heading.z).normalize();
        heading.addScaledVector(outward, 0.06 * spread);
        heading.y += t > 0.55 ? -0.07 : 0.02;
      },
    });
    const sideCount = 3 + Math.floor(b.range(0, 2));
    for (let j = 0; j < sideCount; j++) {
      const at = Math.min(
        0.98,
        0.38 + (j / sideCount) * 0.6 + b.range(-0.05, 0.05),
      );
      const side = b.sprout(limb, at, {
        direction: tilt(
          station(limb, at).direction,
          b.range(0.45, 0.9),
          b.range(0, 6.28),
        ),
        length: limbLength * b.range(0.38, 0.55),
        radiusStart: 0.05 * size,
        radiusEnd: 0.015 * size,
        wander: 0.14 * gnarl,
        droop: 0.04,
      });
      const twigCount = 2 + Math.floor(b.range(0, 2));
      for (let k = 0; k < twigCount; k++) {
        const twig = b.sprout(side, b.range(0.45, 0.95), {
          direction: tilt(
            side.points[1].clone().sub(side.points[0]).normalize(),
            b.range(0.5, 1),
            b.range(0, 6.28),
          ),
          length: limbLength * b.range(0.18, 0.28),
          radiusStart: 0.025 * size,
          radiusEnd: 0.009 * size,
          wander: 0.2 * gnarl,
          steps: 3,
        });
        const r = b.range(0.55, 0.78) * size;
        b.cluster({
          center: tip(twig).position.add(
            new Vector3(0, b.range(-0.1, 0.35) * size, 0),
          ),
          radii: new Vector3(1.05 * r, 0.82 * r, 1.05 * r),
          density: leafCount,
          arrival: tip(twig).arrival,
        });
      }
      const end = tip(side);
      b.cluster({
        center: end.position,
        radii: ellipsoid(b.range(0.62, 0.85) * size, 0.85),
        density: leafCount,
        arrival: end.arrival,
      });
    }
    const end = tip(limb);
    const r = 0.95 * size;
    b.cluster({
      center: end.position,
      radii: ellipsoid(r, 0.8),
      density: leafCount,
      arrival: end.arrival,
    });
    const upper = station(limb, 0.72);
    b.cluster({
      center: upper.position.add(new Vector3(0, 0.35 * size, 0)),
      radii: new Vector3(0.9 * r, 0.7 * r, 0.9 * r),
      density: 40 * density,
      arrival: upper.arrival,
    });
  }
}

export function growTree(shape: TreeShape): Tree {
  const builder = new TreeBuilder(createRng(Math.imul(0x9e3779b1, shape.seed)));
  growCherry(builder, shape);
  const { branches, leaves } = builder;

  let reach = 0;
  for (const branch of branches)
    reach = Math.max(reach, branch.arrival[branch.arrival.length - 1]);
  for (const leaf of leaves) reach = Math.max(reach, leaf.arrival);
  const scale = 1 / Math.max(1e-6, reach);
  for (const branch of branches)
    branch.arrival = branch.arrival.map((a) => a * scale);
  for (const leaf of leaves) leaf.arrival *= scale;

  const bounds = new Box3();
  for (const leaf of leaves) bounds.expandByPoint(leaf.position);
  for (const branch of branches)
    for (const point of branch.points) bounds.expandByPoint(point);

  const crown = new Vector3();
  for (const leaf of leaves) crown.add(leaf.position);
  crown.multiplyScalar(1 / Math.max(1, leaves.length));

  const half = bounds.getSize(new Vector3()).multiplyScalar(0.5);
  for (const leaf of leaves) {
    const outward = leaf.position.clone().sub(crown);
    outward.x /= Math.max(0.3, half.x);
    outward.y /= Math.max(0.3, half.y);
    outward.z /= Math.max(0.3, half.z);
    leaf.normal
      .multiplyScalar(0.78)
      .addScaledVector(outward.normalize(), 0.22)
      .normalize();
  }

  return { branches, leaves, bounds, crown };
}
