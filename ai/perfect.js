PongAI.register({
  id: 'perfect',
  label: 'Perfect',
  create: function () {
    const U = PongAI.util;
    return {
      think: function (input) {
        const { ball, self, width, height } = input;
        const incoming = U.isIncoming(ball, self);
        const mid = height * 0.5;
        if (!incoming) {
          return {
            targetY: U.clampPaddleCenter(mid, self, height),
            debug: { predictedY: mid, incoming: false },
          };
        }
        const predictedY = U.predictArrival(ball, U.paddleFaceX(self), width, height);
        return {
          targetY: U.clampPaddleCenter(predictedY, self, height),
          debug: { predictedY: predictedY, incoming: true },
        };
      },
    };
  },
});
