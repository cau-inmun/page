/* ==========================================================================
   히어로 3D 씬 — 원본

   이 파일은 브라우저가 직접 읽지 않습니다. three.js 에서 실제로 쓰는
   부분만 추려 js/hero3d.js 로 묶어 두고, 사이트는 그것을 불러옵니다.
   three.js 전체는 원본 2MB(gzip 407KB)라 그대로 싣기에는 큽니다.

   다시 묶는 방법은 README 의 '히어로 3D' 절에 적어 두었습니다.

   지키는 것 (요구사항 3절의 금지 목록)
     · 노이즈 · 그레인 · 먼지 텍스처 없음
     · 안개(fog) · 볼류메트릭 없음
     · MeshDistortMaterial 등 왜곡 재질 없음
     · 포스트프로세싱 없음 (bloom · vignette · 수차 전부)
     · 표면은 매끈하게, 경계는 또렷하게, 배경은 균일한 크림색
   ========================================================================== */
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Clock,
  Mesh, MeshPhysicalMaterial, Color,
  SphereGeometry, TorusGeometry, CapsuleGeometry, CylinderGeometry, IcosahedronGeometry,
  PMREMGenerator, MathUtils, ACESFilmicToneMapping, SRGBColorSpace
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* 사이트 팔레트 안에서만 고른다. 크림 · 모래빛이 기조이고,
   포인트 두 개만 아주 연한 푸른색이다 (요구사항 3절).
   순백은 쓰지 않는다 — 크림 배경 위에서 형태가 날아가 납작한 덩어리로 보인다. */
const WARM  = 0xEADCC4;
const SAND  = 0xDFC9A6;
const BLUE  = 0xAFC7E2;
const STEEL = 0x93AAC6;

/* 자리는 좌표가 아니라 '보이는 화면의 몇 할' 로 잡는다.
   좌표로 못박으면 화면 비율이 달라질 때 가운데로 몰려 로고와 글자를
   침범한다. 실제로 그렇게 만들어 놓고 한 번 갈아엎었다.
   x 는 가장자리 쪽으로, z 는 뒤로 — 앞에 나서지 않게 한다. */
const PIECES = [
  { geo: 'sphere',  r: 0.40, fx: -0.80, fy:  0.42, z: -2.2, spin: 0.030, bob: 0.14, color: WARM },
  { geo: 'ico',     r: 0.30, fx: -0.93, fy: -0.34, z: -3.0, spin: 0.045, bob: 0.18, color: SAND },
  { geo: 'disc',    r: 0.46, fx: -0.66, fy: -0.72, z: -3.6, spin: 0.024, bob: 0.11, color: WARM },
  { geo: 'torus',   r: 0.32, fx:  0.82, fy:  0.50, z: -2.4, spin: 0.038, bob: 0.16, color: BLUE },
  { geo: 'capsule', r: 0.26, fx:  0.94, fy: -0.28, z: -3.1, spin: 0.028, bob: 0.13, color: WARM },
  { geo: 'sphere',  r: 0.22, fx:  0.70, fy: -0.76, z: -3.8, spin: 0.033, bob: 0.20, color: STEEL }
];

function geometryFor(p) {
  switch (p.geo) {
    /* 면 수를 넉넉히 주되 과하지 않게. 전부 합쳐 3만 삼각형 아래로 잡는다. */
    case 'sphere':  return new SphereGeometry(p.r, 32, 20);
    case 'ico':     return new IcosahedronGeometry(p.r, 2);
    case 'torus':   return new TorusGeometry(p.r, p.r * 0.36, 18, 44);
    case 'capsule': return new CapsuleGeometry(p.r * 0.62, p.r * 1.2, 6, 20);
    case 'disc':    return new CylinderGeometry(p.r, p.r, p.r * 0.18, 40);
    default:        return new SphereGeometry(p.r, 24, 16);
  }
}

/* 전부 무광이다. 유리(transmission)를 써 봤는데, 배경이 비어 있으면
   굴절될 것이 없어 흰 덩어리로만 보였다. 있지도 않은 것을 비추게 하느니
   빛을 머금는 표면으로 두는 편이 깨끗하다. */
function materialFor(p) {
  return new MeshPhysicalMaterial({
    color: new Color(p.color),
    roughness: 0.32, metalness: 0.06,
    clearcoat: 0.22, clearcoatRoughness: 0.14
  });
}

export function createHeroScene(canvas, opts) {
  const o = opts || {};
  const renderer = new WebGLRenderer({
    canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = ACESFilmicToneMapping;
  /* 1.05 로 두었더니 크림빛 표면이 하얗게 날아가 형태가 사라졌다. */
  renderer.toneMappingExposure = 0.86;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();          /* 배경은 칠하지 않는다 — 페이지의 크림이 그대로 비친다 */
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  /* 조명은 스튜디오 환경맵 하나로 해결한다. HDRI 파일을 따로 받지 않으므로
     용량이 늘지 않고, 점광원을 여럿 두는 것보다 표면이 고르게 뜬다. */
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const group = new Group();
  scene.add(group);

  let triangles = 0;
  const items = PIECES.map((p) => {
    const geo = geometryFor(p);
    const mesh = new Mesh(geo, materialFor(p));
    mesh.position.set(0, 0, p.z);   /* 실제 자리는 resize 에서 정한다 */
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    group.add(mesh);
    triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    return { mesh, p, phase: Math.random() * Math.PI * 2, y0: 0 };
  });

  /* 마우스에 따라 아주 미세하게 시차를 준다. 카메라를 움직이지 않고
     덩어리만 기울인다 — 원근이 흔들리면 멀미가 난다. */
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const onMove = (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  const clock = new Clock();
  let raf = 0, running = false;

  /* 보이는 화면의 몇 할에 놓을지로 자리를 정한다.
     화면 비율이 바뀌면 다시 계산한다 — 그래야 어떤 폭에서도 가장자리에
     머물고 가운데(로고와 글자)를 비워 준다. */
  function place() {
    items.forEach((it) => {
      const dist = camera.position.z - it.p.z;
      const halfH = Math.tan(MathUtils.degToRad(camera.fov) / 2) * dist;
      const halfW = halfH * camera.aspect;
      it.mesh.position.x = it.p.fx * halfW;
      it.y0 = it.p.fy * halfH;
    });
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width === Math.round(w * renderer.getPixelRatio()) &&
        canvas.height === Math.round(h * renderer.getPixelRatio())) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    place();
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    resize();
    const t = clock.getElapsedTime();

    pointer.x += (target.x - pointer.x) * 0.04;
    pointer.y += (target.y - pointer.y) * 0.04;
    group.rotation.y = pointer.x * 0.07;
    group.rotation.x = pointer.y * 0.05;

    items.forEach((it) => {
      it.mesh.position.y = it.y0 + Math.sin(t * 0.34 + it.phase) * it.p.bob;
      it.mesh.rotation.y += it.p.spin * 0.01;
      it.mesh.rotation.x += it.p.spin * 0.006;
    });
    renderer.render(scene, camera);
  }

  return {
    triangles: Math.round(triangles),
    start() { if (running) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); },
    stop()  { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    dispose() {
      this.stop();
      window.removeEventListener('pointermove', onMove);
      items.forEach((it) => { it.mesh.geometry.dispose(); it.mesh.material.dispose(); });
      pmrem.dispose();
      renderer.dispose();
    }
  };
}
