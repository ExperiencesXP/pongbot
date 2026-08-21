let engine;
let left;
let right;
let scores;
let lastTick = 0;
let lastFrameSeen = -1;
let match;

const PADDLE_W = 20;
const PADDLE_H = 110;
const PADDLE_SPEED = 620;
const PADDLE_INSET = 40;
const PRESETS = ['human', 'perfect', 'perfectplus', 'ace', 'trickster', 'fun-easy', 'fun', 'fun-hard', 'simple'];

let pongReady = false;

function setup() {
  const vp = viewportSize();
  createCanvas(vp.w, vp.h);
  rectMode(CORNER);
  ellipseMode(CENTER);
  noStroke();
  frameRate(60);

  engine = new PhysicsEngine();
  engine.reset(width, height);

  left = createPaddle('left');
  right = createPaddle('right');
  layoutPaddles();
  left.y = height / 2 - left.h / 2;
  right.y = height / 2 - right.h / 2;

  scores = { left: 0, right: 0 };
  match = {
    state: 'menu',
    bestOf: 5,
    target: 3,
    winner: null,
  };

  lastTick = 0;
  noLoop();
  const boot = window.PongAI && typeof PongAI.boot === 'function'
    ? PongAI.boot()
    : Promise.resolve();
  boot.then(function () {
    bindMenu();
    showMenu();
    pongReady = true;
    lastTick = 0;
    loop();
  }).catch(function (err) {
    console.error(err);
    bindMenu();
    showMenu();
    pongReady = true;
    loop();
  });
}

function draw() {
  if (!pongReady || !engine || !left || !right) return;
  const dt = stepDt();
  const playing = match && match.state === 'playing';

  if (playing) {
    left.targetY = thinkTarget(left, right, dt);
    right.targetY = thinkTarget(right, left, dt);
    movePaddle(left, dt);
    movePaddle(right, dt);
    const events = engine.step(dt, left, right, width, height);
    handlePhysicsEvents(events);
  }

  drawWorld(playing);
  if (typeof drawDevOverlay === 'function') {
    try {
      drawDevOverlay(overlayInfo());
    } catch (err) {
      console.error(err);
    }
  }
}

function viewportSize() {
  const doc = document.documentElement;
  return {
    w: Math.max(1, doc.clientWidth || window.innerWidth || 1),
    h: Math.max(1, doc.clientHeight || window.innerHeight || 1),
  };
}

function stepDt() {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let dt = lastTick ? (now - lastTick) / 1000 : 1 / 60;
  lastTick = now;
  if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
  if (dt > 0.05) dt = 0.05;
  return dt;
}

function resumeLoop() {
  lastTick = 0;
  if (typeof loop === 'function') loop();
}

function keyPressed() {
  if (key === 'Escape') {
    showMenu();
    return false;
  }
  if (key === 'd' || key === 'D') {
    window.DEV = !window.DEV;
  }
  if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) return false;
}

function bindMenu() {
  const leftSel = document.getElementById('left-ai');
  const rightSel = document.getElementById('right-ai');
  const presets = listAIPresetsSafe();
  fillSelect(leftSel, presets, window.LEFT_AI || 'human');
  fillSelect(rightSel, presets, window.RIGHT_AI || 'fun');

  const start = document.getElementById('btn-start');
  const again = document.getElementById('btn-again');
  const back = document.getElementById('btn-back');
  const menuBtn = document.getElementById('btn-menu');
  if (start) start.addEventListener('click', startMatch);
  if (again) again.addEventListener('click', startMatch);
  if (back) back.addEventListener('click', showMenu);
  if (menuBtn) menuBtn.addEventListener('click', showMenu);
}

function listAIPresetsSafe() {
  if (window.PongAI && typeof PongAI.list === 'function') {
    const listed = PongAI.list();
    if (Array.isArray(listed) && listed.length) return listed;
  }
  return [];
}

function fillSelect(sel, presets, current) {
  if (!sel) return;
  sel.innerHTML = '';
  const cur = String(current || '').toLowerCase();
  for (let i = 0; i < presets.length; i++) {
    const p = presets[i];
    const id = typeof p === 'object' ? p.id : p;
    const label = typeof p === 'object' ? (p.label || p.id) : p;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    if (String(id).toLowerCase() === cur) opt.selected = true;
    sel.appendChild(opt);
  }
}

