const PongPhysics = {
  MAX_SPEED: 1800,
  UNCAP_HITS: 24,
  MIN_SPEED: 320,
  SERVE_SPEED: 380,
  SPEED_UP: 1.07,
  WALL_SPEED_UP: 1.02,
  PADDLE_ANGLE: (72 * Math.PI) / 180,
  WALL_NOISE: (11 * Math.PI) / 180,
  PADDLE_NOISE: (13 * Math.PI) / 180,
  SPIN_ON_HIT: 2.4,
  SPIN_ON_MOTION: 0.0018,
  SPIN_WALL: 0.28,
  SPIN_DECAY: 1.6,
};

class PhysicsBall {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 10;
    this.spin = 0;
    this.speed = 0;
    this.serveSpeed = PongPhysics.SERVE_SPEED;
    this.hits = 0;
    this.rallyTime = 0;
    this.lastEvent = null;
  }

  reset(width, height) {
    this.x = width / 2;
    this.y = height / 2;
    this.radius = 10;
    this.spin = 0;
    this.hits = 0;
    this.rallyTime = 0;
    const speed = PongPhysics.SERVE_SPEED;
    this.serveSpeed = speed;
    this.speed = speed;
    const angle = (Math.random() - 0.5) * 0.7;
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.vx = dir * speed * Math.cos(angle);
    this.vy = speed * Math.sin(angle);
    this.lastEvent = { type: 'serve', noise: 0, speed: speed };
  }
}

class PhysicsEngine {
  constructor() {
    this.ball = new PhysicsBall();
  }

  reset(width, height) {
    this.ball.reset(width, height);
  }

  step(dt, leftPaddle, rightPaddle, width, height) {
    const events = [];
    const b = this.ball;
    const speed = Math.hypot(b.vx, b.vy);
    const maxStep = Math.max(4, b.radius * 0.45);
    const sub = Math.max(4, Math.ceil((speed * Math.max(dt, 0)) / maxStep));
    const h = dt / sub;

    for (let i = 0; i < sub; i++) {
      const ev = this._substep(h, leftPaddle, rightPaddle, width, height);
      for (let j = 0; j < ev.length; j++) events.push(ev[j]);
      if (events.some(function (e) { return e.type === 'score-left' || e.type === 'score-right'; })) {
        break;
      }
    }

    return { events: events, ball: this.ball };
  }

  _substep(dt, leftPaddle, rightPaddle, width, height) {
    const events = [];
    const b = this.ball;
    const r = b.radius;

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin *= Math.exp(-PongPhysics.SPIN_DECAY * dt);
    b.rallyTime = (b.rallyTime || 0) + dt;
    b.speed = Math.hypot(b.vx, b.vy);

    const wall = bounceWall(b, width, height);
    if (wall) events.push(wall);

    const leftHit = bouncePaddle(b, leftPaddle, 'left');
    if (leftHit) events.push(leftHit);
    const rightHit = bouncePaddle(b, rightPaddle, 'right');
    if (rightHit) events.push(rightHit);

    if (b.x + r < 0) {
      const ev = { type: 'score-right', x: b.x, y: b.y };
      b.lastEvent = ev;
      events.push(ev);
    } else if (b.x - r > width) {
      const ev = { type: 'score-left', x: b.x, y: b.y };
      b.lastEvent = ev;
      events.push(ev);
    }

    return events;
  }
}

function bounceWall(b, width, height) {
  const r = b.radius;
  let bounced = false;
  if (b.y - r < 0) {
    b.y = r;
    b.vy = Math.abs(b.vy);
    bounced = true;
  } else if (b.y + r > height) {
    b.y = height - r;
    b.vy = -Math.abs(b.vy);
    bounced = true;
  }
  if (!bounced) return null;

  const fromTop = b.y <= b.radius + 0.01;
  const noise = (Math.random() * 2 - 1) * PongPhysics.WALL_NOISE;
  const rot = rotateVel(b.vx, b.vy, noise);
  b.vx = rot.vx + b.spin * PongPhysics.SPIN_WALL;
  b.vy = rot.vy;
  if (fromTop && b.vy < 0) b.vy = Math.abs(b.vy);
  if (!fromTop && b.vy > 0) b.vy = -Math.abs(b.vy);
  let speed = Math.hypot(b.vx, b.vy) * bounceGain(b, PongPhysics.WALL_SPEED_UP, 'wall');
  speed = clampBounceSpeed(b, speed);
  renormalize(b, speed);
  b.speed = speed;

  const ev = { type: 'wall', noise: noise, spin: b.spin, speed: speed };
  b.lastEvent = ev;
  return ev;
}

