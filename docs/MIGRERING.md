# Migrering

## Sådan tilføjer I en AI

1. Start serveren fra projektmappen: `npm start`
2. Åbn den URL, `npm start` printer (fx http://127.0.0.1:8080/). I Firefox: brug `127.0.0.1` hvis `localhost` fejler.
3. Kopier `ai/_skabelon.js` til fx `ai/hold3.js`
4. Gem og refresh siden

## To måder at skrive jeres AI på

### Nye metode (anbefalet)

```javascript
PongAI.register({
  id: 'hold3',
  label: 'Hold 3',
  create: function () {
    const U = PongAI.util;
    return {
      think: function (input) {
        const { ball, self, opponent, width, height, dt } = input;
        return { targetY: ball.y };
      },
      reset: function () {},
    };
  },
});
```

`think` kaldes hvert frame. Returnér `targetY` (Y for **paddle-centret**).

`input.self` og `input.opponent` har `x, y, w, h, speed, vy, side` (`'left'` / `'right'`).

Bolden har `x, y, vx, vy, radius, speed, hits, spin, lastEvent`.

### Legacy-stil

I kan paste den gamle `updateAI` / `updateAILeft` / `AI5` næsten 1:1.

**Metode A**: `PongAI.registerLegacy` (se `ai/_skabelon-legacy.js`):

```javascript
PongAI.registerLegacy({
  id: 'min-legacy',
  label: 'Min legacy AI',
  updateAI: function (ball, playerPaddle, aiPaddle) {
    if (ball.y < this.y + this.height / 2) this.y -= this.aiSpeed;
    if (ball.y > this.y + this.height / 2) this.y += this.aiSpeed;
  },
});
```

**Metode B**: Global funktion hvor filnavnet bliver id:

```javascript
function updateAI(ball, playerPaddle, aiPaddle) {
  if (ball.y < this.y + this.height / 2) this.y -= this.aiSpeed;
  if (ball.y > this.y + this.height / 2) this.y += this.aiSpeed;
}
```

Adapteren sørger for:

- `this` er jeres ketcher (`this.y`, `this.x`, `this.width`, `this.height`, `this.aiSpeed`)
- `ball.xSpeed` / `ball.ySpeed` er sat (alias for `vx` / `vy`)
- `ball.size` er sat (diameter)
- `playerPaddle` / `aiPaddle` (eller venstre/højre) peger på de rigtige objekter, og `this` er den ketcher I styrer
- `width` og `height` er stadig p5-globals
- `constrain()` findes stadig
- `this.aiSpeed` er pixels **dette frame** (skaleret med `dt`), så `this.y -= this.aiSpeed` stadig flytter ketcheren fornuftigt

Venstre-AI der bruger `updateAILeft` og `this.y` virker. Højre-AI der muterer `aiPaddle.y` virker, hvis I kalder `updateAI` som i `humanvsai.js`.

Hvis I har hjælpemetoder (`simulateArrivalY`, `movePaddleTo`, `AI5`), så læg dem på det samme objekt i `registerLegacy` og kald dem med `this`.

## Største forskelle

### 1. Fysikken er ikke længere deterministisk

I det gamle `ball.js` vendte et ketcher-hit kun `xSpeed` og gangede med 1.05. Banen kunne i princippet beregnes hele vejen.

Nu:

- Hvor på ketcheren bolden rammer, ændrer udgangsvinklen
- Vægge og ketchere lægger tilfældig støj på vinklen
- Ketcherens bevægelse (`vy`) giver spin
- Hastigheden stiger mere på ketcher-hit (×1.07) end på væg (×1.02)
- Efter mange hits i samme rally fjernes 1800-loftet

### 2. Tid og fart

Den nye engine bruger delta-time. Hastigheder er i **pixels pr. sekund**, ikke pr. frame.

- Ketcher-hastighed er typisk ~620 px/s
- Legacy-adapteren omregner til pixels/frame, så gammel kode ikke skal omskrives
- Ny kode bør bruge `dt` og `self.speed`

### 3. Boldens API

| Gammelt | Nyt |
|---|---|
| `ball.xSpeed` | `ball.vx` (legacy: begge findes på fake-bolden) |
| `ball.ySpeed` | `ball.vy` |
| `ball.size` | `ball.radius` (cirkel; diameter = 2·radius) |
| `delta` 1.05 overalt | `PongPhysics.SPEED_UP` / `WALL_SPEED_UP` |
| Ingen spin | `ball.spin` |
| Ingen hit-offset | `lastEvent.hitFrac` |

Væg-bounce i den gamle version tjekkede `y < 0 \|\| y > height` efter flytning og vendte `ySpeed`. Nu er bolden en cirkel, og væggen skubber den indenfor + støj.

### 4. Ketcherens API

| Gammelt | Nyt (`input.self`) |
|---|---|
| `this.width` / `this.height` | `self.w` / `self.h` |
| `this.aiSpeed` (px/frame) | `self.speed` (px/s) |
| `this.isPlayer` | `self.side === 'left'` |
| Flyt `this.y` direkte | Returnér `targetY` (centrum) |

Motoren flytter ketcheren hen imod `targetY` med den fælles ketcher-fart. AI’er kan ikke sætte deres egen hastighed.

## Hjælpere (`PongAI.util`)

- `isIncoming(ball, self)`
- `paddleFaceX(self)` / `paddleCenterY(paddle)`
- `clampPaddleCenter(y, self, height)`
- `predictArrival(ball, targetX, width, height)` — nul-støj-estimat af Y
- `predictArrivalTimed(...)` — samme, plus tid i sekunder