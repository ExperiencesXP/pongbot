PongAI.register({
  id: 'fun-hard',
  label: 'Fun (Hard)',
  create: function () {
    const spec = PongAI.util.FUN_SKILL['fun-hard'];
    let state = PongAI.util.makeFunState();
    return {
      reset: function () { state = PongAI.util.makeFunState(); },
      think: function (input) { return PongAI.util.thinkFun(input, state, spec); },
    };
  },
});