function setSelectsEnabled(on) {
  const leftSel = document.getElementById('left-ai');
  const rightSel = document.getElementById('right-ai');
  const bestSel = document.getElementById('best-of');
  if (leftSel) leftSel.disabled = !on;
  if (rightSel) rightSel.disabled = !on;
  if (bestSel) bestSel.disabled = !on;
}

function showMenu() {
  match.state = 'menu';
  match.winner = null;
  setSelectsEnabled(true);
  const menu = document.getElementById('menu');
  const over = document.getElementById('match-over');
  const menuBtn = document.getElementById('btn-menu');
  if (menu) menu.hidden = false;
  if (over) over.hidden = true;
  if (menuBtn) menuBtn.hidden = true;
  scores.left = 0;
  scores.right = 0;
  resetRally(false);
}

function startMatch() {
  if (match.state !== 'menu' && match.state !== 'over') return;
  if (!listAIPresetsSafe().length) {
    console.error('Ingen AI indlæst. Kør npm start og åbn http://127.0.0.1:<port>/');
    return;
  }

  const leftSel = document.getElementById('left-ai');
  const rightSel = document.getElementById('right-ai');
  const bestSel = document.getElementById('best-of');
  const bestOf = bestSel ? parseInt(bestSel.value, 10) : 5;
  match.bestOf = isFinite(bestOf) && bestOf > 0 ? bestOf : 5;
  match.target = Math.ceil(match.bestOf / 2);
  match.winner = null;

  assignAI(left, leftSel ? leftSel.value : 'human', 'human');
  assignAI(right, rightSel ? rightSel.value : 'fun', 'fun');
  match.state = 'playing';
  setSelectsEnabled(false);

  scores.left = 0;
  scores.right = 0;
  resetRally(true);

  const menu = document.getElementById('menu');
  const over = document.getElementById('match-over');
  const menuBtn = document.getElementById('btn-menu');
  if (menu) menu.hidden = true;
  if (over) over.hidden = true;
  if (menuBtn) menuBtn.hidden = false;
  lastTick = 0;
}

function endMatch(winnerSide) {
  match.state = 'over';
  match.winner = winnerSide;
  const over = document.getElementById('match-over');
  const title = document.getElementById('winner-text');
  const final = document.getElementById('final-score');
  const menuBtn = document.getElementById('btn-menu');
  const name = winnerSide === 'left' ? left.name : right.name;
  if (title) title.textContent = name + ' wins';
  if (final) {
    final.textContent =
      scores.left + ' – ' + scores.right + '  ·  best of ' + match.bestOf;
  }
  if (over) over.hidden = false;
  if (menuBtn) menuBtn.hidden = true;
}

function resetRally(serve) {
  layoutPaddles();
  left.y = height / 2 - left.h / 2;
  right.y = height / 2 - right.h / 2;
  left.vy = 0;
  right.vy = 0;
  if (left.ai && typeof left.ai.reset === 'function') left.ai.reset();
  if (right.ai && typeof right.ai.reset === 'function') right.ai.reset();
  if (serve) engine.reset(width, height);
}

function windowResized() {
  const vp = viewportSize();
  if (Math.abs(vp.w - width) < 1 && Math.abs(vp.h - height) < 1) return;
  resizeCanvas(vp.w, vp.h);
  layoutPaddles();
  const b = engine && engine.ball;
  if (b) {
    const r = b.radius || 10;
    b.x = constrain(b.x, r, width - r);
    b.y = constrain(b.y, r, height - r);
  }
  resumeLoop();
}

document.addEventListener('visibilitychange', resumeLoop);
document.addEventListener('fullscreenchange', resumeLoop);

// Some WebViews only fire rAF on layout changes (e.g. fullscreen). Keep ticking.
setInterval(function () {
  if (!engine) return;
  if (typeof frameCount !== 'number' || typeof redraw !== 'function') return;
  if (frameCount === lastFrameSeen) redraw();
  lastFrameSeen = frameCount;
}, 16);

function createPaddle(side) {
  return {
    x: 0,
    y: 0,
    w: PADDLE_W,
    h: PADDLE_H,
    width: PADDLE_W,
    height: PADDLE_H,
    vy: 0,
    side: side,
    speed: PADDLE_SPEED,
    ai: null,
    name: '',
    targetY: 0,
    moveSpeed: null,
  };
}

