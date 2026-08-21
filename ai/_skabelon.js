// Kopiér denne fil til fx ai/min-bot.js (uden underscore i starten).
// Gem, genindlæs spillet — den dukker op i dropdowns automatisk.

PongAI.register({
  id: 'min-bot',
  label: 'Min bot',
  create: function () {
    const U = PongAI.util;
    return {
      reset: function () {},
      think: function (input) {
        const { ball, self, opponent, width, height, dt } = input;
        // Returnér Y for paddle-centret. Motoren styrer farten.
        const incoming = U.isIncoming(ball, self);
        const targetY = incoming
          ? U.predictArrival(ball, U.paddleFaceX(self), width, height)
          : height * 0.5;
        return {
          targetY: U.clampPaddleCenter(targetY, self, height),
          debug: { incoming: incoming },
        };
      },
    };
  },
});
