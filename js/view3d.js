/* ============================================================
   view3d.js — Three.js + MediaPipe Hand Gesture 3D Viewer
   ES Module — GSAP accessed via window.gsap
============================================================ */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';

const gsap = window.gsap;

// ── DOM refs ──────────────────────────────────────────────────
const canvas      = document.getElementById('three-canvas');
const webcamEl    = document.getElementById('webcam');
const statusDot   = document.getElementById('status-dot');
const statusText  = document.getElementById('status-text');
const gestureHint = document.getElementById('gesture-hint');
const camBlocked  = document.getElementById('cam-blocked');
const stateLabel  = document.getElementById('state-label');
const pinchRing   = document.getElementById('pinch-ring');
const overlay     = document.getElementById('page-transition');

// ── Page entry: reverse the wipe-in overlay ──────────────────
gsap.to(overlay, {
  clipPath: 'circle(0% at 50% 50%)',
  duration: 0.9,
  ease: 'power2.inOut',
  delay: 0.1
});

// ── Back link transition ──────────────────────────────────────
document.getElementById('back-link').addEventListener('click', (e) => {
  e.preventDefault();
  const href = e.currentTarget.getAttribute('href');
  gsap.to(overlay, {
    clipPath: 'circle(150% at 50% 50%)',
    duration: 0.9,
    ease: 'power2.inOut',
    onComplete: () => { window.location.href = href; }
  });
});

// ============================================================
//  THREE.JS SCENE SETUP
// ============================================================
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x050505, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 7);

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Lighting ──────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x111111, 1.0);
scene.add(ambientLight);

const keyLight = new THREE.PointLight(0xffffff, 80, 30);
keyLight.position.set(3, 4, 6);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0xE8B400, 40, 20);
rimLight.position.set(-4, -1, -4);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x6688bb, 20, 25);
fillLight.position.set(0, -5, 4);
scene.add(fillLight);

// ── Canvas dot/grid texture for navy temple arms ─────────────
function createDotTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const cx = c.getContext('2d');
  cx.fillStyle = '#1a2340';
  cx.fillRect(0, 0, size, size);
  cx.fillStyle = '#232f55';
  const sp = 9;
  for (let x = sp / 2; x < size; x += sp) {
    for (let y = sp / 2; y < size; y += sp) {
      cx.beginPath();
      cx.arc(x, y, 1.5, 0, Math.PI * 2);
      cx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 1);
  return tex;
}

// ── Extra fill light so model is clearly visible ──────────────
const modelFill = new THREE.DirectionalLight(0xffffff, 0.9);
modelFill.position.set(0, 2, 8);
scene.add(modelFill);

// ── Materials ─────────────────────────────────────────────────
// Matte frosted olive-grey acetate — TH1949 frame colour
const frameMat = new THREE.MeshPhysicalMaterial({
  color: 0x6a7a6e,        // muted olive-grey, not blue
  roughness: 0.52,
  metalness: 0.0,
  clearcoat: 0.35,
  clearcoatRoughness: 0.3,
  thickness: 0.3,
  transmission: 0.05,     // barely translucent edge — solid acetate feel
  ior: 1.49,
});

// Dark navy temple — fine dot grid texture
const darkFrameMat = new THREE.MeshStandardMaterial({
  color: 0x1a2340,
  roughness: 0.75,
  metalness: 0.05,
  map: createDotTexture(),
});

// Clear optical-glass lens — prescription glasses, NOT sunglasses
const lensMat = new THREE.MeshPhysicalMaterial({
  color: 0xd0e0e8,        // barely-tinted near-white
  transparent: true,
  opacity: 0.08,           // nearly invisible
  roughness: 0.0,
  metalness: 0.0,
  transmission: 0.92,
  ior: 1.5,
  reflectivity: 0.5,
  side: THREE.DoubleSide,
  depthWrite: false
});

// Gold — hinges, nose pads, temple tips
const hingeMat = new THREE.MeshStandardMaterial({
  color: 0xE8B400,
  metalness: 0.82,
  roughness: 0.12,
  emissive: 0x3a2800,
  emissiveIntensity: 0.3
});

// ── Shape builders ────────────────────────────────────────────
function createRoundedRectShape(w, h, r) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return shape;
}

