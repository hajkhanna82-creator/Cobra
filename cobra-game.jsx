import { useState, useRef, useEffect, useCallback, Component } from "react";
import { supabase } from "./src/supabase.js";
import { useRoom, saveRoomDB, loadRoomDB } from "./src/useRoom.js";
import QRCode from "qrcode";

const SUITS=["♠","♥","♦","♣"];
const VALUES=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const VM={A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13};
const cvHigh=c=>c.value==="A"?14:VM[c.value];
const COBRA_PEN=30,LOSE=100,DECLARE_MAX=30,TURN_SEC=30;
const CPU_P=[{thinkMs:1200,risk:0.25},{thinkMs:800,risk:0.65},{thinkMs:1500,risk:0.45},{thinkMs:700,risk:0.7}];
const EMOJIS=["👀","🔥","😂","🐍","💀","😤","🤡","👑"];
const AVATAR_EMOJIS=["😎","🤠","👑","🐍","🔥","💀","🎭","🃏"];
const ACHIEVEMENTS=[
  {id:"first_win",icon:"🏆",name:"First Blood",desc:"Win your first round"},
  {id:"low_score",icon:"💎",name:"Diamond Hand",desc:"Declare with total 5 or under"},
  {id:"cobra_survive",icon:"🐍",name:"Snake Charmer",desc:"Survive a cobra penalty"},
  {id:"speed_win",icon:"⚡",name:"Lightning",desc:"Win a round in under 10 seconds"},
  {id:"big_run",icon:"🃏",name:"Full House",desc:"Play a run of 5+ cards"},
];
const TUTORIAL_STEPS=[
  {icon:"🐍",title:"Welcome to COBRA!",body:"The goal is simple: have the LOWEST total card value in your hand when someone declares."},
  {icon:"🃏",title:"Your Hand",body:"You start with 7 cards. Ace=1 point, King=13 points. Lower is better! Your total shows bottom-right."},
  {icon:"🔄",title:"Your Turn",body:"Tap cards to select and play a sequence. Then pick up one card from the pile or draw from the deck."},
  {icon:"♣",title:"Valid Sequences",body:"Single card, Pair (two same number), Triple/Quad, Run of 3+ (5,6,7), or Flush (3+ same suit). Ace plays high too — Q,K,A is a valid run!"},
  {icon:"📢",title:"Declaring",body:"When your total is 30 or less, you CAN DECLARE at the start of your turn. If you have the strictly lowest total — you win the round and score zero!"},
  {icon:"🐍",title:"The Cobra Penalty!",body:"Wrong declare (tied or not lowest) = your total + 30 penalty. Only YOU get penalised. Others score nothing that round."},
  {icon:"💀",title:"Elimination",body:"First player to reach 100 points is eliminated. Last one standing wins. Good luck! 🎴"},
];

const cv=c=>VM[c.value];
const ht=h=>h.reduce((s,c)=>s+cv(c),0);
const isRed=c=>c.suit==="♥"||c.suit==="♦";
const mkDeck=()=>SUITS.flatMap(s=>VALUES.map(v=>({suit:s,value:v,id:v+s})));
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
const rnd=(a,b)=>a+Math.random()*(b-a);

function isValidSeq(cards){
  if(!cards||!cards.length)return false;
  if(cards.length===1)return true;
  if(cards.length===2)return cards[0].value===cards[1].value;
  if(cards.every(c=>c.value===cards[0].value))return true;
  const sLow=[...cards].sort((a,b)=>cv(a)-cv(b));
  if(sLow.every((_,i)=>i===0||cv(sLow[i])===cv(sLow[i-1])+1))return true;
  const sHigh=[...cards].sort((a,b)=>cvHigh(a)-cvHigh(b));
  if(sHigh.every((_,i)=>i===0||cvHigh(sHigh[i])===cvHigh(sHigh[i-1])+1))return true;
  if(cards.length>=3&&cards.every(c=>c.suit===cards[0].suit))return true;
  return false;
}
function seqLabel(cards){
  if(!cards||!cards.length)return"";
  if(cards.length===1)return"Single";
  if(cards.length===2&&cards[0].value===cards[1].value)return"Pair";
  if(cards.every(c=>c.value===cards[0].value))return cards.length===3?"Triple":"Quad";
  const sLow=[...cards].sort((a,b)=>cv(a)-cv(b));
  if(sLow.every((_,i)=>i===0||cv(sLow[i])===cv(sLow[i-1])+1))return"Run of "+cards.length;
  const sHigh=[...cards].sort((a,b)=>cvHigh(a)-cvHigh(b));
  if(sHigh.every((_,i)=>i===0||cvHigh(sHigh[i])===cvHigh(sHigh[i-1])+1))return"Run of "+cards.length;
  if(cards.length>=3&&cards.every(c=>c.suit===cards[0].suit))return cards[0].suit+" Flush";
  return"Sequence";
}

const audio={
  _ctx:null,_master:null,_bgGain:null,_sfxGain:null,
  _muted:false,_musicMuted:false,_bgNodes:[],_ready:false,_arpTimer:null,
  init(){
    if(this._ready)return;
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      this._ctx=ctx;
      this._master=ctx.createGain();this._master.gain.value=0.7;this._master.connect(ctx.destination);
      this._sfxGain=ctx.createGain();this._sfxGain.gain.value=1;this._sfxGain.connect(this._master);
      this._bgGain=ctx.createGain();this._bgGain.gain.value=0;this._bgGain.connect(this._master);
      this._ready=true;this._startBg();
    }catch(e){}
  },
  resume(){if(this._ctx&&this._ctx.state==="suspended")this._ctx.resume();},
  _startBg(){
    if(!this._ctx||this._musicMuted)return;
    const ctx=this._ctx;
    this._bgNodes.forEach(n=>{try{n.stop();}catch(e){}});this._bgNodes=[];
    if(this._arpTimer){clearInterval(this._arpTimer);this._arpTimer=null;}
    const delay=ctx.createDelay(1.0);delay.delayTime.value=0.35;
    const fb=ctx.createGain();fb.gain.value=0.3;
    delay.connect(fb);fb.connect(delay);
    const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=600;
    lp.connect(this._bgGain);delay.connect(lp);
    [[55,"sine",0.08],[82.4,"triangle",0.055],[110,"sine",0.04],[130.8,"triangle",0.03],[164.8,"sine",0.025]].forEach(function(cfg){
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type=cfg[1];o.frequency.value=cfg[0]*(1+(Math.random()-0.5)*0.01);
      g.gain.value=cfg[2];o.connect(g);g.connect(lp);g.connect(delay);o.start();
      this._bgNodes.push(o);
    }.bind(this));
    var arpPatterns=[[220,261.6,329.6,392,440,329.6],[246.9,293.7,349.2,415.3,493.9,415.3]];
    var arpNotes=arpPatterns[0];var arpPatternIdx=0;var arpIdx=0;
    var arpOsc=ctx.createOscillator(),arpG=ctx.createGain();
    arpOsc.type="sine";arpOsc.frequency.value=arpNotes[0];
    arpG.gain.value=0.018;arpOsc.connect(arpG);arpG.connect(lp);arpOsc.start();
    this._bgNodes.push(arpOsc);
    this._arpTimer=setInterval(function(){
      arpIdx=(arpIdx+1)%arpNotes.length;
      if(arpIdx===0){arpPatternIdx=(arpPatternIdx+1)%arpPatterns.length;arpNotes=arpPatterns[arpPatternIdx];}
      try{arpOsc.frequency.setValueAtTime(arpNotes[arpIdx],ctx.currentTime);}catch(e){}
    },1800);
    var lfo=ctx.createOscillator(),lfoG=ctx.createGain();
    lfo.frequency.value=0.06;lfoG.gain.value=80;
    lfo.connect(lfoG);lfoG.connect(lp.frequency);lfo.start();this._bgNodes.push(lfo);
    var t=ctx.currentTime;
    this._bgGain.gain.setValueAtTime(0,t);this._bgGain.gain.linearRampToValueAtTime(0.5,t+4);
  },
  _tone(f,type,vol,dur,delay){
    try{
      if(!this._ctx||!this._sfxGain||this._muted)return;
      const ctx=this._ctx,now=ctx.currentTime+(delay||0);
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type=type;o.frequency.setValueAtTime(f,now);
      g.gain.setValueAtTime(0.0001,now);g.gain.linearRampToValueAtTime(vol,now+0.008);
      g.gain.exponentialRampToValueAtTime(0.0001,now+Math.max(dur,0.01));
      o.connect(g);g.connect(this._sfxGain);o.start(now);o.stop(now+dur+0.05);
    }catch(e){}
  },
  _sweep(f1,f2,vol,dur){
    try{
      if(!this._ctx||!this._sfxGain||this._muted)return;
      const ctx=this._ctx,now=ctx.currentTime;
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type="sine";o.frequency.setValueAtTime(f1,now);o.frequency.exponentialRampToValueAtTime(f2,now+dur);
      g.gain.setValueAtTime(0.0001,now);g.gain.linearRampToValueAtTime(vol,now+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001,now+dur);
      o.connect(g);g.connect(this._sfxGain);o.start(now);o.stop(now+dur+0.05);
    }catch(e){}
  },
  _noise(vol,dur,lpFreq){
    try{
      if(!this._ctx||!this._sfxGain||this._muted)return;
      const ctx=this._ctx,now=ctx.currentTime;
      const len=Math.ceil(ctx.sampleRate*dur);
      const buf=ctx.createBuffer(1,len,ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.8);
      const src=ctx.createBufferSource();src.buffer=buf;
      const filt=ctx.createBiquadFilter();filt.type="lowpass";filt.frequency.value=lpFreq||4000;
      const g=ctx.createGain();g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(0.0001,now+dur);
      src.connect(filt);filt.connect(g);g.connect(this._sfxGain);src.start(now);
    }catch(e){}
  },
  buttonClick(){this._tone(200,"sine",0.25,0.055,0);this._noise(0.2,0.035,4500);this._tone(1600,"sine",0.07,0.04,0.006);},
  cardDeal(){this._sweep(280,1500,0.14,0.15);this._noise(0.1,0.12,6000);},
  cardPickup(){this._sweep(1300,320,0.12,0.18);this._noise(0.09,0.14,5000);},
  cardSelect(){this._tone(1000,"sine",0.08,0.06,0);this._tone(1300,"sine",0.05,0.04,0.012);},
  cardPlay(){this._tone(240,"sine",0.2,0.1,0);this._noise(0.12,0.09,5000);this._tone(800,"sine",0.06,0.07,0.035);},
  declare(){[261,329,392,523].forEach((f,i)=>this._tone(f,"sine",0.17,0.55,i*0.065));},
  cobraStrike(){this._sweep(500,60,0.22,0.45);this._noise(0.15,0.3,2000);},
  win(){[523,659,784,1047].forEach((f,i)=>this._tone(f,"sine",0.18,0.45,i*0.1));this._tone(1047,"triangle",0.12,0.7,0.4);},
  turnChange(){this._tone(520,"sine",0.06,0.1,0);},
  timerTick(){this._tone(800,"sine",0.04,0.05,0);},
  timerUrgent(){this._tone(1000,"sine",0.1,0.07,0);},
  achievement(){[784,988,1174].forEach((f,i)=>this._tone(f,"sine",0.15,0.3,i*0.1));},
  shuffle_sfx(){for(let i=0;i<7;i++)setTimeout(()=>this.cardDeal(),i*85);},
  toggleMute(){this._muted=!this._muted;if(this._master&&this._ctx)this._master.gain.linearRampToValueAtTime(this._muted?0:0.7,this._ctx.currentTime+0.1);},
  toggleMusic(){
    this._musicMuted=!this._musicMuted;
    if(this._bgGain&&this._ctx){
      if(this._musicMuted){
        if(this._arpTimer){clearInterval(this._arpTimer);this._arpTimer=null;}
        this._bgGain.gain.linearRampToValueAtTime(0,this._ctx.currentTime+0.5);
      } else {this._startBg();}
    }
  },
};

const haptic={
  light(){try{if(navigator.vibrate)navigator.vibrate(10);}catch(e){}},
  medium(){try{if(navigator.vibrate)navigator.vibrate(25);}catch(e){}},
  success(){try{if(navigator.vibrate)navigator.vibrate([10,5,20]);}catch(e){}},
  error(){try{if(navigator.vibrate)navigator.vibrate([50,20,50]);}catch(e){}},
  cardPlay(){try{if(navigator.vibrate)navigator.vibrate([15,5,10]);}catch(e){}},
  declare(){try{if(navigator.vibrate)navigator.vibrate([20,10,20,10,40]);}catch(e){}},
  cobra(){try{if(navigator.vibrate)navigator.vibrate([80,30,80]);}catch(e){}},
  win(){try{if(navigator.vibrate)navigator.vibrate([10,5,10,5,10,5,40]);}catch(e){}},
};

// saveRoom / loadRoom now delegate to Supabase (see src/useRoom.js)
function saveRoom(c,s){return saveRoomDB(c,s)||Promise.resolve();}
function loadRoom(c){return loadRoomDB(c).then(function(r){return r||null;});}

const GS=`
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#010603;height:100%;-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%;}
html{padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);}
@media(max-width:375px){html{font-size:14px;}}
@media(min-width:428px){html{font-size:17px;}}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:#1a2e1a;border-radius:4px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:14px;font-family:Cinzel,serif;font-weight:700;letter-spacing:2px;cursor:pointer;transition:transform 0.15s cubic-bezier(.34,1.5,.64,1),box-shadow 0.15s,filter 0.15s;user-select:none;text-transform:uppercase;position:relative;overflow:hidden;white-space:nowrap;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:48px;min-width:48px;}
.btn::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.1)0%,transparent 55%);pointer-events:none;}
.btn:active{transform:scale(0.93);}
.btn:disabled{opacity:0.3;cursor:not-allowed;transform:none;}
.panel{background:rgba(2,8,4,0.9);border:1px solid rgba(255,255,255,0.08);border-radius:22px;backdrop-filter:blur(20px);box-shadow:0 16px 60px rgba(0,0,0,0.65),inset 0 1px 0 rgba(255,255,255,0.05);}
input{background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.12);border-radius:12px;color:#e5e7eb;font-size:16px;font-family:Crimson Text,serif;outline:none;transition:all 0.2s;width:100%;display:block;padding:14px 16px;-webkit-appearance:none;}
input:focus{border-color:rgba(212,168,67,0.6);box-shadow:0 0 0 3px rgba(212,168,67,0.12);}
input::placeholder{color:#2a3d28;}
.feltbg{background:radial-gradient(ellipse 180% 90% at 50% -15%,#0d2e14 0%,#040f05 60%,#010402 100%);min-height:100vh;position:relative;}
.feltbg::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.003)2px,rgba(255,255,255,0.003)3px),repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(255,255,255,0.0025)2px,rgba(255,255,255,0.0025)3px);}
.feltbg::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse 90% 80% at 50% 50%,transparent 28%,rgba(0,0,0,0.75)100%);}
@media screen and (orientation:landscape) and (max-height:500px){body::before{content:"Rotate to portrait mode";position:fixed;inset:0;background:#010603;color:#d4a843;font-family:Cinzel,serif;font-size:18px;display:flex;align-items:center;justify-content:center;text-align:center;z-index:9999;padding:20px;}#root{display:none;}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes splashPop{0%{opacity:0;transform:scale(0.7) translateY(20px)}100%{opacity:1;transform:scale(1) translateY(0)}}
@keyframes glowGreen{0%,100%{box-shadow:0 0 10px rgba(74,222,128,0.2)}50%{box-shadow:0 0 26px rgba(74,222,128,0.55)}}
@keyframes shimmer{0%{opacity:0.5}50%{opacity:1}100%{opacity:0.5}}
@keyframes thinkDot{0%,80%,100%{transform:scale(0.55);opacity:0.35}40%{transform:scale(1);opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes screenIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
@keyframes screenOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-30px)}}
.screen_in{animation:screenIn 0.28s cubic-bezier(.22,1,.36,1) both;}
@keyframes cardFlip{0%{transform:scaleX(0) translateY(-10px);opacity:0}50%{transform:scaleX(0.5);opacity:0.5}100%{transform:scaleX(1) translateY(0);opacity:1}}
@keyframes declarePop{0%{transform:scale(0.85);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
@keyframes orbFloat{0%,100%{transform:scale(1) translate(0,0)}33%{transform:scale(1.08) translate(8px,-6px)}66%{transform:scale(0.95) translate(-6px,5px)}}
@keyframes cobraBounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-10px)}70%{transform:translateY(-4px)}}
@keyframes timerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@keyframes emojiFloat{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(1.4)}}
@keyframes achievePop{0%{opacity:0;transform:translateX(120px)}15%{opacity:1;transform:translateX(-8px)}85%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(120px)}}
@keyframes fadeOut{0%{opacity:1}65%{opacity:1}100%{opacity:0}}
@keyframes cardPlay{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-120px) scale(0.7);opacity:0}}
@keyframes cardPickup{0%{transform:translateY(-80px) scale(0.7);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes yourTurnGlow{0%{box-shadow:0 0 30px rgba(212,168,67,0.7),0 0 60px rgba(212,168,67,0.35)}100%{box-shadow:0 0 60px rgba(212,168,67,0.95),0 0 100px rgba(212,168,67,0.6)}}
@keyframes confettiFall{0%{opacity:1;transform:translateY(-20px) rotate(0deg) scale(1)}100%{opacity:0;transform:translateY(200px) rotate(720deg) scale(0.3)}}
@keyframes tutBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes tutPulse{0%,100%{box-shadow:0 0 0 9999px rgba(0,0,0,0.78),0 0 0 3px #d4a843,0 0 20px rgba(212,168,67,0.5)}50%{box-shadow:0 0 0 9999px rgba(0,0,0,0.78),0 0 0 3px #fbbf24,0 0 36px rgba(212,168,67,0.9)}}
@keyframes particleFloat{0%{opacity:0;transform:translateY(0) translateX(0)}20%{opacity:0.12}80%{opacity:0.08}100%{opacity:0;transform:translateY(-120px) translateX(15px)}}
@keyframes scoreFlash{0%{transform:scale(1)}40%{transform:scale(1.4)}100%{transform:scale(1)}}
@keyframes borderGlow{0%,100%{box-shadow:0 0 8px rgba(185,28,28,0.3)}50%{box-shadow:0 0 28px rgba(185,28,28,0.8),0 0 50px rgba(185,28,28,0.4)}}
@keyframes cobraShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes shake{0%,100%{transform:translateX(0)}10%{transform:translateX(-8px)}20%{transform:translateX(8px)}30%{transform:translateX(-6px)}40%{transform:translateX(6px)}50%{transform:translateX(-4px)}60%{transform:translateX(4px)}70%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
@keyframes elimBounce{0%,100%{transform:scale(1) translateY(0)}30%{transform:scale(1.3) translateY(-20px)}60%{transform:scale(0.9) translateY(-8px)}}
@keyframes elimFadeIn{from{opacity:0}to{opacity:1}}
@keyframes rewardPop{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes tileSpinWheel{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.elim_shake{animation:shake 0.5s ease-in-out infinite;}
.anim_up{animation:fadeUp 0.34s cubic-bezier(.22,1,.36,1) both;}
.anim_up_screen_in{animation:fadeUp 0.34s cubic-bezier(.22,1,.36,1) both,screenIn 0.28s cubic-bezier(.22,1,.36,1) both;}
.anim_in{animation:fadeIn 0.22s ease both;}
.float{animation:float 3.5s ease-in-out infinite;}
.pulse{animation:pulse 1.6s ease-in-out infinite;}
.glow_pile{animation:glowGreen 2.2s ease-in-out infinite;}
.shimmer{animation:shimmer 2.2s ease-in-out infinite;}
.think_dot{animation:thinkDot 1.4s ease-in-out infinite;}
.orb_float{animation:orbFloat 9s ease-in-out infinite;}
.btn_btn_gold{background:linear-gradient(155deg,#e0bc4e,#c49030,#a87420);color:#120c00;box-shadow:0 4px 20px rgba(196,144,48,0.45),inset 0 1px 0 rgba(255,255,255,0.32);display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:14px;font-family:Cinzel,serif;font-weight:700;letter-spacing:2px;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;user-select:none;text-transform:uppercase;position:relative;overflow:hidden;white-space:nowrap;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:48px;min-width:48px;}
.btn_btn_gold::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(255,255,255,0.1)0%,transparent 55%);pointer-events:none;}
.btn_btn_gold:active{transform:scale(0.93);}
.btn_btn_red{background:linear-gradient(155deg,#8b1a1a,#a51c1c,#c01c1c);color:#fecaca;box-shadow:0 4px 20px rgba(160,28,28,0.5);display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:14px;font-family:Cinzel,serif;font-weight:700;letter-spacing:2px;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;user-select:none;text-transform:uppercase;position:relative;overflow:hidden;white-space:nowrap;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:48px;min-width:48px;}
.btn_btn_red:active{transform:scale(0.93);}
.btn_btn_green{background:linear-gradient(155deg,#145a2e,#166534,#15803d);color:#bbf7d0;box-shadow:0 4px 20px rgba(22,101,52,0.5);display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:14px;font-family:Cinzel,serif;font-weight:700;letter-spacing:2px;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;user-select:none;text-transform:uppercase;position:relative;overflow:hidden;white-space:nowrap;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:48px;min-width:48px;}
.btn_btn_green:active{transform:scale(0.93);}
.btn_btn_blue{background:linear-gradient(155deg,#1e3a8a,#1d4ed8,#2563eb);color:#bfdbfe;box-shadow:0 4px 20px rgba(29,78,216,0.45);display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:14px;font-family:Cinzel,serif;font-weight:700;letter-spacing:2px;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;user-select:none;text-transform:uppercase;position:relative;overflow:hidden;white-space:nowrap;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:48px;min-width:48px;}
.btn_btn_blue:active{transform:scale(0.93);}
.btn_btn_ghost{background:rgba(255,255,255,0.06);color:#9ca3af;border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(6px);display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;font-family:Cinzel,serif;font-weight:700;letter-spacing:2px;cursor:pointer;transition:transform 0.15s;user-select:none;text-transform:uppercase;position:relative;overflow:hidden;white-space:nowrap;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:48px;min-width:48px;}
.btn_btn_ghost:active{transform:scale(0.93);}
.btn_btn_outline_gold{background:rgba(212,168,67,0.08);color:#d4a843;border:1.5px solid rgba(212,168,67,0.38);display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;font-family:Cinzel,serif;font-weight:700;letter-spacing:2px;cursor:pointer;transition:transform 0.15s;user-select:none;text-transform:uppercase;position:relative;overflow:hidden;white-space:nowrap;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:48px;min-width:48px;}
.btn_btn_outline_gold:active{transform:scale(0.93);}
/* Premium button shine sweep */
@keyframes btnShine{0%{left:-100%}100%{left:200%}}
/* Coin/gem bounce on earn */
@keyframes coinBounce{0%,100%{transform:scale(1)}30%{transform:scale(1.4)}60%{transform:scale(0.9)}}
/* Reward card pop */
@keyframes cardReveal{0%{transform:scale(0.85) translateY(10px);opacity:0}60%{transform:scale(1.04)}100%{transform:scale(1) translateY(0);opacity:1}}
/* XP bar fill */
@keyframes xpFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
/* Legendary shimmer */
@keyframes legendaryShimmer{0%,100%{box-shadow:0 0 20px rgba(212,168,67,0.3),0 0 40px rgba(212,168,67,0.1)}50%{box-shadow:0 0 30px rgba(212,168,67,0.7),0 0 60px rgba(212,168,67,0.3)}}
/* Particle drift */
@keyframes sparkle{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-60px) scale(0);opacity:0}}
/* Spin pointer bounce */
@keyframes pointerBounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-4px)}}
/* Tile pulse for available rewards */
@keyframes availablePulse{0%,100%{box-shadow:inset 0 0 0 1.5px rgba(251,191,36,0.3)}50%{box-shadow:inset 0 0 0 1.5px rgba(251,191,36,0.8),0 0 12px rgba(251,191,36,0.2)}}
/* Section divider */
.section-label{font-family:Cinzel,serif;font-size:9px;letter-spacing:3px;color:rgba(212,168,67,0.45);text-transform:uppercase;text-align:center;padding:8px 0;display:flex;align-items:center;gap:10px;}
.section-label::before,.section-label::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(212,168,67,0.2),transparent);}
/* Premium card base */
.reward-card{border-radius:14px;overflow:hidden;position:relative;transition:transform 0.18s cubic-bezier(.22,1,.36,1);}
.reward-card:active{transform:scale(0.95);}
/* Gold text gradient */
.gold-text{background:linear-gradient(135deg,#f4cc52,#d4a843,#a87020);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
`;

const CARD_THEMES={
  classic:{bg:"linear-gradient(148deg,#091609,#040c04,#071007)",border:"rgba(20,60,20,0.9)",pat:"rgba(212,168,67,0.065)","pat2":"rgba(212,168,67,0.05)"},
  midnight:{bg:"linear-gradient(148deg,#06061a,#030310,#04041a)",border:"rgba(20,20,80,0.9)",pat:"rgba(160,180,255,0.065)","pat2":"rgba(120,140,220,0.05)"},
  crimson:{bg:"linear-gradient(148deg,#1a0505,#0d0303,#120404)",border:"rgba(80,10,10,0.9)",pat:"rgba(220,80,80,0.065)","pat2":"rgba(180,60,60,0.05)"},
  emerald:{bg:"linear-gradient(148deg,#021a06,#010d03,#021404)",border:"rgba(10,80,20,0.9)",pat:"rgba(50,200,80,0.08)","pat2":"rgba(40,160,60,0.06)"},
};

