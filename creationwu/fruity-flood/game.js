"use strict";
/* ==========================================================
   Fruity Flood – fresh build (July 2025)
   架构要点：
   1) 统一时间源：全部使用 Date.now()；
   2) 两套节拍：
      - 渲染节拍：requestAnimationFrame 每帧重画（背景→蛋糕→水果→海浪）。
      - 逻辑节拍：setInterval 每 1000ms 执行 tick()，即使在后台也稳定推进。
   3) 三阶段时间轴（状态机）：
      idle(0–5min) → build(每 5 分钟出 1 个蛋糕，最多 5 个) → celebrate(停止新增，仅随机欢呼)。
   4) 海浪：点击画布触发；动画 5s；结束后冷却 5s；触发时清空水果与蛋糕并重置阶段。
   5) 所有“存在于场景”的对象都以状态记录，每帧按状态重画（避免被背景覆盖）。
   ========================================================== */

/***** 1) 画布与容器 *****/
const cvs  = document.getElementById("game");
const ctx  = cvs.getContext("2d");
const wrap = document.querySelector(".game-wrap");
// 固定画布尺寸（与背景一致）。如果要自适应缩放，请在 CSS 对 .game-wrap 做 transform:scale。

/***** 2) 资源与预加载 *****/
const ASSETS = {
  bg    : "pics/backg0121.png",
  cake  : "pics/cake0121.png",
  wave1 : "pics/ocean_wave1.png", // 横向平铺滚动
  wave2 : "pics/ocean_wave2.png", // 垂直平铺上升
  fruits: [
    "pics/bberry0121.png",
    "pics/mango0121.png",
    "pics/papple0121.png",
    "pics/peach0121.png",
    "pics/sberry0121.png",
  ],
};
const IMG = { fruits: [] };

function loadImage(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload  = ()=>resolve(img);
    img.onerror = ()=>reject(new Error("Failed to load "+src));
    img.src = src;
  });
}

async function preloadAll(){
  IMG.bg    = await loadImage(ASSETS.bg);
  IMG.cake  = await loadImage(ASSETS.cake);
  IMG.wave1 = await loadImage(ASSETS.wave1);
  IMG.wave2 = await loadImage(ASSETS.wave2);
  IMG.fruits = await Promise.all(ASSETS.fruits.map(loadImage));
}

/***** 3) 状态：水果、蛋糕、时间轴、海浪 *****/
// 水果小人（对象数组）：{ img, x, y, seed }
let fruits = [];
// 蛋糕（仅记录存在即可；渲染时统一绘制）。
let cakes  = []; // 例如 [{ created: 172xxx }]

// 阶段机（时间轴）
const STAGE_LEN = 5 * 60 * 1000; // 每阶段 5 分钟
let stage        = "idle";       // idle | build | celebrate
let stageStart   = Date.now();    // 当前阶段开始时刻
let cakeCount    = 0;             // 已出现蛋糕数（上限 5）

// 刷水果的节拍（用 dt 计算，避免漂移）
let spawnTimer   = 0;
let lastTick     = Date.now();
const SPAWN_INTERVAL = 4000;      // 每 4 秒 1 个（可调 3000/5000）
const MAX_FRUITS      = 500;      // 上限保护，避免长时爆量

// 海浪状态
let wavePhase = 0;                // 0=平静 1=滚浪中
let waveX = 0, waveY = 0;         // 波形偏移（横向/纵向）
let waveStart = 0;                // 浪开始时刻
const WAVE_DURATION = 5000;       // 海浪持续 5s
let waveCooldown = false;         // 浪冷却中？
let waveCooldownStart = 0;
const WAVE_COOLDOWN_MS = 5000;    // 冷却 5s

/***** 4) 小工具：对话气泡 *****/
const LINES = {
  call  : ["🤔","👋","❓"],
  build : ["🔨","🍰","🧁"],
  cheer : ["🎉","🥂","👏","😋"],
  panic : ["😱😱😱😱😱","💦😱💦😱💦"],
};
function speak(unit, kind){
  const pool = LINES[kind];
  if(!unit || !pool) return;
  const div = document.createElement("div");
  div.className   = "bubble" + (kind === "panic" ? " float" : "");
  div.textContent = pool[(Math.random()*pool.length)|0];
  // 将气泡定位到水果上方
  div.style.left = `${unit.x}px`;
  div.style.top  = `${unit.y - 20}px`;
  wrap.appendChild(div);
  setTimeout(()=>div.remove(), 2500);
}

