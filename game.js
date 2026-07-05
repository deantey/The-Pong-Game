const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");
const buttons = document.querySelectorAll("button[data-mode]");

let W, H;
let playing = false;
let over = false;
let mode = "medium";

let topP, bottomP, ball;
let topScore = 0;
let bottomScore = 0;
let hitCount = 0;
let flashAlpha = 0;

const colours = ["#00ffff", "#ff00ff", "#ffff00", "#00ff77", "#ff6600", "#8a5cff"];
let colourIndex = 0;
let lastColourChange = 0;

let particles = [];
let trail = [];

const sounds = {
  hit: new Audio("sounds/hit.wav"),
  wall: new Audio("sounds/wall.wav"),
  score: new Audio("sounds/score.wav"),
  win: new Audio("sounds/win.wav")
};

for (const s of Object.values(sounds)) {
  s.preload = "auto";
  s.volume = 0.65;
}

function playSound(name) {
  const original = sounds[name];
  if (!original) return;
  try {
    const s = original.cloneNode();
    s.volume = original.volume;
    s.play().catch(() => {});
  } catch (e) {}
}

function unlockSounds() {
  for (const s of Object.values(sounds)) {
    try {
      s.currentTime = 0;
      s.muted = true;
      s.play().then(() => {
        s.pause();
        s.currentTime = 0;
        s.muted = false;
      }).catch(() => {
        s.muted = false;
      });
    } catch (e) {
      s.muted = false;
    }
  }
}

document.addEventListener("touchstart", unlockSounds, { passive: true });
document.addEventListener("pointerdown", unlockSounds, { passive: true });

buttons.forEach(btn => {
  btn.addEventListener("click", () => startGame(btn.dataset.mode));
});

function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * devicePixelRatio);
  canvas.height = Math.floor(rect.height * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  W = rect.width;
  H = rect.height;

  const paddleWidth = Math.min(W * 0.46, 175);
  const paddleHeight = 17;

  topP = {
    x: W / 2 - paddleWidth / 2,
    y: 90,
    w: paddleWidth,
    h: paddleHeight,
    desiredX: W / 2 - paddleWidth / 2,
    colour: colours[0],
    target: colours[0]
  };

  // Player 1 paddle is closer to the middle so it is always visible and easier to control.
  bottomP = {
    x: W / 2 - paddleWidth / 2,
    y: H - 170,
    w: paddleWidth,
    h: paddleHeight,
    desiredX: W / 2 - paddleWidth / 2,
    colour: colours[2],
    target: colours[2]
  };

  resetBall(Math.random() > 0.5 ? 1 : -1);
}

window.addEventListener("resize", resize);

function startGame(selectedMode) {
  unlockSounds();
  mode = selectedMode;
  playing = true;
  over = false;
  topScore = 0;
  bottomScore = 0;
  hitCount = 0;
  flashAlpha = 0;
  particles = [];
  trail = [];
  menu.style.display = "none";
  resetBall(Math.random() > 0.5 ? 1 : -1);
  playSound("win");
}

function resetBall(direction) {
  ball = {
    x: W / 2,
    y: H / 2,
    r: 10,
    vx: Math.random() * 5 - 2.5,
    vy: direction * 6
  };
}

function aiSpeed() {
  if (mode === "easy") return 0.03;
  if (mode === "hard") return 0.105;
  return 0.065;
}

function clampPaddles() {
  const margin = 18;
  topP.desiredX = Math.max(margin, Math.min(W - topP.w - margin, topP.desiredX));
  bottomP.desiredX = Math.max(margin, Math.min(W - bottomP.w - margin, bottomP.desiredX));
  topP.x = Math.max(margin, Math.min(W - topP.w - margin, topP.x));
  bottomP.x = Math.max(margin, Math.min(W - bottomP.w - margin, bottomP.x));
}