function Card({card,selected,onClick,size,faceDown,clickable,dimmed,glow,dealIdx,theme}){
  const [hov,setHov]=useState(false);
  size=size||"md";dealIdx=dealIdx||0;
  const red=card&&isRed(card);
  const D={xs:{w:32,h:46,fs:7.5,su:13,r:5},sm:{w:44,h:63,fs:10,su:18,r:6},md:{w:58,h:84,fs:13,su:25,r:8},lg:{w:68,h:98,fs:15,su:30,r:10}};
  const d=D[size]||D.md;
  const sc=red?"#b91c1c":"#1a1a2e";
  const lift=selected?-18:hov&&clickable?-4:0;
  const sc2=selected?1.08:hov&&clickable?1.02:1;
  const base={width:d.w,height:d.h,borderRadius:d.r,flexShrink:0,position:"relative",
    cursor:clickable?"pointer":"default",
    transform:"translateY("+lift+"px) scale("+sc2+")",
    transition:"transform 0.2s cubic-bezier(.34,1.56,.64,1),box-shadow 0.18s,opacity 0.18s",
    opacity:dimmed?0.3:1,userSelect:"none",overflow:"hidden",
    animationDelay:(dealIdx*0.07)+"s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"};
  const click=()=>{if(!clickable)return;audio.init();audio.resume();audio.cardSelect();haptic.light();onClick&&onClick();};
  if(faceDown){
    var th=CARD_THEMES[theme]||CARD_THEMES.classic;
    return(
    <div onClick={clickable?click:undefined} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{width:base.width,height:base.height,borderRadius:base.borderRadius,flexShrink:0,position:"relative",
        cursor:base.cursor,transform:base.transform,transition:base.transition,opacity:base.opacity,
        userSelect:"none",overflow:"hidden",animationDelay:base.animationDelay,
        WebkitTapHighlightColor:"transparent",touchAction:"manipulation",
        background:th.bg,
        border:glow?"2px solid #4ade80":selected?"2px solid #d4a843":"1.5px solid "+th.border,
        boxShadow:glow?"0 0 20px rgba(74,222,128,0.5),0 8px 24px rgba(0,0,0,0.8)":selected?"0 0 20px rgba(212,168,67,0.55),0 10px 28px rgba(0,0,0,0.8)":"0 5px 18px rgba(0,0,0,0.72)"}}>
      <div style={{position:"absolute",top:3,left:3,right:3,bottom:3,borderRadius:d.r-2,border:"1px solid rgba(212,168,67,0.2)"}}/>
      <div style={{position:"absolute",top:5,left:5,right:5,bottom:5,borderRadius:d.r-3,overflow:"hidden",backgroundImage:"repeating-linear-gradient(45deg,"+th.pat+"0,"+th.pat+"1px,transparent 1px,transparent 7px),repeating-linear-gradient(-45deg,"+th.pat2+"0,"+th.pat2+"1px,transparent 1px,transparent 7px)"}}/>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:d.su*0.72,opacity:0.15}}>🐍</div>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(255,255,255,0.06)0%,transparent 45%,rgba(0,0,0,0.15)100%)",borderRadius:d.r}}/>
    </div>
  );}
  return(
    <div onClick={clickable?click:undefined} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{width:base.width,height:base.height,borderRadius:base.borderRadius,flexShrink:0,position:"relative",
        cursor:base.cursor,transform:base.transform,transition:base.transition,opacity:base.opacity,
        userSelect:"none",overflow:"hidden",animationDelay:base.animationDelay,
        WebkitTapHighlightColor:"transparent",touchAction:"manipulation",
        background:"linear-gradient(165deg,#fefdf6,#faf7e5 55%,#f2ecd0)",
        border:selected?"2.5px solid #d4a843":glow?"2px solid #4ade80":hov&&clickable?"1.5px solid rgba(212,168,67,0.4)":"1.5px solid rgba(0,0,0,0.15)",
        boxShadow:selected?"0 0 24px rgba(212,168,67,0.6),0 14px 32px rgba(0,0,0,0.75),inset 0 1px 0 rgba(255,255,255,0.95)":glow?"0 0 20px rgba(74,222,128,0.45),0 6px 20px rgba(0,0,0,0.55)":hov&&clickable?"0 10px 24px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.95)":"0 5px 18px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.95)",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",
        padding:Math.round(d.fs*0.38)+"px "+Math.round(d.fs*0.34)+"px"}}>
      <div style={{alignSelf:"flex-start",lineHeight:1,zIndex:1}}>
        <div style={{fontSize:d.fs,fontWeight:900,color:sc,fontFamily:"Georgia,serif",lineHeight:1}}>{card.value}</div>
        <div style={{fontSize:d.fs*0.82,color:sc,lineHeight:1.1}}>{card.suit}</div>
      </div>
      <div style={{fontSize:d.su,color:sc,lineHeight:1,zIndex:1,transition:"filter 0.2s",filter:selected?"drop-shadow(0 0 6px "+(red?"rgba(185,28,28,0.6)":"rgba(26,26,70,0.5)")+")":glow?"drop-shadow(0 0 6px rgba(74,222,128,0.7))":"none"}}>{card.suit}</div>
      <div style={{alignSelf:"flex-end",transform:"rotate(180deg)",lineHeight:1,zIndex:1}}>
        <div style={{fontSize:d.fs,fontWeight:900,color:sc,fontFamily:"Georgia,serif",lineHeight:1}}>{card.value}</div>
        <div style={{fontSize:d.fs*0.82,color:sc,lineHeight:1.1}}>{card.suit}</div>
      </div>
      {selected&&<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(212,168,67,0.08)",borderRadius:d.r-1,pointerEvents:"none"}}/>}
      <div style={{position:"absolute",top:0,left:0,right:0,height:"40%",background:"linear-gradient(180deg,rgba(255,255,255,0.55)0%,transparent)",borderRadius:d.r+"px "+d.r+"px 0 0",pointerEvents:"none"}}/>
    </div>
  );
}

function ScoreStrip({names,scores,currentPlayer,nPlayers,flashScores,avatars,scoreLimit}){
  flashScores=flashScores||[];avatars=avatars||[];var sl=scoreLimit||LOSE;
  return(
    <div style={{display:"flex",gap:5,justifyContent:"center",flexWrap:"wrap"}}>
      {names.slice(0,nPlayers).map(function(n,i){
        const s=scores[i]||0,active=i===currentPlayer,danger=s>=Math.round(sl*0.8),warn=s>=Math.round(sl*0.5),out=s>=sl;
        return(
          <div key={i} style={{padding:"5px 10px 7px",borderRadius:10,minWidth:54,textAlign:"center",
            background:out?"rgba(0,0,0,0.5)":active?"linear-gradient(160deg,rgba(212,168,67,0.22),rgba(212,168,67,0.1))":danger?"rgba(185,28,28,0.16)":"rgba(0,0,0,0.32)",
            border:out?"1px solid rgba(255,255,255,0.04)":active?"1.5px solid rgba(212,168,67,0.5)":danger?"1.5px solid rgba(185,28,28,0.44)":"1px solid rgba(255,255,255,0.05)",
            boxShadow:active?"0 0 20px rgba(212,168,67,0.18)":danger?"0 0 14px rgba(185,28,28,0.22)":"none",
            opacity:out?0.45:1,
            transition:"all 0.35s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,marginBottom:2,color:out?"#4b5563":active?"#d4a843":danger?"#f87171":warn?"#f59e0b":"#2a3d20",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:60}}>{avatars[i]?<span style={{marginRight:2}}>{avatars[i]}</span>:null}{out?"ELIMINATED":n}</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:18,fontWeight:900,lineHeight:1,color:out?"#4b5563":danger?"#f87171":warn?"#fbbf24":active?"#d4a843":"#1a2d14",animation:flashScores[i]?"scoreFlash 0.6s ease both":"none",transition:"color 0.4s"}}>
              {s}
              {flashScores[i]&&<span style={{fontSize:10,color:"#f87171",marginLeft:3,animation:"scoreFlash 0.6s ease both"}}>!</span>}
            </div>
            <div style={{marginTop:3,height:2,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:Math.min(s,100)+"%",borderRadius:2,transition:"width 0.6s cubic-bezier(.22,1,.36,1)",background:danger?"linear-gradient(90deg,#991b1b,#ef4444)":warn?"linear-gradient(90deg,#92400e,#f59e0b)":active?"linear-gradient(90deg,#a07820,#d4a843)":"linear-gradient(90deg,#14532d,#16a34a)"}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Divider=({c})=><div style={{height:1,background:"linear-gradient(90deg,transparent,"+(c||"#d4a843")+"55,transparent)",margin:"4px 0 20px"}}/>;
const SLabel=({children})=><p style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#8aad80",letterSpacing:2,marginBottom:12,textAlign:"center",textTransform:"uppercase"}}>{children}</p>;

export class AppErrorBoundary extends Component{
  constructor(p){super(p);this.state={err:null};}
  static getDerivedStateFromError(e){return{err:e};}
  render(){
    if(this.state.err){
      return(
        <div style={{background:"#010603",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,color:"#d4a843",fontFamily:"Cinzel,serif",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>🐍</div>
          <div style={{fontSize:22,marginBottom:12,letterSpacing:3}}>COBRA</div>
          <div style={{fontSize:13,color:"#f87171",marginBottom:24,maxWidth:300,lineHeight:1.5}}>Something went wrong loading the game.</div>
          <button onClick={()=>window.location.reload()} style={{background:"#d4a843",color:"#010603",border:"none",borderRadius:10,padding:"14px 28px",fontSize:13,letterSpacing:2,fontFamily:"Cinzel,serif",cursor:"pointer"}}>RELOAD</button>
          <pre style={{marginTop:24,fontSize:10,color:"#f87171",maxWidth:340,overflow:"auto",textAlign:"left",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{String(this.state.err)}{"\n"}{this.state.err&&this.state.err.stack?"\n"+this.state.err.stack.slice(0,600):""}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function ThinkingDots(){return(<div style={{display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(function(i){return(<div key={i} className="think_dot" style={{width:6,height:6,borderRadius:"50%",background:"#d4a843",animationDelay:(i*0.22)+"s"}}/>);})}</div>);}

function MenuButton({onClick,active}){
  return(
    <button onClick={onClick} style={{
      position:"fixed",
      top:"calc(16px + env(safe-area-inset-top))",
      right:"calc(16px + env(safe-area-inset-right))",
      zIndex:200,width:42,height:42,borderRadius:12,
      border:active?"1.5px solid #d4a843":"1px solid rgba(212,168,67,0.35)",
      background:active?"rgba(212,168,67,0.12)":"rgba(1,10,4,0.85)",
      backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",
      cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:19,color:"#d4a843",
      transition:"all 0.2s cubic-bezier(.22,1,.36,1)",
      touchAction:"manipulation",WebkitTapHighlightColor:"transparent",
      boxShadow:active?"0 0 20px rgba(212,168,67,0.3), inset 0 1px 0 rgba(212,168,67,0.2)":"0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)"
    }}>
      {active?"✕":"☰"}
    </button>
  );
}

function PremiumToggle({active,onToggle}){
  return(
    <button onClick={onToggle} style={{
      width:50,height:28,borderRadius:14,border:"none",
      background:active?"linear-gradient(135deg,#d4a843,#b8882a)":"rgba(255,255,255,0.08)",
      cursor:"pointer",position:"relative",
      transition:"background 0.3s cubic-bezier(.22,1,.36,1)",
      padding:0,touchAction:"manipulation",WebkitTapHighlightColor:"transparent",
      flexShrink:0,boxShadow:active?"0 0 12px rgba(212,168,67,0.4)":"inset 0 1px 3px rgba(0,0,0,0.4)"
    }}>
      <span style={{
        position:"absolute",top:4,left:active?26:4,
        width:20,height:20,borderRadius:"50%",
        background:active?"#1a0f00":"rgba(255,255,255,0.5)",
        transition:"left 0.3s cubic-bezier(.22,1.4,.36,1)",
        display:"block",
        boxShadow:"0 1px 4px rgba(0,0,0,0.4)"
      }}/>
    </button>
  );
}

function SettingsPanel({open,onClose,sfxMuted,musicMuted,onToggleSfx,onToggleMusic,onHowToPlay,gameStats,cardTheme,setCardTheme}){
  var winRate=gameStats.rounds>0?Math.round(gameStats.wins/gameStats.rounds*100):0;
  var bestStreak=gameStats.bestStreak||0;
  return(
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position:"fixed",inset:0,zIndex:190,
        background:"rgba(0,0,0,0.6)",
        backdropFilter:"blur(3px)",WebkitBackdropFilter:"blur(3px)",
        opacity:open?1:0,pointerEvents:open?"auto":"none",
        transition:"opacity 0.35s ease"
      }}/>

      {/* Panel */}
      <div style={{
        position:"fixed",top:0,right:0,bottom:0,zIndex:195,
        width:"min(310px,90vw)",
        background:"linear-gradient(180deg,rgba(2,12,5,0.98) 0%,rgba(1,8,3,0.99) 100%)",
        borderLeft:"1px solid rgba(212,168,67,0.2)",
        transform:open?"translateX(0)":"translateX(105%)",
        transition:"transform 0.45s cubic-bezier(.22,1.4,.36,1)",
        display:"flex",flexDirection:"column",overflowY:"auto",
        paddingTop:"env(safe-area-inset-top)",
        paddingBottom:"env(safe-area-inset-bottom)",
        boxShadow:"-20px 0 60px rgba(0,0,0,0.7)"
      }}>

        {/* Header */}
        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid rgba(212,168,67,0.1)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:13,letterSpacing:5,margin:0}}>SETTINGS</h2>
            <div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#2a4a2e",fontSize:11,marginTop:2}}>COBRA v2.0 PREMIUM</div>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(212,168,67,0.2)",background:"rgba(212,168,67,0.06)",color:"#d4a843",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>✕</button>
        </div>

        <div style={{padding:"0 22px",flex:1}}>

          {/* AUDIO */}
          <div style={{paddingTop:20}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#3a6a3a",letterSpacing:4,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>🔊</span> AUDIO
            </div>
            {[
              {label:"Sound Effects",sub:"Game sounds & feedback",active:!sfxMuted,onToggle:onToggleSfx},
              {label:"Music",sub:"Ambient background music",active:!musicMuted,onToggle:onToggleMusic}
            ].map(function(item){return(
              <div key={item.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Crimson Text,serif",color:"#c8d8c8",fontSize:15,lineHeight:1.2}}>{item.label}</div>
                  <div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#3a5a3a",fontSize:12,marginTop:1}}>{item.sub}</div>
                </div>
                <PremiumToggle active={item.active} onToggle={item.onToggle}/>
              </div>
            );})}
          </div>

          <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.15),transparent)",margin:"4px 0 0"}}/>

          {/* GAME */}
          <div style={{paddingTop:18}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#3a6a3a",letterSpacing:4,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>🃏</span> GAME
            </div>
            <button onClick={function(){onHowToPlay();onClose();}} style={{
              width:"100%",padding:"14px 18px",borderRadius:14,
              border:"1px solid rgba(212,168,67,0.18)",
              background:"rgba(212,168,67,0.05)",
              cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:10,
              letterSpacing:2.5,color:"#d4a843",
              display:"flex",alignItems:"center",gap:12,
              touchAction:"manipulation",WebkitTapHighlightColor:"transparent",
              transition:"all 0.2s"
            }}>
              <span style={{fontSize:18}}>📖</span>
              <span>HOW TO PLAY</span>
            </button>
          </div>

          <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.15),transparent)",margin:"18px 0 0"}}/>

          {/* CARD THEME */}
          <div style={{paddingTop:18}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#3a6a3a",letterSpacing:4,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>🎴</span> CARD THEME
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              {[
                {id:"classic",bg:"#091609",label:"Classic"},
                {id:"midnight",bg:"#06061a",label:"Midnight"},
                {id:"crimson",bg:"#1a0505",label:"Crimson"},
                {id:"emerald",bg:"#021a06",label:"Emerald"},
              ].map(function(t){return(
                <button key={t.id} onClick={function(){if(setCardTheme){setCardTheme(t.id);try{localStorage.setItem("cobra_card_theme",t.id);}catch(e){}};}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",padding:0,touchAction:"manipulation"}}>
                  <div style={{width:36,height:36,borderRadius:6,background:t.bg,border:cardTheme===t.id?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.15)",boxShadow:cardTheme===t.id?"0 0 10px rgba(212,168,67,0.5)":"none",transition:"all 0.2s"}}/>
                  <span style={{fontFamily:"Cinzel,serif",fontSize:7,color:cardTheme===t.id?"#d4a843":"#3a5a3a",letterSpacing:1}}>{t.label.toUpperCase()}</span>
                </button>
              );})}
            </div>
          </div>

          <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.15),transparent)",margin:"18px 0 0"}}/>

          {/* STATISTICS */}
          <div style={{paddingTop:18}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#3a6a3a",letterSpacing:4,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>📊</span> STATISTICS
            </div>
            {gameStats.rounds===0&&<div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#3a5a3a",fontSize:13,textAlign:"center",marginBottom:12}}>No games played yet</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              {[
                {icon:"🏆",val:gameStats.wins,label:"Wins"},
                {icon:"🃏",val:gameStats.rounds,label:"Rounds"},
                {icon:"🐍",val:gameStats.cobras,label:"Cobras"},
                {icon:"🔥",val:gameStats.streak||0,label:"Streak"},
                {icon:"⚡",val:bestStreak,label:"Best Streak"},
                {icon:"🎯",val:gameStats.rounds>0?winRate+"%":"—",label:"Win Rate"}
              ].map(function(s){return(
                <div key={s.label} style={{
                  background:"rgba(212,168,67,0.04)",
                  border:"1px solid rgba(212,168,67,0.1)",
                  borderRadius:12,padding:"12px 8px",textAlign:"center"
                }}>
                  <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:17,fontWeight:700,color:"#d4a843",lineHeight:1}}>{s.val}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"#3a5a3a",letterSpacing:1,marginTop:4,textTransform:"uppercase"}}>{s.label}</div>
                </div>
              );})}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{padding:"14px 22px calc(14px + env(safe-area-inset-bottom))",borderTop:"1px solid rgba(212,168,67,0.07)",flexShrink:0,marginTop:16}}>
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6}}>
            <span style={{fontSize:12}}>🐍</span>
            <span style={{fontFamily:"Cinzel,serif",fontSize:7,color:"#1a3020",letterSpacing:3}}>COBRA · THE ULTIMATE CARD GAME</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Tutorial({onDone}){
  const [step,setStep]=useState(0);
  const s=TUTORIAL_STEPS[step];
  const isLast=step===TUTORIAL_STEPS.length-1;
  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:380,width:"100%",animation:"declarePop 0.35s cubic-bezier(.22,1,.36,1)"}}>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:20}}>
          {TUTORIAL_STEPS.map(function(_,i){return(<div key={i} style={{width:i===step?20:7,height:7,borderRadius:4,transition:"all 0.3s",background:i===step?"#d4a843":i<step?"rgba(212,168,67,0.4)":"rgba(255,255,255,0.1)"}}/>);})}</div>
        <div style={{background:"rgba(2,8,4,0.95)",border:"1px solid rgba(212,168,67,0.2)",borderRadius:24,padding:28,boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:52,marginBottom:10}}>{s.icon}</div>
            <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:18,letterSpacing:3,marginBottom:12}}>{s.title}</h2>
            <p style={{fontFamily:"Crimson Text,serif",color:"#8aad8a",fontSize:16,lineHeight:1.7}}>{s.body}</p>
          </div>
          <div style={{display:"flex",gap:10,marginTop:24}}>
            {step>0&&<button className="btn_btn_ghost" style={{flex:1,padding:14,fontSize:11,letterSpacing:2}} onClick={function(){setStep(function(p){return p-1;});}}>BACK</button>}
            <button className="btn_btn_gold" style={{flex:2,padding:14,fontSize:12,letterSpacing:2.5}} onClick={function(){audio.buttonClick();if(isLast)onDone();else setStep(function(p){return p+1;});}}>
              {isLast?"LET'S PLAY!":"NEXT"}
            </button>
          </div>
          {!isLast&&<button style={{width:"100%",marginTop:12,padding:"13px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,fontFamily:"Cinzel,serif",fontSize:12,color:"#9ca3af",cursor:"pointer",letterSpacing:2,minHeight:48}} onClick={onDone}>SKIP TUTORIAL</button>}
        </div>
      </div>
    </div>
  );
}

const COACH_STEPS=[
  {id:"welcome",target:null,title:"🐍 Welcome to COBRA!",body:"I'll guide you through your first real game step by step. Follow the arrows!",waitFor:null},
  {id:"hand",target:"tut-hand",title:"🃏 Your Hand",body:"These 7 cards are your hand. Ace=1 pt, King=13 pts. The LOWER your total, the better!",arrow:true,waitFor:null},
  {id:"total",target:"tut-total",title:"🔢 Your Total",body:"This number is your current hand total. Get it to 30 or under to be able to declare and win the round!",arrow:true,waitFor:null},
  {id:"deck",target:"tut-deck",title:"🂠 The Deck",body:"The face-down deck on the left. After playing cards, you can draw a random card from here.",arrow:true,waitFor:null},
  {id:"pile",target:"tut-pile",title:"🎴 Open Pile",body:"This shows what the previous player played. You can TAKE these cards into your hand instead of drawing!",arrow:true,waitFor:null},
  {id:"select",target:"tut-hand",title:"👆 Now You Try — Select a Card",body:"Tap any card in your hand to select it. You can pick multiple cards to play a combo (pair, run, flush)!",arrow:true,waitFor:"selection"},
  {id:"play",target:"tut-actions",title:"▶️ Play Your Cards!",body:"The PLAY button is now active. Tap it to place your selected cards on the pile.",arrow:true,waitFor:"played"},
  {id:"pickup",target:"tut-deck",title:"📥 Pick Up a Card",body:"Good! Now you must take a card. Tap DRAW to pull from the deck, or tap the pile to take those cards.",arrow:true,waitFor:"pickedup"},
  {id:"declare",target:"tut-actions",title:"📢 How to Declare",body:"When your total drops to 30 or under, the DECLARE button glows green. If you have the LOWEST total — you win the round! Wrong declare = +30 penalty (COBRA 🐍).",arrow:true,waitFor:null},
  {id:"done",target:null,title:"🏆 You're Ready!",body:"You know the basics! Keep playing rounds — first player to reach 100 pts is eliminated. Last one standing wins. Good luck!",waitFor:null,isLast:true},
];

function TutorialCoach({stepIdx,sel,phase,currentPlayer,onNext,onSkip}){
  var [rect,setRect]=useState(null);
  var step=COACH_STEPS[stepIdx];
  useEffect(function(){
    if(!step||!step.target){setRect(null);return;}
    function measure(){
      var el=document.getElementById(step.target);
      if(el){var r=el.getBoundingClientRect();setRect({top:r.top,left:r.left,width:r.width,height:r.height});}
    }
    measure();
    var t=setTimeout(measure,80);
    return function(){clearTimeout(t);};
  },[stepIdx]);

  if(!step)return null;
  var pad=10;
  var sTop=rect?rect.top-pad:null;
  var sLeft=rect?rect.left-pad:null;
  var sW=rect?rect.width+pad*2:null;
  var sH=rect?rect.height+pad*2:null;
  var spotMid=rect?(rect.top+rect.height/2):null;
  var vh=typeof window!=="undefined"?window.innerHeight:700;
  var below=spotMid!==null&&spotMid<vh*0.55;
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,pointerEvents:"none"}}>
      {rect?(
        <div style={{position:"fixed",top:sTop,left:sLeft,width:sW,height:sH,borderRadius:18,animation:"tutPulse 1.6s ease-in-out infinite",zIndex:501,pointerEvents:"none"}}/>
      ):(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:500,pointerEvents:"none"}}/>
      )}
      {rect&&step.arrow&&(
        <div style={{position:"fixed",left:sLeft+sW/2-12,top:below?sTop+sH+6:sTop-36,zIndex:503,pointerEvents:"none",fontSize:22,color:"#d4a843",animation:"tutBounce 0.7s ease-in-out infinite",lineHeight:1}}>
          {below?"▲":"▼"}
        </div>
      )}
      <div style={{position:"fixed",left:"50%",transform:"translateX(-50%)",zIndex:504,pointerEvents:"all",
        top:rect&&below?Math.min(sTop+sH+52,vh-220):undefined,
        bottom:rect&&!below?Math.max(vh-(sTop-52),16):(!rect?24:undefined),
        width:"calc(100% - 28px)",maxWidth:380,
        background:"linear-gradient(160deg,rgba(1,8,3,0.98),rgba(2,12,5,0.98))",
        border:"1.5px solid rgba(212,168,67,0.45)",borderRadius:22,
        padding:"18px 18px 14px",boxShadow:"0 24px 64px rgba(0,0,0,0.95)",
      }}>
        <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:14}}>
          {COACH_STEPS.map(function(_,i){return(
            <div key={i} style={{width:i===stepIdx?16:5,height:5,borderRadius:3,transition:"all 0.3s",
              background:i===stepIdx?"#d4a843":i<stepIdx?"rgba(212,168,67,0.4)":"rgba(255,255,255,0.1)"}}/>
          );})}
        </div>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:14,letterSpacing:2,marginBottom:8,fontWeight:700}}>{step.title}</div>
          <div style={{fontFamily:"Crimson Text,serif",color:"#9aad9a",fontSize:15,lineHeight:1.65}}>{step.body}</div>
        </div>
        {!step.waitFor&&(
          <button onClick={onNext} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#92700e,#d4a843)",border:"none",borderRadius:12,fontFamily:"Cinzel,serif",fontSize:12,color:"#010603",cursor:"pointer",letterSpacing:2,fontWeight:700,minHeight:48}}>
            {step.isLast?"LET'S PLAY! 🐍":"GOT IT →"}
          </button>
        )}
        {step.waitFor&&(
          <div style={{textAlign:"center",padding:"10px 0 4px",fontFamily:"Cinzel,serif",fontSize:10,color:"#d4a843",letterSpacing:2,animation:"pulse 1.5s ease-in-out infinite"}}>
            ↑ DO THIS TO CONTINUE ↑
          </div>
        )}
        <button onClick={onSkip} style={{width:"100%",marginTop:8,padding:"9px",background:"transparent",border:"none",fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(255,255,255,0.18)",cursor:"pointer",letterSpacing:2}}>
          SKIP TUTORIAL
        </button>
      </div>
    </div>
  );
}

function AchievementBadge({ach,onDone}){
  useEffect(function(){var t=setTimeout(onDone,3500);return function(){clearTimeout(t);};},[]);
  return(
    <div style={{position:"fixed",top:80,right:16,zIndex:400,background:"linear-gradient(135deg,rgba(10,20,8,0.97),rgba(6,14,5,0.97))",border:"1px solid rgba(212,168,67,0.4)",borderRadius:16,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"achievePop 3.5s ease both",backdropFilter:"blur(12px)",maxWidth:220}}>
      <span style={{fontSize:28}}>{ach.icon}</span>
      <div>
        <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#d4a843",letterSpacing:2,marginBottom:2}}>ACHIEVEMENT</div>
        <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#f0e8d0",letterSpacing:1}}>{ach.name}</div>
        <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"#4a6a4a",marginTop:1}}>{ach.desc}</div>
      </div>
    </div>
  );
}

function EmojiFloat({emoji,x,y}){
  return(<div style={{position:"fixed",left:x,top:y,fontSize:32,zIndex:150,pointerEvents:"none",animation:"emojiFloat 1.4s ease-out forwards"}}>{emoji}</div>);
}

function TurnTimer({seconds,total}){
  const pct=(seconds/total)*100;
  const urgent=seconds<=8;
  const color=urgent?"#ef4444":seconds<=15?"#f59e0b":"#4ade80";
  return(
    <div style={{width:36,height:36,borderRadius:"50%",position:"relative",flexShrink:0}}>
      <svg width="36" height="36" style={{transform:"rotate(-90deg)"}}>
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"/>
        <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray="87.96"
          strokeDashoffset={87.96*(1-pct/100)}
          style={{transition:"stroke-dashoffset 1s linear,stroke 0.3s"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:11,fontWeight:700,color,animation:urgent?"timerPulse 0.5s ease-in-out infinite":"none"}}>{seconds}</div>
    </div>
  );
}

function TableParticles(){
  var particles=[];
  for(var i=0;i<14;i++){
    var dur=(10+Math.random()*8).toFixed(1);
    var delay=(Math.random()*8).toFixed(1);
    var top=(Math.random()*90).toFixed(1);
    var left=(Math.random()*95).toFixed(1);
    var sz=Math.random()<0.5?3:4;
    var color=i%2===0?"rgba(212,168,67,0.15)":"rgba(74,222,128,0.1)";
    particles.push({id:i,dur:dur,delay:delay,top:top,left:left,sz:sz,color:color});
  }
  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
      {particles.map(function(p){return(
        <div key={p.id} style={{position:"absolute",top:p.top+"%",left:p.left+"%",width:p.sz,height:p.sz,borderRadius:"50%",background:p.color,animation:"particleFloat "+p.dur+"s "+p.delay+"s ease-in-out infinite"}}/>
      );})}
    </div>
  );
}

function SplashScreen({onDone}){
  useEffect(function(){
    var t=setTimeout(onDone,2200);
    return function(){clearTimeout(t);};
  },[]);
  return(
    <div style={{position:"fixed",inset:0,background:"#010603",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999,animation:"fadeIn 0.3s ease"}}>
      <div style={{animation:"splashPop 0.6s cubic-bezier(.22,1.4,.36,1) both"}}>
        <div style={{marginBottom:16,animation:"float 2s ease-in-out infinite"}}>
          <span style={{fontSize:90,lineHeight:1,display:"block",textAlign:"center"}}>🐍</span>
        </div>
        <h1 style={{fontFamily:"Cinzel,serif",fontSize:58,fontWeight:900,letterSpacing:12,background:"linear-gradient(175deg,#f4cc52,#d4a843,#a87020)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",textAlign:"center",marginBottom:8}}>COBRA</h1>
        <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#2a4a2e",fontSize:16,letterSpacing:6,textAlign:"center"}}>the ultimate card game</p>
      </div>
      <div style={{position:"absolute",bottom:"calc(60px + env(safe-area-inset-bottom))",display:"flex",gap:6}}>
        {[0,1,2].map(function(i){return(
          <div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#d4a843",opacity:0.6,animation:"thinkDot 1.2s ease-in-out infinite",animationDelay:(i*0.2)+"s"}}/>
        );})}
      </div>
    </div>
  );
}

