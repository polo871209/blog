import {
  BufferGeometry,
  CircleGeometry,
  Color,
  ColorManagement,
  DepthTexture,
  DoubleSide,
  Float32BufferAttribute,
  GLSL3,
  HalfFloatType,
  LessEqualCompare,
  LinearFilter,
  LinearSRGBColorSpace,
  MathUtils,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
  type IUniform,
} from "three";
import { createLeafAtlas } from "./atlas";
import { FallingLeaves, type FallKind } from "./falling";
import { ATLAS_CELL, ATLAS_CELLS, LOOK } from "./looks";
import {
  createBarkGeometry,
  createLeafGeometry,
  createMoundGeometry,
  moundHeight,
  placeStones,
  scatterMoss,
  type MoundShape,
} from "./meshes";
import { createRng } from "./rng";
import * as glsl from "./shaders";
import { growTree } from "./tree";

const WIND = 0.5;
const WIND_SPEED = 1;
const WIND_DIR = new Vector2(-0.94, -0.34).normalize();
const SUN_TURN = 62;
const SUN_HEIGHT = 19;
const SHADOW_SIZE = 2048;
const LEAF_SCALE = 0.16;
const REGROW_AFTER = 18;
const REST_TIME = 60;
const AMBIENT_PER_SECOND = 15.5;
const GROW_TIME = 1.7;
const TILT = 11;
const FALL_CAPACITY = 6000;


type Uniforms = Record<string, IUniform>;

function material(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Uniforms,
  extra: Partial<ShaderMaterial> = {},
): ShaderMaterial {
  return Object.assign(
    new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      glslVersion: GLSL3,
    }),
    extra,
  );
}

