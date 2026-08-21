function drawDevOverlay(info) {
  const panel = document.getElementById('dev-panel');
  const body = document.getElementById('dev-body');
  if (!panel || !body) return;

  if (!window.DEV) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  info = info || {};
  const ball = info.ball || {};
  const left = info.left || {};
  const right = info.right || {};
  const last = info.lastEvent || {};
  const scores = info.scores || {};
  const match = info.match || {};

  const vx = num(ball.vx);
  const vy = num(ball.vy);
  const speed = num(ball.speed) != null
    ? num(ball.speed)
    : (vx != null && vy != null ? Math.hypot(vx, vy) : null);

  const lines = [
    'FPS          ' + fmt(info.fps, 0),
    'SPEED        ' + fmt(speed, 0) + ' px/s',
    'serve        ' + fmt(ball.serveSpeed, 0) + '   hits ' + str(ball.hits, '0'),
    'rally        ' + fmt(ball.rallyTime, 1) + ' s',
    'pos          ' + fmt(ball.x, 0) + ' , ' + fmt(ball.y, 0),
    'vel          ' + fmt(vx, 1) + ' , ' + fmt(vy, 1),
    'spin         ' + fmt(ball.spin, 2),
    '',
    'bounce       ' + str(last.type, '—'),
    '  side       ' + str(last.side, '—'),
    '  hitFrac    ' + fmtHit(last),
    '  noise      ' + formatNoise(last),
    '  out speed  ' + fmt(last.speed, 0),
    '',
    'match        ' + str(match.state, '—') + '   best of ' + str(match.bestOf, '—'),
    'score        ' + fmtScore(scores.left) + ' – ' + fmtScore(scores.right) +
      '   first to ' + str(match.target, '—'),
    '',
    paddleBlock('LEFT ', left),
    '',
    paddleBlock('RIGHT', right),
  ];

  body.textContent = lines.join('\n');
}

function paddleBlock(label, p) {
  const lines = [
    label + '       ' + str(p.name, '?'),
    '  y          ' + fmt(p.y, 0),
    '  target     ' + fmt(p.targetY, 0),
  ];
  const extra = extraDebugLines(p.debug);
  for (let i = 0; i < extra.length; i++) lines.push('  ' + extra[i]);
  return lines.join('\n');
}

function extraDebugLines(debug) {
  const lines = [];
  if (!debug || typeof debug !== 'object') return lines;
  const keys = Object.keys(debug);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = debug[k];
    if (typeof v === 'function') continue;
    lines.push(k + '  ' + shortVal(v));
  }
  return lines;
}

function shortVal(v) {
  if (v == null) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') {
    try {
      let s = JSON.stringify(v);
      if (s.length > 48) s = s.slice(0, 45) + '...';
      return s;
    } catch (e) {
      return String(v);
    }
  }
  const s = String(v);
  return s.length > 48 ? s.slice(0, 45) + '...' : s;
}

function num(v) {
  if (v == null || v === '') return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
}

function fmt(v, digits) {
  const n = num(v);
  if (n == null) return '—';
  return n.toFixed(digits);
}

function fmtScore(v) {
  const n = num(v);
  return n == null ? '—' : String(Math.round(n));
}

function str(v, fallback) {
  if (v == null || v === '') return fallback;
  return String(v);
}

function fmtHit(last) {
  if (!last) return '—';
  if (last.hitFrac != null) return fmt(last.hitFrac, 3);
  if (last.hit != null) return fmt(last.hit, 3);
  return '—';
}

function formatNoise(last) {
  if (!last) return '—';
  if (last.noiseDeg != null && last.noise == null) {
    return fmt(last.noiseDeg, 1) + ' deg';
  }
  const n = num(last.noise);
  if (n == null) return '—';
  if (Math.abs(n) > Math.PI) return n.toFixed(1) + ' deg';
  return (n * 180 / Math.PI).toFixed(1) + ' deg';
}
