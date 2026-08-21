const AI_PRESETS = {
  human: { id: 'human', label: 'Human' },
  perfect: { id: 'perfect', label: 'Perfect' },
  perfectplus: { id: 'perfectplus', label: 'Perfect+' },
  ace: { id: 'ace', label: 'Ace' },
  trickster: { id: 'trickster', label: 'Trickshot' },
  'fun-easy': { id: 'fun-easy', label: 'Fun (Easy)' },
  fun: { id: 'fun', label: 'Fun (Normal)' },
  'fun-hard': { id: 'fun-hard', label: 'Fun (Hard)' },
  simple: { id: 'simple', label: 'Simple' },
};

const FUN_SKILL = {
  'fun-easy': {
    speed: 320,
    reactMin: 0.18,
    reactExtra: 0.22,
    chaseFrac: 0.42,
    follow: 0.90,
    wobbleA: 28,
    wobbleB: 14,
    mistake: 0.016,
    hesitate: [0.16, 0.28],
    overshoot: [40, 70],
    predict: 0.15,
  },
  fun: {
    speed: 420,
    reactMin: 0.08,
    reactExtra: 0.14,
    chaseFrac: 0.58,
    follow: 0.82,
    wobbleA: 16,
    wobbleB: 8,
    mistake: 0.008,
    hesitate: [0.08, 0.16],
    overshoot: [24, 44],
    predict: 0.45,
  },
  'fun-hard': {
    speed: 540,
    reactMin: 0.02,
    reactExtra: 0.08,
    chaseFrac: 0.78,
    follow: 0.70,
    wobbleA: 7,
    wobbleB: 4,
    mistake: 0.003,
    hesitate: [0.04, 0.10],
    overshoot: [12, 24],
    predict: 0.75,
  },
};

function listAIPresets() {
  return Object.values(AI_PRESETS);
}

function createAI(presetId) {
  const preset = AI_PRESETS[presetId] || AI_PRESETS.simple;
  let state = makeAIState(preset.id);

  const funSpec = FUN_SKILL[preset.id] || null;
  return {
    id: preset.id,
    label: preset.label,
    funSpeed: funSpec ? funSpec.speed : null,
    reset() {
      state = makeAIState(preset.id);
    },
    think(input) {
      switch (preset.id) {
        case 'perfect':
          return thinkPerfect(input);
        case 'perfectplus':
          return thinkPerfectPlus(input, state);
        case 'ace':
          return thinkAce(input, state);
        case 'trickster':
          return thinkTrickster(input, state);
        case 'fun':
        case 'fun-easy':
        case 'fun-hard':
          return thinkFun(input, state, funSpec || FUN_SKILL.fun);
        case 'human':
          return thinkHuman(input);
        default:
          return thinkSimple(input);
      }
    },
  };
}

function makeAIState(id) {
  if (id === 'perfectplus') {
    return { lockY: null, lockEta: null, lastIncoming: false, bounceKey: '' };
  }
  if (id === 'ace') {
    return { edge: 1, wasIncoming: false };
  }
  if (id === 'trickster') {
    return {
      wasIncoming: false,
      idleY: null,
      edge: 1,
    };
  }
  if (FUN_SKILL[id]) {
    return {
      t: 0,
      smoothY: null,
      mood: 'wander',
      moodTimer: 0,
      hesitateUntil: 0,
      overshootT: 0,
      overshoot: 0,
      reactAt: 0,
      wasIncoming: false,
    };
  }
  return {};
}

function thinkPerfect(input) {
  const { ball, self, width, height } = input;
  const incoming = isIncoming(ball, self);
  const mid = height * 0.5;

  if (!incoming) {
    return {
      targetY: clampPaddleCenter(mid, self, height),
      debug: { predictedY: mid, incoming: false },
    };
  }

  const predictedY = predictArrival(ball, paddleFaceX(self), width, height);
  const targetY = clampPaddleCenter(predictedY, self, height);
  return {
    targetY,
    debug: { predictedY, incoming: true },
  };
}

