/*
 * Pocky 的行为引擎：状态机 + 互动 + 记忆。
 * 在 Electron 里作为桌宠运行；直接用浏览器打开 index.html 也可以预览。
 */
(function () {
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const menu = document.getElementById('menu');
  const params = new URLSearchParams(location.search);
  const DEBUG_POSE = params.get('pose'); // 截图/调试用：锁定姿势

  let W = 0, H = 0, GROUND = 0;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    GROUND = H - 16;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- 记忆（Pocky 记得你） ----------
  const STORE_KEY = 'pocky-state';
  const memory = Object.assign(
    { adoptedAt: Date.now(), lastSeen: 0, affection: 0, pets: 0, feeds: 0 },
    JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
  );
  const missedYou = memory.lastSeen && Date.now() - memory.lastSeen > 8 * 3600e3;
  function saveMemory() {
    memory.lastSeen = Date.now();
    localStorage.setItem(STORE_KEY, JSON.stringify(memory));
  }
  setInterval(saveMemory, 10e3);
  window.addEventListener('beforeunload', saveMemory);
  const companionDays = () =>
    Math.max(1, Math.ceil((Date.now() - memory.adoptedAt) / 86400e3));

  // ---------- 狗狗本体 ----------
  const dog = {
    x: Math.min(W - 120, Math.max(120, W * 0.5)),
    dir: 1,
    pose: 'stand',
    state: 'idle',
    stateT: 0,      // 当前状态已持续秒数
    stateDur: 2,    // 当前状态计划时长
    targetX: 0,
    speed: 60,
    legPhase: 0,
    tailWag: 0,
    tailSpeed: 0,   // >0 时摇尾巴
    eyesClosed: false,
    happy: false,
    happyT: 0,
    breath: 0,
    scale: parseFloat(params.get('scale')) || 1, // ?scale=1.5 可以把狗狗变大
  };

  const isNight = () => {
    const h = new Date().getHours();
    return h >= 23 || h < 6;
  };

  // ---------- 气泡与粒子 ----------
  let bubble = null; // {text, t, dur}
  function say(text, dur = 2.2) {
    bubble = { text, t: 0, dur };
  }

  const particles = []; // {kind:'heart'|'z', x, y, t, dur, drift}
  function emit(kind, n, x, y) {
    for (let i = 0; i < n; i++) {
      particles.push({
        kind, t: 0,
        dur: 1.4 + (i % 3) * 0.3,
        x: x + (i - n / 2) * 12 + ((i * 37) % 10) - 5,
        y: y - (i % 3) * 8,
        drift: ((i * 53) % 10 - 5) * 3,
      });
    }
  }

  function drawHeart(x, y, size, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 10, size / 10);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#E86A6A';
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-6, -3, -3, -8, 0, -4);
    ctx.bezierCurveTo(3, -8, 6, -3, 0, 3);
    ctx.fill();
    ctx.restore();
  }

  // ---------- 状态机 ----------
  function setState(state, dur) {
    dog.state = state;
    dog.stateT = 0;
    dog.stateDur = dur;
    dog.pose =
      state === 'walk' || state === 'greet' ? 'walk'
      : state === 'sit' ? 'sit'
      : state === 'sleep' ? 'lie'
      : 'stand';
    dog.eyesClosed = state === 'sleep';
    if (state === 'walk' || state === 'greet') {
      const margin = 110;
      dog.targetX =
        state === 'greet'
          ? W / 2
          : margin + Math.random() * Math.max(1, W - margin * 2);
      dog.dir = dog.targetX > dog.x ? 1 : -1;
      dog.speed = state === 'greet' ? 150 : 55 + Math.random() * 30;
    }
  }

  function pickNextState() {
    if (isNight() && Math.random() < 0.65) return setState('sleep', 20 + Math.random() * 25);
    const r = Math.random();
    if (r < 0.45) return setState('walk', 30);
    if (r < 0.62) return setState('sit', 4 + Math.random() * 7);
    if (r < 0.78) return setState('sleep', 10 + Math.random() * 15);
    setState('idle', 2 + Math.random() * 4);
  }

  // 开场：久别重逢会跑过来打招呼
  if (DEBUG_POSE) {
    dog.x = W / 2;
    dog.pose = DEBUG_POSE === 'walk' ? 'walk' : DEBUG_POSE;
    dog.state = 'debug';
    dog.eyesClosed = DEBUG_POSE === 'lie';
    if (params.get('happy')) { dog.happy = true; dog.happyT = 9999; dog.tailSpeed = 7; }
  } else if (missedYou) {
    setState('greet', 30);
    setTimeout(() => say('想你了！', 2.5), 600);
    emit('heart', 4, dog.x, GROUND - 130);
    memory.affection += 2;
  } else {
    setState('idle', 2);
    setTimeout(() => say('汪！我在哦', 2), 800);
  }

  function update(dt) {
    dog.breath += dt * 2.4;
    dog.stateT += dt;
    dog.x = Math.min(W - 60, Math.max(60, dog.x));

    // 摇尾巴衰减
    if (dog.tailSpeed > 0) {
      dog.tailWag = Math.sin(dog.breath * dog.tailSpeed) * 0.35;
    } else {
      dog.tailWag = Math.sin(dog.breath * 0.8) * 0.08;
    }
    if (dog.happy) {
      dog.happyT -= dt;
      if (dog.happyT <= 0) { dog.happy = false; dog.tailSpeed = 0; }
    }

    if (dog.state === 'debug') {
      if (dog.pose === 'walk') dog.legPhase += dt * 8;
      return;
    }

    if (dog.state === 'walk' || dog.state === 'greet') {
      const step = dog.speed * dt * dog.dir;
      dog.x += step;
      dog.legPhase += dt * (dog.speed / 8);
      const arrived =
        (dog.dir === 1 && dog.x >= dog.targetX) ||
        (dog.dir === -1 && dog.x <= dog.targetX);
      if (arrived || dog.stateT > dog.stateDur) {
        if (dog.state === 'greet') {
          dog.happy = true; dog.happyT = 2.5; dog.tailSpeed = 7;
        }
        setState('idle', 1.5 + Math.random() * 3);
      }
    } else if (dog.state !== 'held' && dog.stateT > dog.stateDur) {
      // 夜里睡醒了大概率接着睡
      if (dog.state === 'sleep' && isNight() && Math.random() < 0.7) {
        setState('sleep', 20 + Math.random() * 25);
      } else {
        pickNextState();
      }
    }

    // 睡觉时冒 Z
    if (dog.state === 'sleep' && Math.random() < dt * 0.8) {
      emit('z', 1, dog.x + 30 * dog.dir, GROUND - 60);
    }

    // 粒子
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      p.y -= dt * 28;
      p.x += p.drift * dt;
      if (p.t > p.dur) particles.splice(i, 1);
    }

    if (bubble) {
      bubble.t += dt;
      if (bubble.t > bubble.dur) bubble = null;
    }
  }

  // ---------- 绘制 ----------
  function drawBubble() {
    if (!bubble) return;
    const fade = Math.min(1, bubble.t / 0.15, (bubble.dur - bubble.t) / 0.3);
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.font = '14px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
    const tw = ctx.measureText(bubble.text).width;
    const bw = tw + 24, bh = 30;
    const bx = Math.min(W - bw - 6, Math.max(6, dog.x - bw / 2));
    const by = GROUND - 165;
    ctx.fillStyle = 'rgba(255,252,245,0.95)';
    ctx.strokeStyle = '#E8D9BD';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.stroke();
    // 小三角
    ctx.beginPath();
    ctx.moveTo(dog.x - 6, by + bh);
    ctx.lineTo(dog.x + 6, by + bh);
    ctx.lineTo(dog.x, by + bh + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4A3222';
    ctx.fillText(bubble.text, bx + 12, by + 20);
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawDog(ctx, {
      x: dog.x, y: GROUND, dir: dog.dir, pose: dog.pose,
      legPhase: dog.legPhase, tailWag: dog.tailWag,
      eyesClosed: dog.eyesClosed, happy: dog.happy,
      breath: dog.breath, scale: dog.scale,
    });
    for (const p of particles) {
      const alpha = Math.max(0, 1 - p.t / p.dur);
      if (p.kind === 'heart') {
        drawHeart(p.x, p.y, 9 + Math.sin(p.t * 6) * 1.5, alpha);
      } else {
        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = '#7B93B5';
        ctx.font = `italic ${12 + p.t * 6}px Georgia, serif`;
        ctx.fillText('z', p.x, p.y);
        ctx.restore();
      }
    }
    drawBubble();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- 互动 ----------
  const hitBox = () =>
    dogHitBox({ x: dog.x, y: GROUND, pose: dog.pose, scale: dog.scale });
  const overDog = (mx, my) => {
    const b = hitBox();
    return mx >= b.left && mx <= b.left + b.width && my >= b.top && my <= b.top + b.height;
  };

  // 鼠标穿透控制：只有指到狗（或菜单开着）时窗口才接收鼠标
  let lastOver = false;
  document.addEventListener('mousemove', (e) => {
    const over = overDog(e.clientX, e.clientY) || !menu.hidden;
    if (over !== lastOver) {
      lastOver = over;
      window.petAPI?.setIgnoreMouse(!over);
    }
  });

  function petTheDog() {
    memory.pets += 1;
    memory.affection += 1;
    dog.happy = true;
    dog.happyT = 2;
    dog.tailSpeed = 7;
    if (dog.state === 'sleep') setState('idle', 3);
    dog.eyesClosed = false;
    emit('heart', 3, dog.x, GROUND - 120);
    if (memory.pets % 10 === 0) say('最喜欢你了！');
  }

  function bark() {
    say('汪汪！', 1.5);
    dog.tailSpeed = 7;
    dog.happy = true;
    dog.happyT = 1.5;
    // 放真实录音：把 Pocky 的叫声放到 assets/bark.mp3 即可
    try { new Audio('assets/bark.mp3').play().catch(() => {}); } catch (_) {}
  }

  function feed() {
    memory.feeds += 1;
    memory.affection += 2;
    say('好香！谢谢～', 2);
    dog.happy = true;
    dog.happyT = 3;
    dog.tailSpeed = 8;
    emit('heart', 5, dog.x, GROUND - 120);
  }

  function showStatus() {
    say(`❤ 亲密度 ${memory.affection} · 已陪伴你 ${companionDays()} 天`, 3.5);
  }

  // 点击 = 摸摸；拖动 = 抱着走；双击 = 叫两声
  let press = null;
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !overDog(e.clientX, e.clientY)) return;
    press = { x: e.clientX, moved: false };
  });
  document.addEventListener('mousemove', (e) => {
    if (!press) return;
    if (Math.abs(e.clientX - press.x) > 6) press.moved = true;
    if (press.moved) {
      dog.x = Math.min(W - 60, Math.max(60, e.clientX));
      if (dog.state !== 'debug') { dog.pose = 'stand'; dog.state = 'held'; }
    }
  });
  document.addEventListener('mouseup', () => {
    if (!press) return;
    if (!press.moved) petTheDog();
    else if (dog.state === 'held') setState('idle', 2);
    press = null;
  });
  canvas.addEventListener('dblclick', (e) => {
    if (overDog(e.clientX, e.clientY)) bark();
  });

  // 右键菜单
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!overDog(e.clientX, e.clientY)) return;
    menu.hidden = false;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.min(W - mw - 8, Math.max(8, e.clientX)) + 'px';
    menu.style.top = Math.min(H - mh - 8, Math.max(8, e.clientY - mh)) + 'px';
    window.petAPI?.setIgnoreMouse(false);
  });
  document.addEventListener('mousedown', (e) => {
    if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true;
  });
  if (!window.petAPI) document.getElementById('quitBtn').style.display = 'none';
  menu.addEventListener('click', (e) => {
    const act = e.target.dataset?.act;
    if (!act) return;
    menu.hidden = true;
    if (act === 'pet') petTheDog();
    else if (act === 'feed') feed();
    else if (act === 'nap') setState('sleep', 30);
    else if (act === 'status') showStatus();
    else if (act === 'quit') { saveMemory(); window.petAPI?.quit(); }
  });
})();