function layoutPaddles() {
  left.x = PADDLE_INSET;
  right.x = width - PADDLE_INSET - right.w;
  left.y = constrain(left.y, 0, Math.max(0, height - left.h));
  right.y = constrain(right.y, 0, Math.max(0, height - right.h));
}

function knownPresets() {
  if (window.PongAI && typeof PongAI.list === 'function') {
    const listed = PongAI.list();
    if (Array.isArray(listed) && listed.length) return listed;
  }
  return [];
}

function presetIdOf(value) {
  if (value && typeof value === 'object') return value.id || value.label;
  return value;
}

function assignAI(paddle, name, fallback) {
  if (match && match.state === 'playing') return;
  const allowed = knownPresets().map(presetIdOf).filter(Boolean);
  let preset = String(name || fallback || 'perfect').toLowerCase();
  const found = allowed.find(function (id) {
    return String(id).toLowerCase() === preset;
  });
  if (found) preset = found;
  else if (fallback) preset = String(fallback).toLowerCase();
  paddle.ai = PongAI.create(preset);
  paddle.name = (paddle.ai && paddle.ai.label) || preset;
  paddle.aiDebug = null;
}

function thinkTarget(paddle, opponent, dt) {
  const center = paddle.y + paddle.h / 2;
  if (!paddle.ai || typeof paddle.ai.think !== 'function') return center;
  const out = paddle.ai.think({
    ball: engine.ball,
    self: paddle,
    opponent: opponent,
    width: width,
    height: height,
    dt: dt,
  });
  if (out && out.debug) paddle.aiDebug = out.debug;
  paddle.moveSpeed = null;
  if (typeof out === 'number' && Number.isFinite(out)) return out;
  if (out && typeof out.targetY === 'number' && Number.isFinite(out.targetY)) return out.targetY;
  return center;
}

function movePaddle(paddle, dt) {
  if (paddle.ai && paddle.ai.id === 'human') {
    moveHuman(paddle, dt);
    return;
  }

  const center = paddle.y + paddle.h / 2;
  let target = paddle.targetY;
  if (target == null || !Number.isFinite(target)) target = center;
  const maxMove = paddle.speed * dt;
  const error = target - center;
  let dy = 0;
  if (Math.abs(error) <= maxMove) dy = error;
  else dy = Math.sign(error) * maxMove;

  const prevY = paddle.y;
  paddle.y = constrain(paddle.y + dy, 0, height - paddle.h);
  const actual = paddle.y - prevY;
  paddle.vy = dt > 0 ? actual / dt : 0;
}

function moveHuman(paddle, dt) {
  let dir = 0;
  if (paddle.side === 'left') {
    if (keyIsDown(87)) dir -= 1; // W
    if (keyIsDown(83)) dir += 1; // S
  } else {
    if (keyIsDown(UP_ARROW)) dir -= 1;
    if (keyIsDown(DOWN_ARROW)) dir += 1;
  }
  const prevY = paddle.y;
  paddle.y = constrain(paddle.y + dir * paddle.speed * dt, 0, height - paddle.h);
  paddle.vy = dt > 0 ? (paddle.y - prevY) / dt : 0;
  paddle.targetY = paddle.y + paddle.h / 2;
}

function handlePhysicsEvents(stepResult) {
  if (!match || match.state !== 'playing') return;
  const events = normalizeEvents(stepResult);
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (isScoreEvent(ev, 'left')) {
      scores.left += 1;
      onScore();
      return;
    }
    if (isScoreEvent(ev, 'right')) {
      scores.right += 1;
      onScore();
      return;
    }
  }

  const b = engine && engine.ball;
  if (!b) return;
  const r = b.radius || 0;
  if (b.x + r < 0) {
    scores.right += 1;
    onScore();
  } else if (b.x - r > width) {
    scores.left += 1;
    onScore();
  }
}

function normalizeEvents(result) {
  if (result == null) return [];
  if (Array.isArray(result)) return result;
  if (typeof result === 'string') return [{ type: result }];
  if (typeof result === 'object') {
    if (Array.isArray(result.events)) return result.events;
    if (result.type) return [result];
  }
  return [];
}