// Recalculate the full wall-bounce path at every paddle/wall hit,
// then cruise at exactly the speed needed to arrive on time.
function thinkPerfectPlus(input, state) {
  const { ball, self, width, height, dt } = input;
  const incoming = isIncoming(ball, self);
  const here = paddleCenterY(self);

  if (!incoming) {
    state.lastIncoming = false;
    state.lockY = null;
    state.lockEta = null;
    state.bounceKey = '';
    return {
      targetY: here,
      moveSpeed: 0,
      debug: { predictedY: here, incoming: false, eta: 0, moveSpeed: 0 },
    };
  }

  const key = bounceKey(ball);
  if (!state.lastIncoming || key !== state.bounceKey || state.lockY == null) {
    const faceX = paddleFaceX(self);
    const pred = predictArrivalTimed(ball, faceX, width, height);
    state.lockY = pred.y;
    state.lockEta = pred.time;
    state.bounceKey = key;
  } else {
    state.lockEta = Math.max(0, (state.lockEta || 0) - (dt > 0 ? dt : 1 / 60));
  }
  state.lastIncoming = true;

  const targetY = clampPaddleCenter(state.lockY, self, height);
  const dist = Math.abs(targetY - here);
  const eta = Math.max(state.lockEta, 1e-4);
  const need = dist / eta;
  const moveSpeed = Math.min(self.speed || 620, need);

  return {
    targetY: targetY,
    moveSpeed: moveSpeed,
    debug: {
      predictedY: state.lockY,
      incoming: true,
      eta: round3(eta),
      moveSpeed: round3(moveSpeed),
    },
  };
}

function bounceKey(ball) {
  const ev = ball.lastEvent || {};
  const spd = ev.speed != null ? Number(ev.speed).toFixed(2) : '';
  const noise = ev.noise != null ? Number(ev.noise).toFixed(4) : '';
  return String(ev.type || '') + ':' + (ball.hits || 0) + ':' + spd + ':' + noise;
}

function predictArrivalTimed(ball, targetX, width, height) {
  if (typeof predictBallArrival === 'function') {
    const pred = predictBallArrival(ball, targetX, width, height, 12000);
    if (pred && typeof pred.y === 'number' && isFinite(pred.y)) {
      return { y: pred.y, time: Math.max(0, pred.time || 0) };
    }
  }
  const y = predictArrival(ball, targetX, width, height);
  const time = Math.abs(targetX - ball.x) / Math.max(Math.abs(ball.vx), 1e-6);
  return { y: y, time: time };
}

// Perfect intercept, but run through an edge hit so paddle motion
// and offset send the ball where the opponent is not.
function thinkAce(input, state) {
  const { ball, self, opponent, width, height } = input;
  const incoming = isIncoming(ball, self);
  const half = self.h * 0.5;
  const faceX = paddleFaceX(self);

  if (!incoming) {
    state.wasIncoming = false;
    state.edge = paddleCenterY(opponent) > height * 0.5 ? -1 : 1;
    const coil = height * (state.edge < 0 ? 0.22 : 0.78);
    return {
      targetY: clampPaddleCenter(coil, self, height),
      debug: { predictedY: coil, incoming: false, mode: 'coil', hitFrac: state.edge * 0.8 },
    };
  }

  const predictedY = predictArrival(ball, faceX, width, height);
  const timeToUs = Math.abs(faceX - ball.x) / Math.max(Math.abs(ball.vx), 1e-6);
  if (!state.wasIncoming) {
    state.edge = farEdge(opponent, height);
  }
  state.wasIncoming = true;

  const hitFrac = state.edge * 0.78;
  let contact = predictedY - hitFrac * half;
  contact = clampPaddleCenter(contact, self, height);
  if (!coversBall(contact, self.h, predictedY) || !canReachBy(self, contact, timeToUs)) {
    return {
      targetY: clampPaddleCenter(predictedY, self, height),
      debug: { predictedY, incoming: true, mode: 'save', hitFrac: 0 },
    };
  }

  // Stay coiled until the last dash so we are still moving at contact.
  let targetY = contact;
  let mode = 'slash';
  if (timeToUs > 0.2) {
    const coil = predictedY + hitFrac * half * 1.15;
    targetY = clampPaddleCenter(coil, self, height);
    mode = 'coil';
  }

  return {
    targetY: targetY,
    debug: { predictedY, incoming: true, mode: mode, hitFrac: round3(hitFrac) },
  };
}

