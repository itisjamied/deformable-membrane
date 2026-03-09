import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const canvas = document.getElementById("membrane");
const ctx = canvas.getContext("2d");
const video = document.getElementById("webcam");

let width = 0;
let height = 0;
let dpr = Math.min(window.devicePixelRatio || 1, 2);

// Grid settings
const cols = 90;
const rows = 60;

let cellW = 0;
let cellH = 0;

// Height field
let current = [];
let velocity = [];
let next = [];

// Hand-driven pressure point
const pointer = {
  x: 0,
  y: 0,
  active: false,
  radius: 140,
  strength: 30
};

let handLandmarker = null;
let lastVideoTime = -1;

// smoothing so the hand cursor feels less jittery
let smoothedX = 0;
let smoothedY = 0;
const follow = 0.28;

function create2DArray(cols, rows, fill = 0) {
  return Array.from({ length: cols }, () => Array(rows).fill(fill));
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  cellW = width / (cols - 1);
  cellH = height / (rows - 1);

  current = create2DArray(cols, rows, 0);
  velocity = create2DArray(cols, rows, 0);
  next = create2DArray(cols, rows, 0);
}

function applyPointerPressure() {
  if (!pointer.active) return;

  for (let x = 1; x < cols - 1; x++) {
    for (let y = 1; y < rows - 1; y++) {
      const px = x * cellW;
      const py = y * cellH;

      const dx = px - pointer.x;
      const dy = py - pointer.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < pointer.radius) {
        const t = 1 - dist / pointer.radius;
        const falloff = t * t * (3 - 2 * t);
        current[x][y] += falloff * pointer.strength;
      }
    }
  }
}

function updateSimulation() {
  applyPointerPressure();

  const spring = 0.006;
  const damping = 0.9;
  const neighborInfluence = 0.22;

  for (let x = 1; x < cols - 1; x++) {
    for (let y = 1; y < rows - 1; y++) {
      const center = current[x][y];

      const avgNeighbors =
        (current[x - 1][y] +
          current[x + 1][y] +
          current[x][y - 1] +
          current[x][y + 1]) / 4;

      const force =
        (avgNeighbors - center) * neighborInfluence - center * spring;

      velocity[x][y] += force;
      velocity[x][y] *= damping;

      next[x][y] = center + velocity[x][y];
    }
  }

  for (let x = 1; x < cols - 1; x++) {
    for (let y = 1; y < rows - 1; y++) {
      current[x][y] = next[x][y];
    }
  }
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#1a1a22");
  grad.addColorStop(1, "#09090c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

// function drawMembrane() {
//   ctx.strokeStyle = "rgba(255,255,255,0.14)";
//   ctx.lineWidth = 1;

//   for (let y = 0; y < rows; y++) {
//     ctx.beginPath();

//     for (let x = 0; x < cols; x++) {
//       const px = x * cellW;
//       const py = y * cellH - current[x][y] * 1.2;

//       if (x === 0) ctx.moveTo(px, py);
//       else ctx.lineTo(px, py);
//     }

//     ctx.stroke();
//   }

//   ctx.strokeStyle = "rgba(255,255,255,0.04)";
//   for (let x = 0; x < cols; x++) {
//     ctx.beginPath();

//     for (let y = 0; y < rows; y++) {
//       const px = x * cellW - current[x][y] * 0.35;
//       const py = y * cellH;

//       if (y === 0) ctx.moveTo(px, py);
//       else ctx.lineTo(px, py);
//     }

//     ctx.stroke();
//   }
// }
function drawMembrane() {
  const cx = width * 0.5;
  const cy = height * 0.5;

  // horizontal lines
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;

  for (let y = 0; y < rows; y++) {
    ctx.beginPath();

    for (let x = 0; x < cols; x++) {
      const baseX = x * cellW;
      const baseY = y * cellH;
      const h = current[x][y];

      // direction away from center
      const dx = baseX - cx;
      const dy = baseY - cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      // push points outward from the center a bit
      const offsetX = (dx / len) * h * 0.35;
      const offsetY = (dy / len) * h * 0.35;

      // slight upward bias still helps the "bulge" read nicely
      const px = baseX + offsetX;
      const py = baseY + offsetY - h * 0.35;

      if (x === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }

  // vertical lines
  ctx.strokeStyle = "rgba(255,255,255,0.04)";

  for (let x = 0; x < cols; x++) {
    ctx.beginPath();

    for (let y = 0; y < rows; y++) {
      const baseX = x * cellW;
      const baseY = y * cellH;
      const h = current[x][y];

      const dx = baseX - cx;
      const dy = baseY - cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      const offsetX = (dx / len) * h * 0.35;
      const offsetY = (dy / len) * h * 0.35;

      const px = baseX + offsetX;
      const py = baseY + offsetY - h * 0.35;

      if (y === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }
}

async function setupHandTracking() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: 640,
      height: 480
    },
    audio: false
  });

  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
}

function updateHandPointer() {
  if (!handLandmarker || video.readyState < 2) return;

  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  const results = handLandmarker.detectForVideo(video, performance.now());

  if (results.landmarks && results.landmarks.length > 0) {
    const hand = results.landmarks[0];

    // index fingertip
    const tip = hand[8];

    // video coordinates are normalized 0..1
    // mirror horizontally for selfie-style behavior
    const targetX = (1 - tip.x) * width;
    const targetY = tip.y * height;

    if (!pointer.active) {
      smoothedX = targetX;
      smoothedY = targetY;
    }

    smoothedX += (targetX - smoothedX) * follow;
    smoothedY += (targetY - smoothedY) * follow;

    pointer.x = smoothedX;
    pointer.y = smoothedY;
    pointer.active = true;

    // optional: use hand depth to slightly change push size/strength
    const z = tip.z ?? 0;
    const closeness = Math.max(0, Math.min(1, (-z - 0.02) * 8));

    pointer.radius = 120 + closeness * 80;
    pointer.strength = 18 + closeness * 18;
  } else {
    pointer.active = false;
  }
}

function animate() {
  updateHandPointer();
  updateSimulation();
  drawBackground();
  drawMembrane();
  requestAnimationFrame(animate);
}

async function init() {
  resize();
  window.addEventListener("resize", resize);

  try {
    await setupHandTracking();
    animate();
  } catch (error) {
    console.error(error);
    drawBackground();

    ctx.fillStyle = "white";
    ctx.font = "16px sans-serif";
    ctx.fillText(
      "Camera / MediaPipe failed to start. Run on localhost and allow camera access.",
      24,
      40
    );
  }
}

init();