function isScoreEvent(ev, who) {
  if (ev == null) return false;
  const type = String(ev.type || ev.kind || (typeof ev === 'string' ? ev : '')).toLowerCase();
  const side = String(ev.side || ev.scorer || ev.player || '').toLowerCase();
  if (type === 'score-' + who || type === 'score' + who || type === who + '-score' || type === who + 'score') {
    return true;
  }
  if ((type === 'score' || type === 'scored' || type === 'goal') && side === who) return true;
  return false;
}

function onScore() {
  if (match.state !== 'playing') return;
  if (scores.left >= match.target) {
    endMatch('left');
    return;
  }
  if (scores.right >= match.target) {
    endMatch('right');
    return;
  }
  resetRally(true);
}

function drawWorld(playing) {
  background(0);
  drawCourt();
  drawNet();

  noStroke();
  fill(255);
  rect(left.x, left.y, left.w, left.h, 2);
  rect(right.x, right.y, right.w, right.h, 2);

  if (playing || (match && match.state === 'over')) {
    const b = engine.ball || {};
    const r = b.radius != null ? b.radius : 10;
    ellipse(b.x, b.y, r * 2, r * 2);
  }

  drawHUD();
}

function drawCourt() {
  noFill();
  stroke(255, 28);
  strokeWeight(2);
  rect(1, 1, width - 2, height - 2);
  stroke(255, 22);
  strokeWeight(1);
  line(width / 2, 0, width / 2, height);
  noStroke();
}

function drawNet() {
  const x = width / 2;
  const dash = 18;
  const gap = 12;
  stroke(255, 190);
  strokeWeight(4);
  strokeCap(SQUARE);
  for (let y = 10; y < height - 8; y += dash + gap) {
    line(x, y, x, Math.min(y + dash, height - 10));
  }
  noStroke();
}

function paddleLabel(paddle, keys) {
  const name = paddle.name || '—';
  if (paddle.ai && paddle.ai.id === 'human') return name + '  ' + keys;
  return name;
}

function drawHUD() {
  const scoreSize = Math.max(36, Math.round(width * 0.042));
  fill(255);
  noStroke();
  textAlign(CENTER, TOP);
  textFont('monospace');
  textSize(scoreSize);
  text(String(scores.left), width * 0.25, 22);
  text(String(scores.right), width * 0.75, 22);

  textSize(Math.max(14, Math.round(scoreSize * 0.34)));
  fill(200);
  text(paddleLabel(left, 'W/S'), width * 0.25, 22 + scoreSize + 4);
  text(paddleLabel(right, '↑/↓'), width * 0.75, 22 + scoreSize + 4);

  const b = engine.ball || {};
  const speed = b.speed != null ? b.speed : Math.hypot(b.vx || 0, b.vy || 0);
  const playing = match && match.state !== 'menu';
  if (playing) {
    fill(255);
    textSize(Math.max(16, Math.round(scoreSize * 0.38)));
    text('SPEED ' + Math.round(speed), width / 2, 18);
    fill(160);
    textSize(13);
    text('best of ' + match.bestOf + '  ·  first to ' + match.target, width / 2, 42);
  }

  fill(160);
  textSize(13);
  textAlign(CENTER, BOTTOM);
  text('Esc menu   D debug', width / 2, height - 10);
}

function overlayInfo() {
  const b = engine.ball || {};
  return {
    fps: typeof frameRate === 'function' ? frameRate() : 0,
    ball: {
      x: b.x,
      y: b.y,
      vx: b.vx != null ? b.vx : b.xSpeed,
      vy: b.vy != null ? b.vy : b.ySpeed,
      spin: b.spin,
      radius: b.radius,
      speed: b.speed,
      serveSpeed: b.serveSpeed,
      hits: b.hits,
      rallyTime: b.rallyTime,
    },
    lastEvent: b.lastEvent,
    left: {
      name: left.name,
      y: left.y,
      targetY: left.targetY,
      debug: left.aiDebug,
    },
    right: {
      name: right.name,
      y: right.y,
      targetY: right.targetY,
      debug: right.aiDebug,
    },
    scores: { left: scores.left, right: scores.right },
    match: match,
    width: width,
    height: height,
  };
}