function createLensRimGeo(w, h, r, thickness, depth) {
  const outer = createRoundedRectShape(w, h, r);
  const inner = createRoundedRectShape(w - thickness * 2, h - thickness * 2, Math.max(0.01, r - thickness));
  outer.holes.push(inner);
  return new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.010,   // sharper edges = more realistic
    bevelSize: 0.010,
    bevelSegments: 4
  });
}

function createLensFillGeo(w, h, r) {
  const shape = createRoundedRectShape(w - 0.14, h - 0.14, Math.max(0.01, r - 0.07));
  return new THREE.ShapeGeometry(shape, 32);
}

// ── Build Glasses Pieces ──────────────────────────────────────
const glassesGroup = new THREE.Group();
scene.add(glassesGroup);

// TH1949 proportions: rectangular (W:H ≈ 1.47:1), smaller corner radius
// Reduced overall scale so both lenses fit well in the camera FOV
const LW = 1.30, LH = 0.88, LR = 0.13, LT = 0.075, LD = 0.10;
const GAP = 0.26; // nose bridge half-gap

// Left lens rim
const leftRimGeo  = createLensRimGeo(LW, LH, LR, LT, LD);
const leftRim     = new THREE.Mesh(leftRimGeo, frameMat);
leftRim.position.set(-(LW / 2 + GAP), 0, -LD / 2);

// Right lens rim
const rightRimGeo = createLensRimGeo(LW, LH, LR, LT, LD);
const rightRim    = new THREE.Mesh(rightRimGeo, frameMat);
rightRim.position.set(LW / 2 + GAP, 0, -LD / 2);

// Left lens fill — clear optical glass
const leftLensFill  = new THREE.Mesh(createLensFillGeo(LW, LH, LR), lensMat);
leftLensFill.position.set(-(LW / 2 + GAP), 0, 0);

// Right lens fill
const rightLensFill = new THREE.Mesh(createLensFillGeo(LW, LH, LR), lensMat);
rightLensFill.position.set(LW / 2 + GAP, 0, 0);

// Bridge — gentle downward-dipping arc (sits on nose, below lens centres)
const bridgeCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-(GAP - 0.03), 0.04, 0),
  new THREE.Vector3(0, -0.06, 0.015),
  new THREE.Vector3(GAP - 0.03, 0.04, 0)
]);
const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 24, 0.028, 8, false);
const bridge    = new THREE.Mesh(bridgeGeo, frameMat);

// Left hinge — gold accent block at outer rim junction
const leftHingeGeo  = new THREE.BoxGeometry(0.11, 0.22, 0.13);
const leftHinge     = new THREE.Mesh(leftHingeGeo, hingeMat);
leftHinge.position.set(-(LW + GAP), 0, 0);

// Right hinge
const rightHingeGeo = new THREE.BoxGeometry(0.11, 0.22, 0.13);
const rightHinge    = new THREE.Mesh(rightHingeGeo, hingeMat);
rightHinge.position.set(LW + GAP, 0, 0);

// Left temple — navy arm angled slightly back from hinge
const leftTempleGeo  = new THREE.BoxGeometry(2.2, 0.058, 0.062);
const leftTemple     = new THREE.Mesh(leftTempleGeo, darkFrameMat);
leftTemple.position.set(-(LW + GAP + 1.1 + 0.045), 0, -0.28);
leftTemple.rotation.y = 0.15;

// Right temple
const rightTempleGeo = new THREE.BoxGeometry(2.2, 0.058, 0.062);
const rightTemple    = new THREE.Mesh(rightTempleGeo, darkFrameMat);
rightTemple.position.set(LW + GAP + 1.1 + 0.045, 0, -0.28);
rightTemple.rotation.y = -0.15;

// ── Yellow rubber tip caps at far end of each temple ──────────
const tipMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.06, roughness: 0.65 });
const tipGeo = new THREE.BoxGeometry(0.13, 0.075, 0.075);
const leftTip  = new THREE.Mesh(tipGeo, tipMat);
leftTip.position.set(-(LW + GAP + 2.195 + 0.045), 0, -0.28);
leftTip.rotation.y = 0.15;
const rightTip = new THREE.Mesh(tipGeo, tipMat);
rightTip.position.set(LW + GAP + 2.195 + 0.045, 0, -0.28);
rightTip.rotation.y = -0.15;

