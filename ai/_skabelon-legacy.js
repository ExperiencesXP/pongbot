// Legacy-skabelon. Kopiér til ai/min-legacy.js (uden underscore).
// Du kan paste updateAI / updateAILeft / AI5 direkte — eller lade
// funktionen hedde updateAI i global scope, så fanger registry den.

// Variant A — anbefalet: registrér eksplicit
PongAI.registerLegacy({
  id: 'min-legacy',
  label: 'Min legacy AI',
  updateAI: function (ball, playerPaddle, aiPaddle) {
    // this.y / this.aiSpeed virker som i det gamle spil.
    // ball.xSpeed og ball.ySpeed er aliased fra vx/vy.
    if (ball.y < this.y + this.height / 2) this.y -= this.aiSpeed;
    if (ball.y > this.y + this.height / 2) this.y += this.aiSpeed;
  },
});

// Variant B — bare en global funktion. Filnavnet bliver id'et.
// function updateAI(ball, playerPaddle, aiPaddle) {
//   if (ball.y < this.y + this.height / 2) this.y -= this.aiSpeed;
//   if (ball.y > this.y + this.height / 2) this.y += this.aiSpeed;
// }