function collide(p) {
  return (
    ball.x + ball.r > p.x &&
    ball.x - ball.r < p.x + p.w &&
    ball.y + ball.r > p.y &&
    ball.y - ball.r < p.y + p.h
  );
}

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function mixColour(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const r = Math.round(A.r + (B.r - A.r) * t);
  const g = Math.round(A.g + (B.g - A.g) * t);
  const bl = Math.round(A.b + (B.b - A.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function spawnParticles(x, y, colour, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.8 + Math.random() * 5.2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      colour
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.025;
    p.life -= 0.022;
  }
}

function paddleHit(p, isBottom) {
  hitCount += 1;

  const speedUp = hitCount % 3 === 0 ? 1.06 : 1.035;
  ball.vy = (isBottom ? -Math.abs(ball.vy) : Math.abs(ball.vy)) * speedUp;
  ball.vx += (ball.x - (p.x + p.w / 2)) * 0.048;

  playSound("hit");
  spawnParticles(ball.x, isBottom ? p.y : p.y + p.h, p.target, 36);
}

function update(t) {
  if (t - lastColourChange > 1250) {
    colourIndex = (colourIndex + 1) % colours.length;
    lastColourChange = t;
    topP.colour = topP.target;
    topP.target = colours[colourIndex];
    bottomP.colour = bottomP.target;
    bottomP.target = colours[(colourIndex + 2) % colours.length];
  }

  updateParticles();
  if (flashAlpha > 0) flashAlpha -= 0.032;

  topP.x += (topP.desiredX - topP.x) * 0.30;
  bottomP.x += (bottomP.desiredX - bottomP.x) * 0.30;

  if (!playing || over) return;

  trail.push({ x: ball.x, y: ball.y, life: 1 });
  if (trail.length > 34) trail.shift();
  for (const item of trail) item.life -= 0.034;

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < ball.r + 18 || ball.x > W - ball.r - 18) {
    ball.vx *= -1;
    playSound("wall");
    spawnParticles(ball.x, ball.y, "#00ffff", 16);
  }

  if (mode !== "two") {
    const target = ball.x - topP.w / 2;
    topP.desiredX += (target - topP.desiredX) * aiSpeed();
  }

  clampPaddles();

  if (collide(bottomP) && ball.vy > 0) paddleHit(bottomP, true);
  if (collide(topP) && ball.vy < 0) paddleHit(topP, false);

  if (ball.y < -28) {
    bottomScore += 1;
    flashAlpha = 0.50;
    playSound("score");
    spawnParticles(W / 2, H * 0.20, "#ff00ff", 60);
    resetBall(1);
  }

  if (ball.y > H + 28) {
    topScore += 1;
    flashAlpha = 0.50;
    playSound("score");
    spawnParticles(W / 2, H * 0.80, "#00ffff", 60);
    resetBall(-1);
  }

  if (topScore >= 10 || bottomScore >= 10) {
    over = true;
    playSound("win");
    spawnParticles(W / 2, H / 2, "#ffffff", 85);
  }
}

function drawBackground() {
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, W, H);

  const margin = 14;
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#ff00ff");
  grd.addColorStop(0.45, "#8a5cff");
  grd.addColorStop(1, "#00ffff");

  ctx.strokeStyle = grd;
  ctx.lineWidth = 5;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#00ffff";
  ctx.strokeRect(margin, margin, W - margin * 2, H - margin * 2);
  ctx.shadowBlur = 0;

  for (let y = 40; y < H; y += 42) {
    ctx.strokeStyle = "rgba(255,0,255,.06)";
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(W - margin, y);
    ctx.stroke();
  }

  for (let x = margin; x < W - margin; x += 42) {
    ctx.strokeStyle = "rgba(0,255,255,.045)";
    ctx.beginPath();
    ctx.moveTo(x, margin);
    ctx.lineTo(x, H - margin);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.setLineDash([13, 12]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, H / 2);
  ctx.lineTo(W - margin, H / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function glowRect(p) {
  const progress = Math.min(1, (performance.now() - lastColourChange) / 1250);
  const colour = mixColour(p.colour, p.target, progress);

  ctx.shadowBlur = 30;
  ctx.shadowColor = colour;
  ctx.fillStyle = colour;
  ctx.fillRect(p.x, p.y, p.w, p.h);

  ctx.fillStyle = "rgba(255,255,255,.62)";
  ctx.fillRect(p.x + 8, p.y + 3, p.w - 16, 3);
  ctx.shadowBlur = 0;
}

function drawTrail() {
  for (const item of trail) {
    if (item.life <= 0) continue;
    ctx.globalAlpha = item.life * 0.62;
    ctx.shadowBlur = 28;
    ctx.shadowColor = "#00aaff";
    ctx.fillStyle = "#00aaff";
    ctx.beginPath();
    ctx.arc(item.x, item.y, ball.r * (0.30 + item.life * 0.85), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.shadowBlur = 16;
    ctx.shadowColor = p.colour;
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.0 * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function draw() {
  drawBackground();

  drawTrail();
  drawParticles();

  glowRect(topP);
  glowRect(bottomP);

  ctx.shadowBlur = 30;
  ctx.shadowColor = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Only score is shown during gameplay. No blue/pink player labels.
  ctx.textAlign = "center";
  ctx.font = "bold 42px Arial";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#ffffff";
  ctx.fillText(topScore + " : " + bottomScore, W / 2, 62);
  ctx.shadowBlur = 0;

  if (flashAlpha > 0) {
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  if (over) {
    ctx.fillStyle = "rgba(0,0,0,.76)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Arial";
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#00ffff";
    const winner = bottomScore > topScore ? "PLAYER 1 WINS!" : (mode === "two" ? "PLAYER 2 WINS!" : "AI WINS!");
    ctx.fillText(winner, W / 2, H / 2 - 12);

    ctx.font = "20px Arial";
    ctx.fillText("Tap to return to menu", W / 2, H / 2 + 36);
    ctx.shadowBlur = 0;
  }
}

function loop(t) {
  update(t);
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  unlockSounds();

  const rect = canvas.getBoundingClientRect();
  for (const touch of e.touches) {
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (y > H / 2) {
      bottomP.desiredX = x - bottomP.w / 2;
    } else if (mode === "two") {
      topP.desiredX = x - topP.w / 2;
    }
  }

  clampPaddles();
}, { passive: false });

canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  bottomP.desiredX = (e.clientX - rect.left) - bottomP.w / 2;
  clampPaddles();
});

canvas.addEventListener("click", () => {
  unlockSounds();
  if (over) {
    playing = false;
    over = false;
    menu.style.display = "flex";
  }
});

resize();
loop(0);
