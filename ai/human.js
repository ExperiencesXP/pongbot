// 100% AI
PongAI.register({
  id: 'human',
  label: 'Human',
  create: function () {
    return {
      think: function (input) {
        const y = input.self.y + input.self.h * 0.5;
        const keys = input.self.side === 'left' ? 'W/S' : 'arrows';
        return { targetY: y, debug: { control: keys } };
      },
    };
  },
});
