const canvas = document.getElementById("particles");
const ctx = canvas.getContext("2d");

let particles = [];
let animationId = null;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

export function startParticles(config) {
  stopParticles();
  particles = [];

  const count = config.count ?? 50;

  for (let i = 0; i < count; i++) {
    particles.push(createParticle(config.type));
  }

  animate();
}

export function stopParticles() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function createParticle(type = "dreamy") {
  const size = Math.random() * 5 + 2;
  const speed = Math.random() * 0.4 + 0.1;
  const direction = Math.random() * Math.PI * 2;

  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * 1.3,
    r: size,
    vx: Math.cos(direction) * speed,
    vy: Math.sin(direction) * speed - 0.15,
    alpha: Math.random() * 0.5 + 0.25,
    life: 1,
    lifeDecay: 0.0003 + Math.random() * 0.0004
  };
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.lifeDecay;

    if (p.y < -20 || p.x < -20 || p.x > canvas.width + 20 || p.life <= 0) {
      p.x = Math.random() * canvas.width;
      p.y = canvas.height + 30;
      p.life = 1;
      p.alpha = Math.random() * 0.35 + 0.08;
    }

    p.alpha = p.life * (0.25 + Math.random() * 0.45);

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = "#FFF2B9";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  animationId = requestAnimationFrame(animate);
}