function ProfileScreen({name,avatar,level,xp,xpForLevel,coins,gems,stats,onClose}){
  var pct=Math.min(100,xpForLevel(level)>0?Math.round(xp/xpForLevel(level)*100):100);
  var winRate=stats&&stats.rounds>0?Math.round(stats.wins/stats.rounds*100):0;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:250,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(170deg,#0d1f0e 0%,#060e06 60%,#010603 100%)",border:"1.5px solid rgba(212,168,67,0.35)",borderBottom:"none",borderRadius:"24px 24px 0 0",padding:"0 0 calc(28px + env(safe-area-inset-bottom))",width:"100%",maxWidth:480,animation:"slideUp 0.38s cubic-bezier(.22,1,.36,1) both",maxHeight:"90vh",overflowY:"auto"}}>
        {/* Handle bar */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
          <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)"}}/>
        </div>
        {/* Hero section */}
        <div style={{position:"relative",padding:"20px 24px 0",textAlign:"center"}}>
          {/* Ambient glow behind avatar */}
          <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:180,height:180,borderRadius:"50%",background:"radial-gradient(circle,rgba(212,168,67,0.12),transparent 70%)",pointerEvents:"none"}}/>
          {/* Avatar ring */}
          <div style={{display:"inline-block",position:"relative",marginBottom:12}}>
            <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#d4a843,#a87020)",padding:3,display:"inline-block",boxShadow:"0 0 0 4px rgba(212,168,67,0.1),0 8px 32px rgba(0,0,0,0.4)"}}>
              <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"linear-gradient(135deg,#0d1f0e,#060e06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44}}>
                {avatar||"🐍"}
              </div>
            </div>
            {/* Level badge */}
            <div style={{position:"absolute",bottom:-4,right:-4,width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#d4a843,#f0c060)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:11,fontWeight:700,color:"#010603",boxShadow:"0 2px 8px rgba(0,0,0,0.5),0 0 0 2px #010603"}}>
              {level}
            </div>
          </div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:20,fontWeight:700,letterSpacing:2,background:"linear-gradient(135deg,#f4cc52,#d4a843)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{name||"Player"}</div>
          <div style={{fontFamily:"Crimson Text,serif",color:"rgba(212,168,67,0.5)",fontSize:13,marginTop:2,letterSpacing:3}}>LEVEL {level} COBRA CHAMPION</div>
        </div>
        {/* XP bar */}
        <div style={{margin:"20px 24px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(212,168,67,0.5)",letterSpacing:1,marginBottom:6}}>
            <span>XP PROGRESS</span><span>{xp.toLocaleString()} / {xpForLevel(level).toLocaleString()}</span>
          </div>
          <div style={{height:8,borderRadius:4,background:"rgba(255,255,255,0.05)",overflow:"hidden",position:"relative"}}>
            <div style={{position:"absolute",inset:0,background:"rgba(255,255,255,0.02)"}}/>
            <div style={{height:"100%",width:pct+"%",borderRadius:4,background:"linear-gradient(90deg,#c49030,#f0c060,#d4a843)",boxShadow:"0 0 8px rgba(212,168,67,0.5)",transition:"width 0.8s cubic-bezier(.22,1,.36,1)"}}/>
          </div>
          <div style={{fontFamily:"Crimson Text,serif",fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:4,textAlign:"right"}}>{pct}% to Level {level+1}</div>
        </div>
        {/* Balance row */}
        <div style={{display:"flex",gap:10,margin:"16px 24px 0"}}>
          {[{icon:"🪙",val:coins.toLocaleString(),label:"COINS",color:"#f0c060",bg:"rgba(212,168,67,0.08)",border:"rgba(212,168,67,0.2)"},{icon:"💎",val:gems,label:"GEMS",color:"#c084fc",bg:"rgba(168,85,247,0.08)",border:"rgba(168,85,247,0.2)"}].map(function(b){return(
            <div key={b.label} style={{flex:1,background:b.bg,border:"1px solid "+b.border,borderRadius:12,padding:"12px 10px",textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:2}}>{b.icon}</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:16,fontWeight:700,color:b.color}}>{b.val}</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(255,255,255,0.2)",letterSpacing:2,marginTop:2}}>{b.label}</div>
            </div>
          );})}
        </div>
        {/* Stats grid */}
        <div style={{margin:"12px 24px 0"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:3,color:"rgba(212,168,67,0.35)",marginBottom:10,textAlign:"center"}}>STATISTICS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[
              {icon:"🃏",val:stats&&stats.rounds||0,label:"GAMES"},
              {icon:"🏆",val:stats&&stats.wins||0,label:"WINS"},
              {icon:"🎯",val:winRate+"%",label:"WIN RATE"},
              {icon:"🔥",val:stats&&stats.streak||0,label:"STREAK"},
              {icon:"⭐",val:stats&&stats.bestStreak||0,label:"BEST"},
              {icon:"🐍",val:stats&&stats.cobras||0,label:"COBRAS"},
            ].map(function(s){return(
              <div key={s.label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 6px",textAlign:"center"}}>
                <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:15,fontWeight:700,color:"#d4a843"}}>{s.val}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"rgba(255,255,255,0.2)",letterSpacing:2,marginTop:2}}>{s.label}</div>
              </div>
            );})}
          </div>
        </div>
        {/* Close */}
        <div style={{padding:"20px 24px 0"}}>
          <button onClick={onClose} style={{width:"100%",padding:"14px",background:"rgba(212,168,67,0.1)",border:"1.5px solid rgba(212,168,67,0.3)",borderRadius:14,fontFamily:"Cinzel,serif",fontSize:13,letterSpacing:3,color:"#d4a843",cursor:"pointer",touchAction:"manipulation",transition:"all 0.15s"}}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

