/*****  基础设置  *****/
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const wrap = document.querySelector('.game-wrap');
resize();

function resize(){
  cvs.width  = window.innerWidth;
  cvs.height = window.innerHeight;
}

/* --- 计时&阶段 --- */
const STAGE_LEN     = 5 * 60 * 1000;   // 5 分钟
let   stageStart    = Date.now();      // 当前阶段开始时刻
let   stage         = 'idle';          // idle | build | celebrate
let   cakeCount     = 0;               // 已出现蛋糕数 (上限 5)
let   spawnTimer    = 0;               // 累积刷小人计时


/*****  图片资源  *****/
const IMG = {};
const paths = {
  bg   : 'pics/backg0121.png',
  cake : 'pics/cake0121.png',
  wave1: 'pics/ocean_wave1.png',
  wave2: 'pics/ocean_wave2.png',
  fruits:[
    'pics/bberry0121.png',
    'pics/mango0121.png',
    'pics/papple0121.png',
    'pics/peach0121.png',
    'pics/sberry0121.png'
  ]
};
function load(src){
  const i = new Image(); i.src = src; return i;
}
IMG.bg    = load(paths.bg);
IMG.cake  = load(paths.cake);
IMG.wave1 = load(paths.wave1);
IMG.wave2 = load(paths.wave2);
IMG.fruits= paths.fruits.map(load);

/*****  水果小人类  *****/
class Fruit{
  constructor(img){
    this.img = img;
    this.x = Math.random()*cvs.width;
    this.y = 40 + Math.random() * (cvs.height - 140);   // 顶部 40 px 和底部 100 px 留空
    this.seed = Math.random()*Math.PI*2;   // ① 新增
  }
  draw(){  const wobble = Math.sin(performance.now()/120 + this.seed)*1; // ② 新增
         ctx.drawImage(this.img, this.x, this.y + wobble, 64, 64); }
}

let fruits   = [];
let cakeBuilt= false;

/*****  Emoji 台词池  *****/
const LINES = {
  call   : ['🤔','👋','❓'],
  build  : ['🔨','🍰','🧁'],
  cheer  : ['🎉','🥂','👏','😋'],
  panic  : ['😱😱😱😱😱']
};

/*****  气泡函数  *****/
function speak(unit,cat){
  const pool = LINES[cat];
  if(!pool) return;
  const text = pool[Math.random()*pool.length|0];
  const div = document.createElement('div');
  div.className = 'bubble' + (cat==='panic' ? ' float' : '');
  div.textContent=text;
  div.style.left = (unit.x) + 'px';
  div.style.top  = (unit.y-20)+ 'px';
  wrap.appendChild(div);
  setTimeout(()=>div.remove(),2500);
}

/*****  番茄钟【应该删掉的】  *****/
/*const POMO = 25*60*1000;   // 25 分钟 */
/*let startT = performance.now(); */
/*function resetTimer(){ startT = performance.now(); cakeBuilt=false; } */

/*****  海浪控制  *****/
/*****  海浪控制（整段替换版） *****/
let wavePhase   = 0;              // 0=平静 1=浪滚
let waveX = 0, waveY = 0;
let waveStart   = 0;              // 浪开始时刻
const WAVE_DURATION = 5000;       // 浪持续 5 秒

/* 冷却：浪结束后 5 秒内禁止再触发 */
let waveCooldown       = false;
let waveCooldownStart  = 0;
const WAVE_COOLDOWN_MS = 5000;

/* 点击触发浪 */
cvs.addEventListener('pointerdown', () => {
  /* 若冷却中则忽略点击 */
  if (waveCooldown) return;

  /* —— 1. 进入浪动画 —— */
  wavePhase  = 1;
  waveX = 0; waveY = 0;
  waveStart  = performance.now();

  /* —— 2. 随机 ≤5 个小人冒 panic 泡泡 —— */
  const panicList = fruits
        .slice()
        .sort(()=>0.5 - Math.random())
        .slice(0, Math.min(5, fruits.length));
  panicList.forEach(f => speak(f,'panic'));

  /* —— 3. 清空小人、彻底重置时间轴 —— */
  fruits = [];
  stage        = 'idle';
  stageStart   = performance.now();
  cakeCount    = 0;
  spawnTimer   = 0;
});

/* 在 drawWave() 尾部检测浪结束（保持之前的画浪逻辑） */
function checkWaveEnd(){
  if (wavePhase === 1 &&
      performance.now() - waveStart >= WAVE_DURATION){
      wavePhase = 0;   // 浪停
      waveX = 0; waveY = 0;

      /* 开启 5 秒冷却 */
      waveCooldown      = true;
      waveCooldownStart = performance.now();
  }

  /* 冷却计时 */
  if (waveCooldown &&
      performance.now() - waveCooldownStart >= WAVE_COOLDOWN_MS){
      waveCooldown = false;       // 冷却完毕，可再触浪
  }
}