function bouncePaddle(b, paddle, side) {
  if (!paddle) return null;
  const w = paddle.w != null ? paddle.w : paddle.width;
  const h = paddle.h != null ? paddle.h : paddle.height;
  const approaching = side === 'left' ? b.vx < 0 : b.vx > 0;
  if (!approaching) return null;
  if (!circleHitsAabb(b.x, b.y, b.radius, paddle.x, paddle.y, w, h)) return null;

  const centerY = paddle.y + h / 2;
  let hitFrac = (b.y - centerY) / (h / 2);
  if (hitFrac > 1) hitFrac = 1;
  if (hitFrac < -1) hitFrac = -1;

  const noise = (Math.random() * 2 - 1) * PongPhysics.PADDLE_NOISE;
  const angle = hitFrac * PongPhysics.PADDLE_ANGLE + noise;
  const dir = side === 'left' ? 1 : -1;
  let speed = Math.hypot(b.vx, b.vy) * bounceGain(b, PongPhysics.SPEED_UP, 'paddle');
  speed = clampBounceSpeed(b, speed);

  b.vx = dir * speed * Math.cos(angle);
  b.vy = speed * Math.sin(angle);
  b.speed = speed;
  b.hits = (b.hits || 0) + 1;
  b.spin += hitFrac * PongPhysics.SPIN_ON_HIT + (paddle.vy || 0) * PongPhysics.SPIN_ON_MOTION;

  if (side === 'left') b.x = paddle.x + w + b.radius + 0.5;
  else b.x = paddle.x - b.radius - 0.5;

  const ev = {
    type: 'paddle',
    side: side,
    hitFrac: hitFrac,
    noise: noise,
    speed: speed,
    spin: b.spin,
  };
  b.lastEvent = ev;
  return ev;
}

function clampBounceSpeed(b, speed) {
  if (speed < PongPhysics.MIN_SPEED) speed = PongPhysics.MIN_SPEED;
  if ((b.hits || 0) < PongPhysics.UNCAP_HITS && speed > PongPhysics.MAX_SPEED) {
    speed = PongPhysics.MAX_SPEED;
  }
  return speed;
}

function bounceGain(b, base, kind) {
  let m = base;
  if (kind !== 'paddle') return m;
  const hits = b.hits || 0;
  const t = b.rallyTime || 0;
  // Slow extra ramp on long rallies so max speed is not instant.
  if (hits >= 14) m *= Math.pow(1.02, Math.min(hits - 13, 16));
  if (t >= 14) m *= 1 + Math.min(0.25, (t - 14) * 0.015);
  return m;
}

function circleHitsAabb(cx, cy, r, x, y, w, h) {
  const closestX = clamp(cx, x, x + w);
  const closestY = clamp(cy, y, y + h);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

function rotateVel(vx, vy, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { vx: vx * c - vy * s, vy: vx * s + vy * c };
}

function renormalize(b, speed) {
  const cur = Math.hypot(b.vx, b.vy);
  if (cur < 1e-6) return;
  b.vx = (b.vx / cur) * speed;
  b.vy = (b.vy / cur) * speed;
}

function clamp(v, a, b) {
  if (v < a) return a;
  if (v > b) return b;
  return v;
}

// Zero-noise estimate of Y at a vertical line. No paddle english.
function predictBallY(ball, targetX, width, height, maxSteps) {
  return predictBallArrival(ball, targetX, width, height, maxSteps).y;
}

// Same path, but also returns time-of-flight. Walls use the real
// speed-up (no random noise) so Perfect+ can time its movement.
function predictBallArrival(ball, targetX, width, height, maxSteps) {
  let x = ball.x;
  let y = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;
  const r = ball.radius || 10;
  const goingRight = targetX >= x;
  if (goingRight && vx <= 0) return { y: y, time: 0 };
  if (!goingRight && vx >= 0) return { y: y, time: 0 };

  const phys = typeof PongPhysics === 'object' && PongPhysics ? PongPhysics : {};
  const wallUp = phys.WALL_SPEED_UP != null ? phys.WALL_SPEED_UP : 1.02;
  const minS = phys.MIN_SPEED != null ? phys.MIN_SPEED : 320;
  const maxS = phys.MAX_SPEED != null ? phys.MAX_SPEED : 1800;
  const uncap = phys.UNCAP_HITS != null ? phys.UNCAP_HITS : 24;
  const hits = ball.hits || 0;

  const dt = 1 / 240;
  const n = maxSteps || 12000;
  let t = 0;
  for (let i = 0; i < n; i++) {
    x += vx * dt;
    y += vy * dt;
    t += dt;

    if (y - r < 0 || y + r > height) {
      if (y - r < 0) {
        y = r;
        vy = Math.abs(vy);
      } else {
        y = height - r;
        vy = -Math.abs(vy);
      }
      let speed = Math.hypot(vx, vy) * wallUp;
      if (speed < minS) speed = minS;
      if (hits < uncap && speed > maxS) speed = maxS;
      const cur = Math.hypot(vx, vy);
      if (cur > 1e-6) {
        vx = (vx / cur) * speed;
        vy = (vy / cur) * speed;
      }
    }

    if (goingRight && x >= targetX) return { y: y, time: t };
    if (!goingRight && x <= targetX) return { y: y, time: t };
    if (x < -80 || x > width + 80) return { y: y, time: t };
  }
  return { y: y, time: t };
}
