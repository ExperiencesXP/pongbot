PongAI.register({
  id: 'perfectplus',
  label: 'Perfect+',
  create: function () {
    const U = PongAI.util;
    let state = {
      lockY: null,
      lockEta: null,
      lastIncoming: false,
      bounceKey: '',
    };
    return {
      reset: function () {
        state = { lockY: null, lockEta: null, lastIncoming: false, bounceKey: '' };
      },
      think: function (input) {
        const { ball, self, width, height, dt } = input;
        const incoming = U.isIncoming(ball, self);
        const here = U.paddleCenterY(self);

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

        const key = U.bounceKey(ball);
        if (!state.lastIncoming || key !== state.bounceKey || state.lockY == null) {
          const pred = U.predictArrivalTimed(ball, U.paddleFaceX(self), width, height);
          state.lockY = pred.y;
          state.lockEta = pred.time;
          state.bounceKey = key;
        } else {
          state.lockEta = Math.max(0, (state.lockEta || 0) - (dt > 0 ? dt : 1 / 60));
        }
        state.lastIncoming = true;

        const targetY = U.clampPaddleCenter(state.lockY, self, height);
        const dist = Math.abs(targetY - here);
        const eta = Math.max(state.lockEta, 1e-4);
        const moveSpeed = Math.min(self.speed || 620, dist / eta);
        return {
          targetY: targetY,
          moveSpeed: moveSpeed,
          debug: {
            predictedY: state.lockY,
            incoming: true,
            eta: U.round3(eta),
            moveSpeed: U.round3(moveSpeed),
          },
        };
      },
    };
  },
});
