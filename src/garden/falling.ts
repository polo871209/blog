import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Vector3,
} from "three";
import { createQuad, moundHeight, type MoundShape } from "./meshes";
import type { Rng } from "./rng";

const DRAG = 2.4;
const DEAD = -1e9;

export type FallKind = "knocked" | "petal";

const KIND_CODE: Record<FallKind, number> = { knocked: 0, petal: 1 };

export type Launch = {
  start: Vector3;
  velocity: Vector3;
  terminal: Vector3;
  size: number;
  rnd: number;
  kind: FallKind;
} & ({ restTime: number } | { lifetime: number });

interface Landing {
  time: number;
  x: number;
  z: number;
}

function solveLanding(mound: MoundShape, launch: Launch): Landing {
  const { start, velocity, terminal } = launch;
  const at = (t: number) => {
    const e = (1 - Math.exp(-DRAG * t)) / DRAG;
    return [
      start.x + velocity.x * e + terminal.x * (t - e),
      start.y + velocity.y * e + terminal.y * (t - e),
      start.z + velocity.z * e + terminal.z * (t - e),
    ];
  };
  let time = Math.max(
    0.1,
    (start.y - moundHeight(mound, start.x, start.z)) / -terminal.y + 0.4,
  );
  for (let i = 0; i < 6; i++) {
    const [x, y, z] = at(time);
    const above = y - moundHeight(mound, x, z) - 0.02;
    const decay = Math.exp(-DRAG * time);
    const fallRate = velocity.y * decay + terminal.y * (1 - decay);
    time = Math.max(0, time - above / Math.min(fallRate, -0.05));
  }
  const [x, , z] = at(time);
  return { time, x, z };
}

export class FallingLeaves {
  readonly geometry: InstancedBufferGeometry;
  private readonly start: InstancedBufferAttribute;
  private readonly velocity: InstancedBufferAttribute;
  private readonly terminal: InstancedBufferAttribute;
  private readonly timing: InstancedBufferAttribute;
  private readonly look: InstancedBufferAttribute;
  private readonly restX: Float32Array;
  private readonly restZ: Float32Array;
  private readonly restFrom: Float32Array;
  private readonly restUntil: Float32Array;
  private next = 0;
  private dirty = false;

  constructor(
    private readonly capacity: number,
    private readonly mound: MoundShape,
    private readonly rng: Rng,
  ) {
    this.geometry = createQuad();
    const attribute = (size: number, fill = 0) =>
      new InstancedBufferAttribute(
        new Float32Array(capacity * size).fill(fill),
        size,
      ).setUsage(DynamicDrawUsage);
    this.start = attribute(3);
    this.velocity = attribute(3);
    this.terminal = attribute(3);
    this.timing = attribute(4);
    this.look = attribute(4);
    for (let i = 0; i < capacity; i++) this.timing.setX(i, DEAD);
    this.geometry.setAttribute("aStart", this.start);
    this.geometry.setAttribute("aVelocity", this.velocity);
    this.geometry.setAttribute("aTerminal", this.terminal);
    this.geometry.setAttribute("aTiming", this.timing);
    this.geometry.setAttribute("aLook", this.look);
    this.geometry.instanceCount = capacity;
    this.restX = new Float32Array(capacity);
    this.restZ = new Float32Array(capacity);
    this.restFrom = new Float32Array(capacity).fill(DEAD);
    this.restUntil = new Float32Array(capacity).fill(DEAD);
  }

  launch(launch: Launch, now: number): void {
    const slot = this.next;
    this.next = (this.next + 1) % this.capacity;
    const landing = solveLanding(this.mound, launch);
    this.start.setXYZ(slot, launch.start.x, launch.start.y, launch.start.z);
    this.velocity.setXYZ(
      slot,
      launch.velocity.x,
      launch.velocity.y,
      launch.velocity.z,
    );
    this.terminal.setXYZ(
      slot,
      launch.terminal.x,
      launch.terminal.y,
      launch.terminal.z,
    );
    const rest =
      "lifetime" in launch ? launch.lifetime - landing.time : launch.restTime;
    this.timing.setXYZW(slot, now, landing.time, rest, this.rng());
    this.look.setXYZW(
      slot,
      launch.size,
      1.2 + 2.8 * this.rng(),
      launch.rnd,
      KIND_CODE[launch.kind],
    );
    this.restX[slot] = landing.x;
    this.restZ[slot] = landing.z;
    const sweepable = launch.kind === "knocked";
    this.restFrom[slot] = sweepable ? now + landing.time : DEAD;
    this.restUntil[slot] = sweepable ? now + landing.time + rest - 2.5 : DEAD;
    this.dirty = true;
  }

  sweep(
    center: Vector3,
    radius: number,
    push: Vector3,
    limit: number,
    now: number,
    relaunch: (
      from: Vector3,
      velocity: Vector3,
      size: number,
      rnd: number,
    ) => void,
  ): number {
    const r2 = radius * radius;
    let moved = 0;
    for (let i = 0; i < this.capacity && moved < limit; i++) {
      if (now < this.restFrom[i] + 0.15 || now > this.restUntil[i]) continue;
      const dx = this.restX[i] - center.x;
      const dz = this.restZ[i] - center.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const closeness = 1 - Math.sqrt(d2) / radius;
      const away = new Vector3(dx, 0, dz)
        .normalize()
        .multiplyScalar(0.6 * closeness);
      const velocity = push
        .clone()
        .multiplyScalar(0.6 + closeness)
        .add(away)
        .add(new Vector3(0, 0.9 + 1.4 * closeness + 0.6 * this.rng(), 0));
      const from = new Vector3(
        this.restX[i],
        moundHeight(this.mound, this.restX[i], this.restZ[i]) + 0.05,
        this.restZ[i],
      );
      const size = this.look.getX(i);
      const rnd = this.look.getZ(i);
      this.timing.setX(i, DEAD);
      this.restFrom[i] = DEAD;
      this.restUntil[i] = DEAD;
      this.dirty = true;
      relaunch(from, velocity, size, rnd);
      moved++;
    }
    return moved;
  }

  flush(): void {
    if (!this.dirty) return;
    this.start.needsUpdate = true;
    this.velocity.needsUpdate = true;
    this.terminal.needsUpdate = true;
    this.timing.needsUpdate = true;
    this.look.needsUpdate = true;
    this.dirty = false;
  }
}