// ── Yellow nose pads at inner-lower corners of each lens ──────
const padMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.05, roughness: 0.68 });
const padGeo = new THREE.SphereGeometry(0.045, 8, 8);
const leftPad  = new THREE.Mesh(padGeo, padMat);
leftPad.position.set(-(GAP - 0.05), -LH * 0.34, 0.04);
const rightPad = new THREE.Mesh(padGeo, padMat);
rightPad.position.set(GAP - 0.05, -LH * 0.34, 0.04);

// ── TH flag logo — small coloured block on each temple ────────
const flagMat = new THREE.MeshStandardMaterial({ color: 0xcc1111, roughness: 0.45 });
const flagGeo = new THREE.BoxGeometry(0.10, 0.055, 0.014);
const leftFlag  = new THREE.Mesh(flagGeo, flagMat);
leftFlag.position.set(-(LW + GAP + 0.24), 0, -0.21);
leftFlag.rotation.y = 0.15;
const rightFlag = new THREE.Mesh(flagGeo, flagMat);
rightFlag.position.set(LW + GAP + 0.24, 0, -0.21);
rightFlag.rotation.y = -0.15;

// ── Subtle lens-surface highlight ────────────────────────────
const shineMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, transparent: true, opacity: 0.06,
  metalness: 1, roughness: 0, side: THREE.DoubleSide
});
const leftShine  = new THREE.Mesh(new THREE.PlaneGeometry(LW * 0.48, LH * 0.10), shineMat);
const rightShine = new THREE.Mesh(new THREE.PlaneGeometry(LW * 0.48, LH * 0.10), shineMat);
leftShine.position.set(-(LW / 2 + GAP), LH * 0.20, 0.01);
rightShine.position.set(LW / 2 + GAP, LH * 0.20, 0.01);

// ── Warm gold accent light — catches frame edges ──────────────
const goldAccentLight = new THREE.PointLight(0xc9a84c, 14, 20);
goldAccentLight.position.set(2, 2.5, 4);
scene.add(goldAccentLight);

// Add all to group
[leftRim, rightRim, leftLensFill, rightLensFill, bridge,
 leftHinge, rightHinge, leftTemple, rightTemple,
 leftTip, rightTip, leftPad, rightPad, leftFlag, rightFlag,
 leftShine, rightShine].forEach(m => glassesGroup.add(m));

