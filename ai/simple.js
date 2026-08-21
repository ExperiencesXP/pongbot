PongAI.register({
  id: 'simple',
  label: 'Simple',
  create: function () {
    const U = PongAI.util;
    return {
      think: function (input) {
        const { ball, self } = input;
        if (!U.isIncoming(ball, self)) {
          const targetY = U.paddleCenterY(self);
          return { targetY: targetY, debug: { tracking: true } };
        }
        return { targetY: ball.y, debug: { tracking: true } };
      },
    };
  },
});
