/*****  基础设置  *****/
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const wrap = document.querySelector('.game-wrap');
resize();

function resize(){
  cvs.width  = window.innerWidth;
  cvs.height = window.innerHeight;
}

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
    this.y = Math.random()*cvs.height*0.6 + 40;
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

/*****  番茄钟  *****/
const POMO = 25*60*1000;   // 25 分钟
let startT = performance.now();
function resetTimer(){ startT = performance.now(); cakeBuilt=false; }

/*****  海浪控制  *****/
let wavePhase = 0, waveX = 0, waveY = 0;
let waveCooldown = false;        // 浪后冷却标记
let waveCooldownStart = 0;       // 冷却开始时间
let waveStart = 0;              // ① 记录浪开始的时间
const WAVE_DURATION = 5000;     // ② 浪持续 5 秒（可改 3000‑5000）
cvs.addEventListener('pointerdown', triggerWave);
function triggerWave(){
  wavePhase=1; waveX=0; waveY=0;
  waveStart = performance.now();     // ③ 新增，标记开始时间
 // 随机挑最多 5 个水果小人冒泡（先取再清）
 const panicList = fruits
     .slice().sort(()=>0.5-Math.random())
     .slice(0, Math.min(5, fruits.length));
panicList.forEach(f=>speak(f,'panic'));

 fruits = [];                        // ② 现在再清空数组
 resetTimer();
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
