// Shared helpers for built-in AIs. Available as PongAI.util after registry loads.
(function () {
  const U = {};

  U.FUN_SKILL = {
    'fun-easy': {
      speed: 320, reactMin: 0.18, reactExtra: 0.22, chaseFrac: 0.42,
      follow: 0.90, wobbleA: 28, wobbleB: 14, mistake: 0.016,
      hesitate: [0.16, 0.28], overshoot: [40, 70], predict: 0.15,
    },
    fun: {
      speed: 420, reactMin: 0.08, reactExtra: 0.14, chaseFrac: 0.58,
      follow: 0.82, wobbleA: 16, wobbleB: 8, mistake: 0.008,
      hesitate: [0.08, 0.16], overshoot: [24, 44], predict: 0.45,
    },
    'fun-hard': {
      speed: 540, reactMin: 0.02, reactExtra: 0.08, chaseFrac: 0.78,
      follow: 0.70, wobbleA: 7, wobbleB: 4, mistake: 0.003,
      hesitate: [0.04, 0.10], overshoot: [12, 24], predict: 0.75,
    },
  };

  U.makeFunState = function () {
    return {
      t: 0, smoothY: null, mood: 'wander', moodTimer: 0,
      hesitateUntil: 0, overshootT: 0, overshoot: 0, reactAt: 0, wasIncoming: false,
    };
  };

  U.isIncoming = function (ball, self) {
    const vx = ball.vx;
    if (self.side === 'left') return vx < 0;
    if (self.side === 'right') return vx > 0;
    return self.x + self.w * 0.5 < ball.x ? vx < 0 : vx > 0;
  };

  U.paddleFaceX = function (self) {
    return self.side === 'left' ? self.x + self.w : self.x;
  };

  U.paddleCenterY = function (paddle) {
    return paddle.y + paddle.h * 0.5;
  };

  U.clampPaddleCenter = function (y, self, height) {
    const half = self.h * 0.5;
    return Math.max(half, Math.min(height - half, y));
  };

  U.predictArrival = function (ball, targetX, width, height) {
    if (typeof predictBallY === 'function') {
      const y = predictBallY(ball, targetX, width, height, 6000);
      if (typeof y === 'number' && isFinite(y)) return y;
    }
    return ball.y;
  };

  U.predictArrivalTimed = function (ball, targetX, width, height) {
    if (typeof predictBallArrival === 'function') {
      const pred = predictBallArrival(ball, targetX, width, height, 12000);
      if (pred && typeof pred.y === 'number' && isFinite(pred.y)) {
        return { y: pred.y, time: Math.max(0, pred.time || 0) };
      }
    }
    const y = U.predictArrival(ball, targetX, width, height);
    const time = Math.abs(targetX - ball.x) / Math.max(Math.abs(ball.vx), 1e-6);
    return { y: y, time: time };
  };

  U.farEdge = function (opponent, height) {
    return U.paddleCenterY(opponent) > height * 0.5 ? -1 : 1;
  };

  U.extremeContact = function (predictedY, self, height, edge) {
    const half = self.h * 0.5;
    const tip = 10;
    const y = edge < 0 ? predictedY + half - tip : predictedY - half + tip;
    return U.clampPaddleCenter(y, self, height);
  };

  U.coversBall = function (centerY, paddleH, ballY) {
    const top = centerY - paddleH * 0.5;
    return ballY > top + 2 && ballY < top + paddleH - 2;
  };

  U.canReachBy = function (self, targetCenterY, time) {
    const speed = Math.max(self.speed || 0, Math.abs(self.vy) || 0);
    const dist = Math.abs(targetCenterY - U.paddleCenterY(self));
    return dist <= speed * Math.max(0, time - 0.02) + 12;
  };

  U.round3 = function (n) {
    return Math.round(n * 1000) / 1000;
  };

  U.bounceKey = function (ball) {
    const ev = ball.lastEvent || {};
    const spd = ev.speed != null ? Number(ev.speed).toFixed(2) : '';
    const noise = ev.noise != null ? Number(ev.noise).toFixed(4) : '';
    return String(ev.type || '') + ':' + (ball.hits || 0) + ':' + spd + ':' + noise;
  };

  U.thinkFun = function (input, state, spec) {
    const { ball, self, opponent, width, height, dt } = input;
    const dtSafe = dt > 0 ? dt : 1 / 60;
    const incoming = U.isIncoming(ball, self);
    const faceX = U.paddleFaceX(self);
    const dist = Math.abs(ball.x - faceX);
    const mid = height * 0.5;
    const here = U.paddleCenterY(self);

    state.t += dtSafe;
    if (state.smoothY == null) state.smoothY = here;

    if (incoming && !state.wasIncoming) {
      state.reactAt = state.t + spec.reactMin + Math.random() * spec.reactExtra;
    }
    state.wasIncoming = incoming;

    const late = incoming && dist < width * spec.chaseFrac && state.t >= state.reactAt;

    if (late) {
      const predicted = U.predictArrival(ball, faceX, width, height);
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

      return {
        targetY: U.clampPaddleCenter(targetY, self, height),
        debug: { mood: state.mood, skill: spec.speed, targetY: targetY },
      };
    }

    state.moodTimer -= dtSafe;
    if (state.moodTimer <= 0) {
      const farMoods = ['inspect', 'bounce', 'wander'];
      state.mood = farMoods[(Math.random() * farMoods.length) | 0];
      state.moodTimer = 0.5 + Math.random() * 1.1;
    }

    let targetY;
    if (state.mood === 'inspect') {
      targetY = U.paddleCenterY(opponent) + Math.sin(state.t * 2.2) * 40;
    } else if (state.mood === 'bounce') {
      targetY = here + Math.sin(state.t * 5.5) * Math.min(70, self.h * 0.7);
    } else {
      state.mood = 'wander';
      targetY = mid + Math.sin(state.t * 0.9) * height * 0.32;
    }

    return {
      targetY: U.clampPaddleCenter(targetY, self, height),
      debug: { mood: state.mood, targetY: targetY },
    };
  };

  window.PongAIUtil = U;
})();
