PongAI.register({
  id: 'ace',
  label: 'Ace',
  create: function () {
    const U = PongAI.util;
    let state = { edge: 1, wasIncoming: false };
    return {
      reset: function () { state = { edge: 1, wasIncoming: false }; },
      think: function (input) {
        const { ball, self, opponent, width, height } = input;
        const incoming = U.isIncoming(ball, self);
        const half = self.h * 0.5;
        const faceX = U.paddleFaceX(self);

        if (!incoming) {
          state.wasIncoming = false;
          state.edge = U.paddleCenterY(opponent) > height * 0.5 ? -1 : 1;
          const coil = height * (state.edge < 0 ? 0.22 : 0.78);
          return {
            targetY: U.clampPaddleCenter(coil, self, height),
            debug: { predictedY: coil, incoming: false, mode: 'coil', hitFrac: state.edge * 0.8 },
          };
        }

        const predictedY = U.predictArrival(ball, faceX, width, height);
        const timeToUs = Math.abs(faceX - ball.x) / Math.max(Math.abs(ball.vx), 1e-6);
        if (!state.wasIncoming) state.edge = U.farEdge(opponent, height);
        state.wasIncoming = true;

        const hitFrac = state.edge * 0.78;
        let contact = U.clampPaddleCenter(predictedY - hitFrac * half, self, height);
        if (!U.coversBall(contact, self.h, predictedY) || !U.canReachBy(self, contact, timeToUs)) {
          return {
            targetY: U.clampPaddleCenter(predictedY, self, height),
            debug: { predictedY: predictedY, incoming: true, mode: 'save', hitFrac: 0 },
          };
        }

        let targetY = contact;
        let mode = 'slash';
        if (timeToUs > 0.2) {
          targetY = U.clampPaddleCenter(predictedY + hitFrac * half * 1.15, self, height);
          mode = 'coil';
        }
        return {
          targetY: targetY,
          debug: { predictedY: predictedY, incoming: true, mode: mode, hitFrac: U.round3(hitFrac) },
        };
      },
    };
  },
});
