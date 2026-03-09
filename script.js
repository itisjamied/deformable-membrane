const canvas = document.getElementById("membrane");
const ctx = canvas.getContext("2d");

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

// Mouse / pressure point
const pointer = {
  x: 0,
  y: 0,
  active: false,
  radius: 140,
  strength: 30
};

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
        const falloff = t * t * (3 - 2 * t); // smoothstep-like
        current[x][y] += falloff * pointer.strength;
      }
    }
  }
}

function updateSimulation() {
  applyPointerPressure();

    // const spring = 0.06;
    const spring = 0.006;
    const damping = 0.9;
    // const neighborInfluence = 0.22;
    const neighborInfluence = 0.22;

  for (let x = 1; x < cols - 1; x++) {
    for (let y = 1; y < rows - 1; y++) {
      const center = current[x][y];

      const avgNeighbors =
        (current[x - 1][y] +
          current[x + 1][y] +
          current[x][y - 1] +
          current[x][y + 1]) /
        4;

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
//   // Draw filled quads with lighting based on local slope
//   for (let x = 0; x < cols - 1; x++) {
//     for (let y = 0; y < rows - 1; y++) {
//       const h00 = current[x][y];
//       const h10 = current[x + 1][y];
//       const h01 = current[x][y + 1];

//       const px = x * cellW;
//       const py = y * cellH;

//       // Fake normal from slope
//       const dx = h10 - h00;
//       const dy = h01 - h00;

//       // Lighting
//       const highlight = 160 + dx * 8 + dy * 8 + h00 * 3;
//       const alpha = Math.max(0.12, Math.min(0.55, 0.18 + h00 * 0.015));

//       const shade = Math.max(80, Math.min(255, highlight));

//       ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 10}, ${alpha})`;
//       ctx.fillRect(px, py, cellW + 1, cellH + 1);
//     }
//   }

//   // Gloss lines
//   ctx.strokeStyle = "rgba(255,255,255,0.12)";
//   ctx.lineWidth = 1;

//   for (let y = 0; y < rows; y++) {
//     ctx.beginPath();
//     for (let x = 0; x < cols; x++) {
//       const px = x * cellW;
//       const py = y * cellH - current[x][y] * 0.9;

//       if (x === 0) ctx.moveTo(px, py);
//       else ctx.lineTo(px, py);
//     }
//     ctx.stroke();
//   }

//   for (let x = 0; x < cols; x++) {
//     ctx.beginPath();
//     for (let y = 0; y < rows; y++) {
//       const px = x * cellW - current[x][y] * 0.5;
//       const py = y * cellH;

//       if (y === 0) ctx.moveTo(px, py);
//       else ctx.lineTo(px, py);
//     }
//     ctx.stroke();
//   }

//   // Bright hotspot at cursor
//   if (pointer.active) {
//     const glow = ctx.createRadialGradient(
//       pointer.x,
//       pointer.y,
//       0,
//       pointer.x,
//       pointer.y,
//       pointer.radius * 1.2
//     );
//     glow.addColorStop(0, "rgba(255,255,255,0.22)");
//     glow.addColorStop(0.3, "rgba(255,255,255,0.08)");
//     glow.addColorStop(1, "rgba(255,255,255,0)");
//     ctx.fillStyle = glow;
//     ctx.fillRect(
//       pointer.x - pointer.radius * 1.2,
//       pointer.y - pointer.radius * 1.2,
//       pointer.radius * 2.4,
//       pointer.radius * 2.4
//     );
//   }
// }
function drawMembrane() {
  // soft overall glow / highlight
//   if (pointer.active) {
//     const glow = ctx.createRadialGradient(
//       pointer.x,
//       pointer.y,
//       0,
//       pointer.x,
//       pointer.y,
//       pointer.radius * 1.4
//     );
//     glow.addColorStop(0, "rgba(255,255,255,0.16)");
//     glow.addColorStop(0.35, "rgba(255,255,255,0.07)");
//     glow.addColorStop(1, "rgba(255,255,255,0)");
//     ctx.fillStyle = glow;
//     ctx.fillRect(0, 0, width, height);
//   }

  // horizontal membrane lines only
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;

  for (let y = 0; y < rows; y++) {
    ctx.beginPath();

    for (let x = 0; x < cols; x++) {
      const px = x * cellW;
      const py = y * cellH - current[x][y] * 1.2;

      if (x === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }

  // optional: very subtle vertical lines
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  for (let x = 0; x < cols; x++) {
    ctx.beginPath();

    for (let y = 0; y < rows; y++) {
      const px = x * cellW - current[x][y] * 0.35;
      const py = y * cellH;

      if (y === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }
}
function animate() {
  updateSimulation();
  drawBackground();
  drawMembrane();
  requestAnimationFrame(animate);
}

window.addEventListener("resize", resize);

window.addEventListener("mousemove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
});

window.addEventListener("mousedown", () => {
  pointer.strength = 28;
  pointer.radius = 170;
});

window.addEventListener("mouseup", () => {
  pointer.strength = 18;
  pointer.radius = 140;
});

window.addEventListener("mouseleave", () => {
  pointer.active = false;
});

window.addEventListener("mouseenter", () => {
  pointer.active = true;
});

resize();
animate();