/*****  主循环  *****/
let lastSpawn = 0;
requestAnimationFrame(loop);
function loop(ts){

      // 冷却计时：5 秒后允许重新刷小人
      if(waveCooldown && (performance.now() - waveCooldownStart > 5000)){
      waveCooldown = false;
      }

  /* 背景 */
  ctx.drawImage(IMG.bg,0,0,cvs.width,cvs.height);

  /* 生成水果人 */
  if(ts - lastSpawn > 3000 && !cakeBuilt && wavePhase === 0 && !waveCooldown){         // 每 3s 无浪 & 无冷却
    fruits.push(new Fruit(IMG.fruits[Math.random()*IMG.fruits.length|0]));
    lastSpawn = ts;
    if(fruits.length>1) speak(fruits.at(-1),'call');
  }

  /* 画水果人 */
  fruits.forEach(f=>f.draw());

  /* 盖蛋糕并庆祝 */
  if(!cakeBuilt && performance.now()-startT>=POMO){
    buildCake();
  }

  /* 海浪动画 */
  drawWave();

  requestAnimationFrame(loop);
}

/*****  盖蛋糕  *****/
function buildCake(){
  cakeBuilt=true;
  const cx = (cvs.width-IMG.cake.width)/2;
  const cy = cvs.height-IMG.cake.height-32;
  ctx.drawImage(IMG.cake,cx,cy);
  fruits.forEach(f=>speak(f,'cheer'));
}

/*****  绘制海浪 *****/
function drawWave(){
    if(wavePhase===1){

 /* ---------- wave 2：在底层持续上升，双贴图实现无缝垂直卷轴 ---------- */
 const y2 = (cvs.height - (waveY % IMG.wave2.height));
 ctx.drawImage(IMG.wave2, 0, y2);                      // 第 1 片
 ctx.drawImage(IMG.wave2, 0, y2 - IMG.wave2.height);   // 第 2 片接在上面
 waveY += 6;                                           // 每帧上升 6px

 /* ---------- wave 1：在上层横向滚动 ---------- */
 const start = - (waveX % IMG.wave1.width);
 for(let x = start; x < cvs.width; x += IMG.wave1.width){
   ctx.drawImage(IMG.wave1, x, cvs.height - IMG.wave1.height);
 }
   waveX -= 6;                                          // ④ 改成向右滚动
   if(waveX < 0) waveX += IMG.wave1.width;              // ⑤ 循环归位
 // ⑥ 5 秒到 → 结束浪

   if(performance.now() - waveStart > WAVE_DURATION){
     wavePhase = 0; waveX = 0;                          // 重置为平静
     waveY = 0;                                // 结束后归零
       waveCooldown = true;                       // 开启冷却
       waveCooldownStart = performance.now();
   }
  }

}

/*****  循环时间轴 *****/

/* ------- 统一计时的 tick()，每秒由 setInterval 调用 ------- */
function tick(){
  const now   = Date.now();
  const delta = now - stageStart;   // 距离当前阶段开始了多久（毫秒）

  /* ---------- 阶段推进 ---------- */
  if (stage === 'idle' && delta >= STAGE_LEN){
      stage = 'build';
      stageStart = now;             // 进入 build 阶段
  }
  else if (stage === 'build' && delta >= STAGE_LEN){
      if (cakeCount < 5){
          buildCake();              // 生成蛋糕
          cakeCount++;
          stageStart = now;         // 重置 5 分钟计时
          if (cakeCount >= 5){
              stage = 'celebrate';  // 达到上限 → 庆祝
          }
      }
  }

  /* ---------- 刷水果小人 ---------- */
  if ((stage === 'idle' || stage === 'build') && wavePhase===0 && !waveCooldown){
      spawnTimer += delta;          // 用 delta 计时更准确
      if (spawnTimer >= 3000){      // 每 3 秒刷一只
          spawnFruit();
          spawnTimer = 0;
          const last = fruits.at(-1);
          if (stage === 'idle')  speak(last,'call');
          if (stage === 'build') speak(last,'build');
      }
  }

  /* ---------- 庆祝阶段随机欢呼 ---------- */
  if (stage === 'celebrate' && Math.random() < 0.3){
      const f = fruits[Math.random()*fruits.length|0];
      if (f) speak(f,'cheer');
  }
}

setInterval(tick, 1000);   // 每秒跑一次，不受隐藏标签降频影响