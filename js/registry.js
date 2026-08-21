// Drop a file in /ai and it is picked up automatically (via /ai/manifest.json).
// Modern AIs call PongAI.register(...). Legacy updateAI / updateAILeft / AI5
// functions are wrapped so old student code still runs.
const PongAI = (function () {
  const registry = [];
  const byId = Object.create(null);
  const LEGACY_GLOBALS = ['updateAI', 'updateAILeft', 'AI5', 'AI1', 'AI2', 'AI3', 'AI4'];

  function util() {
    return window.PongAIUtil || {};
  }

  function register(def) {
    if (!def || !def.id) {
      console.warn('PongAI.register: missing id');
      return;
    }
    const entry = {
      id: String(def.id),
      label: def.label || String(def.id),
      create: def.create || function () { return wrapDef(def); },
      legacy: !!def.legacy,
    };
    const existing = registry.findIndex(function (e) { return e.id === entry.id; });
    if (existing >= 0) registry[existing] = entry;
    else registry.push(entry);
    byId[entry.id] = entry;
  }

  function registerLegacy(def) {
    const id = def && def.id;
    if (!id) {
      console.warn('PongAI.registerLegacy: missing id');
      return;
    }
    register({
      id: id,
      label: def.label || id,
      legacy: true,
      create: function () { return createLegacyController(def); },
    });
  }

  function wrapDef(def) {
    let state = def.state ? def.state() : {};
    return {
      think: function (input) {
        if (typeof def.think === 'function') return def.think(input, state);
        return { targetY: input.self.y + input.self.h * 0.5 };
      },
      reset: function () {
        state = def.state ? def.state() : {};
        if (typeof def.reset === 'function') def.reset(state);
      },
    };
  }

  function list() {
    return registry.map(function (e) {
      return { id: e.id, label: e.label };
    });
  }

  function create(id) {
    const e = byId[id] || byId.simple || registry[0];
    if (!e) {
      return {
        id: 'none',
        label: 'None',
        think: function (input) {
          return { targetY: input.self.y + input.self.h * 0.5 };
        },
        reset: function () {},
      };
    }
    const inst = e.create() || {};
    inst.id = e.id;
    inst.label = e.label;
    if (typeof inst.reset !== 'function') inst.reset = function () {};
    if (typeof inst.think !== 'function') {
      inst.think = function (input) {
        return { targetY: input.self.y + input.self.h * 0.5 };
      };
    }
    return inst;
  }

  function snapshotGlobals() {
    const snap = {};
    for (let i = 0; i < LEGACY_GLOBALS.length; i++) {
      const k = LEGACY_GLOBALS[i];
      snap[k] = window[k];
    }
    return snap;
  }

  function harvestLegacy(filename, before) {
    const base = filename.replace(/\.js$/i, '');
    if (byId[base]) return;

    const methods = {};
    let found = false;
    for (let i = 0; i < LEGACY_GLOBALS.length; i++) {
      const k = LEGACY_GLOBALS[i];
      const fn = window[k];
      if (typeof fn === 'function' && fn !== before[k]) {
        methods[k] = fn;
        found = true;
      }
    }
    if (!found) return;

    registerLegacy({
      id: base,
      label: prettyName(base),
      updateAI: methods.updateAI,
      updateAILeft: methods.updateAILeft,
      AI5: methods.AI5,
      AI1: methods.AI1,
      AI2: methods.AI2,
      AI3: methods.AI3,
      AI4: methods.AI4,
    });

    for (let j = 0; j < LEGACY_GLOBALS.length; j++) {
      const key = LEGACY_GLOBALS[j];
      if (typeof window[key] === 'function' && window[key] !== before[key]) {
        try { delete window[key]; } catch (err) { window[key] = undefined; }
      }
    }
  }

  function prettyName(id) {
    return String(id)
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function listFromDirHtml(html) {
    const files = [];
    const re = /href\s*=\s*["']([^"']+\.js)["']/gi;
    let m;
    while ((m = re.exec(html))) {
      const name = m[1].split('/').pop();
      if (name && name.charAt(0) !== '_') files.push(name);
    }
    return files;
  }

  async function discover() {
    try {
      const r = await fetch('ai/manifest.json', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j && Array.isArray(j.files) && j.files.length) return j.files;
      }
    } catch (e) {}

    if (Array.isArray(window.__AI_FILES__) && window.__AI_FILES__.length) {
      return window.__AI_FILES__;
    }

    try {
      const r2 = await fetch('ai/', { cache: 'no-store' });
      if (r2.ok) {
        const listed = listFromDirHtml(await r2.text());
        if (listed.length) return listed;
      }
    } catch (e2) {}

    return [];
  }

  async function boot() {
    const files = await discover();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f || f.charAt(0) === '_') continue;
      const snap = snapshotGlobals();
      try {
        await loadScript('ai/' + f);
      } catch (err) {
        console.warn(err);
        continue;
      }
      harvestLegacy(f, snap);
    }
    if (!registry.length) {
      console.warn('PongAI: no AIs loaded. Run `npm start` so /ai/manifest.json can list the folder.');
    }
  }

  function makeFakePaddle(p, dt) {
    const frame = Math.max(1, (p.speed || 620) * (dt > 0 ? dt : 1 / 60));
    return {
      x: p.x,
      y: p.y,
      width: p.w,
      height: p.h,
      w: p.w,
      h: p.h,
      speed: frame,
      aiSpeed: frame,
      isPlayer: p.side === 'left',
      side: p.side,
    };
  }

  function makeFakeBall(b) {
    const size = (b.radius != null ? b.radius : 10) * 2;
    return {
      x: b.x,
      y: b.y,
      size: size,
      radius: b.radius,
      xSpeed: b.vx,
      ySpeed: b.vy,
      vx: b.vx,
      vy: b.vy,
      delta: (typeof PongPhysics !== 'undefined' && PongPhysics.SPEED_UP) || 1.07,
    };
  }

  function createLegacyController(def) {
    return {
      think: function (input) {
        const dt = input.dt > 0 ? input.dt : 1 / 60;
        const fakeSelf = makeFakePaddle(input.self, dt);
        const fakeOpp = makeFakePaddle(input.opponent, dt);
        const fakeBall = makeFakeBall(input.ball);
        const left = input.self.side === 'left' ? fakeSelf : fakeOpp;
        const right = input.self.side === 'right' ? fakeSelf : fakeOpp;

        const ctx = fakeSelf;
        for (const k in def) {
          if (typeof def[k] === 'function' && k !== 'think' && k !== 'create') {
            ctx[k] = def[k];
          }
        }

        if (typeof def.updateAILeft === 'function' && input.self.side === 'left') {
          def.updateAILeft.call(ctx, fakeBall, left, right);
        } else if (typeof def.updateAI === 'function') {
          def.updateAI.call(ctx, fakeBall, left, right);
        } else if (typeof def.AI5 === 'function') {
          def.AI5.call(ctx, fakeBall, fakeOpp, fakeSelf);
        } else if (typeof def.AI1 === 'function') {
          def.AI1.call(ctx, fakeBall, left, right);
        }

        const y = ctx.y;
        return {
          targetY: y + ctx.height / 2,
          debug: { legacy: true },
        };
      },
      reset: function () {},
    };
  }

  return {
    register: register,
    registerLegacy: registerLegacy,
    list: list,
    create: create,
    boot: boot,
    get util() { return util(); },
  };
})();