/***** 5) 基本实体：水果类 *****/
class Fruit{
  constructor(img){
    this.img  = img;
    this.x    = Math.random() * cvs.width;
    // 顶部保留 40px 给气泡，底部保留 100px 给浪/蛋糕
    this.y    = 40 + Math.random() * (cvs.height - 140);
    this.seed = Math.random() * Math.PI * 2; // 抖动相位
  }
  draw(){
    const wobble = Math.sin(performance.now()/120 + this.seed) * 1; // 轻微上下抖动
    ctx.drawImage(this.img, this.x, this.y + wobble, 64, 64);
  }
}
function spawnFruit(){
  if (fruits.length >= MAX_FRUITS) return;
  const img = IMG.fruits[(Math.random()*IMG.fruits.length)|0];
  const f = new Fruit(img);
  fruits.push(f);
}

/***** 6) 阶段推进（每秒 tick，一直在后台运行） *****/
function tick(){
  const now = Date.now();
  const dt  = now - lastTick;     // 本次 tick 与上次之间的真实间隔
  lastTick  = now;
  const phaseElapsed = now - stageStart; // 当前阶段已过去时间

  // A) 阶段切换（每 5 分钟推进）
  if (stage === "idle"  && phaseElapsed >= STAGE_LEN){
    stage = "build";
    stageStart = now;              // 重置下一个 5 分钟
  }
  else if (stage === "build" && phaseElapsed >= STAGE_LEN){
    if (cakeCount < 5){
      buildCake();                 // 到点生成一个蛋糕
      cakeCount++;
      stageStart = now;            // 重置 5 分钟计时
      if (cakeCount >= 5) stage = "celebrate";
    }
  }

  // B) 刷水果（仅在 idle/build 且无浪/无冷却）
  if ((stage === "idle" || stage === "build") && wavePhase === 0 && !waveCooldown){
    spawnTimer += dt;
    if (spawnTimer >= SPAWN_INTERVAL){
      spawnFruit();
      spawnTimer = 0;
      const last = fruits.at(-1);
      if (last){
        if (stage === "idle")  speak(last, "call");
        if (stage === "build") speak(last, "build");
      }
    }
  }

  // C) 庆祝阶段：随机冒欢呼气泡
  if (stage === "celebrate" && Math.random() < 0.3){
    const f = fruits[(Math.random()*fruits.length)|0];
    if (f) speak(f, "cheer");
  }
}

/***** 7) 生成蛋糕（记录状态；渲染时每帧绘制） *****/
function buildCake(){
  cakes.push({ created: Date.now() }); // 记录一个“蛋糕已存在”的标记
  // 出蛋糕时所有在场小人欢呼
  fruits.forEach(f=>speak(f, "cheer"));
}

/***** 8) 海浪：点击触发，5s 动画 + 5s 冷却，清空场景并重置阶段 *****/
function triggerWave(){
  if (waveCooldown || wavePhase === 1) return; // 冷却中或已在浪中
  wavePhase = 1;
  waveX = 0; waveY = 0;
  waveStart = performance.now();

  // 少量随机小人冒“惊慌”
  fruits.slice().sort(()=>0.5-Math.random()).slice(0, Math.min(5, fruits.length))
        .forEach(f=>speak(f, "panic"));

  // 清空场景 & 重置时间轴
  fruits = [];
  cakes  = [];
  stage = "idle";
  stageStart = Date.now();
  cakeCount  = 0;
  spawnTimer = 0;
}

  // 长按3秒触发海浪“大洪水”
let pressTimer=null, moved=false, sx=0, sy=0;

cvs.addEventListener('pointerdown', e=>{
  moved=false; sx=e.clientX; sy=e.clientY;
  pressTimer = setTimeout(()=>{ triggerWave(); pressTimer=null; }, 300);
});
cvs.addEventListener('pointermove', e=>{
  if(!pressTimer) return;
  const dx=e.clientX - sx, dy=e.clientY - sy;
  if (Math.hypot(dx,dy) > 15) { clearTimeout(pressTimer); pressTimer=null; } // 滑动就不触发
});
['pointerup','pointercancel','pointerleave'].forEach(ev=>{
  cvs.addEventListener(ev, ()=>{ if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; } });
});



