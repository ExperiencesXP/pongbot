PongAI.register({
  id: 'trickster',
  label: 'Trickshot',
  create: function () {
    const U = PongAI.util;
    let state = { wasIncoming: false, idleY: null, edge: 1 };
    return {
      reset: function () { state = { wasIncoming: false, idleY: null, edge: 1 }; },
      think: function (input) {
        const { ball, self, opponent, width, height } = input;
        const incoming = U.isIncoming(ball, self);
        const mid = height * 0.5;
        const half = self.h * 0.5;
        const faceX = U.paddleFaceX(self);

        if (!incoming) {
          if (state.wasIncoming || state.idleY == null) {
            state.edge = ball.vy < 0 ? 1 : -1;
            if (Math.random() < 0.35) state.edge *= -1;
            state.idleY = height * (state.edge < 0 ? 0.2 : 0.8);
          }
          state.wasIncoming = false;
          return {
            targetY: U.clampPaddleCenter(state.idleY, self, height),
            debug: { predictedY: ball.y, edge: state.edge < 0 ? 'top' : 'bottom', mode: 'coil' },
          };
        }

        if (!state.wasIncoming) {
          state.edge = ball.vy < 0 ? -1 : 1;
          const opp = U.paddleCenterY(opponent);
          if (state.edge < 0 && opp < mid - height * 0.12) state.edge = 1;
          else if (state.edge > 0 && opp > mid + height * 0.12) state.edge = -1;
        }
        state.wasIncoming = true;

        const predictedY = U.predictArrival(ball, faceX, width, height);
        const timeToUs = Math.abs(faceX - ball.x) / Math.max(Math.abs(ball.vx), 1e-6);
        const contact = U.extremeContact(predictedY, self, height, state.edge);
        const here = U.paddleCenterY(self);
        const reach = (self.speed || 620) * Math.max(0, timeToUs - 0.015) + 10;
        let hitAt = contact;
        if (Math.abs(contact - here) > reach) {
          const reachable = here + Math.sign(contact - here) * reach;
          hitAt = U.coversBall(reachable, self.h, predictedY) ? reachable : predictedY;
        }

        let targetY = hitAt;
        let mode = 'slash';
        if (timeToUs > 0.16) {
          targetY = U.clampPaddleCenter(predictedY + state.edge * half * 1.35, self, height);
          mode = 'windup';
        }
        return {
          targetY: U.clampPaddleCenter(targetY, self, height),
          debug: {
            predictedY: predictedY,
            edge: state.edge < 0 ? 'top' : 'bottom',
            mode: mode,
            hitFrac: U.round3(state.edge * 0.9),
          },
        };
      },
    };
  },
});