export function createGardenTree(
  host: HTMLElement,
  seed: number,
): void {
  ColorManagement.enabled = false;
  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.append(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new Scene();
  const casters = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 200);
  const sunCamera = new OrthographicCamera(-8.5, 8.5, 8.5, -8.5, 1, 60);

  const shadowTarget = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE);
  const depth = new DepthTexture(SHADOW_SIZE, SHADOW_SIZE, UnsignedIntType);
  depth.compareFunction = LessEqualCompare;
  depth.minFilter = LinearFilter;
  depth.magFilter = LinearFilter;
  shadowTarget.depthTexture = depth;

  const frameTarget = new WebGLRenderTarget(4, 4, {
    samples: 4,
    type: HalfFloatType,
    depthBuffer: true,
  });

  const atlas = createLeafAtlas();
  atlas.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const shared: Uniforms = {
    uTime: { value: 0 },
    uWind: { value: WIND },
    uWindSpeed: { value: WIND_SPEED },
    uWindDir: { value: WIND_DIR },
    uTreeHeight: { value: 5 },
    uGrow: { value: 0 },
    uGrowWidth: { value: 0.12 },
    uBlow: { value: 0 },
    uShadowMatrix: { value: new Matrix4() },
    uShadowMap: { value: depth },
    uShadowRadius: { value: (2.2 * 1.4) / SHADOW_SIZE },
    uSunDir: { value: new Vector3() },
    uSunColor: { value: LOOK.sun },
    uAtlas: { value: atlas },
    uAtlasCells: { value: ATLAS_CELLS },
    uDabCell: { value: ATLAS_CELL.dab },
    uRegrow: { value: REGROW_AFTER },
    uMoundRadius: { value: 1.8 },
    uMoundHeight: { value: 0.32 },
  };

  const crownUniforms: Uniforms = {
    ...shared,
    uLeafScale: { value: LEAF_SCALE },
    uShape: { value: LOOK.crownShape },
    uDabShare: { value: LOOK.crownDabShare },
    uRamp: { value: LOOK.crown },
    uVary: { value: 0.22 },
  };
  const mossUniforms: Uniforms = {
    ...shared,
    uWind: { value: 0 },
    uGrow: { value: 1 },
    uBlow: { value: 0 },
    uLeafScale: { value: 0.15 },
    uShape: { value: LOOK.mossShape },
    uDabShare: { value: LOOK.mossDabShare },
    uRamp: { value: LOOK.moss },
    uVary: { value: 0.3 },
  };
  const fallUniforms: Uniforms = {
    ...shared,
    uLeafScale: crownUniforms.uLeafScale,
    uShape: crownUniforms.uShape,
    uDabShare: crownUniforms.uDabShare,
    uRamp: crownUniforms.uRamp,
    uFade: { value: 0 },
  };
  const barkUniforms: Uniforms = {
    ...shared,
    uBark: { value: LOOK.bark },
    uBarkShade: { value: LOOK.barkShade },
  };
  const groundUniforms: Uniforms = {
    ...shared,
    uGround: { value: LOOK.ground },
    uGravel: { value: LOOK.gravel },
    uRake: { value: LOOK.rake },
    uShadowColor: { value: LOOK.shadow },
    uShadowStrength: { value: 0.8 },
    uRakeStrength: { value: 0.6 },
    uRakeRadius: { value: 1.8 },
    uStones: { value: Array.from({ length: 6 }, () => new Vector4()) },
    uStoneCount: { value: 0 },
  };
  const moundUniforms: Uniforms = {
    ...shared,
    uLit: { value: LOOK.moss[1] },
    uDark: { value: LOOK.moss[0] },
    uGrain: { value: 0.08 },
  };
  const stoneUniforms: Uniforms = {
    ...shared,
    uLit: { value: LOOK.rock },
    uDark: { value: LOOK.rockShade },
    uGrain: { value: 0.05 },
  };

  const crownMaterial = material(
    glsl.leafVertex,
    glsl.leafFragment,
    crownUniforms,
    {
      alphaToCoverage: true,
      side: DoubleSide,
    },
  );
  const crownDepthMaterial = material(
    glsl.leafVertex,
    glsl.leafDepthFragment,
    crownUniforms,
    {
      side: DoubleSide,
    },
  );
  const mossMaterial = material(
    glsl.leafVertex,
    glsl.leafFragment,
    mossUniforms,
    {
      alphaToCoverage: true,
      side: DoubleSide,
    },
  );
  const barkMaterial = material(
    glsl.barkVertex,
    glsl.barkFragment,
    barkUniforms,
  );
  const barkDepthMaterial = material(
    glsl.barkDepthVertex,
    glsl.depthFragment,
    barkUniforms,
  );
  const groundMaterial = material(
    glsl.groundVertex,
    glsl.groundFragment,
    groundUniforms,
  );
  const moundMaterial = material(
    glsl.solidVertex,
    glsl.solidFragment,
    moundUniforms,
  );
  const stoneMaterial = material(
    glsl.solidVertex,
    glsl.solidFragment,
    stoneUniforms,
  );
  const solidDepthMaterial = material(
    glsl.solidDepthVertex,
    glsl.depthFragment,
    {},
  );
  const fallMaterial = material(
    glsl.fallVertex,
    glsl.fallFragment,
    fallUniforms,
    {
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    },
  );

  const composeMaterial = material(
    glsl.screenVertex,
    glsl.composeFragment,
    {
      uFrame: { value: frameTarget.texture },
      uTime: shared.uTime,
    },
    { depthTest: false, depthWrite: false },
  );
  const screenScene = new Scene();
  const screenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const triangle = new BufferGeometry();
  triangle.setAttribute(
    "position",
    new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  const screen = new Mesh(triangle, composeMaterial);
  screen.frustumCulled = false;
  screenScene.add(screen);

  const ground = new Mesh(
    new CircleGeometry(40, 96).rotateX(-Math.PI / 2),
    groundMaterial,
  );
  scene.add(ground);

  const twin = (
    geometry: BufferGeometry,
    main: ShaderMaterial,
    depthOnly: ShaderMaterial,
  ) => {
    const visible = new Mesh(geometry, main);
    const caster = new Mesh(geometry, depthOnly);
    visible.frustumCulled = false;
    caster.frustumCulled = false;
    scene.add(visible);
    casters.add(caster);
    return { visible, caster };
  };

  const mound: MoundShape = { radius: 1.8, height: 0.32 };
  const tree = growTree({
    seed,
    size: 1,
    spread: 1,
    gnarl: 1,
    lean: 0,
    density: 1,
  });
  twin(createBarkGeometry(tree), barkMaterial, barkDepthMaterial);
  const leaves = createLeafGeometry(tree.leaves);
  twin(leaves, crownMaterial, crownDepthMaterial);
  const goneAttribute = leaves.getAttribute("iGone");
  const gone = goneAttribute.array as Float32Array;
  shared.uTreeHeight.value = Math.max(2, tree.bounds.max.y);

  const gardenRng = createRng(7919 * seed + 13);
  twin(createMoundGeometry(mound), moundMaterial, solidDepthMaterial);
  const moss = new Mesh(
    createLeafGeometry(scatterMoss(mound, gardenRng, 2400)),
    mossMaterial,
  );
  moss.frustumCulled = false;
  scene.add(moss);
  const stones = placeStones(mound, gardenRng, 3);
  stones.forEach((stone, i) => {
    const pair = twin(stone.geometry, stoneMaterial, solidDepthMaterial);
    for (const mesh of [pair.visible, pair.caster]) {
      mesh.position.copy(stone.position);
      mesh.scale.copy(stone.scale);
      mesh.rotation.y = stone.rotationY;
    }
    (groundUniforms.uStones.value as Vector4[])[i].copy(stone.footprint);
  });
  groundUniforms.uStoneCount.value = stones.length;
  groundUniforms.uRakeRadius.value = 1.02 * mound.radius;
  shared.uMoundRadius.value = mound.radius;
  shared.uMoundHeight.value = mound.height;

  const falling = new FallingLeaves(FALL_CAPACITY, mound, createRng(777));
  const fallMesh = new Mesh(falling.geometry, fallMaterial);
  fallMesh.frustumCulled = false;
  fallMesh.renderOrder = 5;
  scene.add(fallMesh);

  renderer.setClearColor(
    new Color(LOOK.ground.x, LOOK.ground.y, LOOK.ground.z),
    1,
  );

  let time = 0;
  let growth = 0;
  let growing = true;
  let ambientDebt = 0;
  let primed = false;
  const AMBIENT_WARMUP = 12;
  const ambientRng = createRng(4242);

  let spin = 0;
  let spinVelocity = 0;
  let tiltOffset = 0;

  const isGone = (i: number) =>
    time - gone[i] >= 0 && time - gone[i] < REGROW_AFTER;

  const windOffset = (p: Vector3): Vector3 => {
    const h =
      Math.max(p.y - 0.25, 0) /
      Math.max(shared.uTreeHeight.value as number, 0.5);
    const bend = h * h * WIND;
    const t = time * WIND_SPEED;
    const sway = 0.55 + 0.45 * Math.sin(0.9 * t + 0.22 * p.x + 0.17 * p.z);
    const gust =
      0.5 + 0.5 * Math.sin(0.31 * t + 1.7) * Math.sin(0.53 * t + 0.4);
    const along = bend * (0.18 + 0.32 * sway * (0.6 + 0.8 * gust));
    const across = bend * 0.08 * Math.sin(1.7 * t + 0.9 * p.y + p.x);
    return new Vector3(
      WIND_DIR.x * along - WIND_DIR.y * across,
      -bend * 0.05 * (0.5 + 0.5 * Math.sin(1.1 * t + p.z)),
      WIND_DIR.y * along + WIND_DIR.x * across,
    );
  };

  const terminalVelocity = (kind: FallKind) => {
    const r = ambientRng;
    const drift = (kind === "knocked" ? 0.45 : 0.55) + 0.6 * r();
    const speed =
      kind === "knocked"
        ? 0.62 * (0.75 + 0.5 * r())
        : 0.55 * (0.7 + 0.6 * r());
    return new Vector3(
      WIND_DIR.x * drift * (0.4 + WIND),
      -speed,
      WIND_DIR.y * drift * (0.4 + WIND),
    );
  };

  const drop = (start: Vector3, velocity: Vector3, size: number, rnd: number) =>
    falling.launch(
      {
        start,
        velocity,
        terminal: terminalVelocity("knocked"),
        size,
        rnd,
        kind: "knocked",
        restTime: REST_TIME,
      },
      time,
    );

  const spawnAmbient = (count: number, backdate = 0) => {
    for (let n = 0; n < count; n++) {
      const at = time - backdate * ambientRng();
      const lifetime = 6 + 6 * ambientRng();
      const index = Math.floor(ambientRng() * tree.leaves.length);
      if (isGone(index)) continue;
      const leaf = tree.leaves[index];
      falling.launch(
        {
          start: leaf.position.clone().add(windOffset(leaf.position)),
          velocity: new Vector3(),
          terminal: terminalVelocity("petal"),
          size: 0.85 + 0.5 * ambientRng(),
          rnd: ambientRng(),
          kind: "petal",
          lifetime,
        },
        at,
      );
    }
  };

  const knock = (
    center: Vector3,
    radius: number,
    count: number,
    push: Vector3,
  ) => {
    if (count <= 0) return 0;
    const r2 = radius * radius;
    const candidates: number[] = [];
    tree.leaves.forEach((leaf, i) => {
      if (!isGone(i) && leaf.position.distanceToSquared(center) < r2)
        candidates.push(i);
    });
    let dropped = 0;
    while (dropped < count && candidates.length) {
      const pick = Math.floor(ambientRng() * candidates.length);
      const index = candidates[pick];
      candidates[pick] = candidates[candidates.length - 1];
      candidates.pop();
      const leaf = tree.leaves[index];
      const velocity = push
        .clone()
        .multiplyScalar(0.5 + 0.8 * ambientRng())
        .add(
          new Vector3(
            (ambientRng() - 0.5) * 0.9,
            0.7 * ambientRng(),
            (ambientRng() - 0.5) * 0.9,
          ),
        );
      drop(
        leaf.position.clone().add(windOffset(leaf.position)),
        velocity,
        leaf.size,
        leaf.rnd,
      );
      gone[index] = time;
      dropped++;
    }
    if (dropped && goneAttribute) goneAttribute.needsUpdate = true;
    return dropped;
  };

  const sweep = (
    center: Vector3,
    radius: number,
    push: Vector3,
    limit: number,
  ) =>
    falling.sweep(center, radius, push, limit, time, drop);

  const raycaster = new Raycaster();
  const pointer = new Vector2();

  const aim = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
  };

  const hitLeaf = (): Vector3 | null => {
    const { origin, direction } = raycaster.ray;
    const reach = 0.24;
    const reach2 = reach * reach;
    let nearest = Infinity;
    let hit: Vector3 | null = null;
    tree.leaves.forEach((leaf, i) => {
      if (isGone(i)) return;
      const dx = leaf.position.x - origin.x;
      const dy = leaf.position.y - origin.y;
      const dz = leaf.position.z - origin.z;
      const along = dx * direction.x + dy * direction.y + dz * direction.z;
      if (along <= 0 || along >= nearest) return;
      if (dx * dx + dy * dy + dz * dz - along * along < reach2) {
        nearest = along;
        hit = leaf.position;
      }
    });
    return hit ? (hit as Vector3).clone() : null;
  };

  const hitGround = (): Vector3 | null => {
    const { origin, direction } = raycaster.ray;
    if (direction.y > -0.01) return null;
    let y = 0;
    let point: Vector3 | null = null;
    for (let i = 0; i < 3; i++) {
      point = origin
        .clone()
        .addScaledVector(direction, (y - origin.y) / direction.y);
      y = moundHeight(mound, point.x, point.z);
    }
    return point;
  };

  const screenDirection = (dx: number, dy: number, fallback: Vector3) => {
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const dir = right.multiplyScalar(dx).addScaledVector(up, -dy);
    if (dir.lengthSq() < 1e-6) dir.copy(fallback);
    return dir.normalize().addScaledVector(fallback, 0.35).normalize();
  };

  let lastKnock = -1;
  const lastKnockAt = new Vector3(0, -99, 0);
  let lastSweep = -1;

  const brush = (
    clientX: number,
    clientY: number,
    dx: number,
    dy: number,
    seconds: number,
  ) => {
    if (growing) return;
    aim(clientX, clientY);
    const hit = hitLeaf();
    const speed = Math.hypot(dx, dy) / Math.max(seconds, 1 / 240);
    canvas.style.cursor = hit ? "pointer" : "";
    if (!hit) {
      const spot = hitGround();
      if (spot && speed > 40 && time - lastSweep > 0.03) {
        const push = screenDirection(
          dx,
          dy,
          raycaster.ray.direction.clone().setY(0).normalize(),
        );
        push.y = 0;
        push.normalize().multiplyScalar(Math.min(2.6, speed / 600));
        if (sweep(spot, 0.42, push, 14)) lastSweep = time;
      }
      return;
    }
    if (time - lastKnock < 0.05 && hit.distanceTo(lastKnockAt) < 0.35) return;
    lastKnock = time;
    lastKnockAt.copy(hit);
    const push = screenDirection(dx, dy, raycaster.ray.direction);
    const count = 6 * MathUtils.clamp(speed / 500, 0.7, 3);
    knock(
      hit,
      0.75,
      Math.floor(count + ambientRng()),
      push.multiplyScalar(Math.min(3, 0.4 + speed / 700)),
    );
  };

  const gust = (clientX: number, clientY: number) => {
    if (growing) return;
    aim(clientX, clientY);
    const hit = hitLeaf();
    const windward = new Vector3(WIND_DIR.x, 0.25, WIND_DIR.y).normalize();
    if (!hit) {
      const spot = hitGround();
      if (spot)
        sweep(
          spot,
          1.1,
          windward.clone().setY(0).normalize().multiplyScalar(1.6),
          120,
        );
    }
    const center = hit ?? tree.crown.clone();
    const facing = hit
      ? raycaster.ray.direction.clone()
      : tree.crown.clone().sub(camera.position).normalize();
    knock(
      center,
      1.7,
      90,
      windward.multiplyScalar(0.6).add(facing).normalize().multiplyScalar(2.4),
    );
  };

  let press: {
    x: number;
    y: number;
    moved: boolean;
    onLeaves: boolean;
  } | null = null;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastMoveAt = 0;

  const onPointerDown = (event: PointerEvent) => {
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveAt = performance.now();
    let onLeaves = false;
    if (event.pointerType !== "mouse" && !growing) {
      aim(event.clientX, event.clientY);
      onLeaves = hitLeaf() !== null;
    }
    press = { x: event.clientX, y: event.clientY, moved: false, onLeaves };
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    const now = performance.now();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const seconds = (now - lastMoveAt) / 1000;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveAt = now;
    if (
      press &&
      !press.moved &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6
    ) {
      press.moved = true;
      dragging = !press.onLeaves;
    }
    if (dragging) {
      spin -= 0.3 * dx;
      spinVelocity = -0.3 * dx;
      tiltOffset = MathUtils.clamp(tiltOffset + 0.15 * dy, 1 - TILT, 40 - TILT);
      return;
    }
    brush(event.clientX, event.clientY, dx, dy, seconds);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (press && !press.moved && event.type === "pointerup")
      gust(event.clientX, event.clientY);
    press = null;
    dragging = false;
  };

  const onPointerLeave = () => {
    canvas.style.cursor = "";
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    const ratio = renderer.getPixelRatio();
    frameTarget.setSize(Math.round(width * ratio), Math.round(height * ratio));
    camera.aspect = width / height;
    const shift = width >= 900 ? 0.18 * width : 0;
    camera.setViewOffset(width, height, -shift, 0, width, height);
  };
  resize();
  new ResizeObserver(resize).observe(host);

  const update = (dt: number) => {
    time += dt;
    shared.uTime.value = time;
    if (!dragging) {
      spin += spinVelocity;
      spinVelocity *= 0.9;
      if (Math.abs(spinVelocity) < 0.001) spinVelocity = 0;
    }
    if (growing) {
      growth = Math.min(1, growth + dt / GROW_TIME);
      if (growth >= 1) growing = false;
      shared.uGrow.value = 1 - Math.pow(1 - growth, 1.8);
    }
    if (!primed && growth >= 0.7) {
      spawnAmbient(AMBIENT_PER_SECOND * AMBIENT_WARMUP, AMBIENT_WARMUP);
      primed = true;
    }
    fallUniforms.uFade.value = MathUtils.clamp((growth - 0.7) / 0.3, 0, 1);
    if (primed) {
      ambientDebt += dt * AMBIENT_PER_SECOND;
      const count = Math.floor(ambientDebt);
      ambientDebt -= count;
      spawnAmbient(count);
    }
    falling.flush();
  };

  const draw = () => {
    const turn = MathUtils.degToRad(spin);
    const tilt = MathUtils.degToRad(TILT + tiltOffset);
    const height = Math.max(3.5, tree.bounds.max.y);
    const width = Math.max(
      tree.bounds.max.x - tree.bounds.min.x,
      tree.bounds.max.z - tree.bounds.min.z,
    );
    const halfFov = MathUtils.degToRad(camera.fov) / 2;
    const distance = Math.max(
      (1.75 * height + 1.4) / 2 / Math.tan(halfFov),
      (1.65 * width + 2.4) / 2 / Math.tan(halfFov) / camera.aspect,
      11,
    );
    const target = new Vector3(0, 0.46 * height, 0);
    camera.position.set(
      Math.sin(turn) * Math.cos(tilt) * distance,
      target.y + Math.sin(tilt) * distance,
      Math.cos(turn) * Math.cos(tilt) * distance,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();

    const sunTurn = MathUtils.degToRad(SUN_TURN);
    const sunHeight = MathUtils.degToRad(SUN_HEIGHT);
    const sunDir = (shared.uSunDir.value as Vector3)
      .set(
        Math.sin(sunTurn) * Math.cos(sunHeight),
        Math.sin(sunHeight),
        Math.cos(sunTurn) * Math.cos(sunHeight),
      )
      .normalize();
    const focus = new Vector3(0, 2.5, 0);
    sunCamera.position.copy(focus).addScaledVector(sunDir, 25);
    sunCamera.lookAt(focus);
    sunCamera.updateMatrixWorld();
    (shared.uShadowMatrix.value as Matrix4).multiplyMatrices(
      sunCamera.projectionMatrix,
      sunCamera.matrixWorldInverse,
    );

    renderer.setRenderTarget(shadowTarget);
    renderer.clear();
    renderer.render(casters, sunCamera);

    renderer.setRenderTarget(frameTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(screenScene, screenCamera);
  };

  let onScreen = true;
  let last = performance.now();
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!onScreen || document.hidden) return;
    update(dt);
    draw();
  };
  requestAnimationFrame(loop);

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
  }).observe(host);
}
