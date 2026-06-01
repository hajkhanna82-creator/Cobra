import { useState, useRef, useEffect, useCallback } from "react";
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
@keyframes confettiFall{0%{opacity:1;transform:translateY(-20px) rotate(0deg) scale(1)}100%{opacity:0;transform:translateY(200px) rotate(720deg) scale(0.3)}}
@keyframes scoreFlash{0%{transform:scale(1)}40%{transform:scale(1.4)}100%{transform:scale(1)}}
@keyframes borderGlow{0%,100%{box-shadow:0 0 8px rgba(185,28,28,0.3)}50%{box-shadow:0 0 28px rgba(185,28,28,0.8),0 0 50px rgba(185,28,28,0.4)}}
@keyframes cobraShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes shake{0%,100%{transform:translateX(0)}10%{transform:translateX(-8px)}20%{transform:translateX(8px)}30%{transform:translateX(-6px)}40%{transform:translateX(6px)}50%{transform:translateX(-4px)}60%{transform:translateX(4px)}70%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
@keyframes elimBounce{0%,100%{transform:scale(1) translateY(0)}30%{transform:scale(1.3) translateY(-20px)}60%{transform:scale(0.9) translateY(-8px)}}
@keyframes elimFadeIn{from{opacity:0}to{opacity:1}}
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
`;

function Card({card,selected,onClick,size,faceDown,clickable,dimmed,glow,dealIdx}){
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
  if(faceDown)return(
    <div onClick={clickable?click:undefined} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{width:base.width,height:base.height,borderRadius:base.borderRadius,flexShrink:0,position:"relative",
        cursor:base.cursor,transform:base.transform,transition:base.transition,opacity:base.opacity,
        userSelect:"none",overflow:"hidden",animationDelay:base.animationDelay,
        WebkitTapHighlightColor:"transparent",touchAction:"manipulation",
        background:"linear-gradient(148deg,#091609,#040c04,#071007)",
        border:glow?"2px solid #4ade80":selected?"2px solid #d4a843":"1.5px solid rgba(20,60,20,0.9)",
        boxShadow:glow?"0 0 20px rgba(74,222,128,0.5),0 8px 24px rgba(0,0,0,0.8)":selected?"0 0 20px rgba(212,168,67,0.55),0 10px 28px rgba(0,0,0,0.8)":"0 5px 18px rgba(0,0,0,0.72)"}}>
      <div style={{position:"absolute",top:3,left:3,right:3,bottom:3,borderRadius:d.r-2,border:"1px solid rgba(212,168,67,0.2)"}}/>
      <div style={{position:"absolute",top:5,left:5,right:5,bottom:5,borderRadius:d.r-3,overflow:"hidden",backgroundImage:"repeating-linear-gradient(45deg,rgba(212,168,67,0.065)0,rgba(212,168,67,0.065)1px,transparent 1px,transparent 7px),repeating-linear-gradient(-45deg,rgba(212,168,67,0.05)0,rgba(212,168,67,0.05)1px,transparent 1px,transparent 7px)"}}/>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:d.su*0.72,opacity:0.15}}>🐍</div>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(255,255,255,0.06)0%,transparent 45%,rgba(0,0,0,0.15)100%)",borderRadius:d.r}}/>
    </div>
  );
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

function ScoreStrip({names,scores,currentPlayer,nPlayers,flashScores,avatars}){
  flashScores=flashScores||[];avatars=avatars||[];
  return(
    <div style={{display:"flex",gap:5,justifyContent:"center",flexWrap:"wrap"}}>
      {names.slice(0,nPlayers).map(function(n,i){
        const s=scores[i]||0,active=i===currentPlayer,danger=s>=80,warn=s>=50,out=s>=LOSE;
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

function SettingsPanel({open,onClose,sfxMuted,musicMuted,onToggleSfx,onToggleMusic,onHowToPlay,gameStats}){
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

          {/* STATISTICS */}
          <div style={{paddingTop:18}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#3a6a3a",letterSpacing:4,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>📊</span> STATISTICS
            </div>
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
  const [myName,setMyName]=useState("Player");
  const [onlinePlayers,setOnlinePlayers]=useState([]);
  const [isHost,setIsHost]=useState(false);
  const [onlineStatus,setOnlineStatus]=useState("");
  const [cpuThinking,setCpuThinking]=useState(false);
  const [sfxMuted,setSfxMuted]=useState(function(){try{return localStorage.getItem("cobra_sfx_muted")==="1";}catch(e){return false;}});
  const [musicMuted,setMusicMuted]=useState(function(){try{return localStorage.getItem("cobra_mus_muted")==="1";}catch(e){return false;}});
  const [showSettings,setShowSettings]=useState(false);
  const [showTutorial,setShowTutorial]=useState(false);
  const [tutorialDone,setTutorialDone]=useState(false);
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
  const [myAvatar,setMyAvatar]=useState("😎");
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installDismissed,setInstallDismissed]=useState(function(){try{return localStorage.getItem("cobra_install_dismissed")==="1";}catch(e){return false;}});
  const [showQR,setShowQR]=useState(false);
  const [qrDataUrl,setQrDataUrl]=useState("");
  const [elimAnim,setElimAnim]=useState(null); // {name, idx}
  const prevPlayersCount=useRef(0);

  const toastT=useRef(null);
  const pollRef=useRef(null); // kept for legacy; unused when Supabase is active
  const timerRef=useRef(null);
  const audioInit=useRef(false);
  const yourTurnTimer=useRef(null);
  const phaseRef=useRef(phase);
  const handsRef=useRef(hands);
  useEffect(function(){phaseRef.current=phase;},[phase]);
  useEffect(function(){handsRef.current=hands;},[hands]);
  const H=myIdx;

  // ── Supabase Realtime ────────────────────────────────
  const onRoomUpdate=useCallback(function(room){
    if(!room)return;
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
      setMyPlayed(gs.myPlayed||[]);setCurrentPlayer(gs.currentPlayer);
      setPhase(gs.phase);setScores(gs.scores);
      setNames(room.players.map(function(p){return p.name;}));
      setNPlayers(room.players.length);
      setScreen("game");
    }
  },[]);

  const {subscribe:rtSubscribe,broadcast:rtBroadcast,unsubscribe:rtUnsubscribe}=useRoom({onRoomUpdate});

  // PWA install prompt listener
  useEffect(function(){
    function handleInstall(e){e.preventDefault();setInstallPrompt(e);}
    window.addEventListener("beforeinstallprompt",handleInstall);
    return function(){window.removeEventListener("beforeinstallprompt",handleInstall);};
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
    if(s==="home")rtUnsubscribe();
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
        if(curPhase==="play"){
          var hand=curHands[H];
          if(hand&&hand.length){
            var highest=[...hand].sort(function(a,b){return cv(b)-cv(a);})[0];
            var nh=[...curHands];nh[H]=hand.filter(function(c){return c.id!==highest.id;});
            setHands(nh);setMyPlayed([highest]);setSel([]);setPhase("pickup");
            pop("Time up! Auto-played "+highest.value+highest.suit,"warning");
          }
        } else if(curPhase==="declare"){
          setPhase("play");pop("Time up! Play a card","warning");
        }
      }
    },1000);
    return function(){clearInterval(timerRef.current);};
  },[currentPlayer,screen,timerOn,H]);

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
    yourTurnTimer.current=setTimeout(function(){setShowYourTurn(false);},2200);
    audio.init();audio.resume();
    setTimeout(function(){audio.shuffle_sfx();},100);
  }

  function startCPU(){
    var n=1+cpuCount,ns=names.slice(0,n),s=Array(n).fill(0);
    setMode("cpu");setNPlayers(n);setNames(ns);setMyIdx(0);
    deal(s,n);goScreen("game");
    if(!tutorialDone)setShowTutorial(true);
  }

  function createRoom(){
    var code=Math.random().toString(36).slice(2,6).toUpperCase();
    setRoomCode(code);setIsHost(true);setMyIdx(0);
    var room={code:code,host:myName,players:[{name:myName,idx:0}],maxPlayers:4,status:"lobby",gameState:null,ts:Date.now()};
    saveRoom(code,room).then(function(){
      setMode("online");
      startLobbyPoll(code); // subscribe first so we hear our own broadcast
      rtBroadcast(room);
      setOnlinePlayers([myName]);goScreen("lobby");
      pop("Room "+code+" created!","success");
      audio.init();audio.resume();audio.win();
    });
  }

  function joinRoom(){
    var code=roomInput.trim().toUpperCase();
    if(!code){pop("Enter a room code","error");return;}
    loadRoom(code).then(function(room){
      if(!room){pop("Room not found","error");return;}
      if(room.players.length>=room.maxPlayers){pop("Room is full","error");return;}
      if(room.status!=="lobby"){pop("Game already started","error");return;}
      var idx=room.players.length;
      room.players.push({name:myName,idx:idx});
      saveRoom(code,room).then(function(){
        setMode("online");
        setRoomCode(code);setIsHost(false);setMyIdx(idx);
        setOnlinePlayers(room.players.map(function(p){return p.name;}));
        startLobbyPoll(code);
        rtBroadcast(room); // tell host + others a new player joined
        goScreen("lobby");pop("Joined!","success");
      });
    });
  }

  function startLobbyPoll(code){
    // Subscribe to Realtime channel for instant updates
    rtSubscribe(code);
    // Also load current DB state immediately (handles late-joiners / refresh)
    loadRoom(code).then(function(room){if(room)onRoomUpdate(room);});
  }

  function startOnlineGame(){
    loadRoom(roomCode).then(function(room){
      if(!room)return;
      var n=room.players.length,d=shuffle(mkDeck()),h=[];
      for(var i=0;i<n;i++)h.push(d.splice(0,7));
      var gs={hands:h,deck:d,openPile:{cards:[],owner:-1},myPlayed:[],currentPlayer:0,phase:"declare",scores:Array(n).fill(0)};
      room.status="started";room.gameState=gs;
      saveRoom(roomCode,room).then(function(){
        rtBroadcast(room); // push to all players simultaneously
        setNames(room.players.map(function(p){return p.name;}));setNPlayers(n);
        setHands(h);setDeck(d);setOpenPile({cards:[],owner:-1});setMyPlayed([]);
        setCurrentPlayer(0);setPhase("declare");setSel([]);setScores(Array(n).fill(0));
        goScreen("game");
      });
    });
  }

  function joinGlobal(){
    audio.init();audio.resume();haptic.light();
    if(!myName.trim()){pop("Enter your name first","warning");return;}
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
    audio.turnChange();
    if(mode==="cpu"){runCPURound(1,nh,nd,np);}
    else{var next=(currentPlayer+1)%nPlayers;setCurrentPlayer(next);setPhase("declare");
      if(next===H){setShowYourTurn(true);clearTimeout(yourTurnTimer.current);yourTurnTimer.current=setTimeout(function(){setShowYourTurn(false);},2200);}}
  }

  function runCPURound(startIdx,initHands,initDeck,initPile){
    var ch=[...initHands],cd=[...initDeck],cp={...initPile},idx=startIdx;
    function step(){
      if(idx>=nPlayers){
        setCpuThinking(false);setCurrentPlayer(0);setPhase("declare");
        setShowYourTurn(true);clearTimeout(yourTurnTimer.current);
        yourTurnTimer.current=setTimeout(function(){setShowYourTurn(false);},2200);
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
    setRevealData({ns:ns,res:res,declarerIdx:H,hands:hands.map(function(h){return h.slice();})});
    setScreen("reveal");
  }

  function finishRound(ns,res){
    var loser=ns.findIndex(function(s){return s>=LOSE;});
    var resWithScores=res.map(function(r,i){return Object.assign({},r,{newScore:ns[i]});});
    var ned={results:resWithScores,scores:ns,nPlayers:nPlayers,names:names.slice(0,nPlayers)};
    setFlashScores(ns.map(function(s,i){return s!==(scores[i]||0);}));
    setTimeout(function(){setFlashScores([]);},1200);
    setRoundEndData(ned);setScores(ns);setRoundRes(resWithScores);
    setHands([]);setDeck([]);setMyPlayed([]);setSel([]);setOpenPile({cards:[],owner:-1});setPrevHand(null);
    if(loser>=0){
      var winner=ns.indexOf(Math.min.apply(null,ns));
      setGameOverData({scores:ns,winner:winner,loser:loser});
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
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
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
        <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#2a4a2e",fontSize:15,letterSpacing:4,marginTop:4,marginBottom:10}}>the card game</p>
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
          <button className="btn_btn_ghost" style={{flex:1,padding:"14px",fontSize:11,letterSpacing:2}} onClick={function(){setTutorialDone(false);goScreen("setupCPU");}}>🎓 TUTORIAL</button>
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
            {installPrompt?"Add COBRA to your home screen":"/iphone|ipad|ipod/i".test(navigator.userAgent)?"Tap Share → Add to Home Screen":"Add COBRA to your home screen"}
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
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
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
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
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
                <button key={em} onClick={function(){audio.buttonClick();setMyAvatar(em);}} style={{fontSize:24,width:44,height:44,borderRadius:10,border:myAvatar===em?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.1)",background:myAvatar===em?"rgba(212,168,67,0.18)":"rgba(255,255,255,0.05)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",transition:"all 0.2s"}}>{em}</button>
              );})}
            </div>
            <SLabel>YOUR NAME</SLabel>
            <input defaultValue={names[0]} onChange={function(e){ln[0]=e.target.value;}} style={{marginBottom:16}} placeholder="Your name"/>
            <SLabel>CPU NAMES</SLabel>
            {Array(cpuCount).fill(0).map(function(_,i){return(
              <input key={i} defaultValue={"CPU "+(i+1)} onChange={function(e){ln[i+1]=e.target.value;}} style={{marginBottom:8}} placeholder={"CPU "+(i+1)}/>
            );})}
            <button className="btn_btn_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:3,marginTop:14}} onClick={function(){audio.buttonClick();haptic.medium();setNames(ln);startCPU();}}>DEAL CARDS</button>
          </div>
        </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
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
              <button key={em} onClick={function(){audio.buttonClick();setMyAvatar(em);}} style={{fontSize:24,width:44,height:44,borderRadius:10,border:myAvatar===em?"2px solid #60a5fa":"1.5px solid rgba(255,255,255,0.1)",background:myAvatar===em?"rgba(96,165,250,0.18)":"rgba(255,255,255,0.05)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",transition:"all 0.2s"}}>{em}</button>
            );})}
          </div>
          <SLabel>YOUR NAME</SLabel>
          <input value={myName} onChange={function(e){setMyName(e.target.value);}} style={{marginBottom:20}} placeholder="Your name"/>
          <button className="btn_btn_blue" style={{width:"100%",padding:16,fontSize:13,letterSpacing:2.5,marginBottom:14}} onClick={function(){audio.buttonClick();haptic.medium();createRoom();}}>CREATE ROOM</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,0.07)"}}/>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#1a3020",letterSpacing:3}}>OR JOIN</span>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,0.07)"}}/>
          </div>
          <input value={roomInput} onChange={function(e){setRoomInput(e.target.value.toUpperCase());}} style={{marginBottom:12,letterSpacing:6,textAlign:"center",fontSize:24,fontFamily:"Cinzel,serif"}} placeholder="ROOM CODE" maxLength={4}/>
          <button className="btn_btn_outline_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:2.5}} onClick={function(){audio.buttonClick();joinRoom();}}>JOIN ROOM</button>
        </div>
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
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
              <button key={em} onClick={function(){audio.buttonClick();setMyAvatar(em);}} style={{fontSize:24,width:44,height:44,borderRadius:10,border:myAvatar===em?"2px solid #4ade80":"1.5px solid rgba(255,255,255,0.1)",background:myAvatar===em?"rgba(74,222,128,0.18)":"rgba(255,255,255,0.05)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",transition:"all 0.2s"}}>{em}</button>
            );})}
          </div>
          <SLabel>YOUR NAME</SLabel>
          <input value={myName} onChange={function(e){setMyName(e.target.value);}} style={{marginBottom:20}} placeholder="Enter your name"/>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:12,marginBottom:20}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 8px #4ade80",flexShrink:0}} className="pulse"/>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#2a5a3a",letterSpacing:2}}>GLOBAL MATCHMAKING ACTIVE</span>
          </div>
          <button className="btn_btn_green" style={{width:"100%",padding:16,fontSize:14,letterSpacing:2.5}} onClick={joinGlobal}>PLAY NOW</button>
        </div>
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );

  // ─── LOBBY ───────────────────────────────────────────
  if(screen==="lobby")return(
    <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{maxWidth:420,width:"100%",textAlign:"center",position:"relative",zIndex:1}} className="anim_up">
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
        {isHost
          ?<button className="btn_btn_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:3}} disabled={onlinePlayers.length<2} onClick={function(){audio.buttonClick();startOnlineGame();}}>
            {onlinePlayers.length<2?"WAITING...":"START GAME"}
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
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
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
              var loser=ns.findIndex(function(s){return s>=LOSE;});
              var resWS=res.map(function(r,i){return Object.assign({},r,{newScore:ns[i]});});
              var ned={results:resWS,scores:ns,nPlayers:nPlayers,names:names.slice(0,nPlayers)};
              setFlashScores(ns.map(function(s,i){return s!==(scores[i]||0);}));
              setTimeout(function(){setFlashScores([]);},1200);
              setRoundEndData(ned);setScores(ns);setRoundRes(resWS);
              setHands([]);setDeck([]);setMyPlayed([]);setSel([]);setOpenPile({cards:[],owner:-1});
              setRevealData(null);
              if(loser>=0){var winner=ns.indexOf(Math.min.apply(null,ns));setGameOverData({scores:ns,winner:winner,loser:loser});setScreen("gameOver");}
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
            <p style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#4a6a4a",letterSpacing:2,marginBottom:12,textAlign:"center"}}>STANDINGS — FIRST TO 100 IS OUT</p>
            {redResults.map(function(r,i){
              var ns=r.newScore||0;
              return(
                <div key={i} style={{marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:ns>=80?"#f87171":ns>=50?"#fbbf24":r.winner?"#d4a843":"#7a9d78",width:56,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span>
                  <div style={{flex:1,height:10,background:"rgba(255,255,255,0.06)",borderRadius:5,overflow:"hidden"}}>
                    <div style={{height:"100%",width:Math.min(ns,100)+"%",borderRadius:5,transition:"width 0.8s cubic-bezier(.22,1,.36,1)",background:ns>=80?"linear-gradient(90deg,#991b1b,#ef4444)":ns>=50?"linear-gradient(90deg,#92400e,#f59e0b)":r.winner?"linear-gradient(90deg,#a07820,#d4a843)":"linear-gradient(90deg,#14532d,#16a34a)"}}/>
                  </div>
                  <span style={{fontFamily:"Cinzel,serif",fontSize:11,fontWeight:700,width:38,textAlign:"right",color:ns>=80?"#f87171":ns>=50?"#fbbf24":"#7a9d78"}}>{ns}/100</span>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button className="btn_btn_gold" style={{flex:2,padding:17,fontSize:13,letterSpacing:2}}
              onClick={function(){audio.init();audio.resume();audio.buttonClick();haptic.medium();audio.shuffle_sfx();var ns=redResults.map(function(r){return r.newScore||0;});deal(ns,red.nPlayers||nPlayers);setScreen("game");}}>
              🃏 NEXT ROUND
            </button>
            <button className="btn_btn_ghost" style={{flex:1,padding:17,fontSize:12,letterSpacing:1.5,border:"1px solid rgba(255,255,255,0.12)"}}
              onClick={function(){audio.buttonClick();setRoundEndData(null);setScores([]);setScreen("home");}}>
              🏠 HOME
            </button>
          </div>
        </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
      </div>
    );
  }

  // ─── GAME OVER ──────────────────────────────────────
  if(screen==="gameOver"){
    if(!gameOverData)return(<div className="feltbg"><style>{GS}</style></div>);
    return(
      <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
        <style>{GS}</style>
        <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
        <div style={{maxWidth:420,width:"100%",textAlign:"center",position:"relative",zIndex:1}} className="anim_up">
          <div style={{fontSize:70,marginBottom:8,animation:"cobraBounce 1.2s ease-in-out 3"}}>👑</div>
          <h1 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:32,letterSpacing:7,margin:"0 0 4px",textShadow:"0 0 30px rgba(212,168,67,0.5)"}}>WINNER</h1>
          <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#4a7a4a",fontSize:22,marginBottom:6}}>{names[gameOverData.winner]}</p>
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
            <button className="btn_btn_gold" style={{flex:2,padding:16,fontSize:13,letterSpacing:2}}
              onClick={function(){
                audio.init();audio.resume();audio.buttonClick();haptic.medium();audio.shuffle_sfx();
                setGameOverData(null);
                if(mode==="cpu"){startCPU();}
                else if(mode==="online"&&isHost){startOnlineGame();}
                else{deal(Array(nPlayers).fill(0),nPlayers);setScreen("game");}
              }}>
              🔄 REMATCH
            </button>
            <button className="btn_btn_ghost" style={{flex:1,padding:16,fontSize:12,letterSpacing:1.5}}
              onClick={function(){audio.buttonClick();setScores([]);goScreen("home");}}>
              🏠 HOME
            </button>
          </div>
        </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
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
      {showTutorial&&<Tutorial onDone={function(){setShowTutorial(false);setTutorialDone(true);}}/>}
      {earnedAch&&<AchievementBadge ach={earnedAch} onDone={function(){setEarnedAch(null);}}/>}
      {emojis.map(function(e){return(<EmojiFloat key={e.id} emoji={e.emoji} x={e.x} y={e.y}/>);})}
      {confetti.map(function(c){return(
        <div key={c.id} style={{position:"fixed",left:c.x+"%",top:"-10px",width:c.size,height:c.size*1.4,borderRadius:2,background:c.color,zIndex:300,pointerEvents:"none",animation:"confettiFall "+c.dur+"s "+c.delay+"s ease-in forwards"}}/>
      );})}
      {/* YOUR TURN splash */}
      {showYourTurn&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:150,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeOut 2.2s ease forwards"}}>
          <div style={{background:"rgba(212,168,67,0.92)",borderRadius:30,padding:"14px 32px",boxShadow:"0 4px 24px rgba(0,0,0,0.35)",whiteSpace:"nowrap",animation:"fadeOut 2.2s ease forwards"}}>
            <span style={{fontFamily:"Cinzel,serif",fontSize:16,fontWeight:900,color:"#120c00",letterSpacing:3}}>YOUR TURN</span>
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
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#3a5a3a",letterSpacing:1,padding:"2px 8px",background:"rgba(255,255,255,0.04)",borderRadius:8}}>R{roundNum}</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#16a34a",boxShadow:"0 0 6px #16a34a"}}/>
                <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#5a7a60",letterSpacing:2}}>{deck.length}</span>
              </div>
            </div>
          </div>
        </div>
        <ScoreStrip names={names} scores={scores} currentPlayer={currentPlayer} nPlayers={nPlayers} flashScores={flashScores} avatars={Array.from({length:nPlayers},function(_,i){return i===H?myAvatar:null;})}/>
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
                      <Card card={{suit:"♠",value:"A"}} faceDown size="sm"/>
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
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,flexShrink:0,width:70}}>
          <span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#5a7a60",letterSpacing:2}}>DECK</span>
          <div style={{position:"relative",height:92,width:64,cursor:isMyTurn&&phase==="pickup"?"pointer":"default",filter:isMyTurn&&phase==="pickup"?"drop-shadow(0 0 14px rgba(74,222,128,0.45))":"none",transition:"filter 0.3s"}}
            onClick={isMyTurn&&phase==="pickup"?pickFromDeck:undefined}
            onTouchStart={function(e){if(isMyTurn&&phase==="pickup")e.currentTarget._ty=e.touches[0].clientY;}}
            onTouchEnd={function(e){if(isMyTurn&&phase==="pickup"&&e.currentTarget._ty-e.changedTouches[0].clientY>30)pickFromDeck();}}>
            {deck.length>0?[2,1,0].map(function(o){return(
              <div key={o} style={{position:o===0?"relative":"absolute",top:o===0?0:-o*3,left:o===0?0:o,zIndex:3-o}}>
                <Card card={{suit:"♠",value:"A"}} faceDown glow={o===0&&isMyTurn&&phase==="pickup"} size="md"/>
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
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:7,minWidth:0}}>
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

      {/* MY HAND */}
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
          <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
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
            <div style={{fontFamily:"Cinzel,serif",fontSize:18,fontWeight:900,lineHeight:1,color:myTotal<=15?"#4ade80":myTotal<=DECLARE_MAX?"#d4a843":myTotal>=60?"#f87171":"#fbbf24",padding:"5px 11px",borderRadius:9,transition:"all 0.3s",background:myTotal<=DECLARE_MAX?"rgba(74,222,128,0.08)":"rgba(185,28,28,0.12)",border:"1.5px solid "+(myTotal<=DECLARE_MAX?"rgba(74,222,128,0.25)":"rgba(185,28,28,0.3)"),display:"flex",alignItems:"center",gap:4}}>
              {myTotal}
              {prevTotal!==null&&prevTotal!==myTotal&&(
                <span style={{fontSize:10,color:myTotal<prevTotal?"#4ade80":"#f87171",animation:"fadeIn 0.3s ease"}}>{myTotal<prevTotal?"↓":"↑"}</span>
              )}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:3,paddingTop:2,justifyContent:myHand.length<=6?"center":"flex-start",alignItems:"flex-end",minHeight:108}}>
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
      {/* Elimination overlay */}
      {elimAnim&&(
        <div style={{position:"fixed",inset:0,zIndex:600,background:"radial-gradient(ellipse at center,rgba(60,0,0,0.97) 0%,rgba(0,0,0,0.99) 70%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"elimFadeIn 0.3s ease"}}>
          <div style={{animation:"elimBounce 0.6s ease-in-out infinite",fontSize:90,marginBottom:24}}>💀</div>
          <h1 style={{fontFamily:"Cinzel,serif",fontSize:28,fontWeight:900,letterSpacing:4,background:"linear-gradient(135deg,#ef4444,#991b1b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",textAlign:"center",animation:"shake 0.4s ease-in-out infinite",padding:"0 24px"}}>{elimAnim.name.toUpperCase()} ELIMINATED</h1>
          <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"rgba(248,113,113,0.7)",fontSize:18,marginTop:14}}>Reached 100 points</p>
        </div>
      )}
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} onHowToPlay={function(){setShowSettings(false);setShowRules(true);}}/>
    </div>
  );
}