// ── Piece registry (assembled → dismantled positions/rotations) ─
const pieces = [
  {
    mesh: leftRim,
    assembled:   { px: -(LW/2+GAP), py: 0, pz: -LD/2, rx: 0, ry: 0, rz: 0 },
    dismantled:  { px: -5.5, py: 1.5, pz: 2.5, rx: 0.4, ry: -0.8, rz: 0.3 }
  },
  {
    mesh: rightRim,
    assembled:   { px: LW/2+GAP,  py: 0, pz: -LD/2, rx: 0, ry: 0, rz: 0 },
    dismantled:  { px: 5.5,  py: 1.5, pz: 2.5, rx: 0.4, ry: 0.8, rz: -0.3 }
  },
  {
    mesh: leftLensFill,
    assembled:   { px: -(LW/2+GAP), py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
    dismantled:  { px: -4.0, py: 3.0, pz: 1.5, rx: 0.5, ry: -0.5, rz: 0.2 }
  },
  {
    mesh: rightLensFill,
    assembled:   { px: LW/2+GAP,  py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
    dismantled:  { px: 4.0,  py: 3.0, pz: 1.5, rx: 0.5, ry: 0.5, rz: -0.2 }
  },
  {
    mesh: bridge,
    assembled:   { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
    dismantled:  { px: 0, py: 4.5, pz: 1.0, rx: 1.2, ry: 0, rz: 0 }
  },
  {
    mesh: leftHinge,
    assembled:   { px: -(LW+GAP), py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
    dismantled:  { px: -3.0, py: -3.0, pz: 2.5, rx: 0.8, ry: -1.0, rz: 0.6 }
  },
  {
    mesh: rightHinge,
    assembled:   { px: LW+GAP,  py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
    dismantled:  { px: 3.0,  py: -3.0, pz: 2.5, rx: 0.8, ry: 1.0, rz: -0.6 }
  },
  {
    mesh: leftTemple,
    assembled:   { px: -(LW+GAP+1.1+0.045), py: 0, pz: -0.28, rx: 0, ry: 0.15, rz: 0 },
    dismantled:  { px: -7.0, py: -1.5, pz: -3.0, rx: 0.2, ry: 0.8, rz: 0.1 }
  },
  {
    mesh: rightTemple,
    assembled:   { px: LW+GAP+1.1+0.045, py: 0, pz: -0.28, rx: 0, ry: -0.15, rz: 0 },
    dismantled:  { px: 7.0,  py: -1.5, pz: -3.0, rx: 0.2, ry: -0.8, rz: -0.1 }
  }
];

// ── Entry animation ───────────────────────────────────────────
glassesGroup.scale.set(0, 0, 0);
glassesGroup.rotation.y = Math.PI * 0.5;

gsap.to(glassesGroup.scale, {
  x: 1, y: 1, z: 1,
  duration: 1.6,
  ease: 'elastic.out(1, 0.6)',
  delay: 0.5
});
gsap.to(glassesGroup.rotation, {
  y: 0,
  duration: 1.4,
  ease: 'power3.out',
  delay: 0.5
});

// ── Rotation state ────────────────────────────────────────────
let targetRotX = 0, targetRotY = 0;
let currentRotX = 0, currentRotY = 0;
let isDismantled = false;
let lastHandTime = 0;
let idleFrames = 0;
const IDLE_THRESHOLD = 180; // ~3s at 60fps before auto-rotate

// ── Dismantle / Reassemble ────────────────────────────────────
function triggerDismantle() {
  if (isDismantled) return;
  isDismantled = true;
  stateLabel.textContent = 'Dismantled';
  stateLabel.classList.add('dismantled');

  pieces.forEach(({ mesh, dismantled }, i) => {
    gsap.to(mesh.position, {
      x: dismantled.px, y: dismantled.py, z: dismantled.pz,
      duration: 1.3,
      ease: 'power3.out',
      delay: i * 0.06
    });
    gsap.to(mesh.rotation, {
      x: dismantled.rx, y: dismantled.ry, z: dismantled.rz,
      duration: 1.1,
      ease: 'power2.out',
      delay: i * 0.06
    });
  });
}

function triggerReassemble() {
  if (!isDismantled) return;
  isDismantled = false;
  stateLabel.textContent = 'Assembled';
  stateLabel.classList.remove('dismantled');

  pieces.forEach(({ mesh, assembled }, i) => {
    gsap.to(mesh.position, {
      x: assembled.px, y: assembled.py, z: assembled.pz,
      duration: 1.1,
      ease: 'elastic.out(1, 0.65)',
      delay: i * 0.05
    });
    gsap.to(mesh.rotation, {
      x: assembled.rx, y: assembled.ry, z: assembled.rz,
      duration: 0.9,
      ease: 'power3.out',
      delay: i * 0.05
    });
  });
}

// ── MediaPipe Hands ───────────────────────────────────────────
let handTrackingActive = false;

function initMediaPipe() {
  if (typeof Hands === 'undefined') {
    console.warn('MediaPipe Hands not loaded, falling back to mouse');
    initMouseFallback();
    return;
  }

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.75,
    minTrackingConfidence: 0.65
  });

  hands.onResults((results) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      idleFrames++;
      return;
    }

    idleFrames = 0;
    lastHandTime = Date.now();
    const lm = results.multiHandLandmarks[0];

    // Wrist position (lm[0]) drives rotation
    // Flip X because webcam is mirrored
    targetRotY = (0.5 - lm[0].x) * Math.PI * 1.3;
    targetRotX = (lm[0].y - 0.5) * Math.PI * 0.7;

    // Update light positions to follow hand
    keyLight.position.x  =  targetRotY * 5;
    keyLight.position.y  = -targetRotX * 5;
    rimLight.position.x  = -targetRotY * 4;
    rimLight.position.y  =  targetRotX * 4;

    // Pinch detection: thumb tip (4) to index tip (8)
    const dx = lm[4].x - lm[8].x;
    const dy = lm[4].y - lm[8].y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Move pinch ring to index finger tip
    const ix = (1 - lm[8].x) * window.innerWidth;
    const iy = lm[8].y * window.innerHeight;
    pinchRing.style.left = `${ix}px`;
    pinchRing.style.top  = `${iy}px`;

    if (dist < 0.045) {
      pinchRing.classList.add('visible');
      triggerDismantle();
    } else if (dist > 0.10) {
      pinchRing.classList.remove('visible');
      triggerReassemble();
    }
  });

  // Request camera
  navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
    .then((stream) => {
      webcamEl.srcObject = stream;
      webcamEl.onloadedmetadata = () => {
        webcamEl.play();

        if (typeof Camera !== 'undefined') {
          const mpCamera = new Camera(webcamEl, {
            onFrame: async () => { await hands.send({ image: webcamEl }); },
            width: 640,
            height: 480
          });
          mpCamera.start();
        } else {
          // Manual frame loop fallback
          const sendFrame = async () => {
            if (webcamEl.readyState >= 2) {
              await hands.send({ image: webcamEl });
            }
            requestAnimationFrame(sendFrame);
          };
          sendFrame();
        }

        handTrackingActive = true;
        statusDot.classList.add('active');
        statusText.textContent = 'Hand tracking active';

        // Fade out hint after 5s
        setTimeout(() => {
          gsap.to(gestureHint, { opacity: 0, duration: 1.2, ease: 'power2.inOut' });
        }, 5000);
      };
    })
    .catch((err) => {
      console.warn('Camera access denied:', err);
      statusDot.classList.add('fallback');
      statusText.textContent = 'Mouse fallback';
      gestureHint.style.display = 'none';
      camBlocked.style.display  = 'block';
      initMouseFallback();
    });
}

// ── Mouse Fallback ────────────────────────────────────────────
function initMouseFallback() {
  statusDot.classList.add('fallback');
  statusText.textContent = 'Mouse / touch mode';

  window.addEventListener('mousemove', (e) => {
    targetRotY = ((e.clientX / window.innerWidth) - 0.5) * Math.PI * 1.2;
    targetRotX = ((e.clientY / window.innerHeight) - 0.5) * Math.PI * 0.6;
    keyLight.position.x  =  targetRotY * 5;
    keyLight.position.y  = -targetRotX * 5;
    rimLight.position.x  = -targetRotY * 4;
    idleFrames = 0;
  });

  // Click-and-hold → dismantle / release → reassemble
  window.addEventListener('mousedown', () => triggerDismantle());
  window.addEventListener('mouseup',   () => triggerReassemble());

  // Touch drag support
  let lastTouchX = 0, lastTouchY = 0;
  window.addEventListener('touchstart', (e) => {
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  });
  window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const dx = e.touches[0].clientX - lastTouchX;
    const dy = e.touches[0].clientY - lastTouchY;
    targetRotY += dx * 0.01;
    targetRotX += dy * 0.01;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
    idleFrames = 0;
  }, { passive: false });

  // Tap to toggle dismantle
  let lastTap = 0;
  window.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      isDismantled ? triggerReassemble() : triggerDismantle();
    }
    lastTap = now;
  });

  // Fade hint after 4s
  setTimeout(() => {
    gsap.to(gestureHint, { opacity: 0, duration: 1.2 });
  }, 4000);
}

// ── Scroll to zoom ────────────────────────────────────────────
window.addEventListener('wheel', (e) => {
  camera.position.z = Math.max(4, Math.min(11, camera.position.z + e.deltaY * 0.005));
}, { passive: true });

// ── Render loop ───────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  // Smooth lerp
  const lerpSpeed = handTrackingActive ? 0.07 : 0.06;
  currentRotX += (targetRotX - currentRotX) * lerpSpeed;
  currentRotY += (targetRotY - currentRotY) * lerpSpeed;

  // Idle auto-rotation when no hand/mouse
  idleFrames++;
  if (idleFrames > IDLE_THRESHOLD) {
    targetRotY += 0.003;
  }

  glassesGroup.rotation.x = currentRotX;
  glassesGroup.rotation.y = currentRotY;

  renderer.render(scene, camera);
}

// ── Boot ──────────────────────────────────────────────────────
initMediaPipe();
animate();
