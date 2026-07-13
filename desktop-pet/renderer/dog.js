/*
 * 程序化绘制一只柴犬风格的小狗（占位形象）。
 * 之后可以把整个 drawDog 换成基于真实 Pocky 照片制作的精灵图，接口不变。
 *
 * drawDog(ctx, opts)
 *   opts.x, opts.y   狗脚下的地面点（画布坐标）
 *   opts.dir         1 朝右，-1 朝左
 *   opts.pose        'stand' | 'walk' | 'sit' | 'lie'
 *   opts.legPhase    行走相位（弧度）
 *   opts.tailWag     摇尾角度偏移（弧度）
 *   opts.eyesClosed  是否闭眼
 *   opts.happy       开心状态（吐舌 + 脸红）
 *   opts.breath      呼吸相位 0..2π
 *   opts.scale       整体缩放
 */
(function () {
  const FUR = '#E8A05C';
  const FUR_DARK = '#C9853F';
  const CREAM = '#F9EBD2';
  const INK = '#3E2A1A';
  const BLUSH = 'rgba(240,120,120,0.35)';
  const TONGUE = '#E88A8A';

  function ellipse(ctx, x, y, rx, ry, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  // 一条腿：hipX 髋部位置，phase 决定前后摆动和抬脚
  function leg(ctx, hipX, hipY, phase, color, moving) {
    const swing = moving ? Math.sin(phase) * 7 : 0;
    const lift = moving ? Math.max(0, Math.sin(phase + Math.PI / 3)) * 5 : 0;
    roundRect(ctx, hipX - 5 + swing, hipY, 11, -hipY - lift, 5, color);
  }

  // 卷起来的柴犬尾巴，base 在身体后上方
  function tail(ctx, bx, by, wag) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-0.3 + wag);
    ctx.strokeStyle = FUR;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-6, -12, 12, Math.PI * 0.4, Math.PI * 1.9);
    ctx.stroke();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-6, -12, 12, Math.PI * 0.55, Math.PI * 1.4);
    ctx.stroke();
    ctx.restore();
  }

  function ear(ctx, x, y, lean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.moveTo(-9, 4);
    ctx.quadraticCurveTo(-3, -20, 4, -18);
    ctx.quadraticCurveTo(11, -6, 9, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#F3C99A';
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.quadraticCurveTo(-1, -12, 3, -11);
    ctx.quadraticCurveTo(7, -3, 5, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 头部组件：cx, cy 头心；tilt 头部倾斜
  function head(ctx, cx, cy, opts, tilt) {
    ctx.save();
    ctx.translate(cx, cy);
    if (tilt) ctx.rotate(tilt);

    ear(ctx, -14, -20, -0.25);
    ear(ctx, 10, -22, 0.2);

    // 头
    ellipse(ctx, 0, 0, 25, 22, FUR);
    // 脸颊 / 口吻部
    ellipse(ctx, 12, 7, 15, 11, CREAM);
    ellipse(ctx, -2, 10, 12, 9, CREAM);
    // 眉斑
    ellipse(ctx, 9, -13, 3, 2, CREAM);

    // 鼻子
    ellipse(ctx, 24, 2, 4, 3.2, INK);
    // 嘴
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(23, 6);
    ctx.quadraticCurveTo(19, 10, 14, 8);
    ctx.stroke();

    if (opts.happy) {
      ellipse(ctx, 17, 12, 4, 5.5, TONGUE);
      ellipse(ctx, -6, 4, 5, 3, BLUSH);
    }

    // 眼睛
    if (opts.eyesClosed) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(6, -2, 4, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else {
      ellipse(ctx, 7, -4, 3.4, 3.9, INK);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(8.2, -5.4, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawStandWalk(ctx, o) {
    const moving = o.pose === 'walk';
    const p = o.legPhase || 0;
    const bob = moving ? Math.sin(p * 2) * 1.5 : Math.sin(o.breath || 0) * 1;

    tail(ctx, -36, -66 + bob, o.tailWag || 0);
    // 远侧两条腿（深色，错开一点让四条腿都看得见）
    leg(ctx, -31, -44, p + Math.PI, FUR_DARK, moving);
    leg(ctx, 14, -44, p, FUR_DARK, moving);
    // 身体
    ellipse(ctx, 0, -54 + bob, 42, 26, FUR);
    ellipse(ctx, 8, -44 + bob, 24, 13, CREAM);
    // 近侧两条腿
    leg(ctx, -18, -46, p, FUR, moving);
    leg(ctx, 27, -46, p + Math.PI, FUR, moving);

    head(ctx, 44, -86 + bob, o, moving ? Math.sin(p) * 0.04 : 0);
  }

  function drawSit(ctx, o) {
    const bob = Math.sin(o.breath || 0) * 1;

    tail(ctx, -32, -40, o.tailWag || 0);
    // 后腿蜷坐
    ellipse(ctx, -16, -26, 27, 26, FUR);
    ellipse(ctx, 4, -5, 13, 5.5, '#DE9A50'); // 搭在地上的后脚
    // 躯干斜向上
    ellipse(ctx, 8, -52 + bob, 30, 25, FUR, -0.5);
    ellipse(ctx, 16, -42 + bob, 16, 14, CREAM, -0.5);
    // 前腿立直
    roundRect(ctx, 12, -50, 11, 50, 5, FUR_DARK);
    roundRect(ctx, 25, -48, 11, 48, 5, FUR);

    head(ctx, 36, -92 + bob, o, 0);
  }

  function drawLie(ctx, o) {
    const br = 1 + Math.sin(o.breath || 0) * 0.045;

    tail(ctx, -38, -20, (o.tailWag || 0) * 0.4);
    // 趴平的身体
    ellipse(ctx, -4, -18 * br, 44, 17 * br, FUR);
    ellipse(ctx, 0, -12, 26, 8, CREAM);
    // 前爪伸出来
    roundRect(ctx, 26, -10, 26, 9, 4.5, FUR);
    roundRect(ctx, 22, -16, 24, 9, 4.5, FUR_DARK);

    head(ctx, 36, -32, o, 0.12);
  }

  window.drawDog = function (ctx, o) {
    const s = o.scale || 1;
    ctx.save();
    ctx.translate(o.x, o.y);

    // 地面阴影（不随朝向翻转）
    const shadowR = o.pose === 'lie' ? 55 : 45;
    ellipse(ctx, 4 * (o.dir || 1), 2, shadowR, 7, 'rgba(0,0,0,0.10)');

    ctx.scale((o.dir || 1) * s, s);
    if (o.pose === 'sit') drawSit(ctx, o);
    else if (o.pose === 'lie') drawLie(ctx, o);
    else drawStandWalk(ctx, o);
    ctx.restore();
  };

  // 狗狗的可点击范围（画布坐标）
  window.dogHitBox = function (o) {
    const s = o.scale || 1;
    const w = (o.pose === 'lie' ? 130 : 120) * s;
    const h = (o.pose === 'lie' ? 70 : 130) * s;
    return { left: o.x - w / 2, top: o.y - h, width: w, height: h };
  };
})();
