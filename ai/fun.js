PongAI.register({
  id: 'fun',
  label: 'Fun (Normal)',
  create: function () {
    const spec = PongAI.util.FUN_SKILL.fun;
    let state = PongAI.util.makeFunState();
    return {
      reset: function () { state = PongAI.util.makeFunState(); },
      think: function (input) { return PongAI.util.thinkFun(input, state, spec); },
    };
  },
});
