/* =====================================================================
   Mundo Torajo — Vila de Verade (protótipo greybox)
   Three.js (global THREE via CDN). Sem build tools.
   ===================================================================== */
'use strict';

(() => {
  // ---------------------------------------------------------------
  // Configuração geral
  // ---------------------------------------------------------------
  const CONFIG = {
    gravity: 30,
    radius: 0.45,        // raio de colisão dos personagens
    stepHeight: 0.45,    // degrau que dá pra subir andando
    groundMargin: 0.25,  // tolerância do "pé" na borda das plataformas
    killY: -30,          // abaixo disso: respawn
    totalCoins: 5,
  };

  const STATS = {
    torajo: { speed: 7,  jump: 12, jumps: 1, glide: false, dashSpeed: 20, dashTime: 0.22 },
    zulmi:  { speed: 14, jump: 12, jumps: 2, glide: false, dashSpeed: 26, dashTime: 0.22 },
    linn:   { speed: 7,  jump: 11, jumps: 1, glide: true,  dashSpeed: 20, dashTime: 0.22,
              glideFall: 2.5, glideSpeedMul: 1.3 },
    morajo: { speed: 8,  jump: 12, jumps: 1, glide: false, dashSpeed: 20, dashTime: 0.22 },
  };

  // ---------------------------------------------------------------
  // Efeitos sonoros procedurais (Web Audio API, sem arquivos)
  // ---------------------------------------------------------------
  const Sfx = (() => {
    let ctx = null;
    let master = null;
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);

    function init() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.22;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    }

    function tone({ type = 'square', f0 = 440, f1 = null, dur = 0.15, vol = 0.3, delay = 0 }) {
      if (!ctx) return;
      const t0 = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }

    function noise({ dur = 0.2, vol = 0.3, f0 = 2000, f1 = 400, delay = 0 }) {
      if (!ctx) return;
      const t0 = ctx.currentTime + delay;
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(f0, t0);
      f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t0);
    }

    const arp = (notes, step, type = 'square', vol = 0.25, len = step * 1.6) =>
      notes.forEach((n, i) => tone({ type, f0: midi(n), dur: len, vol, delay: i * step }));

    return {
      init,
      jump:       () => tone({ f0: 260, f1: 560, dur: 0.14, vol: 0.22 }),
      doubleJump: () => tone({ f0: 420, f1: 980, dur: 0.16, vol: 0.22 }),
      land:       () => noise({ dur: 0.08, vol: 0.25, f0: 500, f1: 150 }),
      dash: () => {
        noise({ dur: 0.22, vol: 0.35, f0: 3000, f1: 300 });
        tone({ type: 'triangle', f0: 220, f1: 80, dur: 0.2, vol: 0.25 });
      },
      throwCam: () => {
        tone({ type: 'triangle', f0: 1000, f1: 300, dur: 0.22, vol: 0.3 });
        noise({ dur: 0.15, vol: 0.15, f0: 4000, f1: 1500 });
      },
      capture: () => arp([72, 76, 79, 84, 88], 0.06),
      release: () => arp([84, 79, 72], 0.05, 'square', 0.18),
      like: () => {
        tone({ type: 'sine', f0: 1320, dur: 0.07, vol: 0.25 });
        tone({ type: 'sine', f0: 1760, dur: 0.14, vol: 0.25, delay: 0.05 });
      },
      coin: () => {
        tone({ f0: midi(83), dur: 0.09, vol: 0.25 });
        tone({ f0: midi(88), dur: 0.45, vol: 0.25, delay: 0.08 });
      },
      glitch: () => {
        for (let i = 0; i < 6; i++) {
          tone({ type: 'sawtooth', f0: 200 + Math.random() * 900, dur: 0.05, vol: 0.12, delay: i * 0.045 });
        }
      },
      portalOpen: () => {
        arp([60, 64, 67, 72, 76, 79, 84], 0.09, 'triangle', 0.3, 0.5);
        noise({ dur: 1.2, vol: 0.15, f0: 300, f1: 3000 });
      },
      victory: () => {
        const melody = [[72, 0.15], [76, 0.15], [79, 0.15], [84, 0.3], [79, 0.15], [84, 0.6]];
        let t = 0;
        for (const [n, d] of melody) {
          tone({ f0: midi(n), dur: d * 0.95, vol: 0.25, delay: t });
          tone({ type: 'triangle', f0: midi(n - 24), dur: d * 0.95, vol: 0.3, delay: t });
          t += d;
        }
      },
    };
  })();

  // ---------------------------------------------------------------
  // Utilitários
  // ---------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
  function lerpAngle(a, b, t) {
    const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.0, ...extra });

  function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    return m;
  }

  function makeTextSprite(text, color = '#ffffff', bg = 'rgba(20,16,50,0.7)') {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 28);
    ctx.fill();
    ctx.font = 'bold 34px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(2, 0.5, 1);
    sp.renderOrder = 10;
    return sp;
  }

  // ---------------------------------------------------------------
  // Renderer, cena, câmera e luzes
  // ---------------------------------------------------------------
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const SKY = 0x8fd8ff;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 70, 180);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5c9a5a, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------------------------------------------------------------
  // Mundo: colisores (caixas e rampas) + construção do mapa
  // ---------------------------------------------------------------
  const colliders = [];
  const secretMeshes = [];
  let secretActive = false;   // true enquanto o Morajo está sendo controlado
  const isSolid = c => !c.secret || secretActive;

  // Plataformas do "Hack do Algoritmo": invisíveis/intangíveis até o Morajo ser capturado
  const secretMat = new THREE.MeshStandardMaterial({
    color: 0xff2a6a, emissive: 0x9a1aff, emissiveIntensity: 0.9,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const secretEdgeMat = new THREE.LineBasicMaterial({ color: 0xff9ae6, transparent: true, opacity: 0 });
  let secretFade = 0;

  function addSecretBox(cx, top, cz, w, h, d) {
    colliders.push({
      type: 'box', secret: true,
      minX: cx - w / 2, maxX: cx + w / 2,
      minY: top - h, maxY: top,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    });
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, secretMat);
    m.position.set(cx, top - h / 2, cz);
    m.visible = false;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), secretEdgeMat));
    scene.add(m);
    secretMeshes.push(m);
  }

  function updateSecrets(dt, t) {
    secretFade += ((secretActive ? 1 : 0) - secretFade) * damp(6, dt);
    const on = secretFade > 0.02;
    secretMat.opacity = secretFade * (0.45 + Math.sin(t * 7) * 0.1);
    secretEdgeMat.opacity = secretFade;
    for (const m of secretMeshes) {
      m.visible = on;
      m.castShadow = secretActive;
      // leve "glitch" visual (só a escala pisca; a colisão não muda)
      m.scale.x = secretActive && Math.random() < 0.03 ? 1.06 : 1;
    }
  }

  /** Caixa sólida. `top` = altura do topo (facilita montar o mapa). */
  function addBox(cx, top, cz, w, h, d, color, { visible = true, cast = true } = {}) {
    colliders.push({
      type: 'box',
      minX: cx - w / 2, maxX: cx + w / 2,
      minY: top - h, maxY: top,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    });
    if (!visible) return null;
    const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color), cx, top - h / 2, cz);
    m.castShadow = cast;
    scene.add(m);
    return m;
  }

  /** Rampa: h0 na coordenada mínima do eixo, h1 na máxima. */
  function addRamp(x0, x1, z0, z1, axis, h0, h1, color) {
    colliders.push({ type: 'ramp', minX: x0, maxX: x1, minZ: z0, maxZ: z1, axis, h0, h1 });
    const len = axis === 'z' ? z1 - z0 : x1 - x0;
    const width = axis === 'z' ? x1 - x0 : z1 - z0;
    const rise = h1 - h0;
    const angle = Math.atan2(rise, len);
    const slope = Math.hypot(len, rise);
    const th = 0.4;
    const geo = axis === 'z'
      ? new THREE.BoxGeometry(width, th, slope)
      : new THREE.BoxGeometry(slope, th, width);
    const m = mesh(geo, mat(color), (x0 + x1) / 2, (h0 + h1) / 2 - th / 2 / Math.cos(angle), (z0 + z1) / 2);
    if (axis === 'z') m.rotation.x = -angle; else m.rotation.z = angle;
    scene.add(m);
    // faixas decorativas na rampa
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const s = mesh(new THREE.BoxGeometry(axis === 'z' ? width * 0.9 : 0.15, 0.05, axis === 'z' ? 0.15 : width * 0.9),
        mat(0xffffff), 0, 0, 0, false);
      s.position.set(
        axis === 'x' ? x0 + len * t : (x0 + x1) / 2,
        h0 + rise * t + 0.03,
        axis === 'z' ? z0 + len * t : (z0 + z1) / 2,
      );
      s.rotation.copy(m.rotation);
      scene.add(s);
    }
  }

  /** Ilha flutuante: topo de grama em y=0 + "raiz" de terra decorativa. */
  function addIsland(cx, cz, w, d, grass = 0x6ad04f) {
    addBox(cx, 0, cz, w, 1.2, d, grass);
    const dirt = mesh(new THREE.BoxGeometry(w * 0.94, 3, d * 0.94), mat(0xa0673a), cx, -2.7, cz);
    scene.add(dirt);
    const root = mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.35, 0.5, 6, 6), mat(0x8a5530), cx, -7.2, cz);
    scene.add(root);
  }

  function addTree(x, z, groundY = 0, canopy = 0x2fb84a) {
    const trunk = mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.4, 8), mat(0x8b5a2b), x, groundY + 1.2, z);
    const top = mesh(new THREE.SphereGeometry(1.4, 12, 10), mat(canopy), x, groundY + 3.1, z);
    scene.add(trunk, top);
    addBox(x, groundY + 2.4, z, 0.8, 2.4, 0.8, 0, { visible: false });
  }

  function addHouse(x, z, wallColor, roofColor, w = 4, h = 3.5) {
    addBox(x, h, z, w, h, w, wallColor);
    const roof = mesh(new THREE.ConeGeometry(w * 0.78, 2.2, 4), mat(roofColor), x, h + 1.1, z);
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);
    const door = mesh(new THREE.BoxGeometry(0.9, 1.6, 0.1), mat(0x6b3b1f), x, 0.8, z + w / 2 + 0.02, false);
    scene.add(door);
  }

  function addSign(x, z, text, rotY = 0) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 6), mat(0x8b5a2b), -1.2, 1, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 6), mat(0x8b5a2b), 1.2, 1, 0));
    const c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c98a4b'; ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#7a4a1f'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, 500, 148);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 64px Segoe UI, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 84);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = mesh(new THREE.BoxGeometry(3.2, 1, 0.12),
      [mat(0xc98a4b), mat(0xc98a4b), mat(0xc98a4b), mat(0xc98a4b), mat(0xffffff, { map: tex }), mat(0xc98a4b)],
      0, 1.8, 0);
    g.add(board);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
  }

  function buildWorld() {
    // Oceano lá embaixo
    const water = new THREE.Mesh(new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ color: 0x2a8bd8, roughness: 0.3, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -14;
    water.receiveShadow = true;
    scene.add(water);

    // --- Ilha principal (Vila de Verade) ---
    addIsland(0, 0, 50, 50);
    addSign(-4, 6, 'Vila de Verade', 0.25);

    addHouse(-10, -8, 0xfff1c9, 0xff5a5a);
    addHouse(-16, 14, 0xd6f0ff, 0x4a7bff);
    addHouse(14, -18, 0xffe0f0, 0xb44aff);

    // Estúdio (teto plano) com caixote para subir -> Botão #4
    addBox(8, 4, -8, 5, 4, 5, 0xff5fa2);
    addBox(11.5, 2, -8, 2, 2, 2, 0xc98a4b);
    const logo = mesh(new THREE.BoxGeometry(2.2, 1.5, 0.1), mat(0xff2a2a), 8, 2.4, -5.48, false);
    const tri = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 3), mat(0xffffff), 0, 0, 0, false);
    tri.rotation.x = Math.PI / 2;
    const triG = new THREE.Group(); triG.add(tri); triG.rotation.z = Math.PI / 2; triG.position.z = 0.04;
    logo.add(triG);
    scene.add(logo);

    // Escadinha oeste + plataforma flutuante alta (só com pulo duplo) -> Botão #3
    addBox(-12, 1.5, 10, 3, 1.5, 3, 0xffb347);
    addBox(-15, 3.5, 6, 3, 3.5, 3, 0xff8c42);
    addBox(-18, 5.5, 2, 3, 5.5, 3, 0xff6b35);
    addBox(-18, 8.5, -3, 4, 1, 4, 0x7b5cff);

    // Rampa leste até o mirante
    addRamp(14, 22, 12, 16, 'x', 0, 3, 0xffd84d);
    addBox(23.5, 3, 14, 3, 3, 8, 0x3fd0ff);

    // Torre norte (Linn espera no topo) + rampa de acesso
    addBox(0, 8, -21, 8, 8, 8, 0x58c4a0);
    addRamp(-2, 2, -17, -5, 'z', 8, 0, 0xffd84d);

    // Árvores
    [[-22, 20], [18, 20], [20, -6], [-6, 20], [6, 18], [-22, -2]].forEach(([x, z], i) =>
      addTree(x, z, 0, i % 2 ? 0x2fb84a : 0x46d36b));

    // --- Plataforma no céu (só alcançável pelo Hack do Morajo) -> Botão #4 ---
    addBox(SKY_SPOT.x, 20, SKY_SPOT.z, 6, 1, 6, 0x5a1a8a);
    const antenna = mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), mat(0xdddddd), SKY_SPOT.x + 2.2, 21.25, SKY_SPOT.z - 2.2);
    const bulb = mesh(new THREE.SphereGeometry(0.25, 10, 8), mat(0xff2a6a, { emissive: 0xff0040 }), SKY_SPOT.x + 2.2, 22.6, SKY_SPOT.z - 2.2);
    scene.add(antenna, bulb);
    // Espiral secreta: 9 degraus de +2u em volta da plataforma do céu
    for (let i = 1; i <= 9; i++) {
      const a = Math.PI + i * 0.8;
      addSecretBox(SKY_SPOT.x + Math.cos(a) * 5.5, i * 2, SKY_SPOT.z + Math.sin(a) * 5.5, 2.6, 0.5, 2.6);
    }

    // --- Ilha leste (abismo de 12u: Zulmi) -> Botão #1 ---
    addIsland(47, 0, 20, 20, 0x8be05a);
    addBox(52, 3, -5, 2, 3, 2, 0xff5fa2);
    addTree(51, 6, 0, 0xffa23f);
    addSign(39.5, -6, 'Ilha Leste', -Math.PI / 2);

    // --- Plataforma no meio do planeio -> Botão #5 ---
    addBox(0, 4, -38, 4, 1, 4, 0xff8c1a);

    // --- Ilha norte (abismo de 26u: Linn plana) -> Botão #2 ---
    addIsland(0, -57, 16, 12, 0x9be86b);
    addTree(-5, -60, 0, 0xffd84d);
    addTree(5, -60, 0, 0xff7ab8);

    // Nuvens decorativas
    const cloudMat = mat(0xffffff, { roughness: 1 });
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const n = 3 + (i % 3);
      for (let j = 0; j < n; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 1.5, 10, 8), cloudMat);
        s.position.set(j * 2.4 - n, Math.random(), Math.random() * 1.5);
        g.add(s);
      }
      const a = (i / 14) * Math.PI * 2;
      const r = 70 + Math.random() * 40;
      g.position.set(Math.cos(a) * r, 18 + Math.random() * 14, Math.sin(a) * r - 15);
      g.userData.speed = 0.5 + Math.random();
      clouds.push(g);
      scene.add(g);
    }
  }

  const clouds = [];
  const SKY_SPOT = { x: -16, z: -16 };   // centro da espiral secreta do Morajo

  /** Posição do topo do degrau secreto i (1..9) — usada pelos Likes da espiral. */
  function secretStepTop(i) {
    const a = Math.PI + i * 0.8;
    return new THREE.Vector3(SKY_SPOT.x + Math.cos(a) * 5.5, i * 2, SKY_SPOT.z + Math.sin(a) * 5.5);
  }

  function surfaceTop(c, x, z) {
    if (c.type === 'box') return c.maxY;
    const t = c.axis === 'z' ? (z - c.minZ) / (c.maxZ - c.minZ) : (x - c.minX) / (c.maxX - c.minX);
    return c.h0 + (c.h1 - c.h0) * clamp(t, 0, 1);
  }

  /** Maior topo de superfície sob (x,z) que esteja abaixo de maxY. */
  function groundAt(x, z, maxY) {
    const m = CONFIG.groundMargin;
    let best = -Infinity;
    for (const c of colliders) {
      if (!isSolid(c)) continue;
      if (x < c.minX - m || x > c.maxX + m || z < c.minZ - m || z > c.maxZ + m) continue;
      const top = surfaceTop(c, x, z);
      if (top <= maxY && top > best) best = top;
    }
    return best;
  }

  /** Menor fundo de caixa acima de minY sob (x,z) — teto. */
  function ceilingAt(x, z, minY) {
    let best = Infinity;
    for (const c of colliders) {
      if (c.type !== 'box' || !isSolid(c)) continue;
      if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
      if (c.minY >= minY - 0.01 && c.minY < best) best = c.minY;
    }
    return best;
  }

  function pointInsideBox(p) {
    return colliders.some(c => c.type === 'box' && isSolid(c) &&
      p.x > c.minX && p.x < c.maxX && p.y > c.minY && p.y < c.maxY && p.z > c.minZ && p.z < c.maxZ);
  }

  // ---------------------------------------------------------------
  // Modelos dos personagens (formas geométricas)
  // ---------------------------------------------------------------
  function addEyes(g, y, z, spread = 0.22, size = 0.13, pupil = 0x1a1a2e) {
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.SphereGeometry(size, 12, 10), mat(0xffffff), s * spread, y, z));
      g.add(mesh(new THREE.SphereGeometry(size * 0.55, 10, 8),
        mat(pupil, pupil !== 0x1a1a2e ? { emissive: pupil, emissiveIntensity: 0.6 } : {}),
        s * spread, y + 0.01, z + size * 0.65));
    }
  }

  function buildMiniCamera(scale = 1) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.32, 0.28), mat(0x2b2b3a, { roughness: 0.4 })));
    const lens = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 16), mat(0x3fe8ff, { emissive: 0x0a6a80 }), 0, 0, 0.2);
    lens.rotation.x = Math.PI / 2;
    g.add(lens);
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), mat(0xff3d7f), -0.14, 0.2, 0));
    g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xff2a2a, { emissive: 0xff0000 }), 0.17, 0.08, 0.15));
    g.scale.setScalar(scale);
    return g;
  }

  function buildTorajo() {
    const g = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(0.72, 24, 18), mat(0xff8c1a), 0, 0.78, 0);
    body.scale.set(1, 0.95, 1);
    g.add(body);
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 6), mat(0x6b3b1f), 0, 1.55, 0));
    const leaf = mesh(new THREE.SphereGeometry(0.28, 12, 8), mat(0x3fbf3f), 0.22, 1.62, 0);
    leaf.scale.set(1, 0.22, 0.55);
    leaf.rotation.z = -0.4;
    g.add(leaf);
    addEyes(g, 0.95, 0.6);
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xff5a7a), s * 0.42, 0.72, 0.52));
      const foot = mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0xc0560a), s * 0.3, 0.12, 0.1);
      foot.scale.set(1, 0.6, 1.4);
      g.add(foot);
    }
    return { model: g, height: 1.5, center: 0.78 };
  }

  function buildZulmi() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CapsuleGeometry(0.45, 0.6, 8, 16), mat(0x6a5cff), 0, 0.8, 0));
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.15, 0.45, 8), mat(0xa25cff), s * 0.25, 1.68, 0);
      ear.rotation.z = -s * 0.25;
      g.add(ear);
      const shoe = mesh(new THREE.BoxGeometry(0.25, 0.15, 0.45), mat(0x3fd0ff), s * 0.22, 0.08, 0.08);
      g.add(shoe);
    }
    const scarf = mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 20), mat(0x3fd0ff), 0, 0.85, 0);
    scarf.rotation.x = Math.PI / 2;
    g.add(scarf);
    const tail = mesh(new THREE.ConeGeometry(0.12, 0.5, 6), mat(0xa25cff), 0, 0.5, -0.5);
    tail.rotation.x = -1.1;
    g.add(tail);
    addEyes(g, 1.08, 0.37, 0.18, 0.12);
    return { model: g, height: 1.7, center: 0.8 };
  }

  function buildLinn() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(0.6, 20, 16), mat(0x7ed957), 0, 0.65, 0));
    const belly = mesh(new THREE.SphereGeometry(0.42, 16, 12), mat(0xffe45c), 0, 0.58, 0.28);
    belly.scale.set(1, 1, 0.6);
    g.add(belly);
    for (const s of [-1, 1]) {
      const sprout = mesh(new THREE.SphereGeometry(0.18, 10, 8), mat(0x3fbf3f), s * 0.12, 1.3, 0);
      sprout.scale.set(0.5, 1.2, 0.3);
      sprout.rotation.z = -s * 0.5;
      g.add(sprout);
    }
    const wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.45, 0.85, -0.05);
      const wing = mesh(new THREE.SphereGeometry(0.55, 14, 10), mat(0xd9e021), s * 0.5, 0, 0);
      wing.scale.set(1, 0.12, 0.5);
      pivot.add(wing);
      pivot.userData.side = s;
      g.add(pivot);
      wings.push(pivot);
    }
    addEyes(g, 0.82, 0.5, 0.2, 0.12);
    return { model: g, height: 1.4, center: 0.65, wings };
  }

  function buildMorajo() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CapsuleGeometry(0.5, 0.5, 8, 16), mat(0xb01e35), 0, 0.8, 0));
    // capuz escuro
    const hood = mesh(new THREE.SphereGeometry(0.54, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(0x2a0a18), 0, 1.0, -0.04);
    g.add(hood);
    // espinhos/chifres
    for (const s of [-1, 0, 1]) {
      const spike = mesh(new THREE.ConeGeometry(0.11, 0.35, 6), mat(0x2a0a18), s * 0.22, 1.55 - Math.abs(s) * 0.05, -0.05);
      spike.rotation.z = -s * 0.35;
      g.add(spike);
    }
    addEyes(g, 1.05, 0.4, 0.18, 0.12, 0xff2040);
    // sobrancelhas franzidas (ponta interna para baixo)
    for (const s of [-1, 1]) {
      const brow = mesh(new THREE.BoxGeometry(0.26, 0.06, 0.06), mat(0x14040a), s * 0.17, 1.2, 0.47);
      brow.rotation.z = s * 0.45;
      g.add(brow);
    }
    // boca em arco para baixo (cara emburrada)
    const mouth = mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12, Math.PI), mat(0x14040a), 0, 0.86, 0.49);
    g.add(mouth);
    // "pixels" de glitch flutuando no ombro
    for (const [x, y, c] of [[0.55, 1.2, 0xa020ff], [0.65, 1.0, 0xff2a6a], [-0.6, 1.25, 0xa020ff]]) {
      g.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat(c, { emissive: c, emissiveIntensity: 0.6 }), x, y, 0));
    }
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(0.26, 0.16, 0.45), mat(0x14040a), s * 0.22, 0.08, 0.08));
    }
    return { model: g, height: 1.65, center: 0.8 };
  }

  // ---------------------------------------------------------------
  // Personagem (física + animação)
  // ---------------------------------------------------------------
  const blobGeo = new THREE.CircleGeometry(0.55, 24);

  class Character {
    constructor({ id, name, color, ability, stats, build, spawn, facing = 0 }) {
      this.id = id;
      this.name = name;
      this.color = color;
      this.colorHex = new THREE.Color(color).getHex();
      this.ability = ability;
      this.stats = stats;

      const built = build();
      this.height = built.height;
      this.wings = built.wings || null;

      this.group = new THREE.Group();
      this.pivot = new THREE.Group();          // pivô no centro do corpo (rolamento / squash)
      this.pivot.position.y = built.center;
      this.model = built.model;
      this.model.position.y = -built.center;
      this.pivot.add(this.model);
      this.group.add(this.pivot);
      this.center = built.center;

      // Indicador de captura (mini câmera no topo)
      this.hat = buildMiniCamera(0.9);
      this.hat.position.y = this.height + 0.2;
      this.hat.visible = false;
      this.group.add(this.hat);

      this.label = null;
      scene.add(this.group);

      // Sombra circular (blob) sempre projetada no chão logo abaixo
      this.blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2,
      }));
      this.blob.rotation.x = -Math.PI / 2;
      this.blob.renderOrder = 1;
      scene.add(this.blob);
      this.trailT = 0;

      this.spawn = spawn.clone();
      this.pos = spawn.clone();
      this.lastSafe = spawn.clone();
      this.vel = new THREE.Vector3();
      this.facing = facing;
      this.targetFacing = facing;
      this.onGround = false;
      this.coyote = 0;
      this.jumpsUsed = 0;
      this.dashTime = 0;
      this.dashCd = 0;
      this.airDashUsed = false;
      this.gliding = false;
      this.flip = 0;
      this.squash = 0;
      this.walkT = 0;
    }

    setLabel(text) {
      this.label = makeTextSprite(text, this.color);
      this.label.position.y = this.height + 0.8;
      this.group.add(this.label);
    }

    centerPos(out = new THREE.Vector3()) {
      return out.set(this.pos.x, this.pos.y + this.center, this.pos.z);
    }

    respawn(p) {
      this.pos.copy(p);
      this.vel.set(0, 0, 0);
      this.dashTime = 0;
    }

    update(dt, inp) {
      const s = this.stats;
      this.dashCd -= dt;

      const mx = inp ? inp.mx : 0;
      const mz = inp ? inp.mz : 0;
      const moving = Math.hypot(mx, mz) > 0.01;
      if (moving) this.targetFacing = Math.atan2(mx, mz);

      // --- Coyote time / reset de pulos
      if (this.onGround) {
        this.coyote = 0.12;
        this.jumpsUsed = 0;
        this.airDashUsed = false;
      } else {
        this.coyote -= dt;
      }

      // --- Dash / rolamento
      if (inp && inp.dashPressed && this.dashCd <= 0 && (this.onGround || !this.airDashUsed)) {
        if (moving) this.facing = this.targetFacing;
        this.dashTime = s.dashTime;
        this.dashCd = 0.55;
        if (!this.onGround) {
          this.airDashUsed = true;
          this.vel.y = Math.max(this.vel.y, 2);
        }
        burst(this.pos.clone().setY(this.pos.y + 0.2), 0xffffff, 10, 4, { life: 0.4, gravity: 2, cubes: true });
        if (this === controlled) Sfx.dash();
      }

      // --- Velocidade horizontal
      const maxSpeed = s.speed * (this.gliding ? s.glideSpeedMul : 1);
      if (this.dashTime > 0) {
        this.dashTime -= dt;
        this.vel.x = Math.sin(this.facing) * s.dashSpeed;
        this.vel.z = Math.cos(this.facing) * s.dashSpeed;
        this.trailT -= dt;
        if (this.trailT <= 0) {
          this.trailT = 0.025;
          burst(this.centerPos(), this.colorHex, 2, 1, { life: 0.35, size: 1.4, gravity: 0, cubes: null });
        }
      } else {
        const k = damp(this.onGround ? 14 : 5, dt);
        this.vel.x += (mx * maxSpeed - this.vel.x) * k;
        this.vel.z += (mz * maxSpeed - this.vel.z) * k;
      }

      // --- Pulo (com pulo duplo para quem tiver)
      if (inp && inp.jumpPressed) {
        if (this.coyote > 0) {
          this.vel.y = s.jump;
          this.jumpsUsed = 1;
          this.coyote = 0;
          this.onGround = false;
          burst(this.pos.clone().setY(this.pos.y + 0.1), 0xfff6e0, 8, 3, { life: 0.45, gravity: 4, up: 0 });
          if (this === controlled) Sfx.jump();
        } else if (Math.max(this.jumpsUsed, 1) < s.jumps) {
          this.jumpsUsed = Math.max(this.jumpsUsed, 1) + 1;
          this.vel.y = s.jump * 0.95;
          this.flip = 1;
          burst(this.centerPos(), 0xb9a8ff, 14, 5, { cubes: null });
          if (this === controlled) Sfx.doubleJump();
        }
      }
      if (inp && inp.jumpReleased && this.vel.y > 0 && !s.glide) this.vel.y *= 0.55;

      // --- Gravidade e planar
      this.vel.y -= CONFIG.gravity * dt;
      this.gliding = !!(s.glide && !this.onGround && inp && inp.jumpHeld && this.vel.y < 0);
      if (this.gliding) this.vel.y = Math.max(this.vel.y, -s.glideFall);
      this.vel.y = Math.max(this.vel.y, -45);

      // --- Movimento + colisão
      const prevFeet = this.pos.y;
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.collideWalls();

      this.pos.y += this.vel.y * dt;
      if (this.vel.y > 0) {
        const ceil = ceilingAt(this.pos.x, this.pos.z, prevFeet + this.height);
        if (this.pos.y + this.height > ceil) {
          this.pos.y = ceil - this.height;
          this.vel.y = 0;
        }
      }

      const wasGround = this.onGround;
      this.onGround = false;
      const ground = groundAt(this.pos.x, this.pos.z, prevFeet + 0.6);
      if (ground > -Infinity && this.vel.y <= 0) {
        if (this.pos.y <= ground || (wasGround && this.pos.y - ground < 0.5)) {
          if (!wasGround && this.vel.y < -8) {
            this.squash = Math.min(0.35, -this.vel.y * 0.015);
            burst(new THREE.Vector3(this.pos.x, ground + 0.1, this.pos.z), 0xfff6e0, 10, 4,
              { life: 0.4, gravity: 3, up: -0.1 });
            if (this === controlled) Sfx.land();
          }
          this.pos.y = ground;
          this.vel.y = 0;
          this.onGround = true;
        }
      }

      // --- Último ponto seguro (para respawn em abismos)
      if (this.onGround) {
        const o = 0.9;
        const ok = [[o, 0], [-o, 0], [0, o], [0, -o]].every(([dx, dz]) =>
          Math.abs(groundAt(this.pos.x + dx, this.pos.z + dz, this.pos.y + 0.6) - this.pos.y) < 0.7);
        if (ok) this.lastSafe.copy(this.pos);
      }
      if (this.pos.y < CONFIG.killY) {
        this.respawn(this.lastSafe);
        if (this === controlled) toast('Ops! De volta ao chão firme.');
      }

      this.animate(dt, moving);
    }

    collideWalls() {
      const R = CONFIG.radius;
      for (const c of colliders) {
        if (c.type !== 'box' || !isSolid(c)) continue;
        if (c.maxY <= this.pos.y + CONFIG.stepHeight) continue;
        if (c.minY >= this.pos.y + this.height) continue;
        const cx = clamp(this.pos.x, c.minX, c.maxX);
        const cz = clamp(this.pos.z, c.minZ, c.maxZ);
        const dx = this.pos.x - cx;
        const dz = this.pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = (R - d) / d;
          this.pos.x += dx * push;
          this.pos.z += dz * push;
        } else {
          // centro dentro da caixa: empurra pela face mais próxima
          const faces = [
            [this.pos.x - c.minX, -1, 0], [c.maxX - this.pos.x, 1, 0],
            [this.pos.z - c.minZ, 0, -1], [c.maxZ - this.pos.z, 0, 1],
          ].sort((a, b) => a[0] - b[0]);
          const [dist, nx, nz] = faces[0];
          this.pos.x += nx * (dist + R);
          this.pos.z += nz * (dist + R);
        }
      }
    }

    animate(dt, moving) {
      if (this.dashTime <= 0 && moving) {
        this.facing = lerpAngle(this.facing, this.targetFacing, damp(12, dt));
      }
      this.group.position.copy(this.pos);
      this.group.rotation.y = this.facing;

      // rolamento no dash / mortal no pulo duplo
      if (this.dashTime > 0) {
        this.pivot.rotation.x = (1 - this.dashTime / this.stats.dashTime) * Math.PI * 2;
      } else if (this.flip > 0) {
        this.flip = Math.max(0, this.flip - dt * 2.8);
        this.pivot.rotation.x = (1 - this.flip) * Math.PI * 2;
      } else {
        this.pivot.rotation.x = 0;
      }

      // squash & stretch
      this.squash = Math.max(0, this.squash - dt * 1.5);
      let sy = 1 - this.squash;
      if (!this.onGround && !this.gliding) sy += Math.min(Math.abs(this.vel.y) * 0.008, 0.12);
      const sxz = 1 / Math.sqrt(sy);
      this.pivot.scale.set(sxz, sy, sxz);

      // passinho
      const hspeed = Math.hypot(this.vel.x, this.vel.z);
      if (this.onGround && hspeed > 0.5) {
        this.walkT += dt * (8 + hspeed);
        this.model.position.y = -this.center + Math.abs(Math.sin(this.walkT)) * 0.1;
      } else {
        this.walkT = 0;
        this.model.position.y = -this.center + Math.sin(performance.now() * 0.003) * 0.02;
      }

      // asas do Linn
      if (this.wings) {
        const t = performance.now() * 0.001;
        for (const w of this.wings) {
          const side = w.userData.side;
          const target = this.gliding ? side * (0.1 + Math.sin(t * 10) * 0.08) : -side * 1.1;
          w.rotation.z += (target - w.rotation.z) * damp(10, dt);
          const sc = this.gliding ? 1.6 : 1;
          w.scale.x += (sc - w.scale.x) * damp(10, dt);
        }
      }

      if (this.hat.visible) {
        this.hat.position.y = this.height + 0.2 + Math.sin(performance.now() * 0.006) * 0.05;
      }

      // blob shadow: encolhe e clareia conforme o personagem sobe
      const gy = groundAt(this.pos.x, this.pos.z, this.pos.y + 0.1);
      if (gy > -Infinity && this.group.visible) {
        const k = clamp(1 - (this.pos.y - gy) * 0.05, 0.35, 1);
        this.blob.visible = true;
        this.blob.position.set(this.pos.x, gy + 0.03, this.pos.z);
        this.blob.scale.setScalar(k);
        this.blob.material.opacity = 0.45 * k;
      } else {
        this.blob.visible = false;
      }
    }
  }

  // ---------------------------------------------------------------
  // Partículas simples
  // ---------------------------------------------------------------
  const particles = [];
  const particleGeo = new THREE.SphereGeometry(0.12, 6, 5);
  const particleCube = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  function burst(pos, color, n = 16, power = 6, { life = 0.7, size = 1, gravity = 12, cubes = false, up = 0.2 } = {}) {
    for (let i = 0; i < n; i++) {
      const geo = cubes || (cubes === null && Math.random() < 0.5) ? particleCube : particleGeo;
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(pos);
      m.scale.setScalar(size * (0.6 + Math.random() * 0.6));
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + up, Math.random() - 0.5)
        .normalize().multiplyScalar(power * (0.5 + Math.random() * 0.5));
      particles.push({ m, v, life, maxLife: life, gravity });
      scene.add(m);
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.v.y -= p.gravity * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += dt * 4;
      p.m.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        scene.remove(p.m);
        p.m.material.dispose();
        particles.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------
  // Colecionáveis: Botões de Play Dourados
  // ---------------------------------------------------------------
  const coins = [];
  let coinsCollected = 0;

  function buildPlayButton() {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffc83d, metalness: 0.85, roughness: 0.25, emissive: 0x7a5200, emissiveIntensity: 0.6,
    });
    g.add(mesh(new THREE.BoxGeometry(1.3, 0.95, 0.22), gold));
    // bordas arredondadas "fake"
    for (const [x, y] of [[-0.65, 0], [0.65, 0]]) {
      const c = mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.22, 16, 1, false, 0, Math.PI), gold, x, y, 0);
      c.rotation.x = Math.PI / 2;
      c.rotation.y = x < 0 ? Math.PI : 0;
      c.scale.set(0.35, 1, 1);
      g.add(c);
    }
    const tri = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.27, 3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x888888 }));
    tri.rotation.x = Math.PI / 2;
    const triG = new THREE.Group();
    triG.rotation.z = Math.PI / 2;
    triG.position.x = 0.04;
    triG.add(tri);
    g.add(triG);
    return g;
  }

  function addCoin(x, y, z) {
    const m = buildPlayButton();
    m.position.set(x, y, z);
    scene.add(m);
    coins.push({ mesh: m, base: y, collected: false, phase: Math.random() * 6 });
  }

  function updateCoins(dt, t) {
    const c = controlled.centerPos();
    for (const coin of coins) {
      if (coin.collected) continue;
      coin.mesh.rotation.y += dt * 2.5;
      coin.mesh.position.y = coin.base + Math.sin(t * 2 + coin.phase) * 0.15;
      if (coin.mesh.position.distanceTo(c) < 1.6) {
        coin.collected = true;
        scene.remove(coin.mesh);
        coinsCollected++;
        burst(coin.mesh.position, 0xffd84d, 24, 8, { cubes: null });
        burst(coin.mesh.position, 0xffffff, 10, 3, { life: 1, gravity: -3 });
        Sfx.coin();
        updateHUD();
        portal.sockets[coinsCollected - 1].material = portal.socketOnMat;
        if (coinsCollected >= CONFIG.totalCoins) {
          setTimeout(openPortal, 900);
        } else {
          toast(`Botão de Play Dourado! (${coinsCollected}/${CONFIG.totalCoins})`);
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // Likes (30 moedinhas azul-claro que guiam o caminho)
  // ---------------------------------------------------------------
  const likes = [];
  let likesCollected = 0;
  const likeGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 18);
  const likeMat = new THREE.MeshStandardMaterial({
    color: 0x6fe3ff, emissive: 0x1aa0d0, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.3,
  });
  const likeCoreGeo = new THREE.SphereGeometry(0.1, 8, 6);
  const likeCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function addLike(x, y, z) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(likeGeo, likeMat);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    g.add(disc, new THREE.Mesh(likeCoreGeo, likeCoreMat));
    g.position.set(x, y, z);
    scene.add(g);
    likes.push({ mesh: g, base: y, collected: false, phase: Math.random() * 6 });
  }
  /** n Likes em linha reta de a até b (inclusive). */
  function likeLine(a, b, n) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      addLike(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    }
  }

  function updateLikes(dt, t) {
    const c = controlled.centerPos();
    for (const like of likes) {
      if (like.collected) continue;
      like.mesh.rotation.y += dt * 4;
      like.mesh.position.y = like.base + Math.sin(t * 3 + like.phase) * 0.1;
      if (like.mesh.position.distanceTo(c) < 1.25) {
        like.collected = true;
        scene.remove(like.mesh);
        likesCollected++;
        burst(like.mesh.position, 0x6fe3ff, 8, 3, { life: 0.4, size: 0.7 });
        Sfx.like();
        updateHUD();
      }
    }
  }

  // ---------------------------------------------------------------
  // Portal do Estúdio (abre com os 5 Botões de Play)
  // ---------------------------------------------------------------
  const PORTAL_CENTER = new THREE.Vector3(0, 3.0, 21);
  const portal = buildPortal();
  let finished = false;

  function buildPortal() {
    const g = new THREE.Group();
    g.position.set(PORTAL_CENTER.x, 0, PORTAL_CENTER.z);
    // base / dais (sólido)
    addBox(PORTAL_CENTER.x, 0.4, PORTAL_CENTER.z, 7, 0.4, 3, 0x8a7cc8);
    addBox(PORTAL_CENTER.x - 3.1, 5.6, PORTAL_CENTER.z, 0.8, 5.2, 0.8, 0x6a5ca8);
    addBox(PORTAL_CENTER.x + 3.1, 5.6, PORTAL_CENTER.z, 0.8, 5.2, 0.8, 0x6a5ca8);

    const frameMat = mat(0x8c8c9e, { metalness: 0.3, roughness: 0.5 });
    const ring = mesh(new THREE.TorusGeometry(2.3, 0.35, 14, 40), frameMat, 0, PORTAL_CENTER.y, 0);
    g.add(ring);

    // superfície do portal com espiral desenhada em canvas
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ff7ad9');
    grad.addColorStop(0.7, '#7b5cff');
    grad.addColorStop(1, '#3fd0ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 6;
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      for (let k = 0; k < 60; k++) {
        const a = arm * Math.PI / 2 + k * 0.12;
        const r = k * 2.1;
        ctx.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const discOpenMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
    const discClosedMat = new THREE.MeshStandardMaterial({ color: 0x2a1a4a, roughness: 0.9, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.05, 40), discClosedMat);
    disc.position.y = PORTAL_CENTER.y;
    g.add(disc);

    // cadeado (visível enquanto fechado)
    const lock = new THREE.Group();
    lock.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.25), mat(0xffc83d, { metalness: 0.7, roughness: 0.3 })));
    const shackle = mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16, Math.PI), mat(0xb0b0c0, { metalness: 0.8 }), 0, 0.35, 0);
    lock.add(shackle);
    lock.position.set(0, PORTAL_CENTER.y - 0.2, 0.15);
    g.add(lock);

    // 5 encaixes que acendem a cada Botão de Play
    const socketOffMat = mat(0x44445a);
    const socketOnMat = mat(0xffd84d, { emissive: 0xffa000, emissiveIntensity: 1 });
    const sockets = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.15 + i * 0.175);
      const s = mesh(new THREE.SphereGeometry(0.22, 12, 10), socketOffMat,
        Math.cos(a) * 2.3, PORTAL_CENTER.y + Math.sin(a) * 2.3, 0.3);
      g.add(s);
      sockets.push(s);
    }
    sockets.reverse(); // acendem da esquerda para a direita

    const label = makeTextSprite('Portal do Estúdio', '#ffe27a');
    label.position.y = PORTAL_CENTER.y + 3.3;
    label.scale.set(3.2, 0.8, 1);
    g.add(label);

    const light = new THREE.PointLight(0xff7ad9, 0, 14);
    light.position.set(0, PORTAL_CENTER.y, 1.5);
    g.add(light);

    scene.add(g);
    return { group: g, ring, disc, lock, sockets, socketOnMat, discOpenMat, frameMat, light, open: false };
  }

  function openPortal() {
    portal.open = true;
    portal.disc.material = portal.discOpenMat;
    portal.lock.visible = false;
    portal.frameMat.color.set(0xffd84d);
    portal.frameMat.emissive.set(0xff8a00);
    portal.frameMat.emissiveIntensity = 0.5;
    burst(PORTAL_CENTER, 0xff7ad9, 40, 10, { cubes: null, life: 1.2 });
    Sfx.portalOpen();
    toast('O Portal do Estúdio se abriu! Volte para o sul da vila.', 5000);
  }

  function updatePortal(dt, t) {
    if (!portal.open) return;
    portal.disc.rotation.z -= dt * 1.5;
    portal.disc.scale.setScalar(1 + Math.sin(t * 4) * 0.03);
    portal.light.intensity = 25 + Math.sin(t * 5) * 8;
    if (Math.random() < 0.4) {
      const a = Math.random() * Math.PI * 2;
      const p = PORTAL_CENTER.clone().add(new THREE.Vector3(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0));
      burst(p, Math.random() < 0.5 ? 0xff7ad9 : 0x3fd0ff, 1, 1.5, { life: 0.8, gravity: -1, size: 0.8 });
    }
    if (!finished && controlled.centerPos().distanceTo(PORTAL_CENTER) < 2.2) finishLevel();
  }

  function finishLevel() {
    finished = true;
    paused = true;
    Sfx.victory();
    burst(PORTAL_CENTER, 0xffd84d, 50, 12, { cubes: null, life: 1.5 });
    const secs = playTime;
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(Math.floor(secs % 60)).padStart(2, '0');
    const ds = Math.floor((secs * 10) % 10);
    document.getElementById('f-time').textContent = `${mm}:${ss}.${ds}`;
    document.getElementById('f-likes').textContent = `${likesCollected}/${likes.length}`;
    document.getElementById('finish').classList.remove('hidden');
    document.exitPointerLock?.();
  }
  document.getElementById('replay').addEventListener('click', () => window.location.reload());

  // ---------------------------------------------------------------
  // Câmera Mágica (arremesso + captura)
  // ---------------------------------------------------------------
  const proj = {
    active: false,
    returning: false,
    t: 0,
    pos: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    mesh: buildMiniCamera(1.5),
  };
  proj.mesh.visible = false;
  const strap = mesh(new THREE.TorusGeometry(0.35, 0.04, 6, 20), mat(0xff3d7f), 0, 0, 0, false);
  proj.mesh.add(strap);
  scene.add(proj.mesh);

  function throwCamera() {
    if (proj.active || controlled !== torajo) return;
    const fx = -Math.sin(cam.yaw);
    const fz = -Math.cos(cam.yaw);
    torajo.facing = torajo.targetFacing = Math.atan2(fx, fz);
    proj.dir.set(fx, 0, fz);
    proj.pos.set(torajo.pos.x + fx * 0.8, torajo.pos.y + 1.1, torajo.pos.z + fz * 0.8);
    proj.active = true;
    proj.returning = false;
    proj.t = 0;
    proj.mesh.visible = true;
    Sfx.throwCam();
  }

  function updateProjectile(dt) {
    if (!proj.active) return;
    proj.t += dt;
    if (!proj.returning) {
      proj.pos.addScaledVector(proj.dir, 24 * dt);
      if (proj.t > 0.6 || pointInsideBox(proj.pos)) proj.returning = true;
      for (const npc of npcs) {
        if (npc === controlled) continue;
        if (npc.centerPos().distanceTo(proj.pos) < 1.3) {
          proj.active = false;
          proj.mesh.visible = false;
          capture(npc);
          return;
        }
      }
    } else {
      const target = torajo.centerPos();
      const to = target.sub(proj.pos);
      const d = to.length();
      if (d < 0.9 || controlled !== torajo) {
        proj.active = false;
        proj.mesh.visible = false;
        return;
      }
      proj.pos.addScaledVector(to.divideScalar(d), Math.min(d, 30 * dt));
    }
    proj.mesh.position.copy(proj.pos);
    proj.mesh.rotation.y += dt * 25;
    if (Math.random() < 0.5) {
      burst(proj.pos, 0x3fe8ff, 1, 0.5, { life: 0.3, size: 0.7, gravity: 0 });
    }
  }

  function capture(npc) {
    controlled = npc;
    torajo.group.visible = false;
    torajo.blob.visible = false;
    npc.hat.visible = true;
    if (npc.label) npc.label.visible = false;
    burst(npc.centerPos(), 0x3fe8ff, 28, 7, { cubes: null });
    burst(npc.centerPos(), npc.colorHex, 16, 4, { life: 0.9, gravity: -2 });
    Sfx.capture();
    secretActive = npc === morajo;
    if (secretActive) {
      Sfx.glitch();
      toast('Hack do Algoritmo! Plataformas secretas reveladas!');
    } else {
      toast(`Sincronizado com ${npc.name}! (Q para sair)`);
    }
    updateHUD();
  }

  function release() {
    if (controlled === torajo) return;
    const n = controlled;
    n.hat.visible = false;
    if (n.label) n.label.visible = true;
    torajo.pos.copy(n.pos);
    torajo.pos.y += 0.2;
    torajo.vel.set(0, 9, 0);
    torajo.lastSafe.copy(n.lastSafe);
    torajo.facing = torajo.targetFacing = n.facing;
    torajo.group.visible = true;
    controlled = torajo;
    if (secretActive) Sfx.glitch();
    secretActive = false;
    burst(torajo.centerPos(), 0xff8c1a, 20, 6, { cubes: null });
    Sfx.release();
    updateHUD();
  }

  // ---------------------------------------------------------------
  // Personagens no mapa
  // ---------------------------------------------------------------
  buildWorld();

  const torajo = new Character({
    id: 'torajo', name: 'Torajo', color: '#ff8c1a',
    ability: 'Arremesse a Câmera Mágica (E) nos aliados!',
    stats: STATS.torajo, build: buildTorajo, spawn: new THREE.Vector3(0, 0, 10), facing: Math.PI,
  });
  const zulmi = new Character({
    id: 'zulmi', name: 'Zulmi', color: '#8f7bff',
    ability: 'Corre 2x mais rápido · Pulo duplo',
    stats: STATS.zulmi, build: buildZulmi, spawn: new THREE.Vector3(21, 0, 3), facing: -Math.PI / 2,
  });
  const linn = new Character({
    id: 'linn', name: 'Linn', color: '#a8e05a',
    ability: 'Segure Espaço no ar para planar',
    stats: STATS.linn, build: buildLinn, spawn: new THREE.Vector3(1.5, 8, -20), facing: 0,
  });
  const morajo = new Character({
    id: 'morajo', name: 'Morajo', color: '#ff3b55',
    ability: 'Hack do Algoritmo: revela plataformas secretas',
    stats: STATS.morajo, build: buildMorajo, spawn: new THREE.Vector3(SKY_SPOT.x, 0, SKY_SPOT.z), facing: 0.8,
  });
  zulmi.setLabel('Zulmi');
  linn.setLabel('Linn');
  morajo.setLabel('Morajo');

  const characters = [torajo, zulmi, linn, morajo];
  const npcs = [zulmi, linn, morajo];
  let controlled = torajo;

  addCoin(48, 1.2, 4);      // #1 ilha leste (Zulmi)
  addCoin(0, 1.2, -58);     // #2 ilha norte (Linn)
  addCoin(-18, 9.7, -3);    // #3 plataforma alta (pulo duplo)
  addCoin(SKY_SPOT.x, 21.2, SKY_SPOT.z); // #4 plataforma no céu (Hack do Morajo)
  addCoin(0, 5.2, -38);     // #5 plataforma no meio do planeio

  // 30 Likes guiando os caminhos (y = superfície + ~0.9)
  const rampZ = z => 8 * (-5 - z) / 12 + 0.9;        // rampa da torre
  const rampX = x => 3 * (x - 14) / 8 + 0.9;         // rampa do mirante
  likeLine([3, 0.9, 8], [17, 0.9, 4], 4);            // início -> Zulmi
  for (const z of [-7, -10, -13, -16]) addLike(0, rampZ(z), z);  // rampa da torre
  addLike(-12, 2.4, 10); addLike(-15, 4.4, 6); addLike(-18, 6.4, 2); // escadinha oeste
  likeLine([0, 9.5, -28], [0, 6.5, -34], 2);         // planeio: torre -> plataforma
  likeLine([0, 3.5, -43], [0, 1.6, -49], 2);         // planeio: plataforma -> ilha norte
  likeLine([28, 2.4, 1], [34, 2.4, 1], 3);           // abismo leste (arco da Zulmi)
  for (const x of [15.5, 18, 20.5]) addLike(x, rampX(x), 14); // rampa do mirante
  addLike(7, 4.9, -9); addLike(9, 4.9, -7);           // topo do estúdio
  addLike(-4, 0.9, -55); addLike(4, 0.9, -55);        // ilha norte
  addLike(42, 0.9, 4); addLike(54, 0.9, -1);          // ilha leste
  for (const i of [3, 6, 9]) {                        // espiral secreta (só com o Morajo)
    const p = secretStepTop(i);
    addLike(p.x, p.y + 0.9, p.z);
  }

  // ---------------------------------------------------------------
  // Entrada (teclado / mouse)
  // ---------------------------------------------------------------
  const keys = {};
  const pressed = new Set();
  const released = new Set();
  const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];

  window.addEventListener('keydown', e => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed.add(e.code);
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => {
    keys[e.code] = false;
    released.add(e.code);
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  const cam = { yaw: 0, pitch: 0.35, dist: 9, target: new THREE.Vector3(0, 1.4, 10) };
  const overlay = document.getElementById('overlay');
  let paused = true;
  let hadLock = false;
  let rightDrag = false;

  let playTime = 0;

  // Alguns contextos (iframes, previews) bloqueiam pointer lock: falha em silêncio
  // e o jogo continua jogável com clique direito + arrastar para girar a câmera.
  function lockPointer() {
    try {
      const r = canvas.requestPointerLock?.();
      if (r && r.catch) r.catch(() => {});
    } catch (_) { /* ignora */ }
  }

  overlay.addEventListener('click', () => {
    Sfx.init();
    paused = false;
    overlay.classList.add('hidden');
    lockPointer();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      hadLock = true;
    } else if (hadLock && !paused && !finished) {
      paused = true;
      document.getElementById('overlay-sub').textContent = 'Pausado';
      overlay.classList.remove('hidden');
    }
  });

  canvas.addEventListener('mousedown', e => {
    if (paused) return;
    if (e.button === 0) {
      if (document.pointerLockElement !== canvas) lockPointer();
      throwCamera();
    } else if (e.button === 2) {
      rightDrag = true;
    }
  });
  window.addEventListener('mouseup', e => { if (e.button === 2) rightDrag = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('mousemove', e => {
    if (paused) return;
    if (document.pointerLockElement === canvas || rightDrag) {
      cam.yaw -= e.movementX * 0.0025;
      cam.pitch = clamp(cam.pitch + e.movementY * 0.0025, -0.15, 1.3);
    }
  });
  window.addEventListener('wheel', e => {
    cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 0.8, 4, 18);
  }, { passive: true });

  function buildInput() {
    const ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const iz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let mx = fx * iz + rx * ix;
    let mz = fz * iz + rz * ix;
    const l = Math.hypot(mx, mz);
    if (l > 1) { mx /= l; mz /= l; }
    return {
      mx, mz,
      jumpPressed: pressed.has('Space'),
      jumpHeld: !!keys.Space,
      jumpReleased: released.has('Space'),
      dashPressed: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
    };
  }

  function handleActions() {
    if (pressed.has('KeyE')) throwCamera();
    if (pressed.has('KeyQ')) release();
    if (pressed.has('KeyR')) {
      release();
      torajo.respawn(torajo.spawn);
      torajo.lastSafe.copy(torajo.spawn);
      toast('De volta ao início da vila.');
    }
  }

  // ---------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------
  const hudCoins = document.getElementById('coins');
  const hudLikes = document.getElementById('likes');
  const hudName = document.getElementById('char-name');
  const hudAbility = document.getElementById('char-ability');
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function updateHUD() {
    hudCoins.textContent = `${coinsCollected}/${CONFIG.totalCoins}`;
    hudLikes.textContent = `${likesCollected}/${likes.length}`;
    hudName.textContent = controlled.name;
    hudName.style.color = controlled.color;
    hudAbility.textContent = controlled.ability;
  }

  function toast(text, ms = 2600) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  // Dicas iniciais
  const hints = [
    'Bem-vindo à Vila de Verade! Encontre os 5 Botões de Play Dourados.',
    'Dica: arremesse a Câmera Mágica (E) na Zulmi para cruzar o abismo leste.',
    'Dica: suba a rampa da torre norte e capture o Linn para planar.',
    'Dica: o Morajo, a noroeste, enxerga caminhos que ninguém vê...',
    'Junte os 5 Botões de Play para abrir o Portal do Estúdio (sul).',
  ];
  let hintIndex = 0;
  function nextHint() {
    if (hintIndex >= hints.length) return;
    toast(hints[hintIndex++], 4000);
    setTimeout(nextHint, 4600);
  }

  // ---------------------------------------------------------------
  // Câmera de terceira pessoa
  // ---------------------------------------------------------------
  const tmpV = new THREE.Vector3();
  function updateCamera(dt) {
    tmpV.set(controlled.pos.x, controlled.pos.y + 1.4, controlled.pos.z);
    cam.target.lerp(tmpV, damp(8, dt));
    const cp = Math.cos(cam.pitch);
    camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
      cam.target.y + Math.sin(cam.pitch) * cam.dist,
      cam.target.z + Math.cos(cam.yaw) * cp * cam.dist,
    );
    const g = groundAt(camera.position.x, camera.position.z, cam.target.y + 0.5);
    if (camera.position.y < g + 0.4) camera.position.y = g + 0.4;
    camera.lookAt(cam.target);

    sun.position.set(cam.target.x + 20, cam.target.y + 40, cam.target.z + 15);
    sun.target.position.copy(cam.target);
  }

  // ---------------------------------------------------------------
  // Loop principal
  // ---------------------------------------------------------------
  const clock = new THREE.Clock();
  let started = false;

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (!paused) {
      if (!started) { started = true; nextHint(); }
      playTime += dt;
      handleActions();
      const inp = buildInput();
      const steps = Math.ceil(dt / (1 / 120));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        const stepInp = i === 0 ? inp : { ...inp, jumpPressed: false, jumpReleased: false, dashPressed: false };
        for (const ch of characters) {
          if (ch === torajo && controlled !== torajo) continue; // Torajo está "dentro" da captura
          ch.update(sdt, ch === controlled ? stepInp : null);
        }
      }
      // NPCs olham para o Torajo quando ele está perto
      for (const npc of npcs) {
        if (npc === controlled || controlled !== torajo) continue;
        const dx = torajo.pos.x - npc.pos.x, dz = torajo.pos.z - npc.pos.z;
        if (dx * dx + dz * dz < 100) npc.facing = lerpAngle(npc.facing, Math.atan2(dx, dz), damp(4, dt));
      }
      updateProjectile(dt);
      updateCoins(dt, t);
      updateLikes(dt, t);
      updatePortal(dt, t);
    }
    updateSecrets(dt, t);
    updateParticles(dt);

    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 140) c.position.x = -140;
    }

    pressed.clear();
    released.clear();
    updateCamera(dt);
    renderer.render(scene, camera);
  }

  // Handle de debug (console do navegador): __torajo.torajo.pos, __torajo.capture(...)
  window.__torajo = {
    torajo, zulmi, linn, morajo, cam, capture, release, openPortal, coins, likes,
    get controlled() { return controlled; },
  };

  updateHUD();
  tick();
})();