function BattlePassScreen({bpLevel,bpPremium,bpClaimed,onClaim,onClose,onUpgrade}){
  var rewards=Array.from({length:50},function(_,i){
    var isSpecial=i===49;
    return{
      free:i%3===0?{type:"coins",amount:(i+1)*20}:i%3===1?{type:"label",label:"🐍 Skin "+(Math.floor(i/3)+1)}:{type:"gems",amount:Math.ceil((i+1)/15)},
      premium:i%2===0?{type:"coins",amount:(i+1)*50}:{type:"gems",amount:Math.ceil((i+1)/8)},
      special:isSpecial,
      milestone:i%9===8,
    };
  });
  return(
    <div style={{position:"fixed",inset:0,background:"#010603",zIndex:250,display:"flex",flexDirection:"column"}}>
      <style>{`@keyframes rewardPop{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}@keyframes legendaryShimmer{0%,100%{box-shadow:0 0 20px rgba(212,168,67,0.4)}50%{box-shadow:0 0 40px rgba(212,168,67,0.8),0 0 80px rgba(212,168,67,0.3)}}`}</style>
      {/* Header */}
      <div style={{background:"linear-gradient(180deg,#0d1f0e,#060e06)",borderBottom:"1px solid rgba(212,168,67,0.15)",paddingTop:"calc(16px + env(safe-area-inset-top))",paddingBottom:16,paddingLeft:20,paddingRight:20,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:700,background:"linear-gradient(135deg,#f4cc52,#d4a843)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",letterSpacing:3}}>BATTLE PASS</div>
            <div style={{fontFamily:"Crimson Text,serif",color:"rgba(212,168,67,0.4)",fontSize:13,letterSpacing:2,marginTop:2}}>SEASON 1 · LEVEL {bpLevel}/50</div>
          </div>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>✕</button>
        </div>
        {/* Season progress bar */}
        <div style={{marginTop:14}}>
          <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
            <div style={{height:"100%",width:Math.round(bpLevel/50*100)+"%",background:"linear-gradient(90deg,#c49030,#f0c060)",borderRadius:3,boxShadow:"0 0 6px rgba(212,168,67,0.5)",transition:"width 0.6s cubic-bezier(.22,1,.36,1)"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(212,168,67,0.3)",letterSpacing:1}}>
            <span>START</span><span style={{color:"rgba(212,168,67,0.6)"}}>{Math.round(bpLevel/50*100)}% COMPLETE</span><span>LV 50</span>
          </div>
        </div>
        {/* Premium upgrade CTA */}
        {!bpPremium&&(
          <button onClick={onUpgrade} style={{width:"100%",marginTop:12,padding:"11px",background:"linear-gradient(135deg,#4c1d95,#7c3aed,#a855f7)",border:"1px solid rgba(168,85,247,0.4)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",touchAction:"manipulation",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:"rgba(255,255,255,0.06)",borderRadius:"12px 12px 0 0",pointerEvents:"none"}}/>
            <div style={{textAlign:"left"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"white",letterSpacing:2,fontWeight:700}}>💎 UPGRADE TO PREMIUM</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"rgba(255,255,255,0.55)",marginTop:1}}>Unlock the premium reward lane</div>
            </div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#e9d5ff",background:"rgba(255,255,255,0.12)",padding:"6px 12px",borderRadius:8,letterSpacing:1,flexShrink:0}}>800 💎</div>
          </button>
        )}
      </div>
      {/* Column headers */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px 6px",background:"rgba(0,0,0,0.3)",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
        <div style={{width:32,flexShrink:0}}/>
        <div style={{flex:1,fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2,color:"rgba(212,168,67,0.35)",textAlign:"center"}}>FREE</div>
        {bpPremium&&<div style={{minWidth:96,fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2,color:"rgba(168,85,247,0.5)",textAlign:"center"}}>PREMIUM</div>}
      </div>
      {/* Reward rows */}
      <div style={{flex:1,overflowY:"auto",padding:"6px 16px",paddingBottom:"calc(12px + env(safe-area-inset-bottom))"}}>
        {rewards.map(function(r,i){
          var lvl=i+1,earned=lvl<=bpLevel,claimed=bpClaimed.indexOf(i)>=0;
          var isCurrent=lvl===bpLevel;
          return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,opacity:earned?1:0.4,transition:"opacity 0.2s",animation:isCurrent?"legendaryShimmer 2s ease-in-out infinite":"none"}}>
              {/* Level node */}
              <div style={{width:32,height:32,borderRadius:"50%",background:earned?"linear-gradient(135deg,#d4a843,#f0c060)":r.milestone?"rgba(212,168,67,0.15)":"rgba(255,255,255,0.05)",border:isCurrent?"2px solid #f0c060":r.milestone?"1px solid rgba(212,168,67,0.3)":"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:10,fontWeight:700,color:earned?"#010603":"rgba(255,255,255,0.2)",flexShrink:0,position:"relative",boxShadow:earned?"0 0 10px rgba(212,168,67,0.3)":"none"}}>
                {earned?<span style={{fontSize:14}}>✓</span>:lvl}
              </div>
              {/* Free reward */}
              <div style={{flex:1,background:claimed?"rgba(34,197,94,0.06)":earned?"rgba(212,168,67,0.05)":"rgba(255,255,255,0.02)",border:"1px solid "+(claimed?"rgba(34,197,94,0.2)":earned?"rgba(212,168,67,0.15)":"rgba(255,255,255,0.05)"),borderRadius:10,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:42}}>
                <div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:claimed?"rgba(34,197,94,0.6)":earned?"#d4a843":"rgba(255,255,255,0.2)",letterSpacing:0.5}}>
                    {r.free.type==="coins"?"🪙 "+r.free.amount.toLocaleString():r.free.type==="gems"?"💎 "+r.free.amount:r.free.label}
                  </div>
                  {r.free.type==="coins"&&<div style={{fontFamily:"Crimson Text,serif",fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:1}}>Cobra Coins</div>}
                </div>
                {earned&&!claimed
                  ?<button onClick={function(){onClaim(i,r.free);}} style={{background:"linear-gradient(135deg,#15803d,#22c55e)",border:"none",color:"white",padding:"5px 12px",borderRadius:7,fontSize:10,cursor:"pointer",fontFamily:"Cinzel,serif",letterSpacing:1,touchAction:"manipulation",boxShadow:"0 2px 8px rgba(34,197,94,0.3)",flexShrink:0}}>CLAIM</button>
                  :claimed?<div style={{width:22,height:22,borderRadius:"50%",background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#22c55e",flexShrink:0}}>✓</div>
                  :<div style={{fontSize:14,color:"rgba(255,255,255,0.1)",flexShrink:0}}>🔒</div>}
              </div>
              {/* Premium reward */}
              {bpPremium&&(
                <div style={{minWidth:96,background:claimed?"rgba(168,85,247,0.06)":earned?"rgba(168,85,247,0.08)":"rgba(255,255,255,0.02)",border:"1px solid "+(claimed?"rgba(168,85,247,0.25)":earned?"rgba(168,85,247,0.2)":"rgba(255,255,255,0.04)"),borderRadius:10,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:42}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:claimed?"rgba(168,85,247,0.5)":earned?"#c084fc":"rgba(255,255,255,0.15)"}}>
                    {r.premium.type==="coins"?"🪙 "+r.premium.amount:("💎 "+r.premium.amount)}
                  </div>
                  {earned&&!claimed
                    ?<button onClick={function(){onClaim(i,r.premium,"premium");}} style={{background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",color:"white",padding:"4px 8px",borderRadius:6,fontSize:10,cursor:"pointer",touchAction:"manipulation",flexShrink:0}}>+</button>
                    :claimed?<span style={{fontSize:12,color:"rgba(168,85,247,0.5)"}}>✓</span>:<span style={{fontSize:12,color:"rgba(255,255,255,0.08)"}}>🔒</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyRewardScreen({onClaim,onClose}){
  var dayRewards=[
    {coins:100,gems:0,label:"Day 1"},
    {coins:150,gems:0,label:"Day 2"},
    {coins:200,gems:1,label:"Day 3"},
    {coins:250,gems:0,label:"Day 4"},
    {coins:300,gems:2,label:"Day 5"},
    {coins:400,gems:0,label:"Day 6"},
    {coins:500,gems:5,label:"Day 7 ⭐"},
  ];
  var last=parseInt((function(){try{return localStorage.getItem("cobra_daily_last")||"0";}catch(e){return"0";}})());
  var streak=parseInt((function(){try{return localStorage.getItem("cobra_daily_streak")||"0";}catch(e){return"0";}})());
  var msSince=Date.now()-last;
  var canClaim=msSince>=86400000;
  var msUntil=Math.max(0,86400000-msSince);
  var hrs=Math.floor(msUntil/3600000),mins=Math.floor((msUntil%3600000)/60000);
  var currentDay=Math.min(streak%7,6);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:250,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(170deg,#1a1100,#0e0a00,#010603)",border:"1.5px solid rgba(212,168,67,0.3)",borderBottom:"none",borderRadius:"24px 24px 0 0",padding:"0 0 calc(28px + env(safe-area-inset-bottom))",width:"100%",maxWidth:480,animation:"slideUp 0.38s cubic-bezier(.22,1,.36,1) both"}}>
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
          <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)"}}/>
        </div>
        {/* Header */}
        <div style={{padding:"12px 24px 20px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:8}}>📅</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:20,fontWeight:700,background:"linear-gradient(135deg,#f4cc52,#d4a843)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",letterSpacing:3}}>DAILY REWARDS</div>
          <div style={{fontFamily:"Crimson Text,serif",color:"rgba(212,168,67,0.4)",fontSize:13,letterSpacing:2,marginTop:4}}>DAY {currentDay+1} OF 7</div>
        </div>
        {/* Day cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,padding:"0 16px 20px"}}>
          {dayRewards.map(function(r,i){
            var past=i<currentDay,active=i===currentDay&&canClaim,today=i===currentDay&&!canClaim,locked=i>currentDay;
            return(
              <div key={i} style={{
                background:active?"linear-gradient(145deg,#92400e,#b45309,#d97706)":past?"rgba(34,197,94,0.08)":today?"rgba(212,168,67,0.08)":"rgba(255,255,255,0.03)",
                border:"1.5px solid "+(active?"#f59e0b":past?"rgba(34,197,94,0.25)":today?"rgba(212,168,67,0.25)":"rgba(255,255,255,0.06)"),
                borderRadius:10,padding:"8px 4px",textAlign:"center",
                opacity:locked?0.3:1,
                boxShadow:active?"0 0 16px rgba(245,158,11,0.4)":past?"0 0 6px rgba(34,197,94,0.1)":"none",
                transition:"all 0.2s",
                animation:active?"availablePulse 1.8s ease-in-out infinite":"none",
              }}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:active?"rgba(0,0,0,0.6)":past?"rgba(34,197,94,0.5)":"rgba(255,255,255,0.2)",letterSpacing:1,marginBottom:4}}>D{i+1}</div>
                <div style={{fontSize:past?16:14,marginBottom:3}}>{past?"✅":r.gems>0?"💎":"🪙"}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:active?"rgba(0,0,0,0.7)":r.gems>0?"#c084fc":"rgba(212,168,67,0.6)",letterSpacing:0.5}}>
                  {past?"":r.gems>0?"+"+r.gems:"+"+r.coins}
                </div>
              </div>
            );
          })}
        </div>
        {/* Active reward preview */}
        <div style={{margin:"0 24px 20px",padding:"16px",background:"rgba(212,168,67,0.06)",border:"1px solid rgba(212,168,67,0.15)",borderRadius:14,display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:32,flexShrink:0}}>{dayRewards[currentDay].gems>0?"💎":"🪙"}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#d4a843",letterSpacing:1,marginBottom:2}}>Today's Reward</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:15,color:"rgba(255,255,255,0.6)"}}>
              {dayRewards[currentDay].coins>0&&"+"+dayRewards[currentDay].coins.toLocaleString()+" 🪙 Cobra Coins"}
              {dayRewards[currentDay].gems>0&&" · +"+dayRewards[currentDay].gems+" 💎 Gems"}
            </div>
          </div>
        </div>
        {/* CTA */}
        <div style={{padding:"0 24px"}}>
          {canClaim
            ?<button onClick={function(){onClaim(dayRewards[currentDay]);}} style={{width:"100%",padding:"16px",background:"linear-gradient(135deg,#92400e,#d97706,#f59e0b)",border:"none",borderRadius:14,fontFamily:"Cinzel,serif",fontSize:15,letterSpacing:3,color:"#010603",fontWeight:700,cursor:"pointer",touchAction:"manipulation",position:"relative",overflow:"hidden",boxShadow:"0 4px 20px rgba(245,158,11,0.4)"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:"rgba(255,255,255,0.12)",borderRadius:"14px 14px 0 0",pointerEvents:"none"}}/>
              🎁 CLAIM DAY {currentDay+1}
            </button>
            :<div style={{padding:"14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,textAlign:"center"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"rgba(255,255,255,0.3)",letterSpacing:2}}>NEXT REWARD IN</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:22,color:"rgba(212,168,67,0.7)",marginTop:4,letterSpacing:3}}>{hrs}h {mins}m</div>
            </div>
          }
          <button onClick={onClose} style={{width:"100%",marginTop:10,padding:"12px",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.3)",borderRadius:14,fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,cursor:"pointer",touchAction:"manipulation"}}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

function SpinScreen({onClose,onSpin}){
  var SEGS=[
    {label:"50",sub:"COINS",icon:"🪙",color1:"#14532d",color2:"#16a34a",glow:"#22c55e",reward:{coins:50},rarity:"common"},
    {label:"100",sub:"COINS",icon:"🪙",color1:"#1e3a8a",color2:"#2563eb",glow:"#60a5fa",reward:{coins:100},rarity:"uncommon"},
    {label:"50",sub:"COINS",icon:"🪙",color1:"#14532d",color2:"#16a34a",glow:"#22c55e",reward:{coins:50},rarity:"common"},
    {label:"200",sub:"COINS",icon:"🪙",color1:"#78350f",color2:"#d97706",glow:"#fbbf24",reward:{coins:200},rarity:"rare"},
    {label:"50",sub:"COINS",icon:"🪙",color1:"#14532d",color2:"#16a34a",glow:"#22c55e",reward:{coins:50},rarity:"common"},
    {label:"100",sub:"COINS",icon:"🪙",color1:"#1e3a8a",color2:"#2563eb",glow:"#60a5fa",reward:{coins:100},rarity:"uncommon"},
    {label:"10",sub:"GEMS",icon:"💎",color1:"#4c1d95",color2:"#7c3aed",glow:"#c084fc",reward:{gems:10},rarity:"epic"},
    {label:"JACKPOT",sub:"500🪙+5💎",icon:"👑",color1:"#7f1d1d",color2:"#dc2626",glow:"#f87171",reward:{coins:500,gems:5},rarity:"legendary"},
  ];
  var rarityColors={common:"#22c55e",uncommon:"#60a5fa",rare:"#fbbf24",epic:"#c084fc",legendary:"#f87171"};
  var rarityLabels={common:"COMMON",uncommon:"UNCOMMON",rare:"RARE",epic:"EPIC",legendary:"LEGENDARY ✦"};
  var last=parseInt((function(){try{return localStorage.getItem("cobra_spin_last")||"0";}catch(e){return"0";}})());
  var msSince=Date.now()-last;
  var canSp=msSince>=86400000;
  var msUntil=Math.max(0,86400000-msSince);
  var hrs=Math.floor(msUntil/3600000),mins=Math.floor((msUntil%3600000)/60000);
  var [spinning,setSpinning]=useState(false);
  var [rotation,setRotation]=useState(0);
  var [result,setResult]=useState(null);
  var [phase,setPhase]=useState("idle");
  var [confettiPieces,setConfettiPieces]=useState([]);
  var sliceAngle=360/8;

  function handleSpin(){
    if(!canSp||spinning)return;
    setSpinning(true);setResult(null);setPhase("spinning");
    var idx=Math.floor(Math.random()*8);
    var base=rotation-(rotation%360);
    var targetRotation=base+360*8+(idx*sliceAngle)+(sliceAngle/2);
    setRotation(targetRotation);
    setTimeout(function(){
      setSpinning(false);
      var seg=SEGS[idx];
      setResult(seg);setPhase("reveal");
      onSpin(seg.reward);
      try{localStorage.setItem("cobra_spin_last",String(Date.now()));}catch(e){}
      // confetti for rare+
      if(seg.rarity==="rare"||seg.rarity==="epic"||seg.rarity==="legendary"){
        var pieces=Array.from({length:seg.rarity==="legendary"?60:30},function(_,k){return{
          id:k,x:Math.random()*100,delay:Math.random()*0.8,dur:1.2+Math.random()*1,
          color:["#d4a843","#f0c060","#c084fc","#22c55e","#f87171","#60a5fa"][Math.floor(Math.random()*6)],
          size:4+Math.random()*8,rotate:Math.random()*360,
        };});
        setConfettiPieces(pieces);
        setTimeout(function(){setConfettiPieces([]);},3000);
      }
    },3800);
  }

  return(
    <div style={{position:"fixed",inset:0,zIndex:250,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflowY:"auto",background:"radial-gradient(ellipse 120% 100% at 50% 0%,#1a0030 0%,#0a0010 40%,#010603 100%)"}}>
      <style>{`
        @keyframes spinPointerBounce{0%,100%{transform:translateX(-50%) translateY(0) scale(1)}50%{transform:translateX(-50%) translateY(-6px) scale(1.1)}}
        @keyframes spinResultReveal{0%{opacity:0;transform:scale(0.8) translateY(30px)}60%{transform:scale(1.04) translateY(-4px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes spinRimRotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes spinGlowPulse{0%,100%{opacity:0.6}50%{opacity:1}}
        @keyframes spinConfetti{0%{opacity:1;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(220px) rotate(720deg)}}
        @keyframes spinLegendaryBg{0%,100%{opacity:0.4}50%{opacity:0.8}}
        @keyframes spinBtnPulse{0%,100%{box-shadow:0 4px 24px rgba(212,168,67,0.4),inset 0 1px 0 rgba(255,255,255,0.3)}50%{box-shadow:0 4px 40px rgba(212,168,67,0.8),0 0 60px rgba(212,168,67,0.3),inset 0 1px 0 rgba(255,255,255,0.3)}}
      `}</style>

      {/* Ambient background orbs */}
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        <div style={{position:"absolute",top:"-20%",left:"50%",transform:"translateX(-50%)",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,85,247,0.12),transparent 70%)",animation:"spinGlowPulse 3s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"-10%",left:"20%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(212,168,67,0.08),transparent 70%)",animation:"spinGlowPulse 4s ease-in-out infinite 1s"}}/>
      </div>

      {/* Confetti */}
      {confettiPieces.map(function(p){return(
        <div key={p.id} style={{position:"absolute",top:"35%",left:p.x+"%",width:p.size,height:p.size,borderRadius:p.size>7?2:"50%",background:p.color,animation:"spinConfetti "+p.dur+"s ease-in "+p.delay+"s both",pointerEvents:"none",zIndex:10,transform:"rotate("+p.rotate+"deg)"}}/>
      );})}

      {/* Header */}
      <div style={{position:"relative",zIndex:2,width:"100%",maxWidth:400,padding:"calc(env(safe-area-inset-top) + 16px) 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{width:36}}/>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:24,fontWeight:700,letterSpacing:4,background:"linear-gradient(135deg,#f4cc52 0%,#d4a843 50%,#f4cc52 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>LUCKY SPIN</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:4,color:"rgba(212,168,67,0.35)",marginTop:2}}>FREE DAILY REWARD</div>
        </div>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",flexShrink:0}}>✕</button>
      </div>

      {/* Wheel assembly */}
      <div style={{position:"relative",zIndex:2,marginBottom:24}}>

        {/* Outer decorative spinning rim (CSS-only, very slow) */}
        <div style={{position:"absolute",inset:-20,borderRadius:"50%",border:"2px dashed rgba(212,168,67,0.12)",animation:"spinRimRotate 20s linear infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",inset:-12,borderRadius:"50%",border:"1px solid rgba(212,168,67,0.08)",animation:"spinRimRotate 30s linear infinite reverse",pointerEvents:"none"}}/>

        {/* Glow bloom behind wheel */}
        <div style={{position:"absolute",inset:-30,borderRadius:"50%",background:"radial-gradient(circle,rgba(212,168,67,0.1),rgba(168,85,247,0.06),transparent 70%)",filter:"blur(8px)",pointerEvents:"none",animation:"spinGlowPulse 2.5s ease-in-out infinite"}}/>

        {/* Pointer */}
        <div style={{position:"absolute",top:-22,left:"50%",zIndex:5,animation:canSp&&!spinning?"spinPointerBounce 1.4s ease-in-out infinite":"none",transformOrigin:"bottom center"}}>
          <svg width="22" height="28" viewBox="0 0 22 28">
            <defs>
              <linearGradient id="ptrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f4cc52"/>
                <stop offset="100%" stopColor="#a87020"/>
              </linearGradient>
              <filter id="ptrGlow">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <polygon points="11,0 22,28 11,22 0,28" fill="url(#ptrGrad)" filter="url(#ptrGlow)"/>
            <polygon points="11,4 19,26 11,20 3,26" fill="rgba(255,255,255,0.2)"/>
          </svg>
        </div>

        {/* The wheel SVG */}
        <svg width="300" height="300" viewBox="0 0 300 300" style={{display:"block",transform:"rotate("+rotation+"deg)",transition:spinning?"transform 3.8s cubic-bezier(0.08,0.82,0.17,1)":"none",filter:"drop-shadow(0 0 24px rgba(0,0,0,0.8))"}}>
          <defs>
            {SEGS.map(function(s,i){return(
              <radialGradient key={"rg"+i} id={"rg"+i} cx="30%" cy="30%" r="80%">
                <stop offset="0%" stopColor={s.color2} stopOpacity="1"/>
                <stop offset="100%" stopColor={s.color1} stopOpacity="1"/>
              </radialGradient>
            );})}
            <radialGradient id="centerGrad" cx="50%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#1a2f1a"/>
              <stop offset="100%" stopColor="#010603"/>
            </radialGradient>
            <filter id="segGlow">
              <feGaussianBlur stdDeviation="1.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Outer metallic bezel */}
          <circle cx="150" cy="150" r="149" fill="none" stroke="url(#ptrGrad)" strokeWidth="3" opacity="0.6"/>
          <circle cx="150" cy="150" r="145" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>

          {SEGS.map(function(s,i){
            var a1=(sliceAngle*i-90)*Math.PI/180,a2=(sliceAngle*(i+1)-90)*Math.PI/180;
            var R=144,cx=150,cy=150;
            var x1=cx+R*Math.cos(a1),y1=cy+R*Math.sin(a1);
            var x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2);
            var midA=(a1+a2)/2;
            var mx=cx+(R*0.64)*Math.cos(midA),my=cy+(R*0.64)*Math.sin(midA);
            var lx=cx+(R*0.88)*Math.cos(midA),ly=cy+(R*0.88)*Math.sin(midA);
            var textAngleDeg=sliceAngle*i+sliceAngle/2-90;
            return(
              <g key={i}>
                {/* Slice fill with radial gradient */}
                <path d={"M"+cx+","+cy+" L"+x1+","+y1+" A"+R+","+R+" 0 0,1 "+x2+","+y2+" Z"} fill={"url(#rg"+i+")"} stroke="rgba(0,0,0,0.5)" strokeWidth="1.5"/>
                {/* Inner highlight arc (top sheen) */}
                <path d={"M"+cx+","+cy+" L"+x1+","+y1+" A"+R+","+R+" 0 0,1 "+x2+","+y2+" Z"} fill="rgba(255,255,255,0.07)" stroke="none" style={{mixBlendMode:"overlay"}}/>
                {/* Rarity glow dot near rim */}
                <circle cx={lx} cy={ly} r="5" fill={s.glow} opacity="0.7" filter="url(#segGlow)"/>
                {/* Text label */}
                <g transform={"rotate("+textAngleDeg+","+mx+","+my+")"}>
                  <text x={mx} y={my-7} textAnchor="middle" dominantBaseline="middle" fontSize={s.label==="JACKPOT"?"9":"15"} fontWeight="800" fill="white" style={{fontFamily:"sans-serif",letterSpacing:s.label==="JACKPOT"?1:0}}>{s.label}</text>
                  <text x={mx} y={my+8} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="rgba(255,255,255,0.65)" style={{fontFamily:"sans-serif",letterSpacing:1}}>{s.sub}</text>
                </g>
                {/* Spoke divider */}
                <line x1={cx} y1={cy} x2={x1} y2={y1} stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"/>
              </g>
            );
          })}

          {/* Center hub */}
          <circle cx="150" cy="150" r="34" fill="url(#centerGrad)" stroke="rgba(212,168,67,0.5)" strokeWidth="2.5"/>
          <circle cx="150" cy="150" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
          <text x="150" y="156" textAnchor="middle" dominantBaseline="middle" fontSize="22">🐍</text>

          {/* Rim dots at each spoke */}
          {SEGS.map(function(_,i){
            var a=(sliceAngle*i-90)*Math.PI/180;
            return(
              <g key={"dot"+i}>
                <circle cx={150+142*Math.cos(a)} cy={150+142*Math.sin(a)} r="5" fill="rgba(212,168,67,0.4)" stroke="rgba(212,168,67,0.8)" strokeWidth="1"/>
                <circle cx={150+142*Math.cos(a)} cy={150+142*Math.sin(a)} r="2" fill="#f0c060"/>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Result reveal */}
      {phase==="reveal"&&result&&(
        <div style={{position:"relative",zIndex:2,width:"100%",maxWidth:360,marginBottom:20,padding:"0 20px",animation:"spinResultReveal 0.5s cubic-bezier(.22,1,.36,1) both"}}>
          <div style={{background:"linear-gradient(135deg,rgba("+
            (result.rarity==="legendary"?"212,168,67":result.rarity==="epic"?"168,85,247":result.rarity==="rare"?"245,158,11":"34,197,94")+
            ",0.1),rgba(0,0,0,0))",border:"1.5px solid "+rarityColors[result.rarity]+"44",borderRadius:20,padding:"18px 20px",textAlign:"center",boxShadow:"0 0 30px "+rarityColors[result.rarity]+"22"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:4,color:rarityColors[result.rarity],marginBottom:8}}>{rarityLabels[result.rarity]}</div>
            <div style={{fontSize:36,marginBottom:6}}>{result.icon}</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:18,fontWeight:700,color:"#f0e6c8",letterSpacing:1,marginBottom:4}}>{result.label} {result.sub==="COINS"?"Coins":result.sub==="GEMS"?"Gems":""}</div>
            {result.reward.gems&&result.reward.coins?<div style={{fontFamily:"Crimson Text,serif",fontSize:14,color:rarityColors[result.rarity],opacity:0.8}}>+{result.reward.coins} 🪙 · +{result.reward.gems} 💎</div>
            :result.reward.gems?<div style={{fontFamily:"Crimson Text,serif",fontSize:14,color:"#c084fc"}}>+{result.reward.gems} Gems</div>
            :<div style={{fontFamily:"Crimson Text,serif",fontSize:14,color:"#f0c060"}}>+{result.reward.coins} Coins</div>}
          </div>
        </div>
      )}

      {/* Rarity legend */}
      {phase!=="reveal"&&(
        <div style={{position:"relative",zIndex:2,display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",justifyContent:"center",padding:"0 20px"}}>
          {Object.entries(rarityColors).map(function(entry){return(
            <div key={entry[0]} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:20,padding:"4px 10px",border:"1px solid rgba(255,255,255,0.05)"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:entry[1],boxShadow:"0 0 4px "+entry[1]}}/>
              <span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:1}}>{rarityLabels[entry[0]].replace(" ✦","")}</span>
            </div>
          );})}
        </div>
      )}

      {/* CTA button */}
      <div style={{position:"relative",zIndex:2,padding:"0 20px",width:"100%",maxWidth:360}}>
        {canSp
          ?<button onClick={handleSpin} disabled={spinning} style={{width:"100%",padding:"16px",background:spinning?"rgba(255,255,255,0.04)":"linear-gradient(135deg,#c49030,#f0c060,#d4a843)",border:spinning?"1px solid rgba(255,255,255,0.08)":"none",borderRadius:16,fontFamily:"Cinzel,serif",fontSize:16,letterSpacing:4,color:spinning?"rgba(255,255,255,0.15)":"#010603",fontWeight:700,cursor:spinning?"not-allowed":"pointer",touchAction:"manipulation",position:"relative",overflow:"hidden",animation:!spinning?"spinBtnPulse 2s ease-in-out infinite":"none",transition:"all 0.3s"}}>
            {!spinning&&<div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:"rgba(255,255,255,0.15)",borderRadius:"16px 16px 0 0",pointerEvents:"none"}}/>}
            {spinning
              ?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><span>🎡</span> SPINNING…</span>
              :<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><span>🎰</span> SPIN NOW</span>
            }
          </button>
          :<div style={{textAlign:"center",padding:"16px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:4,color:"rgba(255,255,255,0.2)",marginBottom:8}}>NEXT SPIN IN</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:32,color:"rgba(212,168,67,0.7)",letterSpacing:6,fontWeight:700}}>{hrs}h {mins}m</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"rgba(255,255,255,0.15)",marginTop:4}}>Come back tomorrow for your free spin</div>
          </div>
        }
        <button onClick={onClose} style={{width:"100%",marginTop:10,padding:"12px",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.25)",borderRadius:14,fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:3,cursor:"pointer",touchAction:"manipulation"}}>CLOSE</button>
      </div>
    </div>
  );
}

function RewardPopup({reward,onClose}){
  var isLegendary=reward.coins>=500||reward.gems>=5;
  var isEpic=reward.gems>=10||(reward.coins>=200&&!isLegendary);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{animation:"rewardPop 0.45s cubic-bezier(.22,1,.36,1) both",maxWidth:280,width:"100%"}} onClick={function(e){e.stopPropagation();}}>
        {/* Glow behind card */}
        <div style={{position:"absolute",width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle,"+(isLegendary?"rgba(212,168,67,0.25)":isEpic?"rgba(168,85,247,0.2)":"rgba(34,197,94,0.15)")+",transparent 70%)",transform:"translate(-50%,-50%)",left:"50%",top:"50%",pointerEvents:"none"}}/>
        <div style={{background:"linear-gradient(160deg,#0d1f0e,#060e06)",border:"2px solid "+(isLegendary?"rgba(212,168,67,0.7)":isEpic?"rgba(168,85,247,0.5)":"rgba(34,197,94,0.4)"),borderRadius:24,padding:"32px 24px",textAlign:"center",position:"relative",overflow:"hidden",boxShadow:"0 0 40px "+(isLegendary?"rgba(212,168,67,0.3)":isEpic?"rgba(168,85,247,0.2)":"rgba(0,0,0,0.8)")}}>
          {/* Top shimmer */}
          <div style={{position:"absolute",top:0,left:0,right:0,height:"40%",background:"rgba(255,255,255,0.025)",pointerEvents:"none"}}/>
          {/* Rarity label */}
          {isLegendary&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:4,color:"#f0c060",marginBottom:12,animation:"shimmer 2s ease-in-out infinite"}}>✦ LEGENDARY REWARD ✦</div>}
          {isEpic&&!isLegendary&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:4,color:"#c084fc",marginBottom:12}}>EPIC REWARD</div>}
          {/* Icon */}
          <div style={{fontSize:64,marginBottom:12,filter:isLegendary?"drop-shadow(0 0 16px rgba(212,168,67,0.8))":isEpic?"drop-shadow(0 0 12px rgba(168,85,247,0.6))":"none"}}>
            {reward.gems&&reward.gems>0?"💎":"🪙"}
          </div>
          {/* Label */}
          <div style={{fontFamily:"Cinzel,serif",fontSize:18,fontWeight:700,background:"linear-gradient(135deg,#f4cc52,#d4a843)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",letterSpacing:2,marginBottom:8}}>{reward.label||"Reward!"}</div>
          {/* Amounts */}
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:24}}>
            {reward.coins&&reward.coins>0?<div style={{fontFamily:"Cinzel,serif",fontSize:22,color:"#f0c060",letterSpacing:1}}>+{reward.coins.toLocaleString()} 🪙</div>:null}
            {reward.gems&&reward.gems>0?<div style={{fontFamily:"Cinzel,serif",fontSize:22,color:"#c084fc",letterSpacing:1}}>+{reward.gems} 💎</div>:null}
          </div>
          <button onClick={onClose} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#d4a843,#f0c060)",border:"none",borderRadius:12,fontFamily:"Cinzel,serif",fontSize:13,letterSpacing:3,color:"#010603",fontWeight:700,cursor:"pointer",touchAction:"manipulation",position:"relative",overflow:"hidden",boxShadow:"0 4px 16px rgba(212,168,67,0.35)"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:"rgba(255,255,255,0.15)",pointerEvents:"none",borderRadius:"12px 12px 0 0"}}/>
            COLLECT!
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaderboardScreen({goScreen,showSettings,setShowSettings,sfxMuted,musicMuted,sfxToggle,musToggle,gameStats,cardTheme,setCardTheme}){
  const [leaders,setLeaders]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  useEffect(function(){
    if(!supabase){setError(true);setLoading(false);return;}
    supabase.from("cobra_scores").select("*").order("wins",{ascending:false}).limit(20).then(function(res){
      if(res.error||!res.data){setError(true);setLoading(false);return;}
      setLeaders(res.data);setLoading(false);
    }).catch(function(){setError(true);setLoading(false);});
  },[]);
  return(
    <div className="feltbg" style={{display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"28px 20px",overflowY:"auto"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{maxWidth:420,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
        <button className="btn_btn_ghost" style={{marginBottom:18,padding:"12px 18px",fontSize:12}} onClick={function(){audio.buttonClick();goScreen("home");}}>BACK</button>
        <div style={{textAlign:"center",marginBottom:20}}>
          <span style={{fontSize:40}}>🏆</span>
          <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:22,letterSpacing:4,marginTop:8}}>LEADERBOARD</h2>
          <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#4a6a4a",fontSize:14,marginTop:4}}>Top 20 players by wins</p>
        </div>
        {loading&&<div style={{textAlign:"center",padding:40}}><ThinkingDots/></div>}
        {error&&!loading&&<div style={{fontFamily:"Crimson Text,serif",color:"#5a7a60",fontSize:15,textAlign:"center",padding:24,fontStyle:"italic"}}>No scores yet — play a game to appear here!</div>}
        {leaders&&leaders.length===0&&<div style={{fontFamily:"Crimson Text,serif",color:"#5a7a60",fontSize:15,textAlign:"center",padding:24,fontStyle:"italic"}}>No scores yet — play a game to appear here!</div>}
        {leaders&&leaders.map(function(row,i){
          var medal=i===0?"👑":i===1?"🥈":i===2?"🥉":""+(i+1);
          return(
            <div key={row.id||i} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,marginBottom:8,background:i===0?"rgba(212,168,67,0.1)":"rgba(0,0,0,0.28)",border:i===0?"1.5px solid rgba(212,168,67,0.3)":"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:i<3?22:14,width:28,textAlign:"center",flexShrink:0,color:i===0?"#d4a843":i===1?"#c0c0c0":i===2?"#cd7f32":"#3a5a3a"}}>{medal}</div>
              <div style={{fontSize:22,flexShrink:0}}>{row.avatar||"😎"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:i===0?"#d4a843":"#c8d8c8",letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.name}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:20,fontWeight:900,color:i===0?"#d4a843":"#4ade80"}}>{row.wins}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#3a5a3a",letterSpacing:1}}>WINS</div>
              </div>
            </div>
          );
        })}
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );
}

export default function Cobra(){
  const [showSplash,setShowSplash]=useState(true);
  const [screen,setScreen]=useState("home");
  const [mode,setMode]=useState(null);
  const [nPlayers,setNPlayers]=useState(2);
  const [names,setNames]=useState(["You","CPU 1","CPU 2","CPU 3","CPU 4"]);
  const [cpuCount,setCpuCount]=useState(1);
  const [cpuDiff,setCpuDiff]=useState(1);
  const [myIdx,setMyIdx]=useState(0);
  const [scores,setScores]=useState([]);
  const [hands,setHands]=useState([]);
  const [deck,setDeck]=useState([]);
  const [openPile,setOpenPile]=useState({cards:[],owner:-1});
  const [myPlayed,setMyPlayed]=useState([]);
  const [prevHand,setPrevHand]=useState(null);
  const [prevTotal,setPrevTotal]=useState(null);
  const [currentPlayer,setCurrentPlayer]=useState(0);
  const [phase,setPhase]=useState("declare");
  const [sel,setSel]=useState([]);
  const [roundRes,setRoundRes]=useState(null);
  const [roundEndData,setRoundEndData]=useState(null);
  const [revealData,setRevealData]=useState(null);
  const [gameOverData,setGameOverData]=useState(null);
  const [toast,setToast]=useState({msg:"",type:"info"});
  const [roomCode,setRoomCode]=useState("");
  const [roomInput,setRoomInput]=useState("");
  const [myName,setMyName]=useState(function(){try{return localStorage.getItem("cobra_player_name")||"";}catch(e){return"";}});
  const [onlinePlayers,setOnlinePlayers]=useState([]);
  const [isHost,setIsHost]=useState(false);
  const [onlineStatus,setOnlineStatus]=useState("");
  const [cpuThinking,setCpuThinking]=useState(false);
  const [sfxMuted,setSfxMuted]=useState(function(){try{return localStorage.getItem("cobra_sfx_muted")==="1";}catch(e){return false;}});
  const [musicMuted,setMusicMuted]=useState(function(){try{return localStorage.getItem("cobra_mus_muted")==="1";}catch(e){return false;}});
  const [showSettings,setShowSettings]=useState(false);
  const [showTutorial,setShowTutorial]=useState(false);
  const [tutorialDone,setTutorialDone]=useState(function(){try{return localStorage.getItem("cobra_tutorial_done")==="1";}catch(e){return false;}});
  const [tutorialStep,setTutorialStep]=useState(-1);
  const [earnedAch,setEarnedAch]=useState(null);
  const [unlockedAchs,setUnlockedAchs]=useState(function(){try{var a=localStorage.getItem("cobra_achs");return a?JSON.parse(a):[];}catch(e){return[];}});
  const [emojis,setEmojis]=useState([]);
  const [confetti,setConfetti]=useState([]);
  const [showEmojiPicker,setShowEmojiPicker]=useState(false);
  const [showRules,setShowRules]=useState(false);
  const [showExitConfirm,setShowExitConfirm]=useState(false);
  const [hovOpponent,setHovOpponent]=useState(-1);
  const [turnTime,setTurnTime]=useState(TURN_SEC);
  const [timerOn,setTimerOn]=useState(true);
  const [roundStart,setRoundStart]=useState(null);
  const [roundNum,setRoundNum]=useState(1);
  const [gameStats,setGameStats]=useState(function(){try{var s=localStorage.getItem("cobra_stats");return s?JSON.parse(s):{wins:0,cobras:0,rounds:0,streak:0,bestStreak:0};}catch(e){return{wins:0,cobras:0,rounds:0,streak:0,bestStreak:0};}});
  const [showYourTurn,setShowYourTurn]=useState(false);
  const [lastCpuPlay,setLastCpuPlay]=useState(null);
  const [showCpuPlay,setShowCpuPlay]=useState(false);
  const [dealAnim,setDealAnim]=useState(false);
  const [playingCardIds,setPlayingCardIds]=useState([]);
  const [pickingUp,setPickingUp]=useState(false);
  const [flashScores,setFlashScores]=useState([]);
  const [myAvatar,setMyAvatar]=useState(function(){try{return localStorage.getItem("cobra_player_avatar")||"😎";}catch(e){return"😎";}});
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installDismissed,setInstallDismissed]=useState(function(){try{return localStorage.getItem("cobra_install_dismissed")==="1";}catch(e){return false;}});
  const [showQR,setShowQR]=useState(false);
  const [qrDataUrl,setQrDataUrl]=useState("");
  const [elimAnim,setElimAnim]=useState(null); // {name, idx}
  const [cardTheme,setCardTheme]=useState(function(){try{return localStorage.getItem("cobra_card_theme")||"classic";}catch(e){return"classic";}});
  const [chatMessages,setChatMessages]=useState([]);
  const [chatOpen,setChatOpen]=useState(false);
  const [chatInput,setChatInput]=useState("");
  const [unreadChat,setUnreadChat]=useState(0);
  const [isSpectator,setIsSpectator]=useState(false);
  const [coins,setCoins]=useState(function(){try{return parseInt(localStorage.getItem("cobra_coins")||"500");}catch(e){return 500;}});
  const [gems,setGems]=useState(function(){try{return parseInt(localStorage.getItem("cobra_gems")||"10");}catch(e){return 10;}});
  const [playerXP,setPlayerXP]=useState(function(){try{return parseInt(localStorage.getItem("cobra_xp")||"0");}catch(e){return 0;}});
  const [playerLevel,setPlayerLevel]=useState(function(){try{return parseInt(localStorage.getItem("cobra_level")||"1");}catch(e){return 1;}});
  const [activeScreen,setActiveScreen]=useState(null);
  const [rewardPopup,setRewardPopup]=useState(null);
  // battle-pass state (safe reads)
  const lsGet=function(k,fb){try{var v=localStorage.getItem(k);return v!==null?v:fb;}catch(e){return fb;}};
  const [bpLevel,setBpLevel]=useState(function(){return parseInt(lsGet("cobra_bp_level","1"));});
  const [bpPremium,setBpPremium]=useState(function(){return lsGet("cobra_bp_premium","false")==="true";});
  const [bpClaimed,setBpClaimed]=useState(function(){try{return JSON.parse(lsGet("cobra_bp_claimed","[]"));}catch(e){return[];}});
  const [dailyLast,setDailyLast]=useState(function(){return parseInt(lsGet("cobra_daily_last","0"));});
  const [dailyStreak,setDailyStreak]=useState(function(){return parseInt(lsGet("cobra_daily_streak","0"));});
  const [spinLast,setSpinLast]=useState(function(){return parseInt(lsGet("cobra_spin_last","0"));});
  const [joiningRoom,setJoiningRoom]=useState(false);
  const [creatingRoom,setCreatingRoom]=useState(false);
  const [startingGame,setStartingGame]=useState(false);
  const [scoreLimit,setScoreLimit]=useState(function(){return parseInt(lsGet("cobra_score_limit","100"));});
  const [connStatus,setConnStatus]=useState(""); // "reconnecting"|"connected"|""
  const chatChannelRef=useRef(null);
  const chatScrollRef=useRef(null);
  const prevPlayersCount=useRef(0);
  // Auto-scroll chat to bottom on new messages
  useEffect(function(){if(chatScrollRef.current&&chatOpen)chatScrollRef.current.scrollTop=chatScrollRef.current.scrollHeight;},[chatMessages,chatOpen]);

  const toastT=useRef(null);
  const pollRef=useRef(null); // kept for legacy; unused when Supabase is active
  const timerRef=useRef(null);
  const audioInit=useRef(false);
  const yourTurnTimer=useRef(null);
  const phaseRef=useRef(phase);
  const handsRef=useRef(hands);
  const deckRef=useRef(deck);
  const currentPlayerRef=useRef(currentPlayer);
  const nPlayersRef=useRef(nPlayers);
  const scoresRef=useRef(scores);
  const modeRef=useRef(mode);
  const roomCodeRef=useRef(roomCode);
  const screenRef=useRef(screen);
  const broadcastMoveRef=useRef(null);
  useEffect(function(){phaseRef.current=phase;},[phase]);
  useEffect(function(){handsRef.current=hands;},[hands]);
  useEffect(function(){deckRef.current=deck;},[deck]);
  useEffect(function(){currentPlayerRef.current=currentPlayer;},[currentPlayer]);
  useEffect(function(){nPlayersRef.current=nPlayers;},[nPlayers]);
  useEffect(function(){scoresRef.current=scores;},[scores]);
  useEffect(function(){modeRef.current=mode;},[mode]);
  useEffect(function(){roomCodeRef.current=roomCode;},[roomCode]);
  useEffect(function(){screenRef.current=screen;},[screen]);
  const H=myIdx;

  const xpForLevel=function(lvl){return lvl*100;};
  const addCoins=function(n){setCoins(function(c){var v=c+n;try{localStorage.setItem("cobra_coins",String(v));}catch(e){}return v;});};
  const addGems=function(n){setGems(function(g){var v=g+n;try{localStorage.setItem("cobra_gems",String(v));}catch(e){}return v;});};

  const gainXP=function(amount){
    var curXP=parseInt(lsGet("cobra_xp","0"))+amount;
    var curLvl=parseInt(lsGet("cobra_level","1"));
    var bonusCoins=0;
    while(curLvl<100&&curXP>=curLvl*100){curXP-=curLvl*100;curLvl++;bonusCoins+=100;}
    try{localStorage.setItem("cobra_xp",String(curXP));localStorage.setItem("cobra_level",String(curLvl));}catch(e){}
    setPlayerXP(curXP);setPlayerLevel(curLvl);
    if(bonusCoins>0)addCoins(bonusCoins);
  };

  // ── Supabase Realtime ────────────────────────────────
  const roomRef=useRef(null);

  const onRoomUpdate=useCallback(function(room){
    if(!room)return;
    roomRef.current=room; // always keep latest room snapshot
    var newPlayers=room.players.map(function(p){return p.name;});
    // Detect join: player count increased
    if(prevPlayersCount.current>0&&newPlayers.length>prevPlayersCount.current){
      var joined=newPlayers[newPlayers.length-1];
      pop(joined+" joined the room!","success",2400);
      try{audio.init();audio.resume();var ctx=audio._ctx;if(ctx&&audio._sfxGain&&!audio._muted){var o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=880;g.gain.setValueAtTime(0.0001,ctx.currentTime);g.gain.linearRampToValueAtTime(0.08,ctx.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.3);o.connect(g);g.connect(audio._sfxGain);o.start();o.stop(ctx.currentTime+0.35);}}catch(e){}
    }
    prevPlayersCount.current=newPlayers.length;
    setOnlinePlayers(newPlayers);
    setOnlineStatus(room.players.length+"/"+room.maxPlayers);
    if(room.status==="started"&&room.gameState){
      var gs=room.gameState;
      setHands(gs.hands);setDeck(gs.deck);setOpenPile(gs.openPile);
      setCurrentPlayer(gs.currentPlayer);
      setPhase(gs.phase);setScores(gs.scores);
      if(gs.scoreLimit)setScoreLimit(gs.scoreLimit);
      if(gs.timerOn!==undefined)setTimerOn(gs.timerOn);
      setNames(room.players.map(function(p){return p.name;}));
      setNPlayers(room.players.length);
      // Another player declared — join the reveal screen
      if(gs.declared){
        var dd=gs.declared;
        setRevealData({ns:dd.ns,res:dd.res,declarerIdx:dd.declarerIdx,hands:dd.hands});
        setScores(dd.ns);
        setScreen("reveal");
      } else {
        // Always move to game — host controls when this fires
        setScreen("game");
      }
    }
  },[]);

  const onConnectionChange=useCallback(function(status){
    if(status==="reconnecting"){setConnStatus("reconnecting");pop("Reconnecting...","warning",4000);}
    else if(status==="connected"){
      setConnStatus("connected");pop("Connected","success",1800);
      setTimeout(function(){setConnStatus("");},2000);
      // Re-sync game state from DB on reconnect
      if(roomCodeRef.current){
        loadRoom(roomCodeRef.current).then(function(r){if(r)onRoomUpdate(r);}).catch(function(){});
      }
    }
    else if(status==="disconnected"){setConnStatus("disconnected");}
  },[]);
  const {subscribe:rtSubscribe,broadcast:rtBroadcast,unsubscribe:rtUnsubscribe}=useRoom({onRoomUpdate,onConnectionChange});

  // Broadcast current game state to all online players after a move
  const broadcastMove=function(nh,nd,np,nextPlayer,nextPhase,ns,declared){
    if(mode==="cpu"||!roomRef.current)return;
    var gs={hands:nh,deck:nd,openPile:np,myPlayed:[],currentPlayer:nextPlayer,phase:nextPhase,scores:ns||scores};
    if(declared)gs.declared=declared;
    // Always force status:"started" — roomRef may still hold lobby status due to async round-trip
    var updatedRoom=Object.assign({},roomRef.current,{gameState:gs,status:"started"});
    roomRef.current=updatedRoom;
    rtBroadcast(updatedRoom);
    saveRoom(updatedRoom.code,updatedRoom);
  };
  broadcastMoveRef.current=broadcastMove;

  // PWA install prompt listener
  useEffect(function(){
    function handleInstall(e){e.preventDefault();setInstallPrompt(e);}
    window.addEventListener("beforeinstallprompt",handleInstall);
    return function(){window.removeEventListener("beforeinstallprompt",handleInstall);};
  },[]);

  // URL room code auto-join
  useEffect(function(){
    try{
      var params=new URLSearchParams(window.location.search);
      var roomParam=params.get("room");
      if(roomParam){
        setRoomInput(roomParam.toUpperCase());
        setScreen("setupGlobal");
        window.history.replaceState({},"","/");
      }
    }catch(e){}
  },[]);

  useEffect(function(){
    var m=document.querySelector('meta[name="theme-color"]');
    if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m);}
    m.content='#010603';
    var v=document.querySelector('meta[name="viewport"]');
    if(!v){v=document.createElement('meta');v.name='viewport';document.head.appendChild(v);}
    v.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
    document.title='COBRA';
    // iOS Safari AudioContext fix — resume on visibility change
    function handleVis(){
      if(document.visibilityState==="visible"){
        audio.resume();
        if(audio._bgGain&&audio._ctx&&!audio._musicMuted){
          var t=audio._ctx.currentTime;
          audio._bgGain.gain.setValueAtTime(0,t);
          audio._bgGain.gain.linearRampToValueAtTime(0.5,t+1.5);
        }
      }
    }
    document.addEventListener("visibilitychange",handleVis);
    // Also resume on any touch - belt and suspenders for iOS
    function handleTouch(){audio.resume();}
    document.addEventListener("touchstart",handleTouch,{passive:true});
    return function(){
      document.removeEventListener("visibilitychange",handleVis);
      document.removeEventListener("touchstart",handleTouch);
    };
  },[]);

  const initAudio=useCallback(function(){
    if(audioInit.current)return;
    audioInit.current=true;
    audio.init();audio.resume();
  },[]);

  useEffect(function(){
    document.addEventListener("touchstart",initAudio,{once:true});
    document.addEventListener("click",initAudio,{once:true});
    return function(){document.removeEventListener("touchstart",initAudio);document.removeEventListener("click",initAudio);};
  },[initAudio]);

  const goScreen=useCallback(function(s){
    audio.init();audio.resume();
    if(s==="home"){
      rtUnsubscribe();
      if(chatChannelRef.current&&supabase){try{supabase.removeChannel(chatChannelRef.current);}catch(e){}chatChannelRef.current=null;}
      setIsSpectator(false);setChatMessages([]);setUnreadChat(0);setChatOpen(false);
    }
    setScreen(s);
  },[rtUnsubscribe]);

  const pop=function(msg,type,ms){
    type=type||"info";ms=ms||2600;
    clearTimeout(toastT.current);setToast({msg:msg,type:type});
    toastT.current=setTimeout(function(){setToast({msg:"",type:"info"});},ms);
  };

  // Turn timer
  useEffect(function(){
    clearInterval(timerRef.current);
    if(screen!=="game"||!timerOn||currentPlayer!==H)return;
    setTurnTime(TURN_SEC);
    var t=TURN_SEC;
    timerRef.current=setInterval(function(){
      t--;setTurnTime(t);
      if(t<=8)audio.timerUrgent();
      else if(t%5===0)audio.timerTick();
      if(t<=0){
        clearInterval(timerRef.current);
        setTurnTime(TURN_SEC);
        var curPhase=phaseRef.current;
        var curHands=handsRef.current;
        if(curPhase==="play"||curPhase==="declare"){
          var hand=curHands[H];
          if(hand&&hand.length){
            var highest=[...hand].sort(function(a,b){return cv(b)-cv(a);})[0];
            var nh2=[...curHands];nh2[H]=hand.filter(function(c){return c.id!==highest.id;});
            pop("Time up! Auto-played "+highest.value+highest.suit,"warning");
            if(modeRef.current==="cpu"){
              // CPU mode: just auto-play, player picks up manually
              setHands(nh2);setMyPlayed([highest]);setSel([]);setPhase("pickup");
            } else {
              // Online mode: auto-complete full turn (play + pick from deck)
              var curDeck=deckRef.current;
              var drawn2=curDeck.length>0?curDeck[0]:null;
              var rest2=drawn2?curDeck.slice(1):curDeck;
              if(drawn2)nh2[H]=[...nh2[H],drawn2];
              var newOpen2={cards:[highest],owner:H};
              setHands(nh2);setDeck(rest2);setMyPlayed([]);setSel([]);setPhase("declare");setOpenPile(newOpen2);
              var next2=(currentPlayerRef.current+1)%nPlayersRef.current;
              setCurrentPlayer(next2);
              if(broadcastMoveRef.current)broadcastMoveRef.current(nh2,rest2,newOpen2,next2,"declare",scoresRef.current);
              if(next2===H){audio.turnChange();setShowYourTurn(true);clearTimeout(yourTurnTimer.current);yourTurnTimer.current=setTimeout(function(){setShowYourTurn(false);},2000);}
            }
          }
        }
      }
    },1000);
    return function(){clearInterval(timerRef.current);};
  },[currentPlayer,screen,timerOn,H]);

  // Tutorial auto-advance: watch for player actions
  useEffect(function(){
    if(tutorialStep<0)return;
    var s=COACH_STEPS[tutorialStep];
    if(!s)return;
    if(s.waitFor==="selection"&&sel.length>0)setTutorialStep(function(p){return p+1;});
  },[sel,tutorialStep]);
  useEffect(function(){
    if(tutorialStep<0)return;
    var s=COACH_STEPS[tutorialStep];
    if(!s)return;
    if(s.waitFor==="played"&&phase==="pickup")setTutorialStep(function(p){return p+1;});
    if(s.waitFor==="pickedup"&&phase==="declare"&&currentPlayer===0)setTutorialStep(function(p){return p+1;});
  },[phase,currentPlayer,tutorialStep]);

  function unlockAch(id){
    if(unlockedAchs.includes(id))return;
    var ach=ACHIEVEMENTS.find(function(a){return a.id===id;});
    if(!ach)return;
    setUnlockedAchs(function(p){var n=[...p,id];try{localStorage.setItem("cobra_achs",JSON.stringify(n));}catch(e){}return n;});
    setEarnedAch(ach);audio.achievement();
  }

  const sendEmoji=function(emoji){
    audio.init();audio.resume();
    setShowEmojiPicker(false);
    var x=Math.random()*60+20;var y=Math.random()*30+40;
    var id=Date.now();
    setEmojis(function(p){return[...p,{id:id,emoji:emoji,x:x+"%",y:y+"%"}];});
    setTimeout(function(){setEmojis(function(p){return p.filter(function(e){return e.id!==id;});});},1500);
    if(chatChannelRef.current){try{chatChannelRef.current.send({type:"broadcast",event:"emoji",payload:{emoji:emoji,x:x+"%",y:y+"%",id:id,player:myName}});}catch(e){}}
  };

  function deal(s,n){
    var d=shuffle(mkDeck()),h=[];
    for(var i=0;i<n;i++)h.push(d.splice(0,7));
    setHands(h);setDeck(d);setOpenPile({cards:[],owner:-1});setMyPlayed([]);
    setCurrentPlayer(0);setPhase("declare");setSel([]);setScores(s);setPrevHand(null);
    setDealAnim(true);setTimeout(function(){setDealAnim(false);},900);
    setRoundStart(Date.now());
    setRoundNum(function(r){return r+1;});
    setShowYourTurn(true);
    clearTimeout(yourTurnTimer.current);
    yourTurnTimer.current=setTimeout(function(){setShowYourTurn(false);},2000);
    audio.init();audio.resume();
    audio.turnChange();
    setTimeout(function(){audio.shuffle_sfx();},100);
  }

  function startCPU(){
    var n=1+cpuCount,ns=names.slice(0,n),s=Array(n).fill(0);
    setMode("cpu");setNPlayers(n);setNames(ns);setMyIdx(0);
    deal(s,n);goScreen("game");
    if(!tutorialDone)setShowTutorial(true);
  }

  function createRoom(){
    if(!myName.trim()){pop("Enter your name first","warning");return;}
    try{localStorage.setItem("cobra_player_name",myName.trim());}catch(e){}
    try{localStorage.setItem("cobra_player_avatar",myAvatar);}catch(e){}
    setCreatingRoom(true);
    var code=Math.random().toString(36).slice(2,6).toUpperCase();
    setRoomCode(code);setIsHost(true);setMyIdx(0);
    var room={code:code,host:myName,players:[{name:myName,idx:0}],maxPlayers:4,status:"lobby",gameState:null,ts:Date.now()};
    saveRoom(code,room).then(function(){
      setCreatingRoom(false);
      setMode("online");
      startLobbyPoll(code); // subscribe first so we hear our own broadcast
      rtBroadcast(room);
      setOnlinePlayers([myName]);goScreen("lobby");
      pop("Room "+code+" created!","success");
      audio.init();audio.resume();audio.win();
    }).catch(function(){
      setCreatingRoom(false);
      pop("Connection error — try again","error");
    });
  }

  function joinRoom(){
    var code=roomInput.trim().toUpperCase();
    if(!code){pop("Enter a room code","error");return;}
    if(!myName.trim()){pop("Enter your name first","warning");return;}
    try{localStorage.setItem("cobra_player_name",myName.trim());}catch(e){}
    try{localStorage.setItem("cobra_player_avatar",myAvatar);}catch(e){}
    setJoiningRoom(true);
    loadRoom(code).then(function(room){
      if(!room){setJoiningRoom(false);pop("Room not found","error");return;}
      if(room.status==="started"){
        setJoiningRoom(false);
        // Offer spectator mode
        setRoomCode(code);
        goScreen("spectatePrompt");
        return;
      }
      if(room.players.length>=room.maxPlayers){setJoiningRoom(false);pop("Room is full","error");return;}
      var idx=room.players.length;
      room.players.push({name:myName,idx:idx});
      saveRoom(code,room).then(function(){
        setJoiningRoom(false);
        setMode("online");
        setRoomCode(code);setIsHost(false);setMyIdx(idx);
        setOnlinePlayers(room.players.map(function(p){return p.name;}));
        startLobbyPoll(code);
        rtBroadcast(room); // tell host + others a new player joined
        goScreen("lobby");pop("Joined!","success");
      }).catch(function(){setJoiningRoom(false);pop("Connection error — try again","error");});
    }).catch(function(){setJoiningRoom(false);pop("Connection error — try again","error");});
  }

  function startLobbyPoll(code){
    // Subscribe to Realtime channel for instant updates
    rtSubscribe(code);
    // Also load current DB state immediately (handles late-joiners / refresh)
    loadRoom(code).then(function(room){if(room)onRoomUpdate(room);});
    // Subscribe to chat channel
    if(supabase){
      try{
        if(chatChannelRef.current)supabase.removeChannel(chatChannelRef.current);
        var chatCh=supabase.channel("cobra-chat:"+code,{config:{broadcast:{self:false}}});
        chatCh.on("broadcast",{event:"chat"},function(obj){
          var payload=obj.payload;
          setChatMessages(function(p){return[...p.slice(-49),payload];});
          setChatOpen(function(open){if(!open)setUnreadChat(function(n){return n+1;});return open;});
        }).on("broadcast",{event:"emoji"},function(obj){
          var p=obj.payload;if(!p)return;
          var id2=p.id+"-r";
          setEmojis(function(prev){return[...prev,{id:id2,emoji:p.emoji,x:p.x,y:p.y}];});
          setTimeout(function(){setEmojis(function(prev){return prev.filter(function(e){return e.id!==id2;});});},1500);
        }).subscribe();
        chatChannelRef.current=chatCh;
      }catch(e){}
    }
  }

  function startOnlineGame(){
    setStartingGame(true);
    loadRoom(roomCode).then(function(room){
      if(!room){setStartingGame(false);return;}
      var n=room.players.length,d=shuffle(mkDeck()),h=[];
      for(var i=0;i<n;i++)h.push(d.splice(0,7));
      var gs={hands:h,deck:d,openPile:{cards:[],owner:-1},myPlayed:[],currentPlayer:0,phase:"declare",scores:Array(n).fill(0),scoreLimit:scoreLimit,timerOn:timerOn};
      room.status="started";room.gameState=gs;
      saveRoom(roomCode,room).then(function(){
        setStartingGame(false);
        roomRef.current=room; // ensure roomRef has started status before any move
        rtBroadcast(room); // push to all players simultaneously
        setNames(room.players.map(function(p){return p.name;}));setNPlayers(n);
        setHands(h);setDeck(d);setOpenPile({cards:[],owner:-1});setMyPlayed([]);
        setCurrentPlayer(0);setPhase("declare");setSel([]);setScores(Array(n).fill(0));
        goScreen("game");
      }).catch(function(){setStartingGame(false);pop("Connection error — try again","error");});
    }).catch(function(){setStartingGame(false);pop("Connection error — try again","error");});
  }

  function onlineNextRound(newScores){
    if(!isHost)return;
    loadRoom(roomCode).then(function(room){
      if(!room)return;
      var n=room.players.length,d=shuffle(mkDeck()),h=[];
      for(var i=0;i<n;i++)h.push(d.splice(0,7));
      var gs={hands:h,deck:d,openPile:{cards:[],owner:-1},myPlayed:[],currentPlayer:0,phase:"declare",scores:newScores};
      room.status="started";room.gameState=gs;
      saveRoom(roomCode,room).then(function(){
        roomRef.current=room;
        rtBroadcast(room);
        deal(newScores,n);
        setScreen("game");
      }).catch(function(){pop("Connection error","error");});
    }).catch(function(){pop("Connection error","error");});
  }

  function joinGlobal(){
    audio.init();audio.resume();haptic.light();
    if(!myName.trim()){pop("Enter your name first","warning");return;}
    try{localStorage.setItem("cobra_player_name",myName.trim());}catch(e){}
    try{localStorage.setItem("cobra_player_avatar",myAvatar);}catch(e){}
    var globalCode="COBRA_GLOBAL";
    loadRoom(globalCode).then(function(room){
      if(!room||room.status==="started"||room.players.length>=5){
        room={code:globalCode,host:"Global",players:[],maxPlayers:5,status:"lobby",gameState:null,ts:Date.now()};
      }
      var idx=room.players.length;
      room.players.push({name:myName.trim(),idx:idx});
      saveRoom(globalCode,room).then(function(){
        setMode("online");
        setRoomCode(globalCode);setIsHost(idx===0);setMyIdx(idx);
        setOnlinePlayers(room.players.map(function(p){return p.name;}));
        startLobbyPoll(globalCode);
        rtBroadcast(room); // announce new player to everyone in global lobby
        goScreen("lobby");
        pop("Finding players...","success");
      });
    });
  }

  const toggleSel=function(card){
    audio.init();audio.resume();audio.cardSelect();haptic.light();
    if(phase==="declare")setPhase("play");
    setSel(function(p){return p.find(function(c){return c.id===card.id;})?p.filter(function(c){return c.id!==card.id;}):[...p,card];});
  };

  function doUndo(){
    if(!prevHand)return;
    audio.buttonClick();haptic.light();
    var nh=[...hands];nh[H]=prevHand;
    setHands(nh);setMyPlayed([]);setSel([]);setPhase("play");
    setPrevHand(null);pop("Undone","info",1200);
  }

  function doPlay(){
    if(!sel.length){pop("Select cards to play","warning");return;}
    if(!isValidSeq(sel)){pop("Not a valid sequence","error");haptic.error();return;}
    audio.init();audio.resume();audio.cardPlay();haptic.cardPlay();
    setPrevHand([...hands[H]]);
    setPlayingCardIds(sel.map(function(c){return c.id;}));
    var played=sel.slice();
    setTimeout(function(){
      var nh=[...hands];nh[H]=hands[H].filter(function(c){return!played.find(function(s){return s.id===c.id;});});
      setPrevTotal(ht(hands[H]));
      setHands(nh);setMyPlayed(played);setSel([]);setPhase("pickup");
      setPlayingCardIds([]);
      pop(""+seqLabel(played),"success",1200);
      if(played.length>=5)unlockAch("big_run");
      // Don't broadcast here — wait until pickup so pile is correct
    },280);
  }

  function pickFromPile(card){
    audio.init();audio.resume();audio.cardPickup();haptic.light();
    setPrevHand(null);
    var nh=[...hands];nh[H]=[...nh[H],card];
    var newOpen={cards:myPlayed,owner:H};
    setHands(nh);setOpenPile(newOpen);setMyPlayed([]);
    afterPickup(nh,deck,newOpen);
  }

  function pickFromDeck(){
    if(!deck.length){pop("Deck is empty!","warning");return;}
    audio.init();audio.resume();audio.cardPickup();haptic.light();
    setPrevHand(null);
    setPickingUp(true);
    var drawn=deck[0];var rest=deck.slice(1);
    var nh=[...hands];nh[H]=[...nh[H],drawn];
    var newOpen={cards:myPlayed,owner:H};
    setTimeout(function(){
      setHands(nh);setDeck(rest);setOpenPile(newOpen);setMyPlayed([]);
      setPickingUp(false);
      afterPickup(nh,rest,newOpen);
    },220);
  }

  function afterPickup(nh,nd,np){
    if(mode==="cpu"){runCPURound(1,nh,nd,np);}
    else{
      var next=(currentPlayer+1)%nPlayers;
      setCurrentPlayer(next);setPhase("declare");
      broadcastMove(nh,nd,np,next,"declare",scores);
      if(next===H){audio.turnChange();setShowYourTurn(true);clearTimeout(yourTurnTimer.current);yourTurnTimer.current=setTimeout(function(){setShowYourTurn(false);},2000);}
    }
  }

  function runCPURound(startIdx,initHands,initDeck,initPile){
    var ch=[...initHands],cd=[...initDeck],cp={...initPile},idx=startIdx;
    function step(){
      if(idx>=nPlayers){
        setCpuThinking(false);setCurrentPlayer(0);setPhase("declare");
        audio.turnChange();setShowYourTurn(true);clearTimeout(yourTurnTimer.current);
        yourTurnTimer.current=setTimeout(function(){setShowYourTurn(false);},2000);
        return;
      }
      setCurrentPlayer(idx);setCpuThinking(true);
      var p=CPU_P[idx%CPU_P.length];
      var thinkTime=p.thinkMs*([1.4,1.0,0.7][cpuDiff]||1)+rnd(-80,80);
      setTimeout(function(){
        var hand=[...ch[idx]];
        var myTotal=ht(hand);
        if(myTotal<=10&&rnd(0,1)<p.risk){
          var totals=ch.map(function(h){return ht(h);});
          var minT=Math.min.apply(null,totals);
          if(myTotal===minT&&totals.filter(function(t){return t===minT;}).length===1){
            audio.win();haptic.success();
            var ns=scores.map(function(s,i){return i===idx?s:s+totals[i];});
            var res=names.map(function(n,i){return{name:n,total:totals[i],added:i===idx?0:totals[i],cobra:false,winner:i===idx};});
            setHands([...ch]);
            setRevealData({ns:ns,res:res,declarerIdx:idx,hands:ch.map(function(h){return h.slice();})});
            setScreen("reveal");setCpuThinking(false);return;
          }
        }
        var best=null;
        for(var sz=Math.min(hand.length,cpuDiff===2?hand.length:4);sz>=1;sz--){
          for(var i=0;i<=hand.length-sz;i++){
            var c=hand.slice(i,i+sz);
            if(isValidSeq(c)){var score=ht(c)*(sz>1?sz*1.2:1);if(!best||score>ht(best))best=c;}
          }
        }
        var played=best||[[...hand].sort(function(a,b){return cv(b)-cv(a);})[0]];
        audio.cardPlay();haptic.light();
        setLastCpuPlay({cards:played,player:names[idx]||"CPU",seq:seqLabel(played)});
        setShowCpuPlay(true);setTimeout(function(){setShowCpuPlay(false);},2000);
        ch=[...ch];ch[idx]=hand.filter(function(c){return!played.find(function(pp){return pp.id===c.id;});});
        var prev=cp.cards||[];
        var pileVal=prev.length>0?cv(prev[0]):99;
        var playerHandSize=ch[0]?ch[0].length:7;
        var myHandTot=ht(ch[idx]);
        // CPU adapts — gets more aggressive as rounds progress
        var roundCount=(scores[idx]||0)/5+1;
        var aggression=Math.min(roundCount*0.5,3);
        var threshold=cpuDiff===2?(playerHandSize<=3?6:4+aggression):(cpuDiff===1?5+aggression:7+aggression);
        if(prev.length>0&&cp.owner!==idx&&pileVal<=threshold&&myHandTot>12){
          ch[idx]=[...ch[idx],prev[0]];
          setTimeout(function(){audio.cardPickup();},80);
        } else if(cd.length>0){
          var drawn2=cd[0];cd=cd.slice(1);ch[idx]=[...ch[idx],drawn2];
          setTimeout(function(){audio.cardPickup();},80);
        }
        cp={cards:played,owner:idx};
        setOpenPile({...cp});setHands([...ch]);setDeck([...cd]);
        audio.turnChange();idx++;setCpuThinking(false);
        setTimeout(step,60);
      },thinkTime);
    }
    step();
  }

  function doDeclare(){
    var myTotal=ht(hands[H]);
    if(myTotal>DECLARE_MAX){pop("Need total 30 or under to declare (yours: "+myTotal+")","error");haptic.error();return;}
    audio.init();audio.resume();audio.declare();haptic.declare();
    var totals=hands.map(function(h){return ht(h);});
    var minT=Math.min.apply(null,totals);
    var iWin=myTotal===minT&&totals.filter(function(t){return t===minT;}).length===1;
    var ns=[...scores],res=[];
    if(iWin){
      ns=ns.map(function(s,i){return i===H?s:s+totals[i];});
      res=names.map(function(n,i){return{name:n,total:totals[i],added:i===H?0:totals[i],cobra:false,winner:i===H};});
      setTimeout(function(){audio.win();haptic.win();},600);
      unlockAch("first_win");
      if(myTotal<=5)unlockAch("low_score");
      var elapsed=(Date.now()-roundStart)/1000;
      if(elapsed<10)unlockAch("speed_win");
      setGameStats(function(g){var streak=(g.streak||0)+1;var n={...g,wins:g.wins+1,rounds:g.rounds+1,streak:streak,bestStreak:Math.max(streak,g.bestStreak||0)};try{localStorage.setItem("cobra_stats",JSON.stringify(n));}catch(e){}return n;});
      // Confetti
      var conf=[];
      for(var ci=0;ci<22;ci++){
        conf.push({id:ci,x:Math.random()*100,color:["#d4a843","#4ade80","#f87171","#60a5fa","#fff","#fbbf24"][Math.floor(Math.random()*6)],size:Math.random()*6+4,delay:Math.random()*0.6,dur:Math.random()*1+1.2});
      }
      setConfetti(conf);setTimeout(function(){setConfetti([]);},2500);
    } else {
      var pen=COBRA_PEN+myTotal;ns[H]+=pen;
      res=names.map(function(n,i){return{name:n,total:totals[i],added:i===H?pen:0,cobra:i===H,winner:false};});
      setTimeout(function(){audio.cobraStrike();haptic.cobra();},300);
      unlockAch("cobra_survive");
      setGameStats(function(g){var n={...g,cobras:g.cobras+1,rounds:g.rounds+1,streak:0};try{localStorage.setItem("cobra_stats",JSON.stringify(n));}catch(e){}return n;});
    }
    var revealHands=hands.map(function(h){return h.slice();});
    setRevealData({ns:ns,res:res,declarerIdx:H,hands:revealHands});
    setScreen("reveal");
    // Tell all other online players to go to reveal too
    broadcastMove(hands,deck,openPile,H,"reveal",ns,{declarerIdx:H,ns:ns,res:res,hands:revealHands});
  }

  function saveLeaderboardWin(){
    if(!supabase||!myName)return;
    try{supabase.from("cobra_scores").select("wins").eq("id",myName).single().then(function(res){
      var prev=(res.data&&res.data.wins)||0;
      supabase.from("cobra_scores").upsert({id:myName,name:myName,avatar:myAvatar||"😎",wins:prev+1,updated_at:new Date().toISOString()},{onConflict:"id"}).then(function(){}).catch(function(){});
    }).catch(function(){
      supabase.from("cobra_scores").upsert({id:myName,name:myName,avatar:myAvatar||"😎",wins:1,updated_at:new Date().toISOString()},{onConflict:"id"}).then(function(){}).catch(function(){});
    });}catch(e){}
  }

  function finishRound(ns,res){
    // XP rewards for local player
    gainXP(25); // participation XP
    var winnerIdx=ns.indexOf(Math.min.apply(null,ns));
    if(winnerIdx===myIdx)gainXP(50); // win bonus
    var loser=ns.findIndex(function(s){return s>=scoreLimit;});
    var resWithScores=res.map(function(r,i){return Object.assign({},r,{newScore:ns[i]});});
    var ned={results:resWithScores,scores:ns,nPlayers:nPlayers,names:names.slice(0,nPlayers)};
    setFlashScores(ns.map(function(s,i){return s!==(scores[i]||0);}));
    setTimeout(function(){setFlashScores([]);},1200);
    setRoundEndData(ned);setScores(ns);setRoundRes(resWithScores);
    setHands([]);setDeck([]);setMyPlayed([]);setSel([]);setOpenPile({cards:[],owner:-1});setPrevHand(null);
    if(loser>=0){
      setGameOverData({scores:ns,winner:winnerIdx,loser:loser});
      if(winnerIdx===myIdx)saveLeaderboardWin();
      // Show elimination animation then go to gameOver
      setElimAnim({name:names[loser],idx:loser});
      setTimeout(function(){setElimAnim(null);setScreen("gameOver");},2500);
    } else {setScreen("roundEnd");}
  }

  function onRevealClose(){
    if(revealData){
      var rd=revealData;
      finishRound(rd.ns,rd.res);
      setRevealData(null);
    }
  }

  const sfxToggle=function(){audio.toggleMute();setSfxMuted(function(v){var n=!v;try{localStorage.setItem("cobra_sfx_muted",n?"1":"0");}catch(e){}return n;});};
  const musToggle=function(){audio.toggleMusic();setMusicMuted(function(v){var n=!v;try{localStorage.setItem("cobra_mus_muted",n?"1":"0");}catch(e){}return n;});};

  if(showSplash)return(
    <div>
      <style>{GS}</style>
      <SplashScreen onDone={function(){setShowSplash(false);audio.init();audio.resume();}}/>
    </div>
  );

  // ─── ACHIEVEMENTS ───────────────────────────────────
  if(screen==="achievements")return(
    <div className="feltbg" style={{display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"28px 20px",overflowY:"auto"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{maxWidth:420,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
        <button className="btn_btn_ghost" style={{marginBottom:18,padding:"12px 18px",fontSize:12}} onClick={function(){audio.buttonClick();goScreen("home");}}>BACK</button>
        <div style={{textAlign:"center",marginBottom:20}}>
          <span style={{fontSize:40}}>🏆</span>
          <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:22,letterSpacing:4,marginTop:8}}>ACHIEVEMENTS</h2>
          <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#4a6a4a",fontSize:14,marginTop:4}}>{unlockedAchs.length} of {ACHIEVEMENTS.length} unlocked</p>
        </div>
        {unlockedAchs.length===0&&<div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#5a7a60",fontSize:15,textAlign:"center",padding:"20px 0"}}>Play games to unlock achievements 🎴</div>}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {ACHIEVEMENTS.map(function(a){
            var unlocked=unlockedAchs.includes(a.id);
            return(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderRadius:16,background:unlocked?"rgba(212,168,67,0.08)":"rgba(0,0,0,0.25)",border:unlocked?"1.5px solid rgba(212,168,67,0.25)":"1px solid rgba(255,255,255,0.05)",transition:"all 0.3s"}}>
                <div style={{fontSize:36,opacity:unlocked?1:0.2,filter:unlocked?"drop-shadow(0 0 10px rgba(212,168,67,0.5))":"none",flexShrink:0}}>{a.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:13,letterSpacing:2,color:unlocked?"#d4a843":"#3a4a3a",marginBottom:4}}>{a.name}</div>
                  <div style={{fontFamily:"Crimson Text,serif",fontSize:14,color:unlocked?"#7a9d78":"#3a4a3a",lineHeight:1.5}}>{a.desc}</div>
                </div>
                {unlocked&&<div style={{fontSize:18}}>✓</div>}
                {!unlocked&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#2a3d28",letterSpacing:1}}>LOCKED</div>}
              </div>
            );
          })}
        </div>
        <div style={{marginTop:20,padding:"14px 16px",background:"rgba(0,0,0,0.2)",borderRadius:12,border:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{display:"flex",justifyContent:"space-around"}}>
            {[["🏆",gameStats.wins,"Wins"],["🐍",gameStats.cobras,"Cobras"],["🔥",gameStats.streak||0,"Streak"],["🃏",gameStats.rounds,"Rounds"]].map(function(row){return(
              <div key={row[2]} style={{textAlign:"center"}}>
                <div style={{fontSize:20}}>{row[0]}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:16,fontWeight:700,color:"#d4a843"}}>{row[1]}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#5a7a60",letterSpacing:1}}>{row[2]}</div>
              </div>
            );})}
          </div>
        </div>
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );

  // ─── HOME ───────────────────────────────────────────
  if(screen==="home")return(
    <div className="feltbg" onClick={initAudio} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"28px 20px",position:"relative"}}>
      <style>{GS}</style>
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
        {[{t:"-10%",l:"5%",w:500,c:"rgba(10,55,18,0.45)"},{t:"60%",r:"3%",w:380,c:"rgba(10,18,45,0.35)"},{t:"30%",l:"45%",w:700,c:"rgba(8,45,14,0.18)"}].map(function(o,i){return(
          <div key={i} className="orb_float" style={{position:"absolute",top:o.t,left:o.l,right:o.r,width:o.w,height:o.w,borderRadius:"50%",background:"radial-gradient(circle,"+o.c+",transparent 70%)",animationDelay:(i*2.8)+"s"}}/>
        );})}
      </div>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",maxWidth:400,width:"100%"}} className="anim_up">
        <div className="float" style={{marginBottom:10}}>
          <span style={{fontSize:88,lineHeight:1,display:"block",textAlign:"center"}}>🐍</span>
        </div>
        <h1 style={{fontFamily:"Cinzel,serif",fontSize:58,fontWeight:900,letterSpacing:10,margin:"4px 0 0",lineHeight:1,background:"linear-gradient(175deg,#f4cc52 0%,#d4a843 36%,#a87020 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>COBRA</h1>
        <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#2a4a2e",fontSize:15,letterSpacing:4,marginTop:4,marginBottom:myName?2:10}}>the card game</p>
        {myName&&<p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#7a6a2e",fontSize:15,marginBottom:10}}>Welcome back, {myName} {myAvatar}</p>}
        <div style={{display:"inline-block",background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.2)",borderRadius:20,padding:"3px 12px",marginBottom:6}}>
          <span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#d4a843",letterSpacing:2}}>v2.0 PREMIUM</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center",marginBottom:24}}>
          <div style={{height:1,width:54,background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.48))"}}/>
          <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#1a2e1e",letterSpacing:4}}>THE ULTIMATE CARD GAME</span>
          <div style={{height:1,width:54,background:"linear-gradient(90deg,rgba(212,168,67,0.48),transparent)"}}/>
        </div>
        {gameStats.rounds>0&&(
          <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:18,padding:"10px 20px",background:"rgba(212,168,67,0.06)",border:"1px solid rgba(212,168,67,0.12)",borderRadius:12}}>
            {[["🏆",gameStats.wins,"Wins"],["🐍",gameStats.cobras,"Cobras"],["🔥",gameStats.streak||0,"Streak"],["🃏",gameStats.rounds,"Rounds"]].map(function(row){return(
              <div key={row[2]} style={{textAlign:"center"}}>
                <div style={{fontSize:16}}>{row[0]}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:700,color:"#d4a843"}}>{row[1]}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#7a9d78",letterSpacing:1}}>{row[2]}</div>
              </div>
            );})}
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:14}}>
          {[{label:"VS COMPUTER",cls:"btn_btn_gold",s:"setupCPU",sub:"Play against AI opponents",icon:"🤖"},
            {label:"MULTIPLAYER",cls:"btn_btn_blue",s:"setupRoom",sub:"Create or join a private room",icon:"👥"},
            {label:"ONLINE GAMEPLAY",cls:"btn_btn_green",s:"setupGlobal",sub:"Play with anyone online",icon:"🌐"}].map(function(b){return(
            <button key={b.label} className={b.cls}
              style={{padding:"16px 22px",fontSize:14,letterSpacing:1.5,borderRadius:16,width:"100%",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:4,height:"auto",textAlign:"left"}}
              onClick={function(){audio.init();audio.resume();audio.buttonClick();haptic.light();goScreen(b.s);}}>
              <span style={{fontFamily:"Cinzel,serif",fontSize:14,letterSpacing:2}}>{b.icon} {b.label}</span>
              <span style={{fontFamily:"Crimson Text,serif",fontSize:14,textTransform:"none",letterSpacing:0,fontWeight:400,opacity:0.7}}>{b.sub}</span>
            </button>
          );})}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn_btn_ghost" style={{flex:1,padding:"14px",fontSize:11,letterSpacing:2}} onClick={function(){audio.buttonClick();goScreen("howto");}}>📖 HOW TO PLAY</button>
          <button className="btn_btn_ghost" style={{flex:1,padding:"14px",fontSize:11,letterSpacing:2}} onClick={function(){audio.buttonClick();audio.init();audio.resume();var ns=["You","CPU"];setMode("cpu");setNPlayers(2);setNames(ns);setMyIdx(0);setTutorialStep(0);deal(Array(2).fill(0),2);goScreen("game");}}>🎓 TUTORIAL</button>
        </div>

        {/* ── REWARDS & PROGRESSION ── */}
        <div style={{marginTop:20}}>
          <div className="section-label">REWARDS & PROGRESSION</div>
          <div style={{borderRadius:20,overflow:"hidden",border:"1px solid rgba(212,168,67,0.18)",background:"linear-gradient(170deg,#0c1e0c,#060e06,#010603)",boxShadow:"0 8px 32px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
            {/* Player header */}
            <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#d4a843,#a87020)",padding:2.5,flexShrink:0,boxShadow:"0 0 12px rgba(212,168,67,0.25)"}}>
                <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"#0a140a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{myAvatar||"🐍"}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#d4a843",letterSpacing:1,fontWeight:700}}>LEVEL {playerLevel}</span>
                  <span style={{fontFamily:"Crimson Text,serif",fontSize:11,color:"rgba(255,255,255,0.2)"}}>·</span>
                  <span style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"rgba(255,255,255,0.3)"}}>{myName||"Player"}</span>
                </div>
                <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                  <div style={{height:"100%",width:Math.min(100,Math.round(playerXP/(playerLevel*100)*100))+"%",background:"linear-gradient(90deg,#c49030,#f0c060)",borderRadius:3,boxShadow:"0 0 4px rgba(212,168,67,0.4)",transition:"width 0.8s cubic-bezier(.22,1,.36,1)"}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:10,flexShrink:0}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#f0c060",fontWeight:700}}>{coins.toLocaleString()}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"rgba(255,255,255,0.2)",letterSpacing:1}}>🪙</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#c084fc",fontWeight:700}}>{gems}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"rgba(255,255,255,0.2)",letterSpacing:1}}>💎</div>
                </div>
              </div>
            </div>
            {/* Tiles grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"rgba(255,255,255,0.03)"}}>
              {/* Battle Pass */}
              <button onClick={function(){audio.buttonClick();haptic.light();setActiveScreen("battlepass");}} style={{background:"linear-gradient(145deg,#0f2010,#0a1408)",border:"none",padding:"14px 12px 12px",cursor:"pointer",touchAction:"manipulation",textAlign:"left",display:"flex",flexDirection:"column",gap:8,transition:"background 0.15s"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:24,filter:"drop-shadow(0 0 4px rgba(212,168,67,0.4))"}}>🎭</span>
                  <div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#d4a843",letterSpacing:1,fontWeight:700}}>Battle Pass</div>
                    <div style={{fontFamily:"Crimson Text,serif",fontSize:11,color:"rgba(212,168,67,0.35)"}}>Season 1</div>
                  </div>
                </div>
                <div>
                  <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.05)",overflow:"hidden",marginBottom:3}}>
                    <div style={{height:"100%",background:"linear-gradient(90deg,#d4a843,#f0c060)",width:Math.min(100,Math.round((bpLevel/50)*100))+"%",borderRadius:2}}/>
                  </div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(212,168,67,0.3)",letterSpacing:1}}>LV {bpLevel} / 50</div>
                </div>
              </button>
              {/* Profile */}
              <button onClick={function(){audio.buttonClick();haptic.light();setActiveScreen("profile");}} style={{background:"linear-gradient(145deg,#0e0e1e,#090912)",border:"none",padding:"14px 12px 12px",cursor:"pointer",touchAction:"manipulation",textAlign:"left",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:24}}>{myAvatar||"😎"}</span>
                  <div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#a0c0ff",letterSpacing:1,fontWeight:700}}>{myName||"Player"}</div>
                    <div style={{fontFamily:"Crimson Text,serif",fontSize:11,color:"rgba(160,192,255,0.3)"}}>{gameStats.wins} wins</div>
                  </div>
                </div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(160,192,255,0.25)",letterSpacing:1}}>VIEW PROFILE →</div>
              </button>
              {/* Daily Rewards */}
              {(function(){
                var canClaim=Date.now()-dailyLast>=86400000;
                var msUntil=Math.max(0,86400000-(Date.now()-dailyLast));
                var hrs=Math.floor(msUntil/3600000),mins=Math.floor((msUntil%3600000)/60000);
                return(
                  <button onClick={function(){audio.buttonClick();haptic.light();setActiveScreen("daily");}} style={{background:"linear-gradient(145deg,#1c1000,#120a00)",border:"none",padding:"14px 12px 12px",cursor:"pointer",touchAction:"manipulation",textAlign:"left",display:"flex",flexDirection:"column",gap:8,position:"relative",animation:canClaim?"availablePulse 2s ease-in-out infinite":"none"}}>
                    {canClaim&&<div style={{position:"absolute",top:8,right:8,width:8,height:8,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 6px rgba(239,68,68,0.8)"}}/>}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:24,filter:canClaim?"drop-shadow(0 0 4px rgba(251,191,36,0.6))":"none"}}>📅</span>
                      <div>
                        <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:canClaim?"#fbbf24":"#a07830",letterSpacing:1,fontWeight:700}}>Daily Reward</div>
                        <div style={{fontFamily:"Crimson Text,serif",fontSize:11,color:canClaim?"rgba(251,191,36,0.5)":"rgba(160,120,48,0.35)"}}>{canClaim?"Ready now!":"Day "+(Math.min(dailyStreak%7+1,7))+" / 7"}</div>
                      </div>
                    </div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:canClaim?"rgba(251,191,36,0.5)":"rgba(160,120,48,0.25)",letterSpacing:1}}>{canClaim?"CLAIM NOW ✦":hrs+"h "+mins+"m"}</div>
                  </button>
                );
              })()}
              {/* Lucky Spin */}
              {(function(){
                var canSp=Date.now()-spinLast>=86400000;
                var msUntil=Math.max(0,86400000-(Date.now()-spinLast));
                var hrs=Math.floor(msUntil/3600000),mins=Math.floor((msUntil%3600000)/60000);
                return(
                  <button onClick={function(){audio.buttonClick();haptic.light();setActiveScreen("spin");}} style={{background:"linear-gradient(145deg,#160616,#0e040e)",border:"none",padding:"14px 12px 12px",cursor:"pointer",touchAction:"manipulation",textAlign:"left",display:"flex",flexDirection:"column",gap:8,position:"relative",animation:canSp?"availablePulse 2.2s ease-in-out infinite":"none"}}>
                    {canSp&&<div style={{position:"absolute",top:8,right:8,width:8,height:8,borderRadius:"50%",background:"#a855f7",boxShadow:"0 0 6px rgba(168,85,247,0.8)"}}/>}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:24,display:"inline-block",filter:canSp?"drop-shadow(0 0 4px rgba(168,85,247,0.6))":"none"}}>🎡</span>
                      <div>
                        <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:canSp?"#c084fc":"#7a4a7a",letterSpacing:1,fontWeight:700}}>Lucky Spin</div>
                        <div style={{fontFamily:"Crimson Text,serif",fontSize:11,color:canSp?"rgba(192,132,252,0.5)":"rgba(122,74,122,0.35)"}}>{canSp?"Win prizes!":"Cooldown"}</div>
                      </div>
                    </div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:canSp?"rgba(192,132,252,0.5)":"rgba(122,74,122,0.25)",letterSpacing:1}}>{canSp?"SPIN NOW 🎰":hrs+"h "+mins+"m"}</div>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>

        <div style={{marginTop:14,padding:"12px 16px",background:"rgba(212,168,67,0.05)",border:"1px solid rgba(212,168,67,0.1)",borderRadius:12,cursor:"pointer"}}
          onClick={function(){audio.buttonClick();haptic.light();goScreen("achievements");}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#6b5a20",letterSpacing:2}}>ACHIEVEMENTS ({unlockedAchs.length}/{ACHIEVEMENTS.length})</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#d4a843",letterSpacing:1}}>VIEW ALL</div>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {ACHIEVEMENTS.map(function(a){return(<div key={a.id} style={{fontSize:24,opacity:unlockedAchs.includes(a.id)?1:0.18,filter:unlockedAchs.includes(a.id)?"drop-shadow(0 0 6px rgba(212,168,67,0.6))":"none",transition:"all 0.3s"}}>{a.icon}</div>);})}
          </div>
        </div>
        <button className="btn_btn_outline_gold" style={{fontSize:12,padding:"13px",letterSpacing:2,marginTop:10,width:"100%"}}
          onClick={function(){audio.buttonClick();haptic.light();goScreen("leaderboard");}}>🏆 LEADERBOARD</button>
        {gameStats.rounds>0&&(
          <button className="btn_btn_ghost" style={{fontSize:10,padding:"10px",letterSpacing:1,marginTop:10,width:"100%",color:"#4a5a4a"}}
            onClick={function(){
              audio.buttonClick();
              try{localStorage.removeItem("cobra_stats");localStorage.removeItem("cobra_achs");}catch(e){}
              setGameStats({wins:0,cobras:0,rounds:0});setUnlockedAchs([]);
            }}>RESET STATS</button>
        )}
      </div>
      {/* PWA Install Banner */}
      {!installDismissed&&(installPrompt||/iphone|ipad|ipod/i.test(navigator.userAgent))&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:300,background:"linear-gradient(135deg,#a87020,#d4a843,#c49030)",padding:"14px 20px calc(14px + env(safe-area-inset-bottom))",display:"flex",alignItems:"center",gap:12,boxShadow:"0 -4px 24px rgba(0,0,0,0.5)"}}>
          <span style={{fontSize:22,flexShrink:0}}>📲</span>
          <span style={{fontFamily:"Crimson Text,serif",fontSize:15,color:"#120c00",flex:1,lineHeight:1.4}}>
            {installPrompt?"Add COBRA to your home screen":/iphone|ipad|ipod/i.test(navigator.userAgent)?"Tap Share → Add to Home Screen":"Add COBRA to your home screen"}
          </span>
          {installPrompt&&(
            <button onClick={function(){
              installPrompt.prompt();
              installPrompt.userChoice.then(function(){setInstallPrompt(null);try{localStorage.setItem("cobra_install_dismissed","1");}catch(e){}setInstallDismissed(true);});
            }} style={{background:"rgba(0,0,0,0.25)",border:"1.5px solid rgba(0,0,0,0.3)",borderRadius:10,fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,color:"#120c00",padding:"8px 14px",cursor:"pointer",flexShrink:0,touchAction:"manipulation",fontWeight:700}}>INSTALL</button>
          )}
          <button onClick={function(){setInstallDismissed(true);try{localStorage.setItem("cobra_install_dismissed","1");}catch(e){};}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#120c00",flexShrink:0,touchAction:"manipulation",padding:4}}>✕</button>
        </div>
      )}
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
      {activeScreen==="profile"&&<ProfileScreen name={myName} avatar={myAvatar} level={playerLevel} xp={playerXP} xpForLevel={xpForLevel} coins={coins} gems={gems} stats={gameStats} onClose={function(){setActiveScreen(null);}}/>}
      {activeScreen==="battlepass"&&<BattlePassScreen
        bpLevel={bpLevel}
        bpPremium={bpPremium}
        bpClaimed={bpClaimed}
        onClaim={function(i,r){
          if(bpClaimed.indexOf(i)<0){
            var newClaimed=[...bpClaimed,i];
            setBpClaimed(newClaimed);
            try{localStorage.setItem("cobra_bp_claimed",JSON.stringify(newClaimed));}catch(e){}
            if(r.type==="coins")addCoins(r.amount);
            if(r.type==="gems")addGems(r.amount);
            setRewardPopup({coins:r.type==="coins"?r.amount:0,gems:r.type==="gems"?r.amount:0,label:"Battle Pass Reward!"});
          }
        }}
        onUpgrade={function(){
          if(gems>=800){addGems(-800);setBpPremium(true);try{localStorage.setItem("cobra_bp_premium","true");}catch(e){}setRewardPopup({coins:0,gems:0,label:"Premium Unlocked! 🎭"});}
          else{pop("Not enough gems! Need 800 💎","error");}
        }}
        onClose={function(){setActiveScreen(null);}}
      />}
      {activeScreen==="daily"&&<DailyRewardScreen
        onClaim={function(r){
          var now=Date.now(),newStreak=dailyStreak+1;
          setDailyLast(now);setDailyStreak(newStreak);
          try{localStorage.setItem("cobra_daily_last",String(now));localStorage.setItem("cobra_daily_streak",String(newStreak));}catch(e){}
          addCoins(r.coins);
          if(r.gems)addGems(r.gems);
          setRewardPopup({coins:r.coins,gems:r.gems||0,label:"Daily Reward! 📅"});
          setActiveScreen(null);
        }}
        onClose={function(){setActiveScreen(null);}}
      />}
      {activeScreen==="spin"&&<SpinScreen
        onSpin={function(r){
          var now=Date.now();setSpinLast(now);
          if(r.coins)addCoins(r.coins);
          if(r.gems)addGems(r.gems);
          setRewardPopup({coins:r.coins||0,gems:r.gems||0,label:"Lucky Spin! 🎡"});
        }}
        onClose={function(){setActiveScreen(null);setSpinLast(parseInt(lsGet("cobra_spin_last","0")));}}
      />}
      {rewardPopup&&<RewardPopup reward={rewardPopup} onClose={function(){setRewardPopup(null);}}/>}
    </div>
  );

  // ─── HOW TO PLAY ────────────────────────────────────
  if(screen==="howto")return(
    <div className="feltbg" style={{display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"28px 20px",overflowY:"auto"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{maxWidth:440,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
        <button className="btn_btn_ghost" style={{marginBottom:18,padding:"12px 18px",fontSize:12}} onClick={function(){audio.buttonClick();goScreen("home");}}>BACK</button>
        <div className="panel" style={{padding:28}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <span style={{fontSize:40}}>📖</span>
            <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:22,letterSpacing:4,marginTop:8}}>HOW TO PLAY</h2>
            <Divider/>
          </div>
          {[{icon:"🎯",t:"GOAL",txt:"Have the lowest total card value. Ace=1, King=13. Declare to win rounds."},
            {icon:"🔄",t:"YOUR TURN",txt:"Tap cards to select and play a sequence. Then pick up from the pile or draw from deck."},
            {icon:"♠",t:"VALID PLAYS",items:["Single — any one card","Pair — two same number","Triple or Quad — three or four same","Run — 3+ in a row (Ace plays high or low)","Flush — 3+ same suit"]},
            {icon:"📢",t:"DECLARING",txt:"Total 30 or under: DECLARE at start of your turn. Strictly lowest total wins the round and scores 0."},
            {icon:"🐍",t:"COBRA PENALTY",txt:"Tied or not lowest when you declare: you get your total + 30. Nobody else scores."},
            {icon:"⏱️",t:"TIMER",txt:"30 seconds per turn. Time runs out — your highest card is auto-played!"},
            {icon:"💀",t:"ELIMINATION",txt:"First to 100 points is eliminated. Last player standing wins!"},
          ].map(function(row){
            var icon=row.icon,t=row.t,txt=row.txt,items=row.items;
            return(
              <div key={t} style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <p style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#4b6040",letterSpacing:2,marginBottom:7,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>{icon}</span>{t}
                </p>
                {txt&&<p style={{fontFamily:"Crimson Text,serif",color:"#6a8a6a",fontSize:15,lineHeight:1.6}}>{txt}</p>}
                {items&&<ul style={{paddingLeft:0,listStyle:"none"}}>{items.map(function(item){return(
                  <li key={item} style={{fontFamily:"Crimson Text,serif",color:"#6a8a6a",fontSize:15,lineHeight:1.7,display:"flex",gap:8}}>
                    <span style={{color:"#d4a843",flexShrink:0}}>.</span>{item}
                  </li>
                );})}</ul>}
              </div>
            );
          })}
          <button className="btn_btn_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:3,marginTop:4}} onClick={function(){audio.buttonClick();goScreen("home");}}>GOT IT</button>
        </div>
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );

  // ─── SETUP CPU ──────────────────────────────────────
  if(screen==="setupCPU"){
    var ln=[...names];var ncpu=1+cpuCount;
    return(
      <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
        <style>{GS}</style>
        <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
        <div style={{maxWidth:400,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
          <button className="btn_btn_ghost" style={{marginBottom:18,padding:"12px 18px",fontSize:12}} onClick={function(){audio.buttonClick();goScreen("home");}}>BACK</button>
          <div className="panel" style={{padding:28}}>
            <div style={{textAlign:"center",marginBottom:4}}>
              <span style={{fontSize:40}}>🤖</span>
              <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:22,letterSpacing:4,marginTop:8}}>VS COMPUTER</h2>
            </div>
            <Divider/>
            <SLabel>CPU OPPONENTS</SLabel>
            <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:22}}>
              {[1,2,3,4].map(function(nc){return(
                <button key={nc} className="btn" onClick={function(){audio.buttonClick();setCpuCount(nc);}}
                  style={{width:56,height:56,fontSize:20,fontFamily:"Cinzel,serif",fontWeight:700,borderRadius:12,background:cpuCount===nc?"rgba(212,168,67,0.22)":"rgba(255,255,255,0.05)",border:cpuCount===nc?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.1)",color:cpuCount===nc?"#d4a843":"#2a3d28",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>{nc}</button>
              );})}
            </div>
            <SLabel>DIFFICULTY</SLabel>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:22}}>
              {[{l:"EASY",c:"#4ade80"},{l:"MEDIUM",c:"#d4a843"},{l:"HARD",c:"#f87171"}].map(function(item,i){
                var l=item.l,c=item.c;
                return(
                  <button key={l} className="btn" onClick={function(){audio.buttonClick();setCpuDiff(i);}}
                    style={{flex:1,padding:"12px 6px",fontSize:10,fontFamily:"Cinzel,serif",fontWeight:700,borderRadius:11,letterSpacing:1,background:cpuDiff===i?"rgba(212,168,67,0.12)":"rgba(255,255,255,0.05)",border:cpuDiff===i?"2px solid "+c:"1.5px solid rgba(255,255,255,0.08)",color:cpuDiff===i?c:"#2a3d28",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",minHeight:48,touchAction:"manipulation"}}>
                    {l}
                  </button>
                );
              })}
            </div>
            <SLabel>TIMER</SLabel>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:22}}>
              {[{l:"30s",on:true},{l:"OFF",on:false}].map(function(item){
                var l=item.l,on=item.on;
                return(
                  <button key={l} className="btn" onClick={function(){audio.buttonClick();setTimerOn(on);}}
                    style={{flex:1,padding:"12px 6px",fontSize:10,fontFamily:"Cinzel,serif",fontWeight:700,borderRadius:11,letterSpacing:1,background:timerOn===on?"rgba(212,168,67,0.12)":"rgba(255,255,255,0.05)",border:timerOn===on?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.08)",color:timerOn===on?"#d4a843":"#2a3d28",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",minHeight:48,touchAction:"manipulation"}}>
                    {l}
                  </button>
                );
              })}
            </div>
            <SLabel>YOUR AVATAR</SLabel>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16,flexWrap:"wrap"}}>
              {AVATAR_EMOJIS.map(function(em){return(
                <button key={em} onClick={function(){audio.buttonClick();setMyAvatar(em);try{localStorage.setItem("cobra_player_avatar",em);}catch(er){};}} style={{fontSize:24,width:44,height:44,borderRadius:10,border:myAvatar===em?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.1)",background:myAvatar===em?"rgba(212,168,67,0.18)":"rgba(255,255,255,0.05)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",transition:"all 0.2s"}}>{em}</button>
              );})}
            </div>
            <SLabel>YOUR NAME</SLabel>
            <input defaultValue={myName||names[0]} onChange={function(e){ln[0]=e.target.value;}} onBlur={function(e){if(e.target.value){try{localStorage.setItem("cobra_player_name",e.target.value);}catch(er){}}}} style={{marginBottom:16}} placeholder="Your name"/>
            <SLabel>CPU NAMES</SLabel>
            {Array(cpuCount).fill(0).map(function(_,i){return(
              <input key={i} defaultValue={"CPU "+(i+1)} onChange={function(e){ln[i+1]=e.target.value;}} style={{marginBottom:8}} placeholder={"CPU "+(i+1)}/>
            );})}
            <button className="btn_btn_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:3,marginTop:14}} onClick={function(){audio.buttonClick();haptic.medium();setNames(ln);startCPU();}}>DEAL CARDS</button>
          </div>
        </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
      </div>
    );
  }

  // ─── SETUP ROOM ─────────────────────────────────────
  if(screen==="setupRoom")return(
    <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{maxWidth:400,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
        <button className="btn_btn_ghost" style={{marginBottom:18,padding:"12px 18px",fontSize:12}} onClick={function(){audio.buttonClick();goScreen("home");}}>BACK</button>
        <div className="panel" style={{padding:28}}>
          <div style={{textAlign:"center",marginBottom:4}}>
            <span style={{fontSize:40}}>👥</span>
            <h2 style={{fontFamily:"Cinzel,serif",color:"#60a5fa",fontSize:22,letterSpacing:4,marginTop:8}}>MULTIPLAYER</h2>
          </div>
          <Divider c="#60a5fa"/>
          <SLabel>YOUR AVATAR</SLabel>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16,flexWrap:"wrap"}}>
            {AVATAR_EMOJIS.map(function(em){return(
              <button key={em} onClick={function(){audio.buttonClick();setMyAvatar(em);try{localStorage.setItem("cobra_player_avatar",em);}catch(er){};}} style={{fontSize:24,width:44,height:44,borderRadius:10,border:myAvatar===em?"2px solid #60a5fa":"1.5px solid rgba(255,255,255,0.1)",background:myAvatar===em?"rgba(96,165,250,0.18)":"rgba(255,255,255,0.05)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",transition:"all 0.2s"}}>{em}</button>
            );})}
          </div>
          <SLabel>YOUR NAME</SLabel>
          <input value={myName} onChange={function(e){setMyName(e.target.value);}} onBlur={function(e){if(e.target.value){try{localStorage.setItem("cobra_player_name",e.target.value);}catch(er){}}}} style={{marginBottom:20}} placeholder="Your name"/>
          <button className="btn_btn_blue" style={{width:"100%",padding:16,fontSize:13,letterSpacing:2.5,marginBottom:14}} disabled={creatingRoom} onClick={function(){audio.buttonClick();haptic.medium();createRoom();}}>{creatingRoom?"CREATING...":"CREATE ROOM"}</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,0.07)"}}/>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#1a3020",letterSpacing:3}}>OR JOIN</span>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,0.07)"}}/>
          </div>
          <input value={roomInput} onChange={function(e){setRoomInput(e.target.value.toUpperCase());}} style={{marginBottom:12,letterSpacing:6,textAlign:"center",fontSize:24,fontFamily:"Cinzel,serif"}} placeholder="ROOM CODE" maxLength={4}/>
          <button className="btn_btn_outline_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:2.5}} disabled={joiningRoom} onClick={function(){audio.buttonClick();joinRoom();}}>{joiningRoom?"JOINING...":"JOIN ROOM"}</button>
        </div>
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );

  // ─── SETUP GLOBAL ────────────────────────────────────
  if(screen==="setupGlobal")return(
    <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{maxWidth:400,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
        <button className="btn_btn_ghost" style={{marginBottom:18,padding:"12px 18px",fontSize:12}} onClick={function(){audio.buttonClick();goScreen("home");}}>BACK</button>
        <div className="panel" style={{padding:28}}>
          <div style={{textAlign:"center",marginBottom:4}}>
            <span style={{fontSize:40}}>🌐</span>
            <h2 style={{fontFamily:"Cinzel,serif",color:"#4ade80",fontSize:22,letterSpacing:4,marginTop:8}}>ONLINE GAMEPLAY</h2>
          </div>
          <Divider c="#4ade80"/>
          <SLabel>YOUR AVATAR</SLabel>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16,flexWrap:"wrap"}}>
            {AVATAR_EMOJIS.map(function(em){return(
              <button key={em} onClick={function(){audio.buttonClick();setMyAvatar(em);try{localStorage.setItem("cobra_player_avatar",em);}catch(er){};}} style={{fontSize:24,width:44,height:44,borderRadius:10,border:myAvatar===em?"2px solid #4ade80":"1.5px solid rgba(255,255,255,0.1)",background:myAvatar===em?"rgba(74,222,128,0.18)":"rgba(255,255,255,0.05)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",transition:"all 0.2s"}}>{em}</button>
            );})}
          </div>
          <SLabel>YOUR NAME</SLabel>
          <input value={myName} onChange={function(e){setMyName(e.target.value);}} onBlur={function(e){if(e.target.value){try{localStorage.setItem("cobra_player_name",e.target.value);}catch(er){}}}} style={{marginBottom:20}} placeholder="Enter your name"/>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:12,marginBottom:20}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 8px #4ade80",flexShrink:0}} className="pulse"/>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#2a5a3a",letterSpacing:2}}>GLOBAL MATCHMAKING ACTIVE</span>
          </div>
          <button className="btn_btn_green" style={{width:"100%",padding:16,fontSize:14,letterSpacing:2.5}} onClick={joinGlobal}>PLAY NOW</button>
        </div>
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );

  // ─── LOBBY ───────────────────────────────────────────
  if(screen==="lobby")return(
    <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{maxWidth:420,width:"100%",textAlign:"center",position:"relative",zIndex:1}} className="anim_up">
        <div style={{textAlign:"left",marginBottom:14}}>
          <button className="btn_btn_ghost" style={{padding:"10px 16px",fontSize:11,letterSpacing:2,display:"inline-flex",alignItems:"center",gap:6}} onClick={function(){audio.buttonClick();goScreen("home");}}>← HOME</button>
        </div>
        <p style={{fontFamily:"Cinzel,serif",color:"#4ade80",fontSize:12,letterSpacing:4,marginBottom:6}}>{roomCode==="COBRA_GLOBAL"?"GLOBAL ROOM":"ROOM CODE"}</p>
        <div style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:54,fontWeight:900,letterSpacing:14,marginBottom:6,textShadow:"0 0 32px rgba(212,168,67,0.45)"}}>{roomCode}</div>
        <div className="panel" style={{padding:22,marginBottom:18}}>
          <p style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#1a3020",letterSpacing:3,marginBottom:14}}>{onlineStatus} PLAYERS</p>
          {onlinePlayers.map(function(p,i){return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",background:i===myIdx?"rgba(212,168,67,0.09)":"rgba(0,0,0,0.22)",borderRadius:12,marginBottom:8,border:i===myIdx?"1px solid rgba(212,168,67,0.25)":"1px solid rgba(255,255,255,0.04)"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 8px #4ade80"}} className="shimmer"/>
              {i===myIdx&&<span style={{fontSize:18}}>{myAvatar}</span>}
              <span style={{fontFamily:"Crimson Text,serif",fontSize:16,color:i===myIdx?"#d4a843":"#9ca3af",flex:1,textAlign:"left"}}>{p}</span>
              {i===0&&<span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#1a3020",letterSpacing:2}}>HOST</span>}
              {i===myIdx&&<span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:2}}>YOU</span>}
              {isHost&&i!==0&&i!==myIdx&&(
                <button onClick={function(){
                  audio.buttonClick();haptic.light();
                  loadRoom(roomCode).then(function(room){
                    if(!room)return;
                    room.players=room.players.filter(function(_,pi){return pi!==i;}).map(function(pl,ni){return Object.assign({},pl,{idx:ni});});
                    saveRoom(roomCode,room).then(function(){rtBroadcast(room);});
                  });
                }} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(248,113,113,0.4)",background:"rgba(185,28,28,0.15)",color:"#f87171",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",flexShrink:0}}>✕</button>
              )}
            </div>
          );})}
        </div>
        {/* Share / Copy / QR invite buttons */}
        {roomCode&&roomCode!=="COBRA_GLOBAL"&&(
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <button className="btn_btn_outline_gold" style={{flex:1,padding:"10px 6px",fontSize:10,letterSpacing:1,minHeight:40}}
              onClick={function(){
                var url="https://cobra-silk.vercel.app/?room="+roomCode;
                navigator.clipboard&&navigator.clipboard.writeText(url).then(function(){pop("Copied!","success",1500);}).catch(function(){pop(url,"info",3000);});
              }}>📋 Copy Link</button>
            <button className="btn_btn_outline_gold" style={{flex:1,padding:"10px 6px",fontSize:10,letterSpacing:1,minHeight:40}}
              onClick={function(){
                var url="https://cobra-silk.vercel.app/?room="+roomCode;
                window.open("https://wa.me/?text=Join my COBRA game! Code: "+roomCode+"%0A"+encodeURIComponent(url),"_blank");
              }}>💬 WhatsApp</button>
            <button className="btn_btn_outline_gold" style={{flex:1,padding:"10px 6px",fontSize:10,letterSpacing:1,minHeight:40}}
              onClick={function(){
                var url="https://cobra-silk.vercel.app/?room="+roomCode;
                QRCode.toDataURL(url,{width:220,margin:2,color:{dark:"#d4a843",light:"#010603"}}).then(function(d){setQrDataUrl(d);setShowQR(true);});
              }}>📱 QR Code</button>
          </div>
        )}
        {/* Host room settings */}
        {isHost&&(
          <div className="panel" style={{padding:18,marginBottom:14,textAlign:"left"}}>
            <p style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:3,marginBottom:14,textAlign:"center"}}>⚙ ROOM SETTINGS</p>
            <SLabel>SCORE LIMIT</SLabel>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16}}>
              {[50,75,100].map(function(v){return(
                <button key={v} className="btn" onClick={function(){audio.buttonClick();setScoreLimit(v);try{localStorage.setItem("cobra_score_limit",String(v));}catch(e){}}}
                  style={{flex:1,padding:"10px 4px",fontSize:12,fontFamily:"Cinzel,serif",fontWeight:700,borderRadius:11,letterSpacing:1,background:scoreLimit===v?"rgba(212,168,67,0.18)":"rgba(255,255,255,0.05)",border:scoreLimit===v?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.08)",color:scoreLimit===v?"#d4a843":"#2a3d28",cursor:"pointer",minHeight:44,touchAction:"manipulation"}}>{v}</button>
              );})}
            </div>
            <SLabel>TURN TIMER</SLabel>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16}}>
              {[{l:"30s",on:true},{l:"OFF",on:false}].map(function(item){var l=item.l,on=item.on;return(
                <button key={l} className="btn" onClick={function(){audio.buttonClick();setTimerOn(on);}}
                  style={{flex:1,padding:"10px 4px",fontSize:10,fontFamily:"Cinzel,serif",fontWeight:700,borderRadius:11,letterSpacing:1,background:timerOn===on?"rgba(212,168,67,0.18)":"rgba(255,255,255,0.05)",border:timerOn===on?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.08)",color:timerOn===on?"#d4a843":"#2a3d28",cursor:"pointer",minHeight:44,touchAction:"manipulation"}}>{l}</button>
              );})}
            </div>
            <SLabel>MAX PLAYERS</SLabel>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              {[2,3,4,5].map(function(v){
                var curMax=roomRef.current?roomRef.current.maxPlayers:4;
                return(
                  <button key={v} className="btn" onClick={function(){
                    audio.buttonClick();
                    loadRoom(roomCode).then(function(room){
                      if(!room)return;
                      room.maxPlayers=v;
                      saveRoom(roomCode,room).then(function(){roomRef.current=room;rtBroadcast(room);});
                    });
                  }}
                    style={{flex:1,padding:"10px 4px",fontSize:12,fontFamily:"Cinzel,serif",fontWeight:700,borderRadius:11,letterSpacing:1,background:curMax===v?"rgba(212,168,67,0.18)":"rgba(255,255,255,0.05)",border:curMax===v?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.08)",color:curMax===v?"#d4a843":"#2a3d28",cursor:"pointer",minHeight:44,touchAction:"manipulation"}}>{v}</button>
                );
              })}
            </div>
          </div>
        )}
        {/* Chat button in lobby */}
        <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"relative"}}>
            <button onClick={function(){audio.buttonClick();setChatOpen(function(o){if(!o)setUnreadChat(0);return!o;});}} style={{padding:"10px 18px",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:2,borderRadius:12,border:"1px solid rgba(212,168,67,0.2)",background:"rgba(212,168,67,0.06)",color:"#d4a843",cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:8,minHeight:44}}>
              💬 CHAT{unreadChat>0&&<span style={{background:"#ef4444",borderRadius:"50%",width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:9,fontWeight:700,color:"#fff"}}>{unreadChat}</span>}
            </button>
          </div>
          <div style={{position:"relative"}}>
            <button onClick={function(){audio.buttonClick();setShowEmojiPicker(function(p){return!p;});}} style={{width:44,height:44,borderRadius:12,border:"1px solid rgba(212,168,67,0.2)",background:"rgba(212,168,67,0.06)",color:"#d4a843",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>😊</button>
            {showEmojiPicker&&(
              <div style={{position:"absolute",bottom:52,right:0,background:"rgba(3,10,5,0.97)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,padding:10,display:"flex",gap:6,flexWrap:"wrap",width:180,zIndex:50,boxShadow:"0 10px 40px rgba(0,0,0,0.7)"}}>
                {EMOJIS.map(function(e){return(
                  <button key={e} onClick={function(){sendEmoji(e);}} style={{fontSize:24,background:"none",border:"none",cursor:"pointer",padding:4,borderRadius:8,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>{e}</button>
                );})}
              </div>
            )}
          </div>
        </div>
        {isHost
          ?<button className="btn_btn_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:3}} disabled={onlinePlayers.length<2||startingGame} onClick={function(){audio.buttonClick();startOnlineGame();}}>
            {startingGame?"STARTING...":onlinePlayers.length<2?"WAITING...":"START GAME"}
          </button>
          :<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            <ThinkingDots/>
            <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#1a3020",fontSize:16}}>Waiting for host...</p>
          </div>
        }
      </div>
      {/* QR Code Modal */}
      {showQR&&(
        <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={function(){setShowQR(false);}}>
          <div style={{background:"rgba(2,8,4,0.98)",border:"2px solid rgba(212,168,67,0.5)",borderRadius:22,padding:28,textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.9)"}} onClick={function(e){e.stopPropagation();}}>
            <div style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:14,letterSpacing:3,marginBottom:16}}>SCAN TO JOIN</div>
            {qrDataUrl&&<img src={qrDataUrl} alt="QR" style={{width:200,height:200,borderRadius:12,display:"block",margin:"0 auto"}}/>}
            <div style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:24,fontWeight:900,letterSpacing:8,marginTop:16}}>{roomCode}</div>
            <button className="btn_btn_ghost" style={{marginTop:16,padding:"10px 24px",fontSize:11}} onClick={function(){setShowQR(false);}}>CLOSE</button>
          </div>
        </div>
      )}
      {/* Chat drawer in lobby */}
      {chatOpen&&<div onClick={function(){setChatOpen(false);}} style={{position:"fixed",inset:0,zIndex:178,background:"rgba(0,0,0,0.45)"}}/>}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:180,height:"55%",background:"linear-gradient(180deg,rgba(2,10,4,0.98),rgba(1,6,2,0.99))",borderTop:"1px solid rgba(212,168,67,0.2)",borderRadius:"20px 20px 0 0",transform:chatOpen?"translateY(0)":"translateY(100%)",transition:"transform 0.35s cubic-bezier(.22,1.4,.36,1)",display:"flex",flexDirection:"column",paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div style={{padding:"14px 18px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(212,168,67,0.1)",flexShrink:0}}>
          <span style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#d4a843",letterSpacing:4}}>CHAT</span>
          <button onClick={function(){setChatOpen(false);}} style={{width:28,height:28,borderRadius:7,border:"1px solid rgba(212,168,67,0.2)",background:"rgba(212,168,67,0.06)",color:"#d4a843",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>✕</button>
        </div>
        <div ref={chatScrollRef} style={{flex:1,overflowY:"auto",padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
          {chatMessages.length===0&&<div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#3a5a3a",fontSize:14,textAlign:"center",marginTop:20}}>No messages yet. Say hello!</div>}
          {chatMessages.map(function(m){return(
            <div key={m.id} style={{display:"flex",alignItems:"flex-start",gap:8}}>
              <span style={{fontSize:18,flexShrink:0}}>{m.avatar}</span>
              <div>
                <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:1,marginRight:6}}>{m.player}</span>
                <span style={{fontFamily:"Crimson Text,serif",fontSize:15,color:"#86efac",lineHeight:1.4}}>{m.text}</span>
              </div>
            </div>
          );})}
        </div>
        <div style={{display:"flex",gap:8,padding:"8px 14px 10px",flexShrink:0,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          <input value={chatInput} onChange={function(e){setChatInput(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&chatInput.trim()&&chatChannelRef.current){var msg={id:Date.now(),player:myName,avatar:myAvatar||"😎",text:chatInput.trim(),ts:Date.now()};try{chatChannelRef.current.send({type:"broadcast",event:"chat",payload:msg});}catch(err){}setChatMessages(function(p){return[...p.slice(-49),msg];});setChatInput("");}}} placeholder="Type a message..." style={{flex:1,minHeight:40,padding:"8px 12px",fontSize:14}}/>
          <button className="btn_btn_gold" style={{padding:"8px 16px",fontSize:10,letterSpacing:2,minHeight:40,flexShrink:0}} onClick={function(){if(!chatInput.trim()||!chatChannelRef.current)return;var msg={id:Date.now(),player:myName,avatar:myAvatar||"😎",text:chatInput.trim(),ts:Date.now()};try{chatChannelRef.current.send({type:"broadcast",event:"chat",payload:msg});}catch(err){}setChatMessages(function(p){return[...p.slice(-49),msg];});setChatInput("");}}>SEND</button>
        </div>
      </div>
      {/* Floating emojis in lobby */}
      {emojis.map(function(e){return(<EmojiFloat key={e.id} emoji={e.emoji} x={e.x} y={e.y}/>);})}
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );

  // ─── REVEAL ──────────────────────────────────────────
  if(screen==="reveal"){
    if(!revealData)return(<div className="feltbg"><style>{GS}</style></div>);
    var rd=revealData;
    var rtotals=rd.hands.map(function(h){return ht(h);});
    var rminT=Math.min.apply(null,rtotals);
    var rdeclarer=names[rd.declarerIdx]||"Player";
    var rdeclTotal=rtotals[rd.declarerIdx];
    var rdeclWon=rdeclTotal===rminT&&rtotals.filter(function(t){return t===rminT;}).length===1;
    return(
      <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
        <style>{GS}</style>
        <div style={{maxWidth:440,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:44,marginBottom:8}}>{rdeclWon?"👑":"🐍"}</div>
            <h2 style={{fontFamily:"Cinzel,serif",color:rdeclWon?"#d4a843":"#f87171",fontSize:22,letterSpacing:3,marginBottom:4}}>
              {rdeclWon?rdeclarer+" WON THE ROUND!":rdeclarer+" COBRA!"}
            </h2>
            <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#5a7a60",fontSize:14}}>
              {rdeclWon?"Lowest total — everyone else adds their cards":"Wrong declare — penalty applied, others score 0"}
            </p>
          </div>
          {names.slice(0,nPlayers).map(function(name,i){
            var total=rtotals[i];
            var isDeclarer=i===rd.declarerIdx;
            var isWinner=total===rminT&&rtotals.filter(function(t){return t===rminT;}).length===1;
            return(
              <div key={i} style={{marginBottom:10,padding:"12px 16px",borderRadius:14,background:isDeclarer&&isWinner?"rgba(212,168,67,0.12)":isDeclarer&&!isWinner?"rgba(185,28,28,0.1)":"rgba(0,0,0,0.35)",border:isDeclarer&&isWinner?"1.5px solid rgba(212,168,67,0.4)":isDeclarer&&!isWinner?"1.5px solid rgba(185,28,28,0.4)":"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,color:isDeclarer&&isWinner?"#d4a843":isDeclarer&&!isWinner?"#f87171":"#8aad8a"}}>
                    {isDeclarer?(isWinner?"👑 ":"🐍 "):""}{name.toUpperCase()}{isDeclarer?" (DECLARED)":""}
                  </span>
                  <span style={{fontFamily:"Cinzel,serif",fontSize:16,fontWeight:900,color:total<=DECLARE_MAX?"#4ade80":"#f87171"}}>{total} pts</span>
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {(rd.hands[i]||[]).map(function(card,j){return(<Card key={j} card={card} size="md"/>);})}
                </div>
              </div>
            );
          })}
          <button className="btn_btn_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:3,marginTop:8}}
            onClick={function(){
              audio.buttonClick();haptic.medium();
              var rd2=revealData;if(!rd2)return;
              var ns=rd2.ns;var res=rd2.res;
              var loser=ns.findIndex(function(s){return s>=scoreLimit;});
              var resWS=res.map(function(r,i){return Object.assign({},r,{newScore:ns[i]});});
              var ned={results:resWS,scores:ns,nPlayers:nPlayers,names:names.slice(0,nPlayers)};
              setFlashScores(ns.map(function(s,i){return s!==(scores[i]||0);}));
              setTimeout(function(){setFlashScores([]);},1200);
              setRoundEndData(ned);setScores(ns);setRoundRes(resWS);
              setHands([]);setDeck([]);setMyPlayed([]);setSel([]);setOpenPile({cards:[],owner:-1});
              setRevealData(null);
              if(loser>=0){var winner=ns.indexOf(Math.min.apply(null,ns));setGameOverData({scores:ns,winner:winner,loser:loser});if(winner===H)saveLeaderboardWin();setScreen("gameOver");}
              else setScreen("roundEnd");
            }}>SEE SCORECARD</button>
        </div>
      </div>
    );
  }

  // ─── ROUND END ───────────────────────────────────────
  if(screen==="roundEnd"){
    var red=roundEndData||{results:[],scores:[],nPlayers:nPlayers,names:names.slice(0,nPlayers)};
    var redResults=red.results||[];
    var redWinner=redResults.find(function(r){return r.winner;});
    var redCobra=redResults.find(function(r){return r.cobra;});
    return(
      <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:24,overflowY:"auto"}}>
        <style>{GS}</style>
        <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
        <div style={{maxWidth:420,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
          <div style={{textAlign:"center",marginBottom:20,padding:"20px",background:redWinner?"rgba(212,168,67,0.08)":redCobra?"rgba(185,28,28,0.08)":"rgba(0,0,0,0.2)",borderRadius:20,border:redWinner?"1px solid rgba(212,168,67,0.2)":redCobra?"1px solid rgba(185,28,28,0.2)":"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{fontSize:48,marginBottom:8}}>{redWinner?"👑":redCobra?"🐍":"🃏"}</div>
            <h2 style={{fontFamily:"Cinzel,serif",fontSize:22,letterSpacing:3,marginBottom:6,color:redWinner?"#d4a843":redCobra?"#f87171":"#9aad9a"}}>
              {redWinner?redWinner.name+" WON THE ROUND":redCobra?"COBRA — "+redCobra.name:"ROUND OVER"}
            </h2>
            <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",fontSize:14,color:redWinner?"#7a9a5a":redCobra?"#8a5a5a":"#5a7a60"}}>
              {redWinner?"Lowest total — scored 0 points":redCobra?"Wrong declare — others score nothing":"Round complete"}
            </p>
          </div>
          <div className="panel" style={{overflow:"hidden",marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",padding:"10px 20px",background:"rgba(212,168,67,0.05)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              {["PLAYER","THIS ROUND","TOTAL"].map(function(h){return(<span key={h} style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#5a7a60",letterSpacing:1.5}}>{h}</span>);})}
            </div>
            {redResults.map(function(r,i){
              var ns=r.newScore||0;
              return(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",padding:"14px 20px",alignItems:"center",borderBottom:i<redResults.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:r.winner?"rgba(212,168,67,0.06)":r.cobra?"rgba(185,28,28,0.08)":"transparent"}}>
                  <span style={{fontFamily:"Crimson Text,serif",fontSize:17,color:r.winner?"#d4a843":r.cobra?"#f87171":"#9aad9a"}}>{r.winner?"👑 ":r.cobra?"🐍 ":""}{r.name}</span>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:700,color:r.winner?"#4ade80":r.cobra?"#f87171":"#9aad9a",animation:"splashPop 0.4s cubic-bezier(.22,1.4,.36,1) both",animationDelay:(i*0.12)+"s"}}>
                    {r.winner?"+0":r.added>0?"+"+r.added:"+0"}
                    <div style={{fontSize:8,color:"#4a6a4a",fontWeight:400,marginTop:2}}>{r.winner?"won":r.cobra?"cobra":"added"}</div>
                  </div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:900,textAlign:"right",color:ns>=80?"#f87171":ns>=50?"#fbbf24":r.winner?"#d4a843":"#c8d8c8",animation:"splashPop 0.5s cubic-bezier(.22,1.4,.36,1) both",animationDelay:(i*0.1)+"s"}}>{ns}</div>
                </div>
              );
            })}
          </div>
          <div style={{background:"rgba(0,0,0,0.25)",borderRadius:14,padding:"14px 16px",marginBottom:18,border:"1px solid rgba(255,255,255,0.05)"}}>
            <p style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#4a6a4a",letterSpacing:2,marginBottom:12,textAlign:"center"}}>STANDINGS — FIRST TO {scoreLimit} IS OUT</p>
            {redResults.map(function(r,i){
              var ns=r.newScore||0,slD=Math.round(scoreLimit*0.8),slW=Math.round(scoreLimit*0.5);
              return(
                <div key={i} style={{marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:ns>=slD?"#f87171":ns>=slW?"#fbbf24":r.winner?"#d4a843":"#7a9d78",width:56,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span>
                  <div style={{flex:1,height:10,background:"rgba(255,255,255,0.06)",borderRadius:5,overflow:"hidden"}}>
                    <div style={{height:"100%",width:Math.min(Math.round(ns/scoreLimit*100),100)+"%",borderRadius:5,transition:"width 0.8s cubic-bezier(.22,1,.36,1)",background:ns>=slD?"linear-gradient(90deg,#991b1b,#ef4444)":ns>=slW?"linear-gradient(90deg,#92400e,#f59e0b)":r.winner?"linear-gradient(90deg,#a07820,#d4a843)":"linear-gradient(90deg,#14532d,#16a34a)"}}/>
                  </div>
                  <span style={{fontFamily:"Cinzel,serif",fontSize:11,fontWeight:700,width:48,textAlign:"right",color:ns>=slD?"#f87171":ns>=slW?"#fbbf24":"#7a9d78"}}>{ns}/{scoreLimit}</span>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10}}>
            {mode==="online"&&!isHost?(
              <div style={{flex:2,padding:17,fontSize:12,letterSpacing:2,fontFamily:"Cinzel,serif",color:"#5a7a60",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8,border:"1px solid rgba(255,255,255,0.07)",borderRadius:12}}>
                <ThinkingDots/> Waiting for host...
              </div>
            ):(
              <button className="btn_btn_gold" style={{flex:2,padding:17,fontSize:13,letterSpacing:2}}
                onClick={function(){
                  audio.init();audio.resume();audio.buttonClick();haptic.medium();audio.shuffle_sfx();
                  var ns=redResults.map(function(r){return r.newScore||0;});
                  if(mode==="online"){onlineNextRound(ns);}
                  else{deal(ns,red.nPlayers||nPlayers);setScreen("game");}
                }}>
                🃏 NEXT ROUND
              </button>
            )}
            <button className="btn_btn_ghost" style={{flex:1,padding:17,fontSize:12,letterSpacing:1.5,border:"1px solid rgba(255,255,255,0.12)"}}
              onClick={function(){audio.buttonClick();setRoundEndData(null);setScores([]);setScreen("home");}}>
              🏠 HOME
            </button>
          </div>
        </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
      </div>
    );
  }

  // ─── GAME OVER ──────────────────────────────────────
  if(screen==="gameOver"){
    if(!gameOverData)return(<div className="feltbg"><style>{GS}</style></div>);
    var iWonGame=gameOverData.winner===H;
    // Trigger confetti if local player won (once)
    if(iWonGame&&confetti.length===0){
      var wConf=[];for(var wci=0;wci<30;wci++){wConf.push({id:wci,x:Math.random()*100,color:["#d4a843","#4ade80","#f87171","#60a5fa","#fff","#fbbf24"][Math.floor(Math.random()*6)],size:Math.random()*7+4,delay:Math.random()*0.8,dur:Math.random()*1.5+1.2});}
      setTimeout(function(){setConfetti(wConf);setTimeout(function(){setConfetti([]);},3500);},100);
    }
    return(
      <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px",position:"relative"}}>
        <style>{GS}</style>
        {confetti.map(function(c){return(<div key={c.id} style={{position:"fixed",left:c.x+"%",top:"-10px",width:c.size,height:c.size*1.4,borderRadius:2,background:c.color,zIndex:300,pointerEvents:"none",animation:"confettiFall "+c.dur+"s "+c.delay+"s ease-in forwards"}}/>);})}
        <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
        <div style={{maxWidth:420,width:"100%",textAlign:"center",position:"relative",zIndex:1}} className="anim_up">
          <div style={{fontSize:70,marginBottom:8,animation:"cobraBounce 1.2s ease-in-out 3"}}>{iWonGame?myAvatar:"👑"}</div>
          <h1 style={{fontFamily:"Cinzel,serif",color:iWonGame?"#4ade80":"#d4a843",fontSize:32,letterSpacing:7,margin:"0 0 4px",textShadow:iWonGame?"0 0 30px rgba(74,222,128,0.6)":"0 0 30px rgba(212,168,67,0.5)"}}>{iWonGame?"YOU WIN! 🏆":"GAME OVER"}</h1>
          <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#4a7a4a",fontSize:22,marginBottom:6}}>{iWonGame?"Congratulations!":names[gameOverData.winner]+" wins"}</p>
          <div style={{height:1,background:"linear-gradient(90deg,transparent,#d4a843,transparent)",margin:"14px auto 22px",width:110}}/>
          <div className="panel" style={{overflow:"hidden",marginBottom:16}}>
            {names.slice(0,nPlayers).map(function(n,i){return(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"15px 24px",borderBottom:i<nPlayers-1?"1px solid rgba(255,255,255,0.04)":"none",background:i===gameOverData.winner?"rgba(212,168,67,0.08)":i===gameOverData.loser?"rgba(185,28,28,0.08)":"transparent"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{i===gameOverData.winner?"👑":i===gameOverData.loser?"💀":" "}</span>
                  <span style={{fontFamily:"Crimson Text,serif",fontSize:19,color:i===gameOverData.winner?"#d4a843":i===gameOverData.loser?"#f87171":"#5a7a5a"}}>{n}</span>
                </div>
                <span style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:900,color:i===gameOverData.winner?"#d4a843":i===gameOverData.loser?"#f87171":"#1a3020"}}>{gameOverData.scores[i]}</span>
              </div>
            );})}
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:18}}>
            {[["🏆",gameStats.wins,"Wins"],["🐍",gameStats.cobras,"Cobras"],["🔥",gameStats.streak||0,"Streak"],["🃏",gameStats.rounds,"Rounds"]].map(function(row){return(
              <div key={row[2]} style={{textAlign:"center",padding:"8px 12px",background:"rgba(255,255,255,0.04)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{fontSize:18}}>{row[0]}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:700,color:"#d4a843"}}>{row[1]}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#7a9d78",letterSpacing:1}}>{row[2]}</div>
              </div>
            );})}
          </div>
          <div style={{display:"flex",gap:10}}>
            {mode==="online"&&!isHost?(
              <div style={{flex:2,padding:16,fontSize:12,letterSpacing:2,fontFamily:"Cinzel,serif",color:"#5a7a60",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8,border:"1px solid rgba(255,255,255,0.07)",borderRadius:12}}>
                <ThinkingDots/> Waiting for host...
              </div>
            ):(
              <button className="btn_btn_gold" style={{flex:2,padding:16,fontSize:13,letterSpacing:2}}
                onClick={function(){
                  audio.init();audio.resume();audio.buttonClick();haptic.medium();audio.shuffle_sfx();
                  setGameOverData(null);
                  if(mode==="cpu"){startCPU();}
                  else if(mode==="online"){startOnlineGame();}
                  else{deal(Array(nPlayers).fill(0),nPlayers);setScreen("game");}
                }}>
                🔄 REMATCH
              </button>
            )}
            <button className="btn_btn_ghost" style={{flex:1,padding:16,fontSize:12,letterSpacing:1.5}}
              onClick={function(){audio.buttonClick();setScores([]);goScreen("home");}}>
              🏠 HOME
            </button>
          </div>
        </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
      </div>
    );
  }

  // ─── LEADERBOARD ────────────────────────────────────
  if(screen==="leaderboard"){
    return <LeaderboardScreen goScreen={goScreen} showSettings={showSettings} setShowSettings={setShowSettings} sfxMuted={sfxMuted} musicMuted={musicMuted} sfxToggle={sfxToggle} musToggle={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme}/>;
  }

  // ─── SPECTATE PROMPT ────────────────────────────────
  if(screen==="spectatePrompt"){
    return(
      <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
        <style>{GS}</style>
        <div style={{maxWidth:360,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
          <div className="panel" style={{padding:32,textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>👁</div>
            <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:20,letterSpacing:4,marginBottom:8}}>GAME IN PROGRESS</h2>
            <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#5a7a60",fontSize:16,marginBottom:24,lineHeight:1.6}}>This game has already started. You can spectate and watch live without playing.</p>
            <button className="btn_btn_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:2.5,marginBottom:12}}
              onClick={function(){
                audio.buttonClick();haptic.medium();
                setIsSpectator(true);setMyIdx(-1);setMode("online");
                startLobbyPoll(roomCode);
                loadRoom(roomCode).then(function(room){
                  if(room&&room.status==="started"&&room.gameState){
                    var gs=room.gameState;
                    setHands(gs.hands);setDeck(gs.deck);setOpenPile(gs.openPile);
                    setMyPlayed(gs.myPlayed||[]);setCurrentPlayer(gs.currentPlayer);
                    setPhase(gs.phase);setScores(gs.scores);
                    setNames(room.players.map(function(p){return p.name;}));
                    setNPlayers(room.players.length);
                    goScreen("game");
                  }
                });
              }}>
              👁 SPECTATE
            </button>
            <button className="btn_btn_ghost" style={{width:"100%",padding:14,fontSize:12,letterSpacing:2}} onClick={function(){audio.buttonClick();goScreen("home");}}>BACK</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── GAME ───────────────────────────────────────────
  if(screen!=="game")return null;
  if(hands.length===0)return(<div className="feltbg"><style>{GS}</style></div>);
  const myHand=hands[H]||[];
  const myTotal=ht(myHand);
  const isMyTurn=currentPlayer===H;
  const pile=openPile.cards||[];
  const canPickPile=isMyTurn&&phase==="pickup"&&pile.length>0;
  const seqOk=isValidSeq(sel);
  const canDeclare=myTotal<=DECLARE_MAX;

  return(
    <div className="feltbg" style={{height:"100vh",maxHeight:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",userSelect:"none"}}>
      <style>{GS}</style>
      <TableParticles/>
      {showTutorial&&<Tutorial onDone={function(){setShowTutorial(false);setTutorialDone(true);try{localStorage.setItem("cobra_tutorial_done","1");}catch(e){}}}/>}
      {earnedAch&&<AchievementBadge ach={earnedAch} onDone={function(){setEarnedAch(null);}}/>}
      {emojis.map(function(e){return(<EmojiFloat key={e.id} emoji={e.emoji} x={e.x} y={e.y}/>);})}
      {confetti.map(function(c){return(
        <div key={c.id} style={{position:"fixed",left:c.x+"%",top:"-10px",width:c.size,height:c.size*1.4,borderRadius:2,background:c.color,zIndex:300,pointerEvents:"none",animation:"confettiFall "+c.dur+"s "+c.delay+"s ease-in forwards"}}/>
      );})}
      {/* YOUR TURN splash */}
      {showYourTurn&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:150,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeOut 2s ease forwards"}}>
          <div style={{background:"rgba(212,168,67,0.95)",borderRadius:32,padding:"20px 48px",boxShadow:"0 0 40px rgba(212,168,67,0.8),0 0 80px rgba(212,168,67,0.4),0 8px 32px rgba(0,0,0,0.5)",whiteSpace:"nowrap",animation:"yourTurnGlow 0.5s ease-in-out infinite alternate,fadeOut 2s ease forwards"}}>
            <span style={{fontFamily:"Cinzel,serif",fontSize:28,fontWeight:900,color:"#120c00",letterSpacing:5}}>YOUR TURN</span>
          </div>
        </div>
      )}
      {/* CPU play toast */}
      {showCpuPlay&&lastCpuPlay&&(
        <div style={{position:"fixed",top:80,left:"50%",transform:"translateX(-50%)",zIndex:140,pointerEvents:"none",background:"rgba(10,20,10,0.92)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:20,padding:"10px 20px",boxShadow:"0 4px 20px rgba(0,0,0,0.5)",whiteSpace:"nowrap",animation:"slideUp 0.2s ease"}}>
          <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#9ca3af",letterSpacing:1}}>{lastCpuPlay.player} played </span>
          <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#d4a843",fontWeight:700,letterSpacing:1}}>{lastCpuPlay.seq}</span>
        </div>
      )}
      {/* Rules modal */}
      {showRules&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:200,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={function(){setShowRules(false);}}>
          <div style={{background:"rgba(2,8,4,0.97)",borderRadius:22,padding:24,maxWidth:380,width:"100%",border:"1px solid rgba(212,168,67,0.2)"}} onClick={function(e){e.stopPropagation();}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:18,color:"#d4a843",letterSpacing:3,marginBottom:16,textAlign:"center"}}>QUICK RULES</div>
            {[["🎯","Goal","Lowest total wins. Ace=1 or 14, King=13."],["🔄","Turn","Tap cards to play, then pick up from pile or draw."],["♠","Plays","Single, Pair, Triple, Quad, Run 3+, Flush 3+"],["📢","Declare","Total 30 or under. Strictly lowest wins. Tied = Cobra!"],["🐍","Cobra","Wrong declare = your total + 30. Others score 0."],["💀","Out","First to 100 is eliminated."]].map(function(r){return(
              <div key={r[0]} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}>
                <span style={{fontSize:18,flexShrink:0}}>{r[0]}</span>
                <div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#d4a843",letterSpacing:2,marginBottom:2}}>{r[1]}</div>
                  <div style={{fontFamily:"Crimson Text,serif",fontSize:14,color:"#8aad8a",lineHeight:1.5}}>{r[2]}</div>
                </div>
              </div>
            );})}
            <button className="btn_btn_gold" style={{width:"100%",padding:14,fontSize:12,letterSpacing:2,marginTop:8}} onClick={function(){setShowRules(false);}}>GOT IT</button>
          </div>
        </div>
      )}
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      {/* Exit confirm */}
      {showExitConfirm&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:200,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"rgba(2,8,4,0.97)",borderRadius:22,padding:28,maxWidth:320,width:"100%",border:"1px solid rgba(255,255,255,0.1)",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
            <div style={{fontSize:36,marginBottom:12}}>🏠</div>
            <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:18,letterSpacing:3,marginBottom:8}}>LEAVE GAME?</h2>
            <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#5a7a60",fontSize:15,marginBottom:24,lineHeight:1.6}}>Your progress will be lost. Are you sure you want to go back to home?</p>
            <div style={{display:"flex",gap:10}}>
              <button className="btn_btn_ghost" style={{flex:1,padding:14,fontSize:12,letterSpacing:1.5}}
                onClick={function(){haptic.light();setShowExitConfirm(false);}}>
                KEEP PLAYING
              </button>
              <button className="btn_btn_red" style={{flex:1,padding:14,fontSize:12,letterSpacing:1.5}}
                onClick={function(){
                  haptic.medium();audio.buttonClick();
                  setShowExitConfirm(false);
                  setScores([]);setHands([]);setDeck([]);
                  goScreen("home");
                }}>
                GO HOME
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{flexShrink:0,padding:"calc(8px + env(safe-area-inset-top)) 16px 10px",position:"relative",zIndex:5,background:"linear-gradient(180deg,rgba(0,0,0,0.85)0%,rgba(0,0,0,0.12)100%)",borderBottom:"1px solid rgba(255,255,255,0.05)",backdropFilter:"blur(16px)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:17,fontWeight:900,letterSpacing:3,background:"linear-gradient(135deg,#e8c052,#c49030)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>🐍 COBRA</div>
            <button onClick={function(){haptic.light();setShowExitConfirm(true);}}
              style={{width:30,height:30,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:"#6a8a6a",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>🏠</button>
            <button onClick={function(){setShowRules(true);haptic.light();}}
              style={{width:30,height:30,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:"#6a8a6a",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>?</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{position:"relative"}}>
              <button onClick={function(){setShowEmojiPicker(function(p){return!p;});}} style={{width:36,height:36,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(0,0,0,0.4)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>😊</button>
              {showEmojiPicker&&(
                <div style={{position:"absolute",top:44,right:0,background:"rgba(3,10,5,0.97)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,padding:10,display:"flex",gap:6,flexWrap:"wrap",width:180,zIndex:50,boxShadow:"0 10px 40px rgba(0,0,0,0.7)"}}>
                  {EMOJIS.map(function(e){return(
                    <button key={e} onClick={function(){sendEmoji(e);}} style={{fontSize:24,background:"none",border:"none",cursor:"pointer",padding:4,borderRadius:8,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>{e}</button>
                  );})}
                </div>
              )}
            </div>
            {timerOn&&isMyTurn&&<TurnTimer seconds={turnTime} total={TURN_SEC}/>}
            {mode==="online"&&(
              <div style={{position:"relative"}}>
                <button onClick={function(){setChatOpen(true);setUnreadChat(0);}} style={{width:36,height:36,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(0,0,0,0.4)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>💬</button>
                {unreadChat>0&&<div style={{position:"absolute",top:-4,right:-4,background:"#ef4444",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:9,fontWeight:700,color:"#fff"}}>{unreadChat}</div>}
              </div>
            )}
            {isSpectator&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:1,padding:"2px 8px",background:"rgba(212,168,67,0.1)",borderRadius:8}}>👁 SPECTATING</div>}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#3a5a3a",letterSpacing:1,padding:"2px 8px",background:"rgba(255,255,255,0.04)",borderRadius:8}}>R{roundNum}</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#16a34a",boxShadow:"0 0 6px #16a34a"}}/>
                <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#5a7a60",letterSpacing:2}}>{deck.length}</span>
              </div>
            </div>
          </div>
        </div>
        <ScoreStrip names={names} scores={scores} currentPlayer={currentPlayer} nPlayers={nPlayers} flashScores={flashScores} avatars={Array.from({length:nPlayers},function(_,i){return i===H?myAvatar:null;})} scoreLimit={scoreLimit}/>
      </div>

      {/* OPPONENTS */}
      <div style={{flexShrink:0,padding:"4px 10px 4px",display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",position:"relative",zIndex:4}}>
        {Array(nPlayers-1).fill(0).map(function(_,i){
          var ci=i+1,ch=hands[ci]||[],active=ci===currentPlayer;
          return(
            <div key={ci} style={{padding:"4px 10px 6px",borderRadius:10,textAlign:"center",background:active?"linear-gradient(160deg,rgba(212,168,67,0.16),rgba(212,168,67,0.07))":"rgba(0,0,0,0.3)",border:active?"1.5px solid rgba(212,168,67,0.42)":"1px solid rgba(255,255,255,0.05)",boxShadow:active?"0 0 22px rgba(212,168,67,0.14)":"none",transition:"all 0.35s cubic-bezier(.22,1,.36,1)"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:7.5,letterSpacing:1.5,marginBottom:3,color:active?"#d4a843":"#4a6a4a",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                {active&&cpuThinking&&mode==="cpu"?<ThinkingDots/>:<>{active&&<div style={{width:5,height:5,borderRadius:"50%",background:"#d4a843",boxShadow:"0 0 7px #d4a843"}} className="pulse"/>}{names[ci]}</>}
              </div>
              <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:4,position:"relative"}}>
                <div style={{display:"flex",justifyContent:"center",flexWrap:"nowrap",overflow:"hidden"}}>
                  {ch.slice(0,Math.min(ch.length,5)).map(function(_,j){return(
                    <div key={j} style={{marginLeft:j===0?0:-16,zIndex:j,transition:"margin 0.2s"}}>
                      <Card card={{suit:"♠",value:"A"}} faceDown size="sm" theme={cardTheme}/>
                    </div>
                  );})}
                </div>
                {ch.length>5&&(
                  <div style={{fontFamily:"Cinzel,serif",fontSize:11,fontWeight:900,color:"#d4a843",background:"rgba(212,168,67,0.15)",border:"1px solid rgba(212,168,67,0.3)",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:2}}>+{ch.length-5}</div>
                )}
              </div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:active?"#d4a843":"#3a5a3a",marginTop:2,letterSpacing:1,transition:"color 0.3s"}}>{ch.length} cards</div>
            </div>
          );
        })}
      </div>

      {/* TABLE */}
      <div style={{flex:1,display:"flex",gap:9,padding:"5px 12px",minHeight:0,position:"relative",zIndex:3}}>
        {/* Deck */}
        <div id="tut-deck" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,flexShrink:0,width:70}}>
          <span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#5a7a60",letterSpacing:2}}>DECK</span>
          <div style={{position:"relative",height:92,width:64,cursor:isMyTurn&&phase==="pickup"?"pointer":"default",filter:isMyTurn&&phase==="pickup"?"drop-shadow(0 0 14px rgba(74,222,128,0.45))":"none",transition:"filter 0.3s"}}
            onClick={isMyTurn&&phase==="pickup"?pickFromDeck:undefined}
            onTouchStart={function(e){if(isMyTurn&&phase==="pickup")e.currentTarget._ty=e.touches[0].clientY;}}
            onTouchEnd={function(e){if(isMyTurn&&phase==="pickup"&&e.currentTarget._ty-e.changedTouches[0].clientY>30)pickFromDeck();}}>
            {deck.length>0?[2,1,0].map(function(o){return(
              <div key={o} style={{position:o===0?"relative":"absolute",top:o===0?0:-o*3,left:o===0?0:o,zIndex:3-o}}>
                <Card card={{suit:"♠",value:"A"}} faceDown glow={o===0&&isMyTurn&&phase==="pickup"} size="md" theme={cardTheme}/>
              </div>
            );}):(
              <div style={{width:60,height:86,borderRadius:9,border:"1.5px dashed rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.15)"}}>
                <span style={{opacity:0.25,fontSize:24}}>empty</span>
              </div>
            )}
          </div>
          <span style={{fontFamily:"Cinzel,serif",fontSize:10,fontWeight:700,color:deck.length>20?"#5a7a60":deck.length>8?"#d4a843":"#f87171"}}>{deck.length}</span>
          {isMyTurn&&phase==="pickup"&&deck.length>0&&<span className="pulse" style={{fontFamily:"Cinzel,serif",fontSize:7.5,color:"#4ade80",textAlign:"center",lineHeight:1.5}}>SWIPE UP OR TAP</span>}
        </div>
        {/* Pile */}
        <div id="tut-pile" style={{flex:1,display:"flex",flexDirection:"column",gap:7,minWidth:0}}>
          <div className={canPickPile?"glow_pile":""} style={{flex:1,borderRadius:18,background:canPickPile?"linear-gradient(160deg,rgba(14,60,22,0.9),rgba(6,28,10,0.85))":pile.length>0?"linear-gradient(160deg,rgba(20,20,40,0.85),rgba(10,10,24,0.8))":"rgba(0,0,0,0.35)",border:canPickPile?"2px solid rgba(74,222,128,0.6)":pile.length>0?"1.5px solid rgba(212,168,67,0.3)":"1.5px solid rgba(255,255,255,0.1)",padding:"12px 14px",display:"flex",flexDirection:"column",boxShadow:canPickPile?"0 0 24px rgba(74,222,128,0.2)":pile.length>0?"0 0 18px rgba(212,168,67,0.08)":"none",transition:"all 0.35s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:canPickPile?"#4ade80":pile.length>0?"#d4a843":"#3a5a3a",fontWeight:700}}>
                  {pile.length>0&&openPile.owner>=0?(names[openPile.owner]||"").toUpperCase()+"'S PLAY":"OPEN PILE"}
                </span>
                {pile.length>0&&<span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.06)",padding:"2px 6px",borderRadius:8}}>{pile.length} card{pile.length>1?"s":""}</span>}
              </div>
              {canPickPile&&<span className="pulse" style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#4ade80",letterSpacing:1}}>TAP TO TAKE</span>}
            </div>
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
              {pile.length===0
                ?<div style={{textAlign:"center",opacity:0.4}}>
                  <div style={{fontSize:28,marginBottom:4}}>🂠</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#1a2e1a",letterSpacing:3}}>EMPTY</div>
                </div>
                :pile.map(function(c,i){return(
                  <div key={i} style={{animation:pickingUp?"cardPickup 0.35s cubic-bezier(.22,1,.36,1) both":"none",animationDelay:(i*0.05)+"s",transform:canPickPile?"translateY(-4px)":"none",transition:"transform 0.3s cubic-bezier(.34,1.56,.64,1)"}}>
                    <Card card={c} clickable={canPickPile} glow={canPickPile} onClick={function(){pickFromPile(c);}} size="md"/>
                  </div>
                );})}
            </div>
          </div>
          {myPlayed.length>0&&(
            <div style={{flexShrink:0,borderRadius:13,background:"rgba(0,0,0,0.22)",border:"1px dashed rgba(255,255,255,0.06)",padding:"8px 13px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#5a7a60",letterSpacing:2.5}}>YOUR PLAY</span>
                {prevHand&&<button className="btn_btn_ghost" style={{padding:"4px 10px",fontSize:9,letterSpacing:1,minHeight:28}} onClick={doUndo}>UNDO</button>}
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{myPlayed.map(function(c,i){return(<Card key={i} card={c} dimmed size="md"/>);})}</div>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      {toast.msg&&(
        <div style={{position:"fixed",top:"36%",left:"50%",transform:"translate(-50%,-50%)",background:toast.type==="error"?"linear-gradient(135deg,rgba(28,4,4,0.97),rgba(16,3,3,0.97))":toast.type==="success"?"linear-gradient(135deg,rgba(3,16,6,0.97),rgba(2,10,4,0.97))":"linear-gradient(135deg,rgba(12,9,2,0.97),rgba(9,7,2,0.97))",color:toast.type==="error"?"#fca5a5":toast.type==="success"?"#86efac":"#d4a843",padding:"13px 28px",borderRadius:14,fontSize:13,fontFamily:"Cinzel,serif",letterSpacing:2.5,border:"1px solid rgba(212,168,67,0.44)",boxShadow:"0 18px 55px rgba(0,0,0,0.88)",zIndex:500,textAlign:"center",maxWidth:"82vw",backdropFilter:"blur(20px)",animation:"slideUp 0.26s cubic-bezier(.22,1,.36,1)"}}>{toast.msg}</div>
      )}

      {/* MY HAND or SPECTATOR */}
      {isSpectator?(
        <div style={{flexShrink:0,padding:"16px 12px calc(12px + env(safe-area-inset-bottom))",position:"relative",zIndex:5,background:"linear-gradient(0deg,rgba(0,0,0,0.92)0%,rgba(0,0,0,0.6)100%)",borderTop:"1px solid rgba(255,255,255,0.07)",backdropFilter:"blur(16px)",display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:18,color:"#d4a843",letterSpacing:4}}>👁 SPECTATING</div>
          <button className="btn_btn_ghost" style={{padding:"12px 28px",fontSize:12,letterSpacing:2}} onClick={function(){audio.buttonClick();goScreen("home");}}>LEAVE</button>
        </div>
      ):(
      <div style={{flexShrink:0,padding:"7px 12px calc(8px + env(safe-area-inset-bottom))",position:"relative",zIndex:5,background:"linear-gradient(0deg,rgba(0,0,0,0.92)0%,rgba(0,0,0,0.6)100%)",borderTop:"1px solid rgba(255,255,255,0.07)",backdropFilter:"blur(16px)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5,gap:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:1}}>
            {!isMyTurn&&(
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <ThinkingDots/>
                <span style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#5a7a60",fontSize:13,whiteSpace:"nowrap"}}>{names[currentPlayer]}...</span>
              </div>
            )}
            {isMyTurn&&sel.length>0&&(
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:seqOk?"#4ade80":"#f87171",padding:"4px 8px",borderRadius:7,background:seqOk?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)",border:"1px solid "+(seqOk?"rgba(74,222,128,0.3)":"rgba(248,113,113,0.3)"),whiteSpace:"nowrap"}}>
                {seqOk?"✓ "+seqLabel(sel):"✗ not valid"}
              </div>
            )}
            {isMyTurn&&sel.length===0&&(phase==="declare"||phase==="play")&&!showYourTurn&&(
              <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,transition:"color 0.3s",color:canDeclare?"#4ade80":"#4a6a4a",fontWeight:canDeclare?"700":"400"}}>
                {canDeclare?"You can DECLARE!":"tap cards to play"}
              </span>
            )}
            {isMyTurn&&phase==="pickup"&&(
              <span className="pulse" style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#4ade80",letterSpacing:1}}>
                {canPickPile?"pick from pile or draw":"draw from deck"}
              </span>
            )}
          </div>
          <div id="tut-actions" style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
            {isMyTurn&&sel.length>0&&(
              <button className="btn_btn_ghost" style={{padding:"10px 14px",fontSize:15,minHeight:48,minWidth:48,letterSpacing:0}} onClick={function(){audio.buttonClick();setSel([]);}}>✕</button>
            )}
            {isMyTurn&&sel.length>0&&seqOk&&(phase==="play"||phase==="declare")&&(
              <button className="btn_btn_green" style={{padding:"12px 20px",fontSize:13,letterSpacing:2,minHeight:48}} onClick={doPlay}>PLAY</button>
            )}
            {isMyTurn&&(phase==="declare"||phase==="play")&&!showYourTurn&&sel.length===0&&(
              <button className="btn_btn_red"
                style={{padding:"12px 20px",fontSize:13,letterSpacing:2,minHeight:48,opacity:canDeclare?1:0.28,boxShadow:canDeclare?"0 0 22px rgba(185,28,28,0.7),0 0 40px rgba(185,28,28,0.3)":"none",animation:canDeclare?"borderGlow 1.5s ease-in-out infinite":"none"}}
                onClick={canDeclare?doDeclare:function(){audio.buttonClick();haptic.error();pop("Need total 30 or under (yours: "+myTotal+")","error");}}>
                DECLARE
              </button>
            )}
            {isMyTurn&&phase==="pickup"&&!showYourTurn&&(
              <button className="btn_btn_ghost" style={{padding:"12px 18px",fontSize:12,letterSpacing:1,minHeight:48,border:"1.5px solid rgba(255,255,255,0.15)",color:"#9ca3af"}} onClick={pickFromDeck}>DRAW</button>
            )}
            <div id="tut-total" style={{fontFamily:"Cinzel,serif",fontSize:18,fontWeight:900,lineHeight:1,color:myTotal<=15?"#4ade80":myTotal<=DECLARE_MAX?"#d4a843":myTotal>=60?"#f87171":"#fbbf24",padding:"5px 11px",borderRadius:9,transition:"all 0.3s",background:myTotal<=DECLARE_MAX?"rgba(74,222,128,0.08)":"rgba(185,28,28,0.12)",border:"1.5px solid "+(myTotal<=DECLARE_MAX?"rgba(74,222,128,0.25)":"rgba(185,28,28,0.3)"),display:"flex",alignItems:"center",gap:4}}>
              {myTotal}
              {prevTotal!==null&&prevTotal!==myTotal&&(
                <span style={{fontSize:10,color:myTotal<prevTotal?"#4ade80":"#f87171",animation:"fadeIn 0.3s ease"}}>{myTotal<prevTotal?"↓":"↑"}</span>
              )}
            </div>
          </div>
        </div>
        <div id="tut-hand" style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:3,paddingTop:2,justifyContent:myHand.length<=6?"center":"flex-start",alignItems:"flex-end",minHeight:108}}>
          {myHand.map(function(card,idx){
            var isPlaying=playingCardIds.includes(card.id);
            return(
              <div key={card.id} style={{animation:isPlaying?"cardPlay 0.28s cubic-bezier(.4,0,.6,1) forwards":dealAnim?"cardFlip 0.35s cubic-bezier(.22,1,.36,1) both":"none",animationDelay:dealAnim?(idx*0.06)+"s":"0s",display:"inline-block"}}>
                <Card card={card}
                  selected={!!sel.find(function(c){return c.id===card.id;})}
                  clickable={isMyTurn&&(phase==="play"||phase==="declare")&&!playingCardIds.length}
                  onClick={function(){if(isMyTurn&&(phase==="play"||phase==="declare")&&!playingCardIds.length)toggleSel(card);}}
                  size="lg"/>
              </div>
            );
          })}
        </div>
      </div>
      )}
      {/* Elimination overlay */}
      {elimAnim&&(
        <div style={{position:"fixed",inset:0,zIndex:600,background:"radial-gradient(ellipse at center,rgba(60,0,0,0.97) 0%,rgba(0,0,0,0.99) 70%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"elimFadeIn 0.3s ease"}}>
          <div style={{animation:"elimBounce 0.6s ease-in-out infinite",fontSize:90,marginBottom:24}}>💀</div>
          <h1 style={{fontFamily:"Cinzel,serif",fontSize:28,fontWeight:900,letterSpacing:4,background:"linear-gradient(135deg,#ef4444,#991b1b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",textAlign:"center",animation:"shake 0.4s ease-in-out infinite",padding:"0 24px"}}>{elimAnim.name.toUpperCase()} ELIMINATED</h1>
          <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"rgba(248,113,113,0.7)",fontSize:18,marginTop:14}}>Reached 100 points</p>
        </div>
      )}
      {/* CHAT DRAWER */}
      {mode==="online"&&(
        <>
          {chatOpen&&<div onClick={function(){setChatOpen(false);}} style={{position:"fixed",inset:0,zIndex:178,background:"rgba(0,0,0,0.45)"}}/>}
          <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:180,height:"55%",background:"linear-gradient(180deg,rgba(2,10,4,0.98),rgba(1,6,2,0.99))",borderTop:"1px solid rgba(212,168,67,0.2)",borderRadius:"20px 20px 0 0",transform:chatOpen?"translateY(0)":"translateY(100%)",transition:"transform 0.35s cubic-bezier(.22,1.4,.36,1)",display:"flex",flexDirection:"column",paddingBottom:"env(safe-area-inset-bottom)"}}>
            <div style={{padding:"14px 18px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(212,168,67,0.1)",flexShrink:0}}>
              <span style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#d4a843",letterSpacing:4}}>CHAT</span>
              <button onClick={function(){setChatOpen(false);}} style={{width:28,height:28,borderRadius:7,border:"1px solid rgba(212,168,67,0.2)",background:"rgba(212,168,67,0.06)",color:"#d4a843",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>✕</button>
            </div>
            <div ref={chatScrollRef} style={{flex:1,overflowY:"auto",padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
              {chatMessages.length===0&&<div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#3a5a3a",fontSize:14,textAlign:"center",marginTop:20}}>No messages yet. Say hello!</div>}
              {chatMessages.map(function(m){return(
                <div key={m.id} style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <span style={{fontSize:18,flexShrink:0}}>{m.avatar}</span>
                  <div>
                    <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:1,marginRight:6}}>{m.player}</span>
                    <span style={{fontFamily:"Crimson Text,serif",fontSize:15,color:"#86efac",lineHeight:1.4}}>{m.text}</span>
                  </div>
                </div>
              );})}
            </div>
            <div style={{display:"flex",gap:8,padding:"8px 14px 10px",flexShrink:0,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
              <input value={chatInput} onChange={function(e){setChatInput(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&chatInput.trim()&&chatChannelRef.current){var msg={id:Date.now(),player:myName,avatar:myAvatar||"😎",text:chatInput.trim(),ts:Date.now()};try{chatChannelRef.current.send({type:"broadcast",event:"chat",payload:msg});}catch(err){}setChatMessages(function(p){return[...p.slice(-49),msg];});setChatInput("");}}} placeholder="Type a message..." style={{flex:1,minHeight:40,padding:"8px 12px",fontSize:14}}/>
              <button className="btn_btn_gold" style={{padding:"8px 16px",fontSize:10,letterSpacing:2,minHeight:40,flexShrink:0}} onClick={function(){if(!chatInput.trim()||!chatChannelRef.current)return;var msg={id:Date.now(),player:myName,avatar:myAvatar||"😎",text:chatInput.trim(),ts:Date.now()};try{chatChannelRef.current.send({type:"broadcast",event:"chat",payload:msg});}catch(err){}setChatMessages(function(p){return[...p.slice(-49),msg];});setChatInput("");}}>SEND</button>
            </div>
          </div>
        </>
      )}
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);setShowRules(true);}}/>
      {tutorialStep>=0&&(
        <TutorialCoach
          stepIdx={tutorialStep}
          sel={sel}
          phase={phase}
          currentPlayer={currentPlayer}
          onNext={function(){
            var n=tutorialStep+1;
            if(n>=COACH_STEPS.length){setTutorialStep(-1);setTutorialDone(true);try{localStorage.setItem("cobra_tutorial_done","1");}catch(e){}}
            else setTutorialStep(n);
          }}
          onSkip={function(){setTutorialStep(-1);setTutorialDone(true);try{localStorage.setItem("cobra_tutorial_done","1");}catch(e){}}}
        />
      )}
    </div>
  );
}
