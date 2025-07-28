// Fruity Flood – game.js (working draft, July 2025)
// --------------------------------------------------
// NOTE: This is the *current* version we are about to debug / improve.
// The user can edit directly here. I will anchor future patches to this file.

/*****  基础设置  *****/
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const wrap = document.querySelector('.game-wrap');
resize();

function resize(){
  cvs.width  = window.innerWidth;
  cvs.height = window.innerHeight;
}

/*****  阶段 & 计时 *****/
const STAGE_LEN  = 5 * 60 * 1000;   // 5 min per stage
let stage        = 'idle';          // idle → build → celebrate
let stageStart   = Date.now();      // phase begin time
let cakeCount    = 0;               // built cakes (< 5)
let spawnTimer   = 0;               // ms since last fruit spawn

/*****  资源加载 *****/
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
function load(src){ const i=new Image(); i.src=src; return i; }
IMG.bg    = load(paths.bg);
IMG.cake  = load(paths.cake);
IMG.wave1 = load(paths.wave1);
IMG.wave2 = load(paths.wave2);
IMG.fruits= paths.fruits.map(load);

/*****  小人类 *****/
class Fruit{
  constructor(img){
    this.img  = img;
    this.x    = Math.random()*cvs.width;
    this.y    = 40 + Math.random()*(cvs.height-140);  // leave top 40 & bottom 100 px
    this.seed = Math.random()*Math.PI*2;
  }
  draw(){
    const wobble = Math.sin(performance.now()/120+this.seed)*1;
    ctx.drawImage(this.img,this.x,this.y+wobble,64,64);
  }
}

let fruits   = [];

/*****  Emoji 台词 *****/
const LINES = {
  call  : ['🤔','👋','❓'],
  build : ['🔨','🍰','🧁'],
  cheer : ['🎉','🥂','👏','😋'],
  panic : ['😱😱😱😱😱']
};
function speak(unit,cat){
  const pool = LINES[cat]; if(!pool) return;
  const txt  = pool[Math.random()*pool.length|0];
  const div  = document.createElement('div');
  div.className = 'bubble'+(cat==='panic'?' float':'');
  div.textContent=txt;
  div.style.left=(unit.x)+'px';
  div.style.top =(unit.y-20)+'px';
  wrap.appendChild(div);
  setTimeout(()=>div.remove(),2500);
}

/*****  海浪控制 *****/
let wavePhase=0, waveX=0, waveY=0;
let waveStart=0;
const WAVE_DURATION=5000;
let waveCooldown=false, waveCooldownStart=0;
const COOLDOWN=5000;

cvs.addEventListener('pointerdown', ()=>{
  if(waveCooldown) return;
  wavePhase=1; waveX=0; waveY=0; waveStart=performance.now();
  // panic bubbles (≤5 fruits)
  fruits.slice().sort(()=>0.5-Math.random()).slice(0,Math.min(5,fruits.length))
        .forEach(f=>speak(f,'panic'));
  // reset world
  fruits=[]; stage='idle'; stageStart=performance.now(); cakeCount=0; spawnTimer=0;
});

function checkWaveEnd(){
  if(wavePhase===1 && performance.now()-waveStart>=WAVE_DURATION){
    wavePhase=0; waveX=waveY=0; waveCooldown=true; waveCooldownStart=performance.now();
  }
  if(waveCooldown && performance.now()-waveCooldownStart>=COOLDOWN){ waveCooldown=false; }
}

/*****  主循环 *****/
requestAnimationFrame(loop);
function loop(ts){
  /* 背景 */
  ctx.drawImage(IMG.bg,0,0,cvs.width,cvs.height);

  /* 画水果 */
  fruits.forEach(f=>f.draw());

  /* 海浪 */
  drawWave();
  checkWaveEnd();

  requestAnimationFrame(loop);
}

/*****  drawWave() — placeholder (unchanged) *****/
function drawWave(){ /* 略 — 与用户现有版本一致 */ }

/*****  tick() 计时器 — 每秒调用 *****/
function tick(){
  const now=Date.now(), delta=now-stageStart;
  // 阶段推进
  if(stage==='idle' && delta>=STAGE_LEN){ stage='build'; stageStart=now; }
  else if(stage==='build' && delta>=STAGE_LEN){
    if(cakeCount<5){ buildCake(); cakeCount++; stageStart=now; if(cakeCount>=5) stage='celebrate'; }
  }
  // 刷小人
  if((stage==='idle'||stage==='build') && wavePhase===0 && !waveCooldown){
    spawnTimer+=delta;
    if(spawnTimer>=3000){ spawnFruit(); spawnTimer=0; const p=fruits.at(-1); if(stage==='idle')speak(p,'call'); if(stage==='build')speak(p,'build'); }
  }
  // 欢呼
  if(stage==='celebrate' && Math.random()<0.3){ const f=fruits[Math.random()*fruits.length|0]; if(f) speak(f,'cheer'); }
}
setInterval(tick,1000);

/*****  辅助函数 *****/
function spawnFruit(){ fruits.push(new Fruit(IMG.fruits[Math.random()*IMG.fruits.length|0])); }
function buildCake(){ /* …保持原逻辑… */ }