// Keep up on defense, but always try a max-english edge slash.
function thinkTrickster(input, state) {
  const { ball, self, opponent, width, height } = input;
  const incoming = isIncoming(ball, self);
  const mid = height * 0.5;
  const half = self.h * 0.5;
  const faceX = paddleFaceX(self);
  const trickSpeed = 540;

  if (!incoming) {
    if (state.wasIncoming || state.idleY == null) {
      // Coil for a reverse-bank or a steep wall-ride next time.
      state.edge = ball.vy < 0 ? 1 : -1;
      if (Math.random() < 0.35) state.edge *= -1;
      state.idleY = height * (state.edge < 0 ? 0.2 : 0.8);
    }
    state.wasIncoming = false;
    return {
      targetY: clampPaddleCenter(state.idleY, self, height),
      debug: { predictedY: ball.y, edge: state.edge < 0 ? 'top' : 'bottom', mode: 'coil' },
    };
  }

  if (!state.wasIncoming) {
    // Default: steepen the current shot into a bank. If the opponent is
    // already on that side, whip the other way for a cross-court.
    state.edge = ball.vy < 0 ? -1 : 1;
    const opp = paddleCenterY(opponent);
    if (state.edge < 0 && opp < mid - height * 0.12) state.edge = 1;
    else if (state.edge > 0 && opp > mid + height * 0.12) state.edge = -1;
  }
  state.wasIncoming = true;

  const predictedY = predictArrival(ball, faceX, width, height);
  const timeToUs = Math.abs(faceX - ball.x) / Math.max(Math.abs(ball.vx), 1e-6);
  const contact = extremeContact(predictedY, self, height, state.edge);
  const edge = state.edge < 0 ? 'top' : 'bottom';

  const here = paddleCenterY(self);
  const reach = trickSpeed * Math.max(0, timeToUs - 0.015) + 10;
  let hitAt = contact;
  if (Math.abs(contact - here) > reach) {
    const reachable = here + Math.sign(contact - here) * reach;
    hitAt = coversBall(reachable, self.h, predictedY)
      ? reachable
      : predictedY;
  }

  // Run through the ball for extra spin / a visible slash.
  let targetY = hitAt;
  let mode = 'slash';
  if (timeToUs > 0.16) {
    targetY = clampPaddleCenter(predictedY + state.edge * half * 1.35, self, height);
    mode = 'windup';
  }

  return {
    targetY: clampPaddleCenter(targetY, self, height),
    debug: { predictedY, edge: edge, mode: mode, hitFrac: round3(state.edge * 0.9) },
  };
}

function thinkHuman(input) {
  const y = paddleCenterY(input.self);
  const keys = input.self.side === 'left' ? 'W/S' : 'arrows';
  return { targetY: y, debug: { control: keys } };
}

