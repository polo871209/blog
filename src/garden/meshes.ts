import {
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Sphere,
  Vector3,
  Vector4,
} from "three";
import type { Rng } from "./rng";
import type { Leaf, Tree } from "./tree";

const NEVER = -1e4;

function perpendicular(v: Vector3): Vector3 {
  const helper =
    Math.abs(v.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  return helper.cross(v).normalize();
}

export function createQuad(): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.boundingSphere = new Sphere(new Vector3(0, 3, 0), 30);
  return geometry;
}

export function createBarkGeometry(tree: Tree): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const centers: number[] = [];
  const arrivals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let base = 0;

  for (const branch of tree.branches) {
    const sides = branch.depth === 0 ? 12 : branch.depth === 1 ? 8 : 6;
    const count = branch.points.length;
    let side: Vector3 | null = null;
    for (let i = 0; i < count; i++) {
      const next = branch.points[Math.min(i + 1, count - 1)];
      const prev = branch.points[Math.max(i - 1, 0)];
      const tangent = next.clone().sub(prev).normalize();
      side = side
        ? side.addScaledVector(tangent, -side.dot(tangent)).normalize()
        : perpendicular(tangent);
      if (side.lengthSq() < 1e-6) side = perpendicular(tangent);
      const binormal = tangent.clone().cross(side).normalize();
      const center = branch.points[i];
      const radius = branch.radii[i];
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        const n = side
          .clone()
          .multiplyScalar(Math.cos(a))
          .addScaledVector(binormal, Math.sin(a));
        positions.push(
          center.x + n.x * radius,
          center.y + n.y * radius,
          center.z + n.z * radius,
        );
        normals.push(n.x, n.y, n.z);
        centers.push(center.x, center.y, center.z);
        arrivals.push(branch.arrival[i]);
        uvs.push(j / sides, branch.along[i]);
      }
    }
    for (let i = 0; i < count - 1; i++) {
      for (let j = 0; j < sides; j++) {
        const a = base + i * (sides + 1) + j;
        const b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    base += count * (sides + 1);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aCenter", new Float32BufferAttribute(centers, 3));
  geometry.setAttribute("aArrival", new Float32BufferAttribute(arrivals, 1));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function createLeafGeometry(leaves: Leaf[]): InstancedBufferGeometry {
  const geometry = createQuad();
  const n = leaves.length;
  const pos = new Float32Array(3 * n);
  const normal = new Float32Array(3 * n);
  const data = new Float32Array(4 * n);
  const exposure = new Float32Array(n);
  leaves.forEach((leaf, i) => {
    leaf.position.toArray(pos, 3 * i);
    leaf.normal.toArray(normal, 3 * i);
    data.set([leaf.size, leaf.angle, leaf.rnd, leaf.arrival], 4 * i);
    exposure[i] = leaf.exposure;
  });
  geometry.setAttribute("iPos", new InstancedBufferAttribute(pos, 3));
  geometry.setAttribute("iNormal", new InstancedBufferAttribute(normal, 3));
  geometry.setAttribute("iData", new InstancedBufferAttribute(data, 4));
  geometry.setAttribute("iExposure", new InstancedBufferAttribute(exposure, 1));
  geometry.setAttribute(
    "iGone",
    new InstancedBufferAttribute(new Float32Array(n).fill(NEVER), 1).setUsage(
      DynamicDrawUsage,
    ),
  );
  geometry.instanceCount = n;
  return geometry;
}

export interface MoundShape {
  radius: number;
  height: number;
}

export function moundHeight(mound: MoundShape, x: number, z: number): number {
  const r = Math.hypot(x, z) / mound.radius;
  return r < 1 ? mound.height * Math.pow(1 - r * r, 1.3) : 0;
}

export function createMoundGeometry(mound: MoundShape): BufferGeometry {
  const rings = 22;
  const segments = 72;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    for (let j = 0; j <= segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const wobble =
        1 + 0.06 * Math.sin(3 * a + 1) + 0.04 * Math.sin(7 * a + 2);
      const r = t * mound.radius * wobble;
      const y = mound.height * Math.pow(1 - t * t, 1.3) - (t > 0.97 ? 0.02 : 0);
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function scatterMoss(
  mound: MoundShape,
  rng: Rng,
  count: number,
): Leaf[] {
  const moss: Leaf[] = [];
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.98 * Math.sqrt(rng()) * mound.radius;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    moss.push({
      position: new Vector3(x, moundHeight(mound, x, z) + 0.02, z),
      normal: new Vector3(
        (1.3 * x) / mound.radius,
        1,
        (1.3 * z) / mound.radius,
      ).normalize(),
      size: 0.7 + 0.6 * rng(),
      angle: 6.28 * rng(),
      rnd: rng(),
      arrival: 0,
      exposure: 0.6 + 0.4 * rng(),
    });
  }
  return moss;
}

export interface Stone {
  geometry: BufferGeometry;
  position: Vector3;
  scale: Vector3;
  rotationY: number;
  footprint: Vector4;
}

export function placeStones(
  mound: MoundShape,
  rng: Rng,
  count: number,
): Stone[] {
  const stones: Stone[] = [];
  const front = Math.PI / 2;
  const turn = rng() < 0.5 ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const first = i === 0;
    const size = first ? 0.55 + 0.15 * rng() : 0.28 + 0.18 * rng();
    const angle =
      front +
      turn *
        (1.15 +
          ((i + 0.5) / count) * (Math.PI * 2 - 2.3) +
          (rng() - 0.5) * 0.35);
    const distance = mound.radius + (first ? 0.2 : 0.6 + 1.6 * rng());
    const geometry = new IcosahedronGeometry(1, 4);
    const position = geometry.getAttribute("position");
    const phase = 100 * rng();
    const v = new Vector3();
    for (let k = 0; k < position.count; k++) {
      v.fromBufferAttribute(position, k);
      const lumps =
        Math.sin(2.1 * v.x + phase) *
        Math.sin(2.7 * v.y + 1.3 * phase) *
        Math.sin(1.9 * v.z + 0.7 * phase);
      const pits =
        Math.sin(5.3 * v.x + 2 * phase) * Math.sin(4.7 * v.z + phase);
      v.multiplyScalar(1 + 0.12 * lumps + 0.025 * pits);
      position.setXYZ(k, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
    const height = size * (0.55 + 0.3 * rng());
    const scale = new Vector3(
      size * (1.1 + 0.4 * rng()),
      height,
      size * (0.9 + 0.3 * rng()),
    );
    const rotationY = 6.28 * rng();
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    stones.push({
      geometry,
      position: new Vector3(x, 0.35 * height, z),
      scale,
      rotationY,
      footprint: new Vector4(
        x,
        z,
        0.95 * Math.max(scale.x, scale.z),
        scale.z / scale.x,
      ),
    });
  }
  return stones;
}
