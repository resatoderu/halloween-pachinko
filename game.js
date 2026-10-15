// Halloween Pachinko: 保留4個・リーチ・大当たり出玉
if (!window.Matter) {
  document.getElementById('message').textContent='物理エンジンを読み込めません。ネット接続を確認してね。';
  throw Error('Matter.js not loaded');
}
const {Engine,Bodies,Body,Composite}=Matter;
const engine=Engine.create();
engine.gravity.y=1.15;
const world=engine.world;
const canvas=document.getElementById('board');
const ctx=canvas.getContext('2d');
const n=['n1','n2','n3'].map(id=>document.getElementById(id));
const msg=document.getElementById('message');
const character=document.querySelector('.main-character');
const ballsLabel=document.getElementById('balls');
const startsLabel=document.getElementById('starts');
const powerInput=document.getElementById('power');
const fire=document.getElementById('fire');
let dialStartX=0,dialStartPower=65;
const MAX_HOLDS=4;
const JACKPOT_PAYOUT=300; // 仮設定。Discord連携前のローカル持ち玉
let ammo=100,starts=0,spinning=false,holds=0;
let firing=false,lastShot=0;
const liveBalls=[],pins=[],walls=[];
const randDigit=()=>1+Math.floor(Math.random()*9);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const screen=document.querySelector('.screen');
const holdPanel=document.createElement('div');
holdPanel.id='hold-panel';
holdPanel.style.cssText='padding:7px 0;color:#ffe4a0;font-weight:bold;font-size:16px;';
holdPanel.innerHTML='保留 <span id="hold-lamps"></span>';
if(screen)screen.appendChild(holdPanel);
const lamps=document.getElementById('hold-lamps');
function updateHolds(){
  lamps.textContent=''; 
  for(let i=0;i<MAX_HOLDS;i++){
    const lamp=document.createElement('span');
    lamp.textContent=i<holds?'🟠':'⚫';
    lamp.style.cssText='display:inline-block;margin:0 4px;font-size:19px;';
    lamps.appendChild(lamp);
  }
}
updateHolds();
function addStatic(x,y,w,h,angle=0){
  const b=Bodies.rectangle(x,y,w,h,{isStatic:true,angle,render:{visible:false}});
  Composite.add(world,b);walls.push(b);
}
addStatic(3,250,6,500);addStatic(397,250,6,500);addStatic(200,503,400,6);
for(let row=0;row<8;row++){
  for(let col=0;col<8;col++){
    const x=24+col*49+(row%2)*19,y=65+row*48;
    if(x>385||(y>345&&x>160&&x<240))continue;
    const pin=Bodies.circle(x,y,4,{isStatic:true,restitution:0.8});
    pins.push(pin);Composite.add(world,pin);
  }
}
const pocket={x:165,y:448,w:70,h:26};
async function animateDigits(duration,indices){
  const end=performance.now()+duration;
  while(performance.now()<end){
    indices.forEach(i=>n[i].textContent=randDigit());
    await wait(85);
  }
}
function queueSpin(){
  if(spinning){
    if(holds<MAX_HOLDS){holds++;updateHolds();}
    return;
  }
  void spin();
}
async function spin(){
  if(spinning)return;
  spinning=true;
  try{
    msg.textContent='🎰 図柄変動中！';
    await animateDigits(1300,[0,1,2]);
    const roll=Math.random();
    const jackpot=roll<0.008;
    const superReach=!jackpot&&roll<0.055;
    const reach=!jackpot&&!superReach&&roll<0.23;
    if(jackpot||superReach||reach){
      const symbol=jackpot&&Math.random()<0.35?7:randDigit();
      n[0].textContent=symbol;n[2].textContent=symbol;
      msg.textContent='⚡ リーチ！！ ⚡';
      await animateDigits(1300,[1]);
      if(jackpot||superReach){
        msg.textContent='👻 スーパーリーチ！！ 🎃';
        if(character)character.classList.add('jackpot');
        await animateDigits(1900,[1]);
        if(character)character.classList.remove('jackpot');
      }
      if(jackpot){
        n[1].textContent=symbol;
        ammo+=JACKPOT_PAYOUT;
        ballsLabel.textContent=ammo;
        msg.textContent=(symbol===7?'🌈 777 プレミア大当たり！':'🎉 大当たり！')+' ＋'+JACKPOT_PAYOUT+'玉！';
        if(character){
          character.classList.add('jackpot');
          setTimeout(()=>character.classList.remove('jackpot'),5000);
        }
      }else{
        let middle=randDigit();
        while(middle===symbol)middle=randDigit();
        n[1].textContent=middle;
        msg.textContent=superReach?'💨 スーパーリーチ、惜しくもハズレ！':'👻 リーチ、惜しい！';
      }
    }else{
      const left=randDigit();let right=randDigit();
      while(right===left)right=randDigit();
      n[0].textContent=left;n[1].textContent=randDigit();n[2].textContent=right;
      msg.textContent='👻 ハズレ！次を狙おう！';
    }
  }catch(err){
    console.error('抽選エラー:',err);
    msg.textContent='抽選中にエラーが発生しました';
  }finally{
    spinning=false;
    if(holds>0){
      holds--;updateHolds();
      setTimeout(()=>{if(!spinning)void spin();},650);
    }
  }
}
function shoot(){
  if(ammo<=0){firing=false;return;}
  ammo--;ballsLabel.textContent=ammo;
  const power=Number(powerInput.value)/100;
  const ball=Bodies.circle(370,475,5,{
    restitution:0.72,friction:0.001,frictionAir:0.0005,density:0.002,label:'pachinkoBall'
  });
  Composite.add(world,ball);
  Body.setVelocity(ball,{x:-5.5*power,y:-18*power});
  liveBalls.push({body:ball,born:performance.now()});
}
function setPower(value){
  const p=Math.max(20,Math.min(100,Math.round(value)));
  powerInput.value=String(p);
  document.getElementById('powerText').textContent=p;
  fire.style.setProperty('--dial-angle',((p-20)/80*125)+'deg');
  fire.setAttribute('aria-valuenow',String(p));
}
setPower(65);
fire.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  e.preventDefault();
  dialStartX=e.clientX;dialStartPower=Number(powerInput.value);
  firing=true;fire.classList.add('is-firing');
  fire.setPointerCapture(e.pointerId);
  shoot();lastShot=performance.now();
});
fire.addEventListener('pointermove',e=>{
  if(!firing)return;
  // 右へドラッグすると回転しながら強くなる
  setPower(dialStartPower+(e.clientX-dialStartX)*0.65);
});
function stopFire(){firing=false;fire.classList.remove('is-firing');}
fire.addEventListener('pointerup',stopFire);
fire.addEventListener('pointercancel',stopFire);
fire.addEventListener('lostpointercapture',stopFire);
window.addEventListener('blur',stopFire);
fire.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key==='ArrowUp'){e.preventDefault();setPower(Number(powerInput.value)+5);}
  if(e.key==='ArrowLeft'||e.key==='ArrowDown'){e.preventDefault();setPower(Number(powerInput.value)-5);}
  if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!firing){firing=true;shoot();lastShot=performance.now();}}
});
fire.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')stopFire();});
function drawBody(b,r,color){
  ctx.beginPath();ctx.arc(b.position.x,b.position.y,r,0,Math.PI*2);
  ctx.fillStyle=color;ctx.fill();
}
let previous=performance.now(),accumulator=0;
function frame(now){
  const dt=Math.min(now-previous,50);previous=now;accumulator+=dt;
  if(firing&&now-lastShot>=150){shoot();lastShot=now;}
  while(accumulator>=1000/60){Engine.update(engine,1000/60);accumulator-=1000/60;}
  for(let i=liveBalls.length-1;i>=0;i--){
    const item=liveBalls[i],b=item.body,x=b.position.x,y=b.position.y;
    if(x>pocket.x&&x<pocket.x+pocket.w&&y>pocket.y&&y<pocket.y+pocket.h){
      starts++;startsLabel.textContent=starts;queueSpin();
      Composite.remove(world,b);liveBalls.splice(i,1);
    }else if(y>495||y< -50||now-item.born>15000){
      Composite.remove(world,b);liveBalls.splice(i,1);
    }
  }
  ctx.clearRect(0,0,400,500);
  ctx.fillStyle='#28133d';ctx.fillRect(0,0,400,500);
  ctx.font='28px sans-serif';ctx.textAlign='center';ctx.fillText('🎃',200,40);
  pins.forEach(pin=>drawBody(pin,4,'#e7d8ff'));
  ctx.fillStyle='#ffac29';ctx.fillRect(pocket.x,pocket.y,pocket.w,pocket.h);
  ctx.fillStyle='#2c1438';ctx.font='14px sans-serif';ctx.fillText('START',200,466);
  liveBalls.forEach(item=>{
    drawBody(item.body,5,'#f5f7ff');
    ctx.beginPath();ctx.arc(item.body.position.x-1,item.body.position.y-2,2,0,Math.PI*2);
    ctx.fillStyle='#fff';ctx.fill();
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