/***** 9) 渲染（每帧） *****/
function drawBackground(){
  // 背景每帧重画一次，避免覆盖其他层：我们先画背景，再画蛋糕/水果/海浪。
  ctx.drawImage(IMG.bg, 0, 0, cvs.width, cvs.height);
}

function drawCakes(){
  if (cakes.length === 0) return;
  const w = IMG.cake.naturalWidth  || IMG.cake.width;
  const h = IMG.cake.naturalHeight || IMG.cake.height;
  if (!w || !h) return; // 还没加载好

  // 将多个蛋糕横向排布（居中），间距 12px。
  const gap = 12;
  const totalW = cakes.length * w + (cakes.length - 1) * gap;
  let x = (cvs.width - totalW) / 2;
  const y = cvs.height - h - 264;  // 底部上来 264px

  for (let i=0; i<cakes.length; i++){
    ctx.drawImage(IMG.cake, x, y);
    x += w + gap;
  }
}

function drawFruits(){
  for (const f of fruits) f.draw();
}

function drawWave(){
  if (wavePhase !== 1) return;

  // 防呆：若图片未加载完（宽高为 0），本帧先不绘制，避免 % 0 造成 NaN。
  const w1 = IMG.wave1.naturalWidth  || IMG.wave1.width;
  const h2 = IMG.wave2.naturalHeight || IMG.wave2.height;
  if (!w1 || !h2) return;

  // wave2：垂直卷轴（从底部向上覆盖）。
  const y2 = (cvs.height - (waveY % h2));
  ctx.drawImage(IMG.wave2, 0, y2);
  ctx.drawImage(IMG.wave2, 0, y2 - h2);
  waveY += 6; // 上升速度

  // wave1：水平卷轴（向右移动的视觉效果：偏移量递减）。
  const start = - (waveX % w1);
  for(let x = start; x < cvs.width; x += w1){
    const bottom = cvs.height - (IMG.wave1.naturalHeight || IMG.wave1.height);
    ctx.drawImage(IMG.wave1, x, bottom);
  }
  waveX -= 6;                  // 递减 → 视觉上向右滚
  if (waveX < 0) waveX += w1;  // 环回

  // 到时停止浪并进入冷却
  if (performance.now() - waveStart >= WAVE_DURATION){
    wavePhase = 0;
    waveX = 0; waveY = 0;
    waveCooldown = true;
    waveCooldownStart = performance.now();
  }
}

function checkWaveCooldown(){
  if (waveCooldown && performance.now() - waveCooldownStart >= WAVE_COOLDOWN_MS){
    waveCooldown = false;
  }
}

function loop(){
  drawBackground();
  drawCakes();     // 先画蛋糕，再画水果（让小人可以在蛋糕前/上方）
  drawFruits();
  drawWave();
  checkWaveCooldown();
  requestAnimationFrame(loop);
}

/***** 10) 启动顺序：预加载 → 开始 tick/loop *****/
(async function start(){
  try{
    await preloadAll();          // 等全部图片加载完成
  }catch(err){
    console.error(err);
    // 即使失败也尽量继续（你也可以在这里显示一条友好消息）。
  }
  // 逻辑时钟：每秒推进一次（后台也能跑）。
  setInterval(tick, 1000);
  // 渲染时钟：每帧重画。
  requestAnimationFrame(loop);
})();

/***** 11) 修正：为适应不同屏幕大小，进行整体缩放 *****/
function fitScale(){
  const baseW = 1536, baseH = 1024;
  const s = Math.min(window.innerWidth / baseW, window.innerHeight / baseH, 1); // 只缩小
  const el = document.querySelector('.game-wrap');
  el.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fitScale);
fitScale();


/*
  —— 使用说明 ——
  1) 打开 index.html：几秒内会出现第一批水果小人；
  2) 5 分钟：进入 build 阶段；10 分钟：第 1 个蛋糕出现；之后每 5 分钟 +1，最多 5 个；
  3) 点击画布：触发海浪（5s 动画）；浪退去后冷却 5s 才能再次点击；
  4) 若首次点击没看到浪，可能是浪图仍在加载：第二次点击应可见（也可等待预加载完成再开场）。
  5) 如需调整节奏：
     - 刷水果间隔：改 SPAWN_INTERVAL（毫秒）；
     - 阶段长度：改 STAGE_LEN（默认 5 分钟）；
     - 海浪动画时长/冷却：改 WAVE_DURATION 与 WAVE_COOLDOWN_MS。
*/