function thinkFun(input, state, spec) {
  const { ball, self, opponent, width, height, dt } = input;
  const dtSafe = dt > 0 ? dt : 1 / 60;
  const incoming = isIncoming(ball, self);
  const faceX = paddleFaceX(self);
  const dist = Math.abs(ball.x - faceX);
  const mid = height * 0.5;
  const here = paddleCenterY(self);

  state.t += dtSafe;
  if (state.smoothY == null) state.smoothY = here;

  if (incoming && !state.wasIncoming) {
    state.reactAt = state.t + spec.reactMin + Math.random() * spec.reactExtra;
  }
  state.wasIncoming = incoming;

  const late = incoming && dist < width * spec.chaseFrac && state.t >= state.reactAt;

  if (late) {
    const predicted = predictArrival(ball, faceX, width, height);
    const aim = ball.y * (1 - spec.predict) + predicted * spec.predict;
    const follow = 1 - Math.pow(spec.follow, dtSafe * 60);
    state.smoothY += (aim - state.smoothY) * follow;

    state.hesitateUntil = Math.max(0, state.hesitateUntil - dtSafe);
    state.overshootT = Math.max(0, state.overshootT - dtSafe);

    if (state.hesitateUntil <= 0 && state.overshootT <= 0 && Math.random() < spec.mistake * dtSafe * 60) {
      if (Math.random() < 0.5) {
        state.hesitateUntil = spec.hesitate[0] + Math.random() * spec.hesitate[1];
      } else {
        const dir = Math.random() < 0.3 ? (aim >= here ? -1 : 1) : (aim >= here ? 1 : -1);
        state.overshoot = dir * (spec.overshoot[0] + Math.random() * spec.overshoot[1]);
        state.overshootT = 0.14 + Math.random() * 0.18;
      }
    }

    if (state.hesitateUntil > 0) {
      state.mood = 'hesitate';
      return { targetY: here, debug: { mood: state.mood, skill: spec.speed, targetY: here } };
    }

    const wobble = Math.sin(state.t * 3.1) * spec.wobbleA + Math.sin(state.t * 1.1) * spec.wobbleB;
    let targetY = state.smoothY + wobble;
    if (state.overshootT > 0) {
      targetY += state.overshoot;
      state.mood = 'overshoot';
    } else {
      state.mood = 'chase';
    }

    targetY = clampPaddleCenter(targetY, self, height);
    return { targetY, debug: { mood: state.mood, skill: spec.speed, targetY } };
  }

  state.moodTimer -= dtSafe;
  if (state.moodTimer <= 0) {
    const farMoods = ['inspect', 'bounce', 'wander'];
    state.mood = farMoods[(Math.random() * farMoods.length) | 0];
    state.moodTimer = 0.5 + Math.random() * 1.1;
  }

  let targetY;
  if (state.mood === 'inspect') {
    targetY = paddleCenterY(opponent) + Math.sin(state.t * 2.2) * 40;
  } else if (state.mood === 'bounce') {
    targetY = here + Math.sin(state.t * 5.5) * Math.min(70, self.h * 0.7);
  } else {
    state.mood = 'wander';
    targetY = mid + Math.sin(state.t * 0.9) * height * 0.32;
  }

  targetY = clampPaddleCenter(targetY, self, height);
  return { targetY, debug: { mood: state.mood, targetY } };
}

function thinkSimple(input) {
  const { ball, self } = input;
  // Naive: chase the live ball, but only while it is coming this way.
  if (!isIncoming(ball, self)) {
    const targetY = paddleCenterY(self);
    return { targetY, debug: { tracking: true } };
  }
  return {
    targetY: ball.y,
    debug: { tracking: true },
  };
}

function isIncoming(ball, self) {
  const vx = ball.vx;
  if (self.side === 'left') return vx < 0;
  if (self.side === 'right') return vx > 0;
  return self.x + self.w * 0.5 < ball.x ? vx < 0 : vx > 0;
}

function paddleFaceX(self) {
  return self.side === 'left' ? self.x + self.w : self.x;
}

function paddleCenterY(paddle) {
  return paddle.y + paddle.h * 0.5;
}

function clampPaddleCenter(y, self, height) {
  const half = self.h * 0.5;
  return Math.max(half, Math.min(height - half, y));
}

function predictArrival(ball, targetX, width, height) {
  if (typeof predictBallY === 'function') {
    const y = predictBallY(ball, targetX, width, height, 6000);
    if (typeof y === 'number' && isFinite(y)) return y;
  }
  return ball.y;
}

function farEdge(opponent, height) {
  const opp = paddleCenterY(opponent);
  return opp > height * 0.5 ? -1 : 1;
}

function extremeContact(predictedY, self, height, edge) {
  const half = self.h * 0.5;
  // Ride the last ~10px of the paddle — still on the face, max angle.
  const tip = 10;
  const y = edge < 0 ? predictedY + half - tip : predictedY - half + tip;
  return clampPaddleCenter(y, self, height);
}

function coversBall(centerY, paddleH, ballY) {
  const top = centerY - paddleH * 0.5;
  return ballY > top + 2 && ballY < top + paddleH - 2;
}

function canReachBy(self, targetCenterY, time) {
  const speed = Math.max(self.speed || 0, Math.abs(self.vy) || 0);
  const dist = Math.abs(targetCenterY - paddleCenterY(self));
  const slack = 12;
  return dist <= speed * Math.max(0, time - 0.02) + slack;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
