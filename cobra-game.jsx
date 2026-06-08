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
  // Gameplay wins
  {id:"first_win",icon:"🏆",name:"First Victory",desc:"Win your first game",cat:"gameplay",goal:1,stat:"wins",reward:{coins:200,gems:0},title:"Rookie"},
  {id:"win_10",icon:"🥇",name:"Ten Down",desc:"Win 10 games",cat:"gameplay",goal:10,stat:"wins",reward:{coins:500,gems:2},title:"Challenger"},
  {id:"win_50",icon:"🎖️",name:"Half Century",desc:"Win 50 games",cat:"gameplay",goal:50,stat:"wins",reward:{coins:1500,gems:8},title:"Card Shark"},
  {id:"win_100",icon:"👑",name:"Century Club",desc:"Win 100 games",cat:"gameplay",goal:100,stat:"wins",reward:{coins:5000,gems:25},title:"Cobra Master"},
  // Rounds
  {id:"play_10",icon:"🃏",name:"Getting Started",desc:"Play 10 rounds",cat:"gameplay",goal:10,stat:"rounds",reward:{coins:150,gems:0},title:null},
  {id:"play_50",icon:"🎴",name:"Dedicated",desc:"Play 50 rounds",cat:"gameplay",goal:50,stat:"rounds",reward:{coins:400,gems:2},title:null},
  {id:"play_200",icon:"🂠",name:"True Serpent",desc:"Play 200 rounds",cat:"gameplay",goal:200,stat:"rounds",reward:{coins:1200,gems:5},title:"Lucky Legend"},
  // Cobras
  {id:"cobra_1",icon:"🐍",name:"First Bite",desc:"Survive a cobra penalty",cat:"gameplay",goal:1,stat:"cobras",reward:{coins:100,gems:0},title:null},
  {id:"cobra_10",icon:"🐍",name:"Snake Charmer",desc:"Survive 10 cobra penalties",cat:"gameplay",goal:10,stat:"cobras",reward:{coins:300,gems:1},title:null},
  // Streaks
  {id:"streak_3",icon:"🔥",name:"On Fire",desc:"Win 3 in a row",cat:"streak",goal:3,stat:"bestStreak",reward:{coins:250,gems:1},title:null},
  {id:"streak_5",icon:"⚡",name:"Unstoppable",desc:"Win 5 in a row",cat:"streak",goal:5,stat:"bestStreak",reward:{coins:600,gems:3},title:null},
  {id:"streak_10",icon:"💫",name:"Legendary Streak",desc:"Win 10 in a row",cat:"streak",goal:10,stat:"bestStreak",reward:{coins:2000,gems:10},title:"Grand Champion"},
  // Progression
  {id:"level_5",icon:"⭐",name:"Rising Star",desc:"Reach Level 5",cat:"progression",goal:5,stat:"level",reward:{coins:300,gems:2},title:"Rookie"},
  {id:"level_10",icon:"🌟",name:"Veteran",desc:"Reach Level 10",cat:"progression",goal:10,stat:"level",reward:{coins:800,gems:5},title:null},
  {id:"level_25",icon:"💎",name:"Elite",desc:"Reach Level 25",cat:"progression",goal:25,stat:"level",reward:{coins:2500,gems:15},title:null},
  // Special
  {id:"low_score",icon:"💎",name:"Diamond Hand",desc:"Declare with total 5 or under",cat:"gameplay",goal:1,stat:"lowScore",reward:{coins:400,gems:3},title:null},
  {id:"speed_win",icon:"⚡",name:"Lightning",desc:"Win a round in under 10 seconds",cat:"gameplay",goal:1,stat:"speedWin",reward:{coins:350,gems:2},title:null},
  {id:"big_run",icon:"🃏",name:"Full House",desc:"Play a run of 5+ cards",cat:"gameplay",goal:1,stat:"bigRun",reward:{coins:200,gems:1},title:null},
  {id:"daily_7",icon:"📅",name:"Faithful",desc:"Claim daily reward 7 times",cat:"rewards",goal:7,stat:"dailyClaims",reward:{coins:500,gems:5},title:null},
  {id:"spin_10",icon:"🎡",name:"Spin Doctor",desc:"Use lucky spin 10 times",cat:"rewards",goal:10,stat:"spinCount",reward:{coins:400,gems:3},title:null},
  // New achievements (feature 10)
  {id:"streak5",name:"On Fire",desc:"Win 5 in a row",icon:"🔥",cat:"streak",goal:5,stat:"bestStreak",xp:200,reward:{coins:150,gems:0},condition:"streak",target:5},
  {id:"streak10",name:"Unstoppable",desc:"Win 10 in a row",icon:"⚡",cat:"streak",goal:10,stat:"bestStreak",xp:500,reward:{coins:400,gems:0},condition:"streak",target:10},
  {id:"prestige1",name:"Reborn",desc:"Reach Prestige 1",icon:"⭐",cat:"progression",goal:1,stat:"prestige",xp:1000,reward:{coins:1000,gems:0},condition:"prestige",target:1},
  {id:"elo1200",name:"Rising Serpent",desc:"Reach 1200 ELO",icon:"📈",cat:"progression",goal:1200,stat:"elo",xp:300,reward:{coins:200,gems:0},condition:"elo",target:1200},
  {id:"elo1500",name:"Elite Snake",desc:"Reach 1500 ELO",icon:"💎",cat:"progression",goal:1500,stat:"elo",xp:600,reward:{coins:500,gems:0},condition:"elo",target:1500},
  {id:"lowscore",name:"Perfect Hand",desc:"Win a round with score 0",icon:"🎯",cat:"gameplay",goal:1,stat:"lowScore",xp:250,reward:{coins:200,gems:0},condition:"lowscore",target:0},
  {id:"cobra10",name:"Venom Master",desc:"Get 10 cobra hits",icon:"🐍",cat:"gameplay",goal:10,stat:"cobras",xp:300,reward:{coins:250,gems:0},condition:"cobras",target:10},
  {id:"coins5000",name:"Coin Hoarder",desc:"Collect 5000 coins total",icon:"🪙",cat:"rewards",goal:5000,stat:"coins",xp:200,reward:{coins:0,gems:0},condition:"coins",target:5000},
  {id:"clan1",name:"Pack Animal",desc:"Join a clan",icon:"🏰",cat:"social",goal:1,stat:"clan",xp:150,reward:{coins:100,gems:0},condition:"clan",target:1},
  {id:"vip1",name:"Royalty",desc:"Become a VIP member",icon:"👑",cat:"social",goal:1,stat:"vip",xp:500,reward:{coins:0,gems:0},condition:"vip",target:1},
];

const TITLES=[
  {id:"rookie",name:"Rookie",color:"#9ca3af",rarity:"common",unlock:"achievement"},
  {id:"challenger",name:"Challenger",color:"#60a5fa",rarity:"common",unlock:"achievement"},
  {id:"card_shark",name:"Card Shark",color:"#4ade80",rarity:"rare",unlock:"achievement"},
  {id:"cobra_master",name:"Cobra Master",color:"#d4a843",rarity:"epic",unlock:"achievement"},
  {id:"lucky_legend",name:"Lucky Legend",color:"#c084fc",rarity:"epic",unlock:"achievement"},
  {id:"grand_champion",name:"Grand Champion",color:"#f87171",rarity:"legendary",unlock:"achievement"},
  {id:"serpent",name:"The Serpent",color:"#4ade80",rarity:"rare",unlock:"level",level:15},
  {id:"untouchable",name:"Untouchable",color:"#f0c060",rarity:"legendary",unlock:"level",level:30},
  {id:"shadow",name:"Shadow",rarity:"rare",color:"#8888aa",glow:"rgba(100,100,180,0.5)",unlock:"achievement",achId:"cobra_10"},
  {id:"void_walker",name:"Void Walker",rarity:"epic",color:"linear-gradient(135deg,#666,#aaa,#666)",glow:"rgba(150,150,150,0.6)",unlock:"achievement",achId:"win_50"},
  {id:"serpent_king",name:"Serpent King",rarity:"legendary",color:"linear-gradient(135deg,#40c060,#d4a843,#40c060)",glow:"rgba(64,192,96,0.8)",unlock:"achievement",achId:"win_100"},
  {id:"the_collector",name:"The Collector",rarity:"epic",color:"linear-gradient(135deg,#c084fc,#818cf8)",glow:"rgba(192,132,252,0.7)",unlock:"achievement",achId:"play_200"},
  {id:"vip_emperor",name:"Emperor",rarity:"legendary",color:"linear-gradient(135deg,#f0c060,#fff,#f0c060)",glow:"rgba(255,255,255,0.9)",unlock:"vip",vipOnly:true},
  {id:"vip_apex",name:"Apex Predator",rarity:"legendary",color:"linear-gradient(135deg,#ff4444,#ff8800,#ff4444)",glow:"rgba(255,68,68,0.9)",unlock:"vip",vipOnly:true},
  {id:"vip_phantom",name:"Phantom",rarity:"legendary",color:"linear-gradient(135deg,#888,#fff,#888)",glow:"rgba(200,200,200,0.8)",unlock:"vip",vipOnly:true},
  {id:"vip_divine",name:"Divine",rarity:"legendary",color:"linear-gradient(135deg,#c084fc,#f0c060,#c084fc)",glow:"rgba(192,132,252,0.9)",unlock:"vip",vipOnly:true},
];

const FRAMES=[
  {id:"none",name:"None",rarity:"common",color:"transparent",unlock:"default"},
  {id:"bronze",name:"Bronze",rarity:"common",color:"#cd7f32",glow:"rgba(205,127,50,0.6)",unlock:"streak",streak:3},
  {id:"silver",name:"Silver",rarity:"rare",color:"#c0c0c0",glow:"rgba(192,192,192,0.6)",unlock:"streak",streak:5},
  {id:"gold",name:"Gold",rarity:"epic",color:"#d4a843",glow:"rgba(212,168,67,0.7)",unlock:"streak",streak:10},
  {id:"emerald",name:"Emerald",rarity:"rare",color:"#4ade80",glow:"rgba(74,222,128,0.5)",unlock:"achievement",achId:"win_50"},
  {id:"cobra",name:"Cobra",rarity:"epic",color:"#f87171",glow:"rgba(248,113,113,0.6)",unlock:"achievement",achId:"cobra_10"},
  {id:"diamond",name:"Diamond",rarity:"legendary",color:"#a5f3fc",glow:"rgba(165,243,252,0.7)",unlock:"achievement",achId:"win_100"},
  {id:"champion",name:"Champion",rarity:"legendary",color:"linear-gradient(135deg,#d4a843,#f87171,#c084fc)",glow:"rgba(212,168,67,0.8)",unlock:"achievement",achId:"streak_10"},
];

const RARITY_COLORS={common:"#9ca3af",rare:"#60a5fa",epic:"#c084fc",legendary:"#f0c060"};
const RARITY_GLOW={common:"rgba(156,163,175,0.4)",rare:"rgba(96,165,250,0.5)",epic:"rgba(192,132,252,0.6)",legendary:"rgba(240,192,96,0.7)"};
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

// Encode an AudioBuffer to a WAV Blob so it can be played via <audio> (bypasses iOS silent switch)
function _bufToWav(buf){
  var sr=buf.sampleRate,n=buf.length,nc=buf.numberOfChannels;
  var out=new ArrayBuffer(44+n*nc*2);var v=new DataView(out);
  var ws=function(o,s){for(var i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  ws(0,"RIFF");v.setUint32(4,36+n*nc*2,true);ws(8,"WAVE");ws(12,"fmt ");
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,nc,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*nc*2,true);
  v.setUint16(32,nc*2,true);v.setUint16(34,16,true);ws(36,"data");v.setUint32(40,n*nc*2,true);
  var off=44;for(var i=0;i<n;i++)for(var c=0;c<nc;c++){var s=Math.max(-1,Math.min(1,buf.getChannelData(c)[i]));v.setInt16(off,s<0?s*0x8000:s*0x7FFF,true);off+=2;}
  return new Blob([out],{type:"audio/wav"});
}
// One template Audio element per blob URL; clone it each play to avoid seek glitches on iOS
var _audioTemplates={};
function _playBlob(url,vol){
  try{
    if(!_audioTemplates[url]){
      var t=new Audio(url);t.setAttribute("playsinline","");t.load();
      _audioTemplates[url]=t;
    }
    var el=_audioTemplates[url].cloneNode();
    el.volume=vol||1;
    el.play().catch(function(){});
  }catch(e){}
}
// Pre-render a sound builder fn in an OfflineAudioContext and return a blob URL promise
function _render(dur,sr,builder){
  return new Promise(function(res){
    try{
      var oc=new OfflineAudioContext(1,Math.ceil((sr||44100)*dur),sr||44100);
      var out=oc.createGain();out.gain.value=1;out.connect(oc.destination);
      builder(oc,out);
      oc.startRendering().then(function(b){res(URL.createObjectURL(_bufToWav(b)));}).catch(function(){res(null);});
    }catch(e){res(null);}
  });
}

const audio={
  _ctx:null,_master:null,_bgGain:null,_sfxGain:null,
  _muted:false,_musicMuted:false,_bgNodes:[],_ready:false,_arpTimer:null,
  _isIOS:false,_blobs:{},
  init(){
    if(this._ready)return;
    try{
      try{this._muted=localStorage.getItem("cobra_sfx_muted")==="1";}catch(e){}
      try{this._musicMuted=localStorage.getItem("cobra_mus_muted")==="1";}catch(e){}
      this._isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      this._ctx=ctx;
      this._master=ctx.createGain();this._master.gain.value=this._muted?0:0.7;
      this._sfxGain=ctx.createGain();this._sfxGain.gain.value=1;this._sfxGain.connect(this._master);
      this._bgGain=ctx.createGain();this._bgGain.gain.value=0;this._bgGain.connect(this._master);
      this._master.connect(ctx.destination);
      this._ready=true;
      if(this._isIOS)this._prerenderIOS();
      var self=this;
      ctx.addEventListener("statechange",function(){
        if(ctx.state==="running"&&!self._musicMuted&&self._bgNodes.length===0){
          self._startBg();
        }
      });
      if(ctx.state==="running"){
        self._startBg();
      } else {
        ctx.resume().catch(function(){});
      }
    }catch(e){}
  },
  _prerenderIOS(){
    var self=this;
    var sr=44100;
    var jobs={
      buttonClick:[0.12,function(c,o){var g=c.createGain();g.gain.setValueAtTime(0.0001,0);g.gain.linearRampToValueAtTime(0.5,0.008);g.gain.exponentialRampToValueAtTime(0.0001,0.1);var osc=c.createOscillator();osc.type="sine";osc.frequency.value=900;osc.connect(g);g.connect(o);osc.start(0);osc.stop(0.12);}],
      cardSelect:[0.1,function(c,o){var g=c.createGain();g.gain.setValueAtTime(0.0001,0);g.gain.linearRampToValueAtTime(0.4,0.008);g.gain.exponentialRampToValueAtTime(0.0001,0.08);var osc=c.createOscillator();osc.type="sine";osc.frequency.value=1200;osc.connect(g);g.connect(o);osc.start(0);osc.stop(0.1);}],
      cardDeal:[0.22,function(c,o){var osc=c.createOscillator(),g=c.createGain();osc.type="sine";osc.frequency.setValueAtTime(280,0);osc.frequency.exponentialRampToValueAtTime(1500,0.15);g.gain.setValueAtTime(0.0001,0);g.gain.linearRampToValueAtTime(0.5,0.012);g.gain.exponentialRampToValueAtTime(0.0001,0.18);osc.connect(g);g.connect(o);osc.start(0);osc.stop(0.22);}],
      cardPickup:[0.2,function(c,o){var osc=c.createOscillator(),g=c.createGain();osc.type="sine";osc.frequency.setValueAtTime(900,0);osc.frequency.exponentialRampToValueAtTime(280,0.15);g.gain.setValueAtTime(0.0001,0);g.gain.linearRampToValueAtTime(0.4,0.012);g.gain.exponentialRampToValueAtTime(0.0001,0.16);osc.connect(g);g.connect(o);osc.start(0);osc.stop(0.2);}],
      cardPlay:[0.28,function(c,o){var osc=c.createOscillator(),g=c.createGain();osc.type="sine";osc.frequency.setValueAtTime(1800,0);osc.frequency.exponentialRampToValueAtTime(180,0.22);g.gain.setValueAtTime(0.0001,0);g.gain.linearRampToValueAtTime(0.55,0.01);g.gain.exponentialRampToValueAtTime(0.0001,0.22);osc.connect(g);g.connect(o);osc.start(0);osc.stop(0.28);}],
      declare:[0.9,function(c,o){[[261.6,0],[329.6,0.08],[392,0.16],[523.2,0.25],[659.2,0.36]].forEach(function(p){var osc=c.createOscillator(),g=c.createGain();osc.type="triangle";osc.frequency.value=p[0];g.gain.setValueAtTime(0.0001,p[1]);g.gain.linearRampToValueAtTime(0.4,p[1]+0.02);g.gain.exponentialRampToValueAtTime(0.0001,p[1]+0.35);osc.connect(g);g.connect(o);osc.start(p[1]);osc.stop(p[1]+0.4);});}],
      cobraStrike:[0.6,function(c,o){var osc=c.createOscillator(),g=c.createGain();osc.type="sawtooth";osc.frequency.setValueAtTime(800,0);osc.frequency.exponentialRampToValueAtTime(40,0.4);g.gain.setValueAtTime(0.0001,0);g.gain.linearRampToValueAtTime(0.6,0.01);g.gain.exponentialRampToValueAtTime(0.0001,0.4);osc.connect(g);g.connect(o);osc.start(0);osc.stop(0.6);}],
      win:[1.2,function(c,o){[[523.2,0,0.4],[659.2,0.1,0.35],[783.9,0.2,0.3],[1046.5,0.3,0.5],[783.9,0.45,0.28],[1046.5,0.55,0.6]].forEach(function(p){var osc=c.createOscillator(),g=c.createGain();osc.type="sine";osc.frequency.value=p[0];g.gain.setValueAtTime(0.0001,p[1]);g.gain.linearRampToValueAtTime(p[2],p[1]+0.02);g.gain.exponentialRampToValueAtTime(0.0001,p[1]+0.5);osc.connect(g);g.connect(o);osc.start(p[1]);osc.stop(p[1]+0.6);});}],
      purchase:[0.4,function(c,o){var osc=c.createOscillator(),g=c.createGain();osc.type="sine";osc.frequency.setValueAtTime(300,0);osc.frequency.exponentialRampToValueAtTime(900,0.12);g.gain.setValueAtTime(0.0001,0);g.gain.linearRampToValueAtTime(0.5,0.012);g.gain.exponentialRampToValueAtTime(0.0001,0.3);osc.connect(g);g.connect(o);osc.start(0);osc.stop(0.4);}],
      turnChange:[0.15,function(c,o){var osc=c.createOscillator(),g=c.createGain();osc.type="sine";osc.frequency.value=520;g.gain.setValueAtTime(0.0001,0);g.gain.linearRampToValueAtTime(0.3,0.008);g.gain.exponentialRampToValueAtTime(0.0001,0.12);osc.connect(g);g.connect(o);osc.start(0);osc.stop(0.15);}],
    };
    Object.keys(jobs).forEach(function(k){
      var j=jobs[k];
      _render(j[0],sr,j[1]).then(function(url){if(url)self._blobs[k]=url;});
    });
    // Pre-render 16s music loop at lower sample rate to keep size manageable
    var msr=22050,mdur=16;
    _render(mdur,msr,function(c,o){
      var lp=c.createBiquadFilter();lp.type="lowpass";lp.frequency.value=600;lp.connect(o);
      var mg=c.createGain();mg.gain.setValueAtTime(0,0);mg.gain.linearRampToValueAtTime(0.4,3);mg.connect(lp);
      [[55,"sine",0.08],[82.4,"triangle",0.055],[110,"sine",0.04],[130.8,"triangle",0.03],[164.8,"sine",0.025]].forEach(function(cfg){
        var osc=c.createOscillator(),g=c.createGain();osc.type=cfg[1];osc.frequency.value=cfg[0];g.gain.value=cfg[2];osc.connect(g);g.connect(mg);osc.start(0);osc.stop(mdur);
      });
      var arpNotes=[220,261.6,329.6,392,440,329.6,246.9,293.7,349.2,415.3,493.9,415.3];
      var ao=c.createOscillator(),ag=c.createGain();ao.type="sine";ag.gain.value=0.018;ao.connect(ag);ag.connect(mg);ao.start(0);ao.stop(mdur);
      for(var t=0,i=0;t<mdur;t+=1.8,i++)ao.frequency.setValueAtTime(arpNotes[i%arpNotes.length],t);
    }).then(function(url){if(url)self._blobs.music=url;});
  },
  _playIOS(name,vol){
    if(this._blobs[name])_playBlob(this._blobs[name],vol||0.9);
  },
  resume(){
    if(!this._ctx)return;
    var self=this;
    // Works for suspended AND interrupted states
    if(this._ctx.state!=="running"){
      this._ctx.resume().catch(function(){});
      // bg music starts automatically via statechange listener in init()
    } else if(!this._musicMuted&&this._bgNodes.length===0){
      this._startBg();
    }
  },
  _startBg(){
    if(!this._ctx||this._musicMuted)return;
    if(this._isIOS){
      var self=this;
      var tryPlay=function(){
        if(!self._blobs.music){setTimeout(tryPlay,200);return;}
        if(!self._musicEl){
          self._musicEl=new Audio(self._blobs.music);
          self._musicEl.setAttribute("playsinline","");
          self._musicEl.loop=true;self._musicEl.volume=0.22;
        }
        self._musicEl.play().catch(function(){});
      };
      tryPlay();
      return;
    }
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
  buttonClick(){if(this._muted)return;if(this._isIOS){this._playIOS("buttonClick");return;}this._tone(200,"sine",0.25,0.055,0);this._noise(0.2,0.035,4500);this._tone(1600,"sine",0.07,0.04,0.006);},
  cardDeal(){if(this._muted)return;if(this._isIOS){this._playIOS("cardDeal");return;}this._sweep(280,1500,0.14,0.15);this._noise(0.1,0.12,6000);},
  cardPickup(){if(this._muted)return;if(this._isIOS){this._playIOS("cardPickup");return;}this._sweep(900,280,0.1,0.15);},
  cardSelect(){if(this._muted)return;if(this._isIOS){this._playIOS("cardSelect");return;}this._tone(1000,"sine",0.08,0.06,0);this._tone(1300,"sine",0.05,0.04,0.012);},
  cardPlay(){if(this._isIOS){if(!this._muted)this._playIOS("cardPlay");return;}
    try{
      if(!this._ctx||this._muted)return;
      const ctx=this._ctx,now=ctx.currentTime;
      // Swoosh: fast high→low sweep + filtered noise burst
      const o=ctx.createOscillator(),og=ctx.createGain();
      o.type="sine";o.frequency.setValueAtTime(1800,now);o.frequency.exponentialRampToValueAtTime(180,now+0.22);
      og.gain.setValueAtTime(0.0001,now);og.gain.linearRampToValueAtTime(0.18,now+0.01);og.gain.exponentialRampToValueAtTime(0.0001,now+0.22);
      o.connect(og);og.connect(this._sfxGain);o.start(now);o.stop(now+0.25);
      // Noise whoosh layer
      const buf=ctx.createBuffer(1,ctx.sampleRate*0.2,ctx.sampleRate);
      const d=buf.getChannelData(0);for(var i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
      const src=ctx.createBufferSource(),filt=ctx.createBiquadFilter(),ng=ctx.createGain();
      src.buffer=buf;filt.type="bandpass";filt.frequency.setValueAtTime(3000,now);filt.frequency.exponentialRampToValueAtTime(400,now+0.2);filt.Q.value=1.2;
      ng.gain.setValueAtTime(0.0001,now);ng.gain.linearRampToValueAtTime(0.22,now+0.015);ng.gain.exponentialRampToValueAtTime(0.0001,now+0.2);
      src.connect(filt);filt.connect(ng);ng.connect(this._sfxGain);src.start(now);
    }catch(e){}
  },
  declare(){
    try{
      if(!this._ctx||this._muted)return;
      if(this._isIOS){this._playIOS("declare");return;}
      const ctx=this._ctx,now=ctx.currentTime;
      // Rising triumphant arpeggio
      [[261.6,0],[329.6,0.08],[392,0.16],[523.2,0.25],[659.2,0.36]].forEach(function([f,t]){
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type="triangle";o.frequency.value=f;
        g.gain.setValueAtTime(0.0001,now+t);g.gain.linearRampToValueAtTime(0.16,now+t+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,now+t+0.35);
        o.connect(g);g.connect(this._sfxGain);o.start(now+t);o.stop(now+t+0.4);
      }.bind(this));
    }catch(e){}
  },
  cobraStrike(){
    try{
      if(!this._ctx||this._muted)return;
      if(this._isIOS){this._playIOS("cobraStrike");return;}
      const ctx=this._ctx,now=ctx.currentTime;
      // Deep thud + descending alarm
      this._sweep(800,40,0.3,0.4);
      this._noise(0.2,0.3,800);
      // Alarm blips
      [0,0.15,0.30].forEach(function(t){
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type="sawtooth";o.frequency.value=440;
        g.gain.setValueAtTime(0.0001,now+t);g.gain.linearRampToValueAtTime(0.12,now+t+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001,now+t+0.1);
        o.connect(g);g.connect(this._sfxGain);o.start(now+t);o.stop(now+t+0.12);
      }.bind(this));
    }catch(e){}
  },
  win(){
    try{
      if(!this._ctx||this._muted)return;
      if(this._isIOS){this._playIOS("win");return;}
      const ctx=this._ctx,now=ctx.currentTime;
      [[523.2,0,0.18],[659.2,0.1,0.16],[783.9,0.2,0.14],[1046.5,0.3,0.22],[783.9,0.45,0.12],[1046.5,0.55,0.28]].forEach(function([f,t,v]){
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type="sine";o.frequency.value=f;
        g.gain.setValueAtTime(0.0001,now+t);g.gain.linearRampToValueAtTime(v,now+t+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,now+t+0.5);
        o.connect(g);g.connect(this._sfxGain);o.start(now+t);o.stop(now+t+0.55);
      }.bind(this));
    }catch(e){}
  },
  turnChange(){if(this._muted)return;if(this._isIOS){this._playIOS("turnChange");return;}this._tone(520,"sine",0.06,0.1,0);},
  timerTick(){this._tone(800,"sine",0.04,0.05,0);},
  timerUrgent(){this._tone(1000,"sine",0.1,0.07,0);},
  achievement(){[784,988,1174].forEach((f,i)=>this._tone(f,"sine",0.15,0.3,i*0.1));},
  purchase(){if(this._muted)return;if(this._isIOS){this._playIOS("purchase");return;}this._sweep(300,900,0.18,0.12);this._tone(1200,"sine",0.12,0.2,0.08);this._tone(1600,"sine",0.08,0.15,0.18);},
  crateOpen(){this._noise(0.25,0.18,3000);this._sweep(200,1200,0.2,0.35);[523,659,784,988,1174,1568].forEach((f,i)=>this._tone(f,"triangle",0.14,0.3,0.08+i*0.07));},
  levelUp(){[392,494,587,784,988].forEach((f,i)=>this._tone(f,"sine",0.2,0.5,i*0.09));this._tone(1568,"sine",0.18,0.8,0.5);this._noise(0.12,0.2,5000);},
  shuffle_sfx(){for(let i=0;i<7;i++)setTimeout(()=>this.cardDeal(),i*85);},
  toggleMute(){this._muted=!this._muted;if(this._master&&this._ctx)this._master.gain.linearRampToValueAtTime(this._muted?0:0.7,this._ctx.currentTime+0.1);},
  toggleMusic(){
    this._musicMuted=!this._musicMuted;
    if(this._isIOS){
      if(this._musicEl){if(this._musicMuted)this._musicEl.pause();else this._musicEl.play().catch(function(){});}
      else if(!this._musicMuted)this._startBg();
      return;
    }
    if(this._bgGain&&this._ctx){
      if(this._musicMuted){
        if(this._arpTimer){clearInterval(this._arpTimer);this._arpTimer=null;}
        this._bgGain.gain.linearRampToValueAtTime(0,this._ctx.currentTime+0.5);
      } else {this._startBg();}
    }
  },
};

const haptic={
  light(){try{if(navigator.vibrate)navigator.vibrate(12);}catch(e){}},
  medium(){try{if(navigator.vibrate)navigator.vibrate(40);}catch(e){}},
  heavy(){try{if(navigator.vibrate)navigator.vibrate(60);}catch(e){}},
  success(){try{if(navigator.vibrate)navigator.vibrate([30,20,60,20,100]);}catch(e){}},
  error(){try{if(navigator.vibrate)navigator.vibrate([50,20,50]);}catch(e){}},
  cardPlay(){try{if(navigator.vibrate)navigator.vibrate([25,8,15]);}catch(e){}},
  cardPickup(){try{if(navigator.vibrate)navigator.vibrate([12]);}catch(e){}},
  declare(){try{if(navigator.vibrate)navigator.vibrate([20,10,20,10,60]);}catch(e){}},
  cobra(){try{if(navigator.vibrate)navigator.vibrate([100,30,100,30,200]);}catch(e){}},
  win(){try{if(navigator.vibrate)navigator.vibrate([30,20,60,20,100]);}catch(e){}},
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
@media(max-width:350px){.card-lg{width:44px!important;height:62px!important;font-size:11px!important;}.card-md{width:36px!important;height:52px!important;font-size:10px!important;}.card-sm{width:28px!important;height:40px!important;font-size:9px!important;}}
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
.feltbg{background:radial-gradient(ellipse at 30% 20%,rgba(15,40,18,0.8) 0%,transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(8,25,12,0.6) 0%,transparent 50%),repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px),linear-gradient(160deg,#0a1f0b 0%,#061208 40%,#040d05 100%);min-height:100vh;position:relative;}
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
@keyframes cardDeal{0%{opacity:0;transform:translateY(-40px) translateX(20px) rotate(-8deg) scale(0.7)}60%{transform:translateY(4px) rotate(1deg) scale(1.02)}100%{opacity:1;transform:translateY(0) rotate(0deg) scale(1)}}
@keyframes scorePop{0%{transform:scale(1)}40%{transform:scale(1.35) translateY(-3px)}70%{transform:scale(0.95)}100%{transform:scale(1)}}
@keyframes toastIn{0%{transform:translateY(-20px) scale(0.85);opacity:0}60%{transform:translateY(4px) scale(1.03)}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes declarePop{0%{transform:scale(0.85);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
@keyframes orbFloat{0%,100%{transform:scale(1) translate(0,0)}33%{transform:scale(1.08) translate(8px,-6px)}66%{transform:scale(0.95) translate(-6px,5px)}}
@keyframes cobraBounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-10px)}70%{transform:translateY(-4px)}}
@keyframes timerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@keyframes emojiFloat{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(1.4)}}
@keyframes achievePop{0%{opacity:0;transform:translateX(120px)}15%{opacity:1;transform:translateX(-8px)}85%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(120px)}}
@keyframes fadeOut{0%{opacity:1}65%{opacity:1}100%{opacity:0}}
@keyframes cardPlay{0%{transform:translateY(0) rotate(0deg) scale(1);opacity:1}30%{transform:translateY(-20px) rotate(-5deg) scale(1.1);opacity:1}100%{transform:translateY(-140px) rotate(12deg) scale(0.6);opacity:0}}
@keyframes cardShuffle{0%{transform:translateX(0) rotate(0deg);opacity:1}25%{transform:translateX(-8px) rotate(-3deg);opacity:0.8}50%{transform:translateX(8px) rotate(3deg);opacity:0.8}75%{transform:translateX(-4px) rotate(-1deg);opacity:0.9}100%{transform:translateX(0) rotate(0deg);opacity:1}}
@keyframes cardFan{0%{opacity:0;transform:translateY(60px) rotate(var(--fan-rot,0deg)) scale(0.6)}60%{transform:translateY(-4px) rotate(var(--fan-rot,0deg)) scale(1.03)}100%{opacity:1;transform:translateY(0) rotate(var(--fan-rot,0deg)) scale(1)}}
@keyframes cardLand{0%{transform:scale(1.15) rotate(-3deg)}60%{transform:scale(0.97) rotate(1deg)}100%{transform:scale(1) rotate(0deg)}}
@keyframes cardPickup{0%{opacity:0;transform:translateY(-60px) rotate(-5deg) scale(0.75)}50%{transform:translateY(5px) rotate(1deg) scale(1.04)}100%{opacity:1;transform:translateY(0) rotate(0deg) scale(1)}}
@keyframes yourTurnGlow{0%,100%{box-shadow:0 0 20px rgba(212,168,67,0.5),0 0 40px rgba(212,168,67,0.2),inset 0 0 20px rgba(212,168,67,0.05)}50%{box-shadow:0 0 50px rgba(212,168,67,0.9),0 0 90px rgba(212,168,67,0.5),inset 0 0 30px rgba(212,168,67,0.12)}}
@keyframes glowPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
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
/* Home screen card drift animations */
@keyframes cardDrift1{0%{transform:translate(0px,0px) rotate(-12deg);opacity:0}5%{opacity:1}90%{opacity:0.7}100%{transform:translate(-180px,-320px) rotate(-28deg);opacity:0}}
@keyframes cardDrift2{0%{transform:translate(0px,0px) rotate(8deg);opacity:0}5%{opacity:0.8}90%{opacity:0.5}100%{transform:translate(200px,-280px) rotate(22deg);opacity:0}}
@keyframes cardDrift3{0%{transform:translate(0px,0px) rotate(-5deg);opacity:0}5%{opacity:0.9}90%{opacity:0.6}100%{transform:translate(-120px,-350px) rotate(-18deg);opacity:0}}
@keyframes cardDrift4{0%{transform:translate(0px,0px) rotate(15deg);opacity:0}5%{opacity:0.7}90%{opacity:0.4}100%{transform:translate(160px,-300px) rotate(30deg);opacity:0}}
@keyframes cardDrift5{0%{transform:translate(0px,0px) rotate(-20deg);opacity:0}5%{opacity:0.85}90%{opacity:0.55}100%{transform:translate(-220px,-260px) rotate(-35deg);opacity:0}}
@keyframes sparkle{0%,100%{transform:scale(0) rotate(0deg);opacity:0}50%{transform:scale(1) rotate(180deg);opacity:1}}
@keyframes snakeWave{0%{transform:translateX(-100%) scaleY(1)}50%{transform:translateX(0%) scaleY(1.3)}100%{transform:translateX(100%) scaleY(1)}}
@keyframes homeGlow{0%,100%{opacity:0.3;transform:scale(1)}50%{opacity:0.55;transform:scale(1.08)}}
@keyframes statSlideIn{0%{transform:translateX(-30px);opacity:0}100%{transform:translateX(0);opacity:1}}
@keyframes trophyBounce{0%,100%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.2) rotate(-8deg)}75%{transform:scale(1.15) rotate(8deg)}}
@keyframes rankReveal{0%{transform:scale(0.5);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
@keyframes shimmerSlide{0%{background-position:200% center}100%{background-position:-200% center}}
`;

const CARD_THEMES={
  classic:{bg:"linear-gradient(148deg,#091609,#040c04,#071007)",border:"rgba(20,60,20,0.9)",pat:"rgba(212,168,67,0.22)",pat2:"rgba(212,168,67,0.15)"},
  midnight:{bg:"linear-gradient(148deg,#06061a,#030310,#04041a)",border:"rgba(20,20,80,0.9)",pat:"rgba(160,180,255,0.22)",pat2:"rgba(120,140,220,0.15)"},
  crimson:{bg:"linear-gradient(148deg,#1a0505,#0d0303,#120404)",border:"rgba(80,10,10,0.9)",pat:"rgba(220,80,80,0.22)",pat2:"rgba(180,60,60,0.15)"},
  emerald:{bg:"linear-gradient(148deg,#021a06,#010d03,#021404)",border:"rgba(10,80,20,0.9)",pat:"rgba(50,200,80,0.24)",pat2:"rgba(40,160,60,0.17)"},
  galaxy:{bg:"linear-gradient(148deg,#0a0520,#050212,#08031a)",border:"rgba(80,40,160,0.9)",pat:"rgba(180,100,255,0.24)",pat2:"rgba(140,60,220,0.17)"},
  gold:{bg:"linear-gradient(148deg,#1a1200,#0d0a00,#161000)",border:"rgba(160,120,0,0.9)",pat:"rgba(255,200,0,0.28)",pat2:"rgba(212,168,0,0.2)"},
  neon:{bg:"linear-gradient(148deg,#001a1a,#000d0d,#001515)",border:"rgba(0,255,200,0.7)",pat:"rgba(0,255,200,0.25)",pat2:"rgba(0,200,160,0.18)"},
  royal:{bg:"linear-gradient(148deg,#0d0020,#060012,#0a001a)",border:"rgba(160,80,255,0.7)",pat:"rgba(160,80,255,0.25)",pat2:"rgba(120,60,200,0.18)"},
  inferno:{bg:"linear-gradient(148deg,#1a0500,#0d0200,#150400)",border:"rgba(255,100,0,0.7)",pat:"rgba(255,100,0,0.25)",pat2:"rgba(200,60,0,0.18)"},
  ice:{bg:"linear-gradient(148deg,#000d1a,#000610,#000f1a)",border:"rgba(100,200,255,0.7)",pat:"rgba(100,200,255,0.25)",pat2:"rgba(60,160,220,0.18)"},
  sakura:{bg:"linear-gradient(148deg,#1a0812,#0d0408,#160610)",border:"rgba(180,80,120,0.9)",pat:"rgba(255,150,180,0.2)",pat2:"rgba(200,100,140,0.15)"},
  storm:{bg:"linear-gradient(148deg,#0a0a1a,#050510,#08081a)",border:"rgba(100,120,255,0.8)",pat:"rgba(120,140,255,0.22)",pat2:"rgba(80,100,220,0.15)"},
  serpent:{bg:"linear-gradient(148deg,#0a1a0a,#051005,#081508)",border:"rgba(40,180,60,0.8)",pat:"rgba(60,200,80,0.22)",pat2:"rgba(40,160,55,0.15)"},
  void:{bg:"linear-gradient(148deg,#080808,#030303,#060606)",border:"rgba(80,80,80,0.6)",pat:"rgba(100,100,100,0.1)",pat2:"rgba(80,80,80,0.08)"},
  vip_gold:{bg:"linear-gradient(148deg,#1a1000,#0d0800,#151000)",border:"rgba(212,168,67,0.95)",pat:"rgba(255,200,0,0.35)",pat2:"rgba(212,168,0,0.25)"},
  vip_obsidian:{bg:"linear-gradient(148deg,#080808,#020202,#060606)",border:"rgba(60,60,60,0.95)",pat:"rgba(120,120,120,0.12)",pat2:"rgba(80,80,80,0.08)"},
  vip_diamond:{bg:"linear-gradient(148deg,#0a1020,#050810,#08101a)",border:"rgba(180,220,255,0.9)",pat:"rgba(180,220,255,0.2)",pat2:"rgba(140,180,255,0.15)"},
  vip_ruby:{bg:"linear-gradient(148deg,#1a0005,#0d0003,#150004)",border:"rgba(220,0,60,0.9)",pat:"rgba(255,0,80,0.2)",pat2:"rgba(200,0,50,0.15)"},
  vip_emerald_royal:{bg:"linear-gradient(148deg,#001a08,#000d04,#001506)",border:"rgba(0,200,80,0.9)",pat:"rgba(0,220,80,0.22)",pat2:"rgba(0,180,60,0.16)"},
  vip_sunset:{bg:"linear-gradient(148deg,#1a0800,#0d0400,#150600)",border:"rgba(255,140,0,0.9)",pat:"rgba(255,160,0,0.22)",pat2:"rgba(220,100,0,0.16)"},
  vip_ocean:{bg:"linear-gradient(148deg,#000d1a,#00060d,#000f1a)",border:"rgba(0,140,255,0.85)",pat:"rgba(0,160,255,0.2)",pat2:"rgba(0,120,220,0.15)"},
  vip_nebula:{bg:"linear-gradient(148deg,#0a0015,#05000d,#080012)",border:"rgba(180,80,255,0.85)",pat:"rgba(200,100,255,0.2)",pat2:"rgba(160,60,220,0.15)"},
  vip_toxic:{bg:"linear-gradient(148deg,#051500,#020a00,#041000)",border:"rgba(80,255,40,0.85)",pat:"rgba(100,255,50,0.2)",pat2:"rgba(60,220,30,0.15)"},
};

const SHOP_THEMES=[
  {id:"classic",name:"Classic",price:0,currency:"coins",color:"#091609",desc:"The original green felt",rarity:"common"},
  {id:"midnight",name:"Midnight",price:500,currency:"coins",color:"#06061a",desc:"Deep blue darkness",rarity:"rare"},
  {id:"crimson",name:"Crimson",price:500,currency:"coins",color:"#1a0505",desc:"Blood red danger",rarity:"rare"},
  {id:"emerald",name:"Emerald",price:500,currency:"coins",color:"#021a06",desc:"Lush green forest",rarity:"rare"},
  {id:"galaxy",name:"Galaxy",price:1200,currency:"coins",color:"#0a0520",desc:"Cosmic purple depths",rarity:"epic"},
  {id:"gold",name:"Gold Rush",price:1500,currency:"coins",color:"#1a1200",desc:"Pure luxury edition",rarity:"legendary"},
  {id:"vip_gold",name:"VIP Gold",price:0,currency:"coins",color:"#1a1000",desc:"Exclusive VIP members only ✦",rarity:"legendary",vipOnly:true},
  {id:"vip_royal",name:"Royal VIP",price:0,currency:"coins",color:"#1a0e00",desc:"Exclusive VIP members only",rarity:"legendary",vipOnly:true},
  {id:"vip_crown",name:"Crown Edition",price:0,currency:"coins",color:"#0a0010",desc:"The crown jewel — VIP exclusive",rarity:"legendary",vipOnly:true},
  {id:"vip_obsidian",name:"Obsidian",price:0,currency:"coins",color:"#050505",desc:"Pure black volcanic glass",rarity:"legendary",vipOnly:true},
  {id:"vip_diamond",name:"Diamond",price:0,currency:"coins",color:"#0a1020",desc:"Crystal clear luxury",rarity:"legendary",vipOnly:true},
  {id:"vip_ruby",name:"Ruby",price:0,currency:"coins",color:"#1a0005",desc:"Deep crimson gemstone",rarity:"legendary",vipOnly:true},
  {id:"vip_emerald_royal",name:"Royal Emerald",price:0,currency:"coins",color:"#001a08",desc:"Emerald dynasty edition",rarity:"legendary",vipOnly:true},
  {id:"vip_sunset",name:"Sunset",price:0,currency:"coins",color:"#1a0800",desc:"Golden hour gradient",rarity:"legendary",vipOnly:true},
  {id:"vip_ocean",name:"Deep Ocean",price:0,currency:"coins",color:"#000d1a",desc:"Abyssal blue depths",rarity:"legendary",vipOnly:true},
  {id:"vip_nebula",name:"Nebula",price:0,currency:"coins",color:"#0a0015",desc:"Cosmic dust and starlight",rarity:"legendary",vipOnly:true},
  {id:"vip_toxic",name:"Toxic",price:0,currency:"coins",color:"#051500",desc:"Radioactive neon green",rarity:"legendary",vipOnly:true},
  {id:"neon",name:"Neon Nights",price:1800,currency:"coins",color:"#001a1a",desc:"Electric cyan glow on deep black",rarity:"rare",isNew:true},
  {id:"royal",name:"Royal Flush",price:2400,currency:"coins",color:"#0d0020",desc:"Deep purple with gold filigree",rarity:"epic",isNew:true},
  {id:"inferno",name:"Inferno",price:2200,currency:"coins",color:"#1a0500",desc:"Blazing orange and red flames",rarity:"rare"},
  {id:"ice",name:"Black Ice",price:2000,currency:"coins",color:"#000d1a",desc:"Frost blue crystalline finish",rarity:"rare"},
  {id:"sakura",name:"Sakura",price:1800,currency:"coins",color:"#1a0812",desc:"Cherry blossom pink and white",rarity:"rare",isNew:true},
  {id:"storm",name:"Thunderstorm",price:2200,currency:"coins",color:"#0a0a1a",desc:"Dark clouds and electric energy",rarity:"epic",isNew:true},
  {id:"serpent",name:"Serpent",price:2800,currency:"coins",color:"#0a1a0a",desc:"Cobra scales in deep green",rarity:"legendary",isNew:true},
  {id:"void",name:"Void",price:3500,currency:"coins",color:"#050505",desc:"Pure darkness, absolute black",rarity:"legendary",isNew:true},
];

// ─── SEASON PASS ─────────────────────────────────────────
const SEASON_PASS={
  season:1,
  name:"Serpent's Rise",
  durationDays:30,
  xpPerTier:100,
  totalTiers:30,
  tiers:[
    // Tiers 1-10
    {tier:1, free:{type:"coins",amount:50,label:"50 Coins",icon:"🪙"}, vip:{type:"gems",amount:2,label:"2 Gems",icon:"💎"}},
    {tier:2, free:{type:"coins",amount:75,label:"75 Coins",icon:"🪙"}, vip:{type:"avatar",id:"🐍",label:"Serpent Avatar",icon:"🐍"}},
    {tier:3, free:{type:"coins",amount:100,label:"100 Coins",icon:"🪙"}, vip:{type:"gems",amount:3,label:"3 Gems",icon:"💎"}},
    {tier:4, free:{type:"coins",amount:75,label:"75 Coins",icon:"🪙"}, vip:{type:"gems",amount:2,label:"2 Gems",icon:"💎"}},
    {tier:5, free:{type:"coins",amount:125,label:"125 Coins",icon:"🪙"}, vip:{type:"avatar",id:"🦎",label:"Lizard Avatar",icon:"🦎"}},
    {tier:6, free:{type:"coins",amount:100,label:"100 Coins",icon:"🪙"}, vip:{type:"gems",amount:4,label:"4 Gems",icon:"💎"}},
    {tier:7, free:{type:"coins",amount:100,label:"100 Coins",icon:"🪙"}, vip:{type:"gems",amount:3,label:"3 Gems",icon:"💎"}},
    {tier:8, free:{type:"coins",amount:150,label:"150 Coins",icon:"🪙"}, vip:{type:"avatar",id:"🌿",label:"Venom Avatar",icon:"🌿"}},
    {tier:9, free:{type:"coins",amount:125,label:"125 Coins",icon:"🪙"}, vip:{type:"gems",amount:5,label:"5 Gems",icon:"💎"}},
    {tier:10, free:{type:"coins",amount:150,label:"150 Coins",icon:"🪙"}, vip:{type:"gems",amount:4,label:"4 Gems",icon:"💎"}},
    // Tiers 11-20
    {tier:11, free:{type:"coins",amount:200,label:"200 Coins",icon:"🪙"}, vip:{type:"theme",id:"serpent",label:"Serpent Theme",icon:"🎨"}},
    {tier:12, free:{type:"coins",amount:250,label:"250 Coins",icon:"🪙"}, vip:{type:"gems",amount:5,label:"5 Gems",icon:"💎"}},
    {tier:13, free:{type:"frame",id:"serpent_frame",label:"Serpent Frame",icon:"🖼️"}, vip:{type:"gems",amount:6,label:"6 Gems",icon:"💎"}},
    {tier:14, free:{type:"coins",amount:300,label:"300 Coins",icon:"🪙"}, vip:{type:"theme",id:"void",label:"Void Theme",icon:"🎨"}},
    {tier:15, free:{type:"coins",amount:250,label:"250 Coins",icon:"🪙"}, vip:{type:"gems",amount:7,label:"7 Gems",icon:"💎"}},
    {tier:16, free:{type:"frame",id:"gold_frame",label:"Gold Frame",icon:"🖼️"}, vip:{type:"gems",amount:8,label:"8 Gems",icon:"💎"}},
    {tier:17, free:{type:"coins",amount:350,label:"350 Coins",icon:"🪙"}, vip:{type:"theme",id:"galaxy",label:"Galaxy Theme",icon:"🎨"}},
    {tier:18, free:{type:"coins",amount:300,label:"300 Coins",icon:"🪙"}, vip:{type:"gems",amount:8,label:"8 Gems",icon:"💎"}},
    {tier:19, free:{type:"frame",id:"purple_frame",label:"Viper Frame",icon:"🖼️"}, vip:{type:"gems",amount:10,label:"10 Gems",icon:"💎"}},
    {tier:20, free:{type:"coins",amount:400,label:"400 Coins",icon:"🪙"}, vip:{type:"gems",amount:10,label:"10 Gems",icon:"💎"}},
    // Tiers 21-30
    {tier:21, free:{type:"avatar",id:"🐲",label:"Dragon Avatar",icon:"🐲"}, vip:{type:"coins",amount:500,label:"500 Coins",icon:"🪙"}},
    {tier:22, free:{type:"coins",amount:400,label:"400 Coins",icon:"🪙"}, vip:{type:"gems",amount:12,label:"12 Gems",icon:"💎"}},
    {tier:23, free:{type:"avatar",id:"👁️",label:"Viper Eye Avatar",icon:"👁️"}, vip:{type:"coins",amount:600,label:"600 Coins",icon:"🪙"}},
    {tier:24, free:{type:"coins",amount:450,label:"450 Coins",icon:"🪙"}, vip:{type:"gems",amount:15,label:"15 Gems",icon:"💎"}},
    {tier:25, free:{type:"title",id:"sp_serpent",label:"Title: Serpent",icon:"🏷️"}, vip:{type:"coins",amount:800,label:"800 Coins",icon:"🪙"}},
    {tier:26, free:{type:"avatar",id:"🌑",label:"Shadow Avatar",icon:"🌑"}, vip:{type:"gems",amount:18,label:"18 Gems",icon:"💎"}},
    {tier:27, free:{type:"coins",amount:500,label:"500 Coins",icon:"🪙"}, vip:{type:"coins",amount:1000,label:"1000 Coins",icon:"🪙"}},
    {tier:28, free:{type:"title",id:"sp_apex",label:"Title: Apex",icon:"🏷️"}, vip:{type:"gems",amount:20,label:"20 Gems",icon:"💎"}},
    {tier:29, free:{type:"avatar",id:"🐍",label:"Cobra King Avatar",icon:"🐍"}, vip:{type:"coins",amount:1500,label:"1500 Coins",icon:"🪙"}},
    {tier:30, free:{type:"title",id:"sp_rise",label:"Title: Serpent's Rise",icon:"🏆"}, vip:{type:"gems",amount:25,label:"25 Gems + 2000 Coins",icon:"💎",bonusCoins:2000}},
  ]
};

const BUNDLES=[
  {id:"bundle_darkness",name:"Darkness Pack",desc:"Midnight + Crimson themes",icon:"🌙",items:["midnight","crimson"],price:3200,currency:"coins",originalPrice:4800,rarity:"rare"},
  {id:"bundle_nature",name:"Nature Pack",desc:"Classic + Emerald themes",icon:"🌿",items:["classic","emerald"],price:2800,currency:"coins",originalPrice:4200,rarity:"rare"},
  {id:"bundle_premium",name:"Elite Pack",desc:"Galaxy + Gold themes + 💎5",icon:"👑",items:["galaxy","gold"],price:18,currency:"gems",originalPrice:30,rarity:"epic",bonusGems:5},
  {id:"bundle_neon_ice",name:"Neon Frost",desc:"Neon Nights + Black Ice themes",icon:"⚡",items:["neon","ice"],price:3000,currency:"coins",originalPrice:3800,rarity:"rare",isNew:true},
  {id:"bundle_serpent",name:"Serpent Pack",desc:"Serpent + Void themes",icon:"🐍",items:["serpent","void"],price:22,currency:"gems",originalPrice:35,rarity:"legendary",isNew:true},
  {id:"bundle_storm",name:"Storm Pack",desc:"Thunderstorm + Sakura themes",icon:"⚡",items:["storm","sakura"],price:3500,currency:"coins",originalPrice:4000,rarity:"epic",isNew:true},
];

const CRATES=[
  {id:"crate_standard",name:"Standard Crate",desc:"Random common or rare cosmetic",icon:"📦",price:500,currency:"coins",rarity:"common",pool:["classic","midnight","crimson"]},
  {id:"crate_premium",name:"Premium Crate",desc:"Guaranteed rare or better",icon:"💼",price:1200,currency:"coins",rarity:"rare",pool:["emerald","galaxy","neon","inferno","ice"]},
  {id:"crate_legendary",name:"Legendary Crate",desc:"Chance at epic or legendary",icon:"🎰",price:8,currency:"gems",rarity:"epic",pool:["gold","royal","bundle_premium"]},
  {id:"crate_serpent",name:"Serpent Crate",desc:"Chance at legendary Serpent or Void theme",icon:"🐍",price:15,currency:"gems",rarity:"legendary",pool:["serpent","void","bundle_serpent"],isNew:true},
];

const SHOP_AVATARS=[
  {id:"😎",name:"Cool",price:0,currency:"coins"},
  {id:"🤠",name:"Cowboy",price:0,currency:"coins"},
  {id:"🐍",name:"Snake",price:0,currency:"coins"},
  {id:"👑",name:"King",price:300,currency:"coins"},
  {id:"🔥",name:"Fire",price:300,currency:"coins"},
  {id:"💀",name:"Skull",price:300,currency:"coins"},
  {id:"🎭",name:"Drama",price:500,currency:"coins"},
  {id:"🃏",name:"Joker",price:500,currency:"coins"},
  {id:"🦊",name:"Fox",price:500,currency:"coins"},
  {id:"🐉",name:"Dragon",price:800,currency:"coins"},
  {id:"🧙",name:"Wizard",price:800,currency:"coins"},
  {id:"🥷",name:"Ninja",price:800,currency:"coins"},
  {id:"👻",name:"Ghost",price:1000,currency:"coins"},
  {id:"🤖",name:"Robot",price:1000,currency:"coins"},
  {id:"🦁",name:"Lion",price:1200,currency:"coins"},
  {id:"💎",name:"Diamond",price:20,currency:"gems"},
  {id:"⚡",name:"Thunder",price:25,currency:"gems"},
  {id:"🌙",name:"Moon",price:30,currency:"gems"},
  {id:"🏆",name:"Trophy",price:40,currency:"gems"},
  {id:"🎯",name:"Target",price:50,currency:"gems"},
  {id:"🦅",name:"Eagle",price:600,currency:"coins"},
  {id:"🐺",name:"Wolf",price:600,currency:"coins"},
  {id:"🦋",name:"Butterfly",price:400,currency:"coins"},
  {id:"🌊",name:"Wave",price:500,currency:"coins"},
  {id:"⚔️",name:"Sword",price:700,currency:"coins"},
  {id:"🎪",name:"Circus",price:500,currency:"coins"},
  {id:"🧊",name:"Ice",price:600,currency:"coins"},
  {id:"🌋",name:"Volcano",price:900,currency:"coins"},
  {id:"🦄",name:"Unicorn",price:35,currency:"gems"},
  {id:"👁️",name:"Eye",price:45,currency:"gems"},
  {id:"🔮",name:"Crystal",price:50,currency:"gems"},
  {id:"🐲",name:"Dragon Lord",price:0,currency:"coins",vipOnly:true},
  {id:"👸",name:"Queen",price:0,currency:"coins",vipOnly:true},
  {id:"🧬",name:"DNA",price:0,currency:"coins",vipOnly:true},
  {id:"🌠",name:"Shooting Star",price:0,currency:"coins",vipOnly:true},
  {id:"🦚",name:"Peacock",price:0,currency:"coins",vipOnly:true},
  {id:"🎆",name:"Fireworks",price:0,currency:"coins",vipOnly:true},
  {id:"🔱",name:"Trident",price:0,currency:"coins",vipOnly:true},
  {id:"⚜️",name:"Fleur",price:0,currency:"coins",vipOnly:true},
  {id:"🌊",name:"Tsunami",price:0,currency:"coins",vipOnly:true},
  {id:"🦋",name:"Emperor Butterfly",price:0,currency:"coins",vipOnly:true},
];

function Card({card,selected,onClick,size,faceDown,clickable,dimmed,glow,dealIdx,theme}){
  const [hov,setHov]=useState(false);
  size=size||"md";dealIdx=dealIdx||0;
  const red=card&&isRed(card);
  const D={xs:{w:32,h:46,fs:7.5,su:13,r:5},sm:{w:44,h:63,fs:10,su:18,r:6},md:{w:58,h:84,fs:13,su:25,r:8},lg:{w:68,h:98,fs:15,su:30,r:10}};
  const d=D[size]||D.md;
  const isFace=card&&["J","Q","K","A"].includes(card.value);
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
      <div style={{position:"absolute",top:5,left:5,right:5,bottom:5,borderRadius:d.r-3,overflow:"hidden",backgroundImage:"repeating-linear-gradient(45deg,"+th.pat+" 0,"+th.pat+" 1px,transparent 1px,transparent 7px),repeating-linear-gradient(-45deg,"+th.pat2+" 0,"+th.pat2+" 1px,transparent 1px,transparent 7px)"}}/>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:d.su*0.72,opacity:0.25}}>🐍</div>
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
        boxShadow:selected?"0 12px 32px rgba(212,168,67,0.5),0 4px 12px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.95)":glow?"0 0 20px rgba(74,222,128,0.45),0 6px 20px rgba(0,0,0,0.55)":hov&&clickable?"0 8px 20px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.95)":"0 4px 12px rgba(0,0,0,0.4),0 1px 3px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.95)",
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
      <div style={{position:"absolute",top:0,left:0,right:0,height:"40%",background:"linear-gradient(180deg,rgba(255,255,255,0.06)0%,transparent)",borderRadius:d.r+"px "+d.r+"px 0 0",pointerEvents:"none"}}/>
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
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,marginBottom:2,color:out?"#4b5563":active?"#d4a843":danger?"#f87171":warn?"#f59e0b":"#2a3d20",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:60,display:"flex",alignItems:"center",justifyContent:"center",gap:2}}>{avatars[i]?<span style={{marginRight:2}}>{avatars[i]}</span>:null}{out?"ELIMINATED":n}{i===0&&<div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:"50%",background:"linear-gradient(135deg,#d4a843,#a87020)",fontFamily:"Cinzel,serif",fontSize:8,fontWeight:900,color:"#010603",boxShadow:"0 0 8px rgba(212,168,67,0.6)",animation:"pulse 2s ease-in-out infinite",marginLeft:4,flexShrink:0}}>D</div>}</div>
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

var _settingsPop=null;
var _notifsEnabled=false;
var _notifToggle=null;
var _sfxPackGlobal="classic";
var _setSfxPackGlobal=null;
function SettingsPanel({open,onClose,sfxMuted,musicMuted,onToggleSfx,onToggleMusic,onHowToPlay,gameStats,cardTheme,setCardTheme,notifsEnabled,onToggleNotifs,sfxPack,onSetSfxPack}){
  var resolvedSfxPack=sfxPack||_sfxPackGlobal||"classic";
  var resolvedSetSfxPack=onSetSfxPack||_setSfxPackGlobal||null;
  var resolvedNotifsEnabled=notifsEnabled!==undefined?notifsEnabled:_notifsEnabled;
  var resolvedNotifToggle=typeof onToggleNotifs==="function"?onToggleNotifs:(typeof _notifToggle==="function"?_notifToggle:null);
  var onPop=_settingsPop;
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
            <div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#6a9a6e",fontSize:11,marginTop:2}}>COBRA v2.0 PREMIUM</div>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(212,168,67,0.2)",background:"rgba(212,168,67,0.06)",color:"#d4a843",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>✕</button>
        </div>

        <div style={{padding:"0 22px",flex:1}}>

          {/* AUDIO */}
          <div style={{paddingTop:20}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#8ab08a",letterSpacing:4,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>🔊</span> AUDIO
            </div>
            {[
              {label:"Sound Effects",sub:"Game sounds & feedback",active:!sfxMuted,onToggle:onToggleSfx},
              {label:"Music",sub:"Ambient background music",active:!musicMuted,onToggle:onToggleMusic}
            ].map(function(item){return(
              <div key={item.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Crimson Text,serif",color:"#c8d8c8",fontSize:15,lineHeight:1.2}}>{item.label}</div>
                  <div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#7a9a7a",fontSize:12,marginTop:1}}>{item.sub}</div>
                </div>
                <PremiumToggle active={item.active} onToggle={item.onToggle}/>
              </div>
            );})}
          </div>

          {/* SFX PACK */}
          {!sfxMuted&&(
            <div style={{marginBottom:16}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#8ab08a",letterSpacing:3,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>🎵</span> SFX PACK</div>
              <div style={{display:"flex",gap:6}}>
                {[{id:"classic",label:"Classic",icon:"🎵"},{id:"retro",label:"Retro",icon:"👾"},{id:"minimal",label:"Minimal",icon:"🔇"}].map(function(pack){
                  var active=resolvedSfxPack===pack.id;
                  return(
                    <button key={pack.id} onClick={function(){if(resolvedSetSfxPack)resolvedSetSfxPack(pack.id);audio.buttonClick();}} style={{flex:1,padding:"8px 4px",borderRadius:10,border:active?"1.5px solid rgba(212,168,67,0.6)":"1px solid rgba(255,255,255,0.1)",background:active?"rgba(212,168,67,0.12)":"rgba(255,255,255,0.04)",cursor:"pointer",touchAction:"manipulation",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                      <span style={{fontSize:16}}>{pack.icon}</span>
                      <span style={{fontFamily:"Cinzel,serif",fontSize:8,color:active?"#d4a843":"#8a9a8a",letterSpacing:1}}>{pack.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {"Notification" in window && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#d4a843",letterSpacing:2}}>🔔 NOTIFICATIONS</div>
                <div style={{fontFamily:"Crimson Text,serif",color:"#6a8a6e",fontSize:12,marginTop:2}}>Daily missions, challenges & streak</div>
              </div>
              <PremiumToggle active={!!resolvedNotifsEnabled} onToggle={function(){
                if(typeof resolvedNotifToggle==="function")resolvedNotifToggle();
              }}/>
            </div>
          )}

          <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.15),transparent)",margin:"4px 0 0"}}/>

          {/* GAME */}
          <div style={{paddingTop:18}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#8ab08a",letterSpacing:4,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
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
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#8ab08a",letterSpacing:4,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>📊</span> STATISTICS
            </div>
            {gameStats.rounds===0&&<div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#7a9a7a",fontSize:13,textAlign:"center",marginBottom:12}}>No games played yet</div>}
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
                  <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"#7a9a7a",letterSpacing:1,marginTop:4,textTransform:"uppercase"}}>{s.label}</div>
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
        <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"#8aaa8a",marginTop:1}}>{ach.desc}</div>
      </div>
    </div>
  );
}

function TitleUnlockModal({title,onClose,onGoCollection}){
  const [show,setShow]=useState(false);
  useEffect(function(){var t=setTimeout(function(){setShow(true);},60);return function(){clearTimeout(t);};},[]);
  var rc=RARITY_COLORS[title.rarity]||"#f0c060";
  var rg=RARITY_GLOW[title.rarity]||"rgba(240,192,96,0.4)";
  return(
    <div style={{position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",backdropFilter:"blur(10px)",padding:"24px"}}>
      <style>{`
        @keyframes titleReveal{0%{transform:scale(0.4) rotate(-6deg);opacity:0}60%{transform:scale(1.08) rotate(1deg);opacity:1}80%{transform:scale(0.97)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes titleGlow{0%,100%{box-shadow:0 0 40px ${rg},0 0 80px ${rg}33}50%{box-shadow:0 0 60px ${rg},0 0 120px ${rg}55}}
        @keyframes titleShimmer{0%{background-position:200% center}100%{background-position:-200% center}}
      `}</style>
      <div style={{maxWidth:320,width:"100%",textAlign:"center",animation:show?"titleReveal 0.6s cubic-bezier(.34,1.56,.64,1) both":"none"}}>
        {/* Sparkle ring */}
        <div style={{fontSize:48,marginBottom:12,filter:"drop-shadow(0 0 20px "+rc+"88)"}}>🎖️</div>
        <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:4,color:"rgba(255,255,255,0.5)",marginBottom:8}}>TITLE UNLOCKED</div>
        {/* Title card */}
        <div style={{borderRadius:24,padding:"28px 32px",background:"linear-gradient(145deg,rgba(10,10,5,0.98),rgba(5,5,3,0.99))",border:"2px solid "+rc,boxShadow:"0 0 50px "+rg+", inset 0 1px 0 rgba(255,255,255,0.07)",animation:"titleGlow 2s ease-in-out infinite",marginBottom:20}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:26,fontWeight:900,letterSpacing:3,color:rc,textShadow:"0 0 20px "+rc,background:"linear-gradient(90deg,"+rc+",#ffffff,"+rc+")",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",backgroundSize:"200% auto",animation:"titleShimmer 3s linear infinite",marginBottom:10}}>
            {title.name}
          </div>
          <div style={{display:"inline-block",background:rc+"22",border:"1px solid "+rc+"55",borderRadius:8,padding:"4px 14px",fontFamily:"Cinzel,serif",fontSize:9,color:rc,letterSpacing:2}}>
            {title.rarity.toUpperCase()}
          </div>
        </div>
        {/* Buttons */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button onClick={function(){audio.buttonClick();onGoCollection();}} style={{width:"100%",padding:"14px",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,background:"linear-gradient(135deg,#c49030,#f0c060)",border:"none",borderRadius:14,color:"#010603",cursor:"pointer",touchAction:"manipulation",fontWeight:900,boxShadow:"0 4px 20px rgba(212,168,67,0.5)"}}>
            📚 GO TO COLLECTION
          </button>
          <button onClick={function(){audio.buttonClick();onClose();}} style={{width:"100%",padding:"12px",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.15)",borderRadius:14,color:"rgba(255,255,255,0.7)",cursor:"pointer",touchAction:"manipulation"}}>
            CLOSE
          </button>
        </div>
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

function DailyLoginModal({data,onClose}){
  var days=["MON","TUE","WED","THU","FRI","SAT","SUN"];
  var rewards=[
    {coins:100,gems:0},{coins:150,gems:0},{coins:200,gems:1},
    {coins:250,gems:1},{coins:300,gems:2},{coins:400,gems:2},{coins:500,gems:5}
  ];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}} onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(170deg,#0d1f0e,#060e06)",border:"1.5px solid rgba(212,168,67,0.4)",borderRadius:24,padding:"28px 24px",width:"100%",maxWidth:360,animation:"slideUp 0.4s cubic-bezier(.22,1,.36,1) both"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48,marginBottom:8}}>🎁</div>
          <h2 style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:900,color:"#f0c060",letterSpacing:4,marginBottom:4}}>DAILY BONUS</h2>
          <p style={{fontFamily:"Crimson Text,serif",color:"#7a9a7e",fontSize:14,fontStyle:"italic"}}>Day {data.streak} login streak</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:20}}>
          {days.map(function(d,i){
            var done=i<data.day;
            var active=i===data.day;
            var r=rewards[i];
            return(
              <div key={i} style={{background:active?"rgba(212,168,67,0.2)":done?"rgba(74,222,128,0.08)":"rgba(255,255,255,0.03)",border:active?"1.5px solid rgba(212,168,67,0.7)":done?"1px solid rgba(74,222,128,0.3)":"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"6px 2px",textAlign:"center"}}>
                <div style={{fontSize:9,fontFamily:"Cinzel,serif",color:active?"#f0c060":done?"#4ade80":"#4a6a4e",letterSpacing:1,marginBottom:3}}>{d}</div>
                <div style={{fontSize:14}}>{done?"✅":active?"⭐":r.gems>0?"💎":"🪙"}</div>
                <div style={{fontSize:8,color:active?"#f0c060":done?"#4ade80":"#4a6a4e",fontFamily:"Cinzel,serif",marginTop:2}}>{r.gems>0?"+"+r.gems+"💎":"+"+r.coins}</div>
              </div>
            );
          })}
        </div>
        <div style={{background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.3)",borderRadius:14,padding:"14px",textAlign:"center",marginBottom:18}}>
          {data.vipBonus&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#f0c060",letterSpacing:2,marginBottom:8}}>👑 VIP 2x BONUS!</div>}
          <p style={{fontFamily:"Crimson Text,serif",color:"#a09060",fontSize:13,marginBottom:6}}>Today's reward</p>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16}}>
            <span style={{fontFamily:"Cinzel,serif",fontSize:22,color:"#f0c060"}}>🪙 +{data.coins}</span>
            {data.gems>0&&<span style={{fontFamily:"Cinzel,serif",fontSize:22,color:"#60c8f0"}}>💎 +{data.gems}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#d4a843,#a87020)",border:"none",borderRadius:12,fontFamily:"Cinzel,serif",fontSize:15,fontWeight:700,color:"#010603",letterSpacing:3,cursor:"pointer"}}>CLAIM</button>
      </div>
    </div>
  );
}

function SplashScreen({onDone}){
  useEffect(function(){
    var t=setTimeout(onDone,1500);
    return function(){clearTimeout(t);};
  },[]);
  return(
    <div style={{position:"fixed",inset:0,background:"#010603",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999,animation:"fadeIn 0.3s ease"}}>
      <div style={{animation:"splashPop 0.6s cubic-bezier(.22,1.4,.36,1) both"}}>
        <div style={{marginBottom:16,animation:"float 2s ease-in-out infinite"}}>
          <span style={{fontSize:90,lineHeight:1,display:"block",textAlign:"center"}}>🐍</span>
        </div>
        <h1 style={{fontFamily:"Cinzel,serif",fontSize:58,fontWeight:900,letterSpacing:12,background:"linear-gradient(175deg,#f4cc52,#d4a843,#a87020)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",textAlign:"center",marginBottom:8}}>COBRA</h1>
        <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#6a9a6e",fontSize:16,letterSpacing:6,textAlign:"center"}}>the ultimate card game</p>
      </div>
      <div style={{position:"absolute",bottom:"calc(60px + env(safe-area-inset-bottom))",display:"flex",gap:6}}>
        {[0,1,2].map(function(i){return(
          <div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#d4a843",opacity:0.6,animation:"thinkDot 1.2s ease-in-out infinite",animationDelay:(i*0.2)+"s"}}/>
        );})}
      </div>
    </div>
  );
}

function ProfileScreen({name,avatar,level,xp,xpForLevel,coins,gems,stats,onClose,isVIP}){
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
          <div style={{fontFamily:"Cinzel,serif",fontSize:20,fontWeight:700,letterSpacing:2,background:"linear-gradient(135deg,#f4cc52,#d4a843)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",display:"flex",alignItems:"center",justifyContent:"center"}}>{name||"Player"}{isVIP&&<VIPBadge/>}</div>
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

function AchievementsScreen({goScreen,gameStats,achProgress,claimedAchs,onClaim,playerLevel,showSettings,setShowSettings,sfxMuted,musicMuted,sfxToggle,musToggle,cardTheme,setCardTheme}){
  const [cat,setCat]=useState("all");
  const cats=[["all","ALL"],["gameplay","GAMEPLAY"],["streak","STREAKS"],["progression","PROGRESS"],["rewards","REWARDS"]];
  var filtered=cat==="all"?ACHIEVEMENTS:ACHIEVEMENTS.filter(function(a){return a.cat===cat;});
  function getProgress(a){
    if(a.stat==="wins")return Math.min(a.goal,gameStats.wins||0);
    if(a.stat==="rounds")return Math.min(a.goal,gameStats.rounds||0);
    if(a.stat==="cobras")return Math.min(a.goal,gameStats.cobras||0);
    if(a.stat==="bestStreak")return Math.min(a.goal,gameStats.bestStreak||0);
    if(a.stat==="level")return Math.min(a.goal,playerLevel||1);
    return Math.min(a.goal,achProgress[a.stat]||0);
  }
  var totalClaimed=claimedAchs.length;
  var totalUnlocked=ACHIEVEMENTS.filter(function(a){return getProgress(a)>=a.goal;}).length;
  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",height:"100%",maxHeight:"100vh",overflow:"hidden"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{flexShrink:0,padding:"calc(16px + env(safe-area-inset-top)) 18px 0"}}>
        <button className="btn_btn_ghost" style={{marginBottom:12,padding:"10px 16px",fontSize:11}} onClick={function(){audio.buttonClick();goScreen("home");}}>← BACK</button>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:32,marginBottom:4}}>🏆</div>
          <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:20,letterSpacing:4,margin:"0 0 6px",textShadow:"0 0 20px rgba(212,168,67,0.3)"}}>ACHIEVEMENTS</h2>
          <div style={{display:"flex",gap:14,justifyContent:"center"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#4ade80"}}>{totalClaimed}/{ACHIEVEMENTS.length} CLAIMED</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#d4a843"}}>{totalUnlocked} UNLOCKED</div>
          </div>
          <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.07)",margin:"10px 0 0",overflow:"hidden"}}>
            <div style={{height:"100%",width:Math.round(totalClaimed/ACHIEVEMENTS.length*100)+"%",background:"linear-gradient(90deg,#c49030,#f0c060)",borderRadius:2,transition:"width 0.6s cubic-bezier(.22,1,.36,1)"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:8}}>
          {cats.map(function(c){var active=cat===c[0];return(
            <button key={c[0]} onClick={function(){audio.buttonClick();setCat(c[0]);}} style={{flexShrink:0,padding:"7px 12px",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1.5,border:active?"1.5px solid rgba(212,168,67,0.6)":"1.5px solid rgba(255,255,255,0.08)",borderRadius:20,cursor:"pointer",background:active?"rgba(212,168,67,0.15)":"rgba(0,0,0,0.3)",color:active?"#f0c060":"#8aaa8a",touchAction:"manipulation",transition:"all 0.15s"}}>
              {c[1]}
            </button>
          );})}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"4px 18px calc(20px + env(safe-area-inset-bottom))"}}>
        {filtered.map(function(a){
          var prog=getProgress(a);
          var done=prog>=a.goal;
          var claimed=claimedAchs.indexOf(a.id)>=0;
          var pct=Math.min(100,Math.round(prog/a.goal*100));
          return(
            <div key={a.id} style={{marginBottom:10,borderRadius:16,padding:"14px 16px",background:claimed?"rgba(74,222,128,0.05)":done?"rgba(212,168,67,0.08)":"rgba(0,0,0,0.3)",border:claimed?"1.5px solid rgba(74,222,128,0.25)":done?"1.5px solid rgba(212,168,67,0.4)":"1px solid rgba(255,255,255,0.07)",transition:"all 0.2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:44,height:44,borderRadius:12,background:claimed?"rgba(74,222,128,0.15)":done?"rgba(212,168,67,0.15)":"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,border:claimed?"1px solid rgba(74,222,128,0.3)":done?"1px solid rgba(212,168,67,0.3)":"1px solid rgba(255,255,255,0.07)",filter:claimed||done?"none":"grayscale(0.7) opacity(0.5)"}}>
                  {claimed?"✅":a.icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                    <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:claimed?"#4ade80":done?"#f0c060":"#8a9a8a",fontWeight:700,letterSpacing:0.5}}>{a.name}</span>
                    {a.title&&<span style={{fontFamily:"Cinzel,serif",fontSize:7,color:"#c084fc",background:"rgba(192,132,252,0.15)",padding:"2px 6px",borderRadius:5,letterSpacing:1}}>+TITLE</span>}
                  </div>
                  <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"#9aba9a",marginBottom:6}}>{a.desc}</div>
                  <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.07)",overflow:"hidden",marginBottom:4}}>
                    <div style={{height:"100%",width:pct+"%",background:claimed?"linear-gradient(90deg,#4ade80,#22c55e)":done?"linear-gradient(90deg,#c49030,#f0c060)":"linear-gradient(90deg,#1a4a1a,#2a6a2a)",borderRadius:2,transition:"width 0.6s"}}/>
                  </div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#7a9a7a",letterSpacing:1}}>{prog}/{a.goal}</div>
                </div>
                <div style={{flexShrink:0,textAlign:"right"}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#f0c060",marginBottom:4}}>
                    {a.reward.coins>0&&"🪙"+a.reward.coins}
                    {a.reward.gems>0&&" 💎"+a.reward.gems}
                  </div>
                  {done&&!claimed&&(
                    <button onClick={function(){onClaim(a.id);}} style={{padding:"7px 14px",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,background:"linear-gradient(135deg,#c49030,#f0c060)",border:"none",borderRadius:9,color:"#010603",cursor:"pointer",touchAction:"manipulation",fontWeight:900,boxShadow:"0 2px 12px rgba(212,168,67,0.4)"}}>
                      CLAIM
                    </button>
                  )}
                  {claimed&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#4ade80",letterSpacing:1}}>✓ DONE</div>}
                  {!done&&!claimed&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#6a9a6a",letterSpacing:1}}>{pct}%</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );
}

function MissionsScreen({goScreen,gameStats,achProgress,dailyMissions,weeklyMissions,onClaimMission,missionStreak,showSettings,setShowSettings,sfxMuted,musicMuted,sfxToggle,musToggle,cardTheme,setCardTheme}){
  const [tab,setTab]=useState("daily");
  var missions=tab==="daily"?dailyMissions:weeklyMissions;
  var now=Date.now();
  var dailySeed=Math.floor(now/(1000*60*60*24));
  var weeklySeed=Math.floor(now/(1000*60*60*24*7));
  var nextDaily=new Date((dailySeed+1)*1000*60*60*24);
  var nextWeekly=new Date((weeklySeed+1)*1000*60*60*24*7);
  var msLeft=tab==="daily"?nextDaily.getTime()-now:nextWeekly.getTime()-now;
  var hLeft=Math.floor(msLeft/3600000);
  var mLeft=Math.floor((msLeft%3600000)/60000);
  function getMProg(m){
    if(!m)return 0;
    if(m.stat==="wins")return Math.min(m.goal,gameStats.wins||0);
    if(m.stat==="rounds")return Math.min(m.goal,gameStats.rounds||0);
    if(m.stat==="cobras")return Math.min(m.goal,gameStats.cobras||0);
    if(m.stat==="bestStreak")return Math.min(m.goal,gameStats.bestStreak||0);
    return Math.min(m.goal,achProgress[m.stat]||0);
  }
  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",height:"100%",maxHeight:"100vh",overflow:"hidden"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{flexShrink:0,padding:"calc(16px + env(safe-area-inset-top)) 18px 0"}}>
        <button className="btn_btn_ghost" style={{marginBottom:12,padding:"10px 16px",fontSize:11}} onClick={function(){audio.buttonClick();goScreen("home");}}>← BACK</button>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:32,marginBottom:4}}>🎯</div>
          <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:20,letterSpacing:4,margin:"0 0 6px"}}>MISSIONS</h2>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#7a9a7a",letterSpacing:2}}>RESETS IN {hLeft}h {mLeft}m</div>
        </div>
        <div style={{background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.25)",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:24}}>🔥</span>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#f0c060",letterSpacing:2}}>MISSION STREAK</div>
            <div style={{fontFamily:"Crimson Text,serif",color:"#8a9a8a",fontSize:13}}>Complete all dailies to keep your streak!</div>
          </div>
          <div style={{marginLeft:"auto",fontFamily:"Cinzel,serif",fontSize:22,color:"#f0c060",fontWeight:900}}>
            {missionStreak} <span style={{fontSize:12}}>days</span>
          </div>
        </div>
        <div style={{display:"flex",gap:6,background:"rgba(255,255,255,0.05)",borderRadius:12,padding:4,marginBottom:12,border:"1px solid rgba(255,255,255,0.08)"}}>
          {[["daily","📅 DAILY"],["weekly","📆 WEEKLY"]].map(function(t){var a=tab===t[0];return(
            <button key={t[0]} onClick={function(){audio.buttonClick();setTab(t[0]);}} style={{flex:1,padding:"10px 4px",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1.5,border:"none",borderRadius:9,cursor:"pointer",background:a?"linear-gradient(135deg,rgba(212,168,67,0.25),rgba(212,168,67,0.12))":"transparent",color:a?"#f0c060":"#8aaa8a",transition:"all 0.2s",touchAction:"manipulation",fontWeight:a?"700":"400"}}>{t[1]}</button>
          );})}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"4px 18px calc(20px + env(safe-area-inset-bottom))"}}>
        {(!missions||!missions.missions)&&<div style={{fontFamily:"Crimson Text,serif",color:"#7a9a7a",textAlign:"center",padding:40,fontStyle:"italic"}}>Loading missions...</div>}
        {missions&&missions.missions&&missions.missions.map(function(m,i){
          var prog=getMProg(m);
          var done=prog>=m.goal;
          var pct=Math.min(100,Math.round(prog/m.goal*100));
          var diff=m.reward.gems>0||m.reward.coins>=300?"HARD":m.reward.coins>=150?"MED":"EASY";
          var diffColor=diff==="HARD"?"#f87171":diff==="MED"?"#f0c060":"#4ade80";
          return(
            <div key={i} style={{marginBottom:12,borderRadius:16,padding:"16px",background:m.claimed?"rgba(74,222,128,0.05)":done?"rgba(212,168,67,0.08)":"rgba(0,0,0,0.3)",border:m.claimed?"1.5px solid rgba(74,222,128,0.2)":done?"1.5px solid rgba(212,168,67,0.35)":"1px solid rgba(255,255,255,0.08)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div style={{width:40,height:40,borderRadius:11,background:m.claimed?"rgba(74,222,128,0.15)":done?"rgba(212,168,67,0.15)":"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:m.claimed?"1px solid rgba(74,222,128,0.3)":done?"1px solid rgba(212,168,67,0.3)":"1px solid rgba(255,255,255,0.07)"}}>
                  {m.claimed?"✅":m.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:m.claimed?"#4ade80":done?"#f0c060":"#c8d8c8",fontWeight:700}}>{m.desc}</div>
                    <span style={{fontFamily:"Cinzel,serif",fontSize:7,color:diffColor,border:"1px solid "+diffColor+"55",borderRadius:4,padding:"1px 5px",letterSpacing:1,flexShrink:0}}>{diff}</span>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {m.reward.xp>0&&<span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#60a5fa"}}>⭐{m.reward.xp} XP</span>}
                    {m.reward.coins>0&&<span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#f0c060"}}>🪙{m.reward.coins}</span>}
                    {m.reward.gems>0&&<span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#c084fc"}}>💎{m.reward.gems}</span>}
                  </div>
                </div>
                {done&&!m.claimed&&(
                  <button onClick={function(){onClaimMission(tab,i,m);}} style={{padding:"8px 14px",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,background:"linear-gradient(135deg,#c49030,#f0c060)",border:"none",borderRadius:9,color:"#010603",cursor:"pointer",touchAction:"manipulation",fontWeight:900,boxShadow:"0 2px 10px rgba(212,168,67,0.4)"}}>CLAIM</button>
                )}
                {m.claimed&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#4ade80"}}>✓</div>}
              </div>
              <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.07)",overflow:"hidden",marginBottom:4}}>
                <div style={{height:"100%",width:pct+"%",background:m.claimed?"linear-gradient(90deg,#4ade80,#22c55e)":done?"linear-gradient(90deg,#d4a843,#f0c060)":"linear-gradient(90deg,#d4a843,#f0c060)",opacity:done||m.claimed?1:0.4,borderRadius:3,transition:"width 0.5s"}}/>
              </div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#6a9a6a",letterSpacing:1}}>{prog}/{m.goal}</div>
            </div>
          );
        })}
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );
}

function CollectionScreen({goScreen,ownedItems,myAvatar,cardTheme,equippedTitle,equippedFrame,unlockedTitles,unlockedFrames,onEquipTitle,onEquipFrame,onEquipAvatar,onEquipTheme,showSettings,setShowSettings,sfxMuted,musicMuted,sfxToggle,musToggle,gameStats,setCardTheme,isVIP}){
  const [tab,setTab]=useState("avatars");
  var ownedAvatars=SHOP_AVATARS.filter(function(a){return (a.price===0&&!a.vipOnly)||ownedItems.indexOf("av_"+a.id)>=0||(a.vipOnly&&isVIP);});
  var ownedThemes=SHOP_THEMES.filter(function(t){return (t.price===0&&!t.vipOnly)||ownedItems.indexOf(t.id)>=0||(t.vipOnly&&isVIP);});
  var TXT="#e8f0e8";var TXT2="#c0d8c0";var DIM="rgba(255,255,255,0.45)";
  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",height:"100%",maxHeight:"100vh",overflow:"hidden"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{flexShrink:0,padding:"calc(16px + env(safe-area-inset-top)) 18px 0"}}>
        <button className="btn_btn_ghost" style={{marginBottom:12,padding:"10px 16px",fontSize:11}} onClick={function(){audio.buttonClick();goScreen("home");}}>← BACK</button>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:32,marginBottom:4}}>📚</div>
          <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:20,letterSpacing:4,margin:0}}>COLLECTION</h2>
        </div>
        <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:8}}>
          {[["avatars","😎"],["themes","🎨"],["frames","🖼️"],["titles","🎖️"]].map(function(t){var a=tab===t[0];return(
            <button key={t[0]} onClick={function(){audio.buttonClick();setTab(t[0]);}} style={{flexShrink:0,padding:"8px 14px",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1.5,border:a?"1.5px solid rgba(212,168,67,0.6)":"1.5px solid rgba(255,255,255,0.2)",borderRadius:20,cursor:"pointer",background:a?"rgba(212,168,67,0.18)":"rgba(255,255,255,0.06)",color:a?"#f0c060":TXT2,touchAction:"manipulation",transition:"all 0.15s"}}>
              {t[1]} {t[0].toUpperCase()}
            </button>
          );})}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"4px 18px calc(20px + env(safe-area-inset-bottom))"}}>
        {tab==="avatars"&&(
          <>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:TXT2,letterSpacing:2,marginBottom:12}}>{ownedAvatars.length}/{SHOP_AVATARS.length} COLLECTED · TAP TO EQUIP/UNEQUIP</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {SHOP_AVATARS.map(function(item){
                var owned=(item.price===0&&!item.vipOnly)||ownedItems.indexOf("av_"+item.id)>=0||(item.vipOnly&&isVIP);
                var eq=myAvatar===item.id;
                return(<div key={item.id} onClick={function(){if(!owned)return;audio.buttonClick();onEquipAvatar&&onEquipAvatar(eq?"😎":item.id);}} style={{borderRadius:14,padding:"14px 6px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:5,border:eq?"2px solid #f0c060":"1.5px solid rgba(255,255,255,0.15)",background:eq?"rgba(212,168,67,0.18)":"rgba(255,255,255,0.06)",opacity:owned?1:0.4,cursor:owned?"pointer":"default",transition:"all 0.15s",boxShadow:eq?"0 0 18px rgba(212,168,67,0.4)":"none"}}>
                  <div style={{fontSize:28}}>{item.id}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:eq?"#f0c060":TXT,letterSpacing:0.5,textAlign:"center"}}>{item.name.toUpperCase()}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:eq?"#f0c060":owned?"#a0d0a0":"#888",letterSpacing:0.5}}>{eq?"✓ ON":owned?"owned":"🔒"}</div>
                </div>);
              })}
            </div>
          </>
        )}
        {tab==="themes"&&(
          <>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:TXT2,letterSpacing:2,marginBottom:12}}>{ownedThemes.length}/{SHOP_THEMES.length} COLLECTED · TAP TO EQUIP/UNEQUIP</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {SHOP_THEMES.map(function(item){
                var owned=(item.price===0&&!item.vipOnly)||ownedItems.indexOf(item.id)>=0||(item.vipOnly&&isVIP);
                var eq=cardTheme===item.id;
                var th=CARD_THEMES[item.id]||CARD_THEMES.classic;
                return(<div key={item.id} onClick={function(){if(!owned)return;audio.buttonClick();onEquipTheme&&onEquipTheme(eq?"classic":item.id);}} style={{borderRadius:14,overflow:"hidden",border:eq?"2px solid #f0c060":"1.5px solid rgba(255,255,255,0.15)",opacity:owned?1:0.4,cursor:owned?"pointer":"default",boxShadow:eq?"0 0 22px rgba(212,168,67,0.4)":"none",transition:"all 0.15s"}}>
                  <div style={{height:64,background:th.bg,display:"flex",alignItems:"center",justifyContent:"center",gap:8,position:"relative"}}>
                    {[0,1,2].map(function(ci){return(<div key={ci} style={{transform:"rotate("+(ci-1)*6+"deg) translateY("+(ci===1?-4:2)+"px)"}}><Card card={{suit:"♠",value:"A"}} faceDown size="xs" theme={item.id}/></div>);})}
                    {!owned&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🔒</div>}
                    {eq&&<div style={{position:"absolute",top:6,right:10,fontFamily:"Cinzel,serif",fontSize:8,color:"#f0c060",background:"rgba(0,0,0,0.65)",padding:"3px 8px",borderRadius:6}}>✓ ACTIVE</div>}
                  </div>
                  <div style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.05)"}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:eq?"#f0c060":TXT,fontWeight:700}}>{item.name}</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:eq?"#f0c060":owned?"#a0d0a0":"#888"}}>{eq?"TAP TO UNEQUIP":owned?"TAP TO EQUIP":"🔒 LOCKED"}</div>
                  </div>
                </div>);
              })}
            </div>
          </>
        )}
        {tab==="frames"&&(
          <>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:TXT2,letterSpacing:2,marginBottom:12}}>{unlockedFrames.length}/{FRAMES.length} COLLECTED · TAP TO EQUIP/UNEQUIP</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {FRAMES.map(function(frame){
                var owned=unlockedFrames.indexOf(frame.id)>=0;
                var eq=equippedFrame===frame.id;
                var rc=RARITY_COLORS[frame.rarity];
                return(<div key={frame.id} onClick={function(){if(!owned)return;audio.buttonClick();onEquipFrame(eq?"none":frame.id);}} style={{borderRadius:16,padding:"16px 12px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,border:eq?"2px solid "+rc:"1.5px solid rgba(255,255,255,0.15)",background:eq?"rgba(212,168,67,0.08)":"rgba(255,255,255,0.05)",opacity:owned?1:0.4,cursor:owned?"pointer":"default",transition:"all 0.2s",boxShadow:eq?"0 0 18px "+RARITY_GLOW[frame.rarity]:"none"}}>
                  <div style={{width:48,height:48,borderRadius:"50%",border:"3px solid "+(typeof frame.color==="string"&&!frame.color.includes("gradient")?frame.color:"#d4a843"),background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:owned&&frame.glow?"0 0 14px "+frame.glow:"none"}}>🐍</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:eq?rc:TXT,fontWeight:700,textAlign:"center"}}>{frame.name}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:rc,letterSpacing:1}}>{frame.rarity.toUpperCase()}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:eq?rc:owned?"#a0d0a0":"#888"}}>{eq?"✓ EQUIPPED":owned?"tap to equip":"🔒"}</div>
                </div>);
              })}
            </div>
          </>
        )}
        {tab==="titles"&&(
          <>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:TXT2,letterSpacing:2,marginBottom:12}}>{unlockedTitles.length}/{TITLES.length} COLLECTED · TAP TO EQUIP/UNEQUIP</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div onClick={function(){audio.buttonClick();onEquipTitle("");}} style={{borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,border:equippedTitle===""?"1.5px solid rgba(212,168,67,0.5)":"1px solid rgba(255,255,255,0.15)",background:equippedTitle===""?"rgba(212,168,67,0.08)":"rgba(255,255,255,0.05)",cursor:"pointer",touchAction:"manipulation"}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:TXT,flex:1}}>No Title</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:equippedTitle===""?"#f0c060":"#a0d0a0"}}>{equippedTitle===""?"✓ ON":"tap to set"}</div>
              </div>
              {TITLES.map(function(title){
                var owned=unlockedTitles.indexOf(title.id)>=0;
                var eq=equippedTitle===title.id;
                var rc=RARITY_COLORS[title.rarity];
                return(<div key={title.id} onClick={function(){if(!owned)return;audio.buttonClick();onEquipTitle(eq?"":title.id);}} style={{borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,border:eq?"1.5px solid "+rc:"1px solid rgba(255,255,255,0.15)",background:eq?"rgba(212,168,67,0.08)":"rgba(255,255,255,0.05)",opacity:owned?1:0.4,cursor:owned?"pointer":"default",transition:"all 0.2s",boxShadow:eq?"0 0 14px "+RARITY_GLOW[title.rarity]:"none"}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:owned?title.color:TXT2,fontWeight:700,letterSpacing:1,textShadow:eq?"0 0 10px "+title.color:"none"}}>{title.name}</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:rc,letterSpacing:1,marginTop:2}}>{title.rarity.toUpperCase()}</div>
                  </div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:eq?rc:owned?"#a0d0a0":"#888"}}>{eq?"✓ ON":owned?"tap":"🔒"}</div>
                </div>);
              })}
            </div>
          </>
        )}
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );
}

function getEloTierStatic(e){
  if(e>=2000)return{name:"Grandmaster",icon:"👑",color:"#f0c060"};
  if(e>=1800)return{name:"Master",icon:"🏆",color:"#ff8f00"};
  if(e>=1600)return{name:"Diamond",icon:"💠",color:"#b39ddb"};
  if(e>=1400)return{name:"Platinum",icon:"💎",color:"#4dd0e1"};
  if(e>=1200)return{name:"Gold",icon:"🥇",color:"#ffd700"};
  if(e>=1000)return{name:"Silver",icon:"🥈",color:"#c0c0c0"};
  return{name:"Bronze",icon:"🥉",color:"#cd7f32"};
}
// ── ProfileModal (Feature 6) ────────────────────────────────────────────────
function ProfileModal({profile,onClose,friends,onAddFriend}){
  if(!profile)return null;
  var tier=getEloTierStatic(profile.elo||1000);
  var isFriend=friends&&friends.some(function(f){return f.name===profile.name;});
  return(
    <div style={{position:"fixed",inset:0,zIndex:9990,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.82)",backdropFilter:"blur(8px)",padding:20}} onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(160deg,#0a1a0a,#060e06)",border:"1.5px solid rgba(212,168,67,0.3)",borderRadius:24,padding:24,width:"100%",maxWidth:340,boxShadow:"0 24px 60px rgba(0,0,0,0.9)",animation:"declarePop 0.3s cubic-bezier(.22,1,.36,1)"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:52,marginBottom:6}}>{profile.avatar||"😎"}</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:18,color:"#d4a843",letterSpacing:2,fontWeight:700}}>{profile.name}</div>
          {profile.title&&<div style={{fontFamily:"Cinzel,serif",fontSize:10,color:tier.color,letterSpacing:2,marginTop:3}}>{profile.title}</div>}
          <div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:8,padding:"4px 12px",borderRadius:20,background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.2)"}}>
            <span style={{fontSize:16}}>{tier.icon}</span>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:tier.color,letterSpacing:1}}>{tier.name}</span>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(212,168,67,0.6)"}}>{profile.elo||1000}</span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {[["LEVEL",profile.level||1,"⭐"],["WIN RATE",(profile.winRate||0)+"%","🏆"],["COBRAS",profile.cobras||0,"🐍"]].map(function(s){return(
            <div key={s[0]} style={{background:"rgba(0,0,0,0.3)",borderRadius:10,padding:"10px 6px",textAlign:"center",border:"1px solid rgba(255,255,255,0.05)"}}>
              <div style={{fontSize:16,marginBottom:2}}>{s[2]}</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#d4a843",fontWeight:700}}>{s[1]}</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"#7a9a7a",letterSpacing:1,marginTop:2}}>{s[0]}</div>
            </div>
          );})}
        </div>
        {profile.frame&&profile.frame!=="none"&&<div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#8a9a7a",textAlign:"center",marginBottom:12}}>🖼️ Frame: {profile.frame}</div>}
        <div style={{display:"flex",gap:10}}>
          <button className="btn_btn_ghost" style={{flex:1,padding:"12px",fontSize:11,letterSpacing:1}} onClick={onClose}>CLOSE</button>
          {!isFriend&&<button className="btn_btn_gold" style={{flex:1,padding:"12px",fontSize:11,letterSpacing:1}} onClick={function(){onAddFriend&&onAddFriend(profile);onClose();}}>+ ADD FRIEND</button>}
          {isFriend&&<div style={{flex:1,padding:"12px",textAlign:"center",fontFamily:"Cinzel,serif",fontSize:11,color:"#4ade80"}}>✓ FRIENDS</div>}
        </div>
      </div>
    </div>
  );
}

// ── GiftModal (Feature 15) ──────────────────────────────────────────────────
function GiftModal({friend,open,onClose,coins,onSendGift}){
  var [selected,setSelected]=useState(null);
  var options=[
    {label:"100 coins",coins:100,icon:"🪙"},
    {label:"250 coins",coins:250,icon:"🪙"},
    {label:"500 coins",coins:500,icon:"🪙"},
    {label:"Random Theme",coins:200,icon:"🎁",special:true},
  ];
  if(!open||!friend)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:9995,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.82)",backdropFilter:"blur(8px)",padding:20}} onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(160deg,#0a1a0a,#060e06)",border:"1.5px solid rgba(240,192,96,0.35)",borderRadius:24,padding:24,width:"100%",maxWidth:320,animation:"declarePop 0.3s cubic-bezier(.22,1,.36,1)"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:36,marginBottom:4}}>🎁</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:15,color:"#f0c060",letterSpacing:2}}>SEND GIFT</div>
          <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"#8a9a7a",marginTop:4}}>To: {friend.name}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {options.map(function(opt){
            var canAfford=coins>=opt.coins;
            return(
              <button key={opt.label} onClick={function(){if(canAfford)setSelected(opt);}} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,border:selected===opt?"1.5px solid #f0c060":"1px solid rgba(255,255,255,0.1)",background:selected===opt?"rgba(240,192,96,0.1)":"rgba(0,0,0,0.25)",cursor:canAfford?"pointer":"not-allowed",opacity:canAfford?1:0.4,touchAction:"manipulation"}}>
                <span style={{fontSize:20}}>{opt.icon}</span>
                <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:selected===opt?"#f0c060":"#c8d8c8",flex:1,textAlign:"left"}}>{opt.label}</span>
                <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#7a9a7a"}}>({opt.coins} 🪙)</span>
              </button>
            );
          })}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn_btn_ghost" style={{flex:1,padding:"12px",fontSize:11}} onClick={onClose}>CANCEL</button>
          <button className="btn_btn_gold" style={{flex:1,padding:"12px",fontSize:11}} disabled={!selected} onClick={function(){if(selected)onSendGift(friend,selected);onClose();}}>SEND</button>
        </div>
      </div>
    </div>
  );
}

var MOCK_LEADERBOARD=[
  {rank:1,name:"CobraKing88",avatar:"👑",elo:2420,wins:312,tier:"Grandmaster"},
  {rank:2,name:"VenomStrike",avatar:"🐍",elo:2210,wins:287,tier:"Grandmaster"},
  {rank:3,name:"ShadowAce",avatar:"😈",elo:2080,wins:251,tier:"Master"},
  {rank:4,name:"DarkPhoenix",avatar:"🦅",elo:1980,wins:228,tier:"Master"},
  {rank:5,name:"NightBlade",avatar:"🥷",elo:1870,wins:196,tier:"Master"},
  {rank:6,name:"CrimsonFang",avatar:"🦊",elo:1760,wins:174,tier:"Diamond"},
  {rank:7,name:"IronSerpent",avatar:"⚔️",elo:1650,wins:152,tier:"Diamond"},
  {rank:8,name:"ThunderAce",avatar:"⚡",elo:1590,wins:138,tier:"Platinum"},
  {rank:9,name:"FrostByte",avatar:"🧊",elo:1510,wins:122,tier:"Platinum"},
  {rank:10,name:"GoldRush",avatar:"💎",elo:1440,wins:108,tier:"Gold"},
];

function LeaderboardScreen({goScreen,showSettings,setShowSettings,sfxMuted,musicMuted,sfxToggle,musToggle,gameStats,cardTheme,setCardTheme,elo,myName}){
  var localTier=getEloTierStatic(elo||1000);
  const [leaders,setLeaders]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [lbTab,setLbTab]=useState("global");
  const [viewProfile,setViewProfile]=useState(null);
  const [friends,setFriends]=useState(function(){try{var v=localStorage.getItem("cobra_friends");return v?JSON.parse(v):[];}catch(e){return[];}});
  useEffect(function(){
    if(!supabase){setError(true);setLoading(false);return;}
    supabase.from("cobra_scores").select("*").order("wins",{ascending:false}).limit(100).then(function(res){
      if(res.error||!res.data){setError(true);setLoading(false);return;}
      setLeaders(res.data);setLoading(false);
    }).catch(function(){setError(true);setLoading(false);});
  },[]);

  var myRankInMock=MOCK_LEADERBOARD.findIndex(function(r){return r.name===myName;});
  var myMockRank=myRankInMock>=0?myRankInMock+1:null;
  var displayList=lbTab==="global"?(leaders&&leaders.length>0?leaders:MOCK_LEADERBOARD):friends.map(function(f,i){return{...f,rank:i+1,wins:f.wins||0};});
  var tabStyle=function(t){return{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,padding:"10px 0",cursor:"pointer",background:"none",border:"none",borderBottom:lbTab===t?"2px solid #d4a843":"2px solid transparent",color:lbTab===t?"#d4a843":"#6a8a6e",flex:1,touchAction:"manipulation"};};
  return(
    <div className="feltbg" style={{display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"28px 20px",overflowY:"auto"}}>
      <style>{GS}</style>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{maxWidth:420,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
        <button className="btn_btn_ghost" style={{marginBottom:18,padding:"12px 18px",fontSize:12}} onClick={function(){audio.buttonClick();goScreen("home");}}>BACK</button>
        <div style={{textAlign:"center",marginBottom:16}}>
          <span style={{fontSize:40}}>🏆</span>
          <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:22,letterSpacing:4,marginTop:8}}>LEADERBOARD</h2>
          <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#8aaa8a",fontSize:14,marginTop:4}}>Top players worldwide</p>
        </div>
        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:16}}>
          <button style={tabStyle("global")} onClick={function(){setLbTab("global");}}>🌍 GLOBAL</button>
          <button style={tabStyle("friends")} onClick={function(){setLbTab("friends");}}>👥 FRIENDS</button>
        </div>
        {/* Local ELO rank card (highlighted as "You") */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:14,marginBottom:16,background:"rgba(212,168,67,0.08)",border:"1.5px solid rgba(212,168,67,0.35)"}}>
          <span style={{fontSize:24}}>{localTier.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:localTier.color,letterSpacing:1,fontWeight:700}}>{localTier.name}</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"rgba(255,255,255,0.5)"}}>{myName||"You"} {myMockRank?"· Rank #"+myMockRank:""}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:18,fontWeight:900,color:localTier.color}}>{elo||1000}</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1}}>ELO</div>
          </div>
        </div>
        {loading&&lbTab==="global"&&<div style={{textAlign:"center",padding:20}}><ThinkingDots/></div>}
        {lbTab==="friends"&&friends.length===0&&<div style={{fontFamily:"Crimson Text,serif",color:"#5a7a60",fontSize:15,textAlign:"center",padding:24,fontStyle:"italic"}}>Add friends to see them here!</div>}
        {(function(){
          var rows=lbTab==="global"?(leaders&&leaders.length>0?leaders:MOCK_LEADERBOARD):friends.map(function(f,i){return{name:f.name,avatar:f.avatar||"😎",elo:f.elo||1000,wins:0,id:f.name,rank:i+1};});
          return rows.slice(0,lbTab==="global"?100:50).map(function(row,i){
            var medal=i===0?"👑":i===1?"🥈":i===2?"🥉":"#"+(i+1);
            var rowElo=row.elo||1000;
            var rowTier=getEloTierStatic(rowElo);
            var isMe=row.name===myName;
            return(
              <div key={row.id||i} onClick={function(){setViewProfile({name:row.name,avatar:row.avatar||"😎",elo:rowElo,level:Math.max(1,Math.floor(rowElo/100)),winRate:row.wins>0?Math.round(row.wins/(row.wins+10)*100):0,cobras:0,title:rowTier.name,frame:"none"});}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,marginBottom:8,background:isMe?"rgba(212,168,67,0.12)":i===0?"rgba(212,168,67,0.06)":"rgba(0,0,0,0.28)",border:isMe?"1.5px solid rgba(212,168,67,0.5)":i===0?"1.5px solid rgba(212,168,67,0.2)":"1px solid rgba(255,255,255,0.06)",cursor:"pointer"}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:i<3?22:13,width:28,textAlign:"center",flexShrink:0,color:i===0?"#d4a843":i===1?"#c0c0c0":i===2?"#cd7f32":"#3a5a3a"}}>{medal}</div>
                <div style={{fontSize:22,flexShrink:0}}>{row.avatar||"😎"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:isMe?"#f0c060":i===0?"#d4a843":"#c8d8c8",letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.name}{isMe?" (You)":""}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:rowTier.color,letterSpacing:1}}>{rowTier.icon} {rowTier.name}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                  {row.wins>0&&<div style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:900,color:isMe?"#f0c060":"#4ade80"}}>{row.wins}<span style={{fontSize:8,marginLeft:2,color:"#7a9a7a"}}>W</span></div>}
                  <div style={{fontFamily:"Cinzel,serif",fontSize:11,fontWeight:700,color:rowTier.color}}>{rowElo} ELO</div>
                </div>
              </div>
            );
          });
        })()}
      </div>
      {viewProfile&&<ProfileModal profile={viewProfile} onClose={function(){setViewProfile(null);}} friends={friends} onAddFriend={function(p){var newF=[...friends,{name:p.name,avatar:p.avatar,elo:p.elo}];setFriends(newF);try{localStorage.setItem("cobra_friends",JSON.stringify(newF));}catch(e){}}}/>}
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );
}

function CrateOpenModal({reveal,setReveal,onEquipTheme}){
  const [phase,setPhase]=useState("idle"); // idle -> shaking -> tapping -> opening -> revealed
  const [confetti,setConfetti]=useState([]);
  const shakeRef=useRef(null);

  useEffect(function(){
    // Auto-start shake after mount
    var t=setTimeout(function(){setPhase("shaking");},200);
    return function(){clearTimeout(t);};
  },[]);

  function handleTap(){
    if(phase==="shaking"||phase==="idle"){
      audio.buttonClick();
      setPhase("opening");
      setTimeout(function(){
        setPhase("revealed");
        audio.crateOpen&&audio.crateOpen();
        // spawn confetti
        var cf=[];
        for(var i=0;i<40;i++){cf.push({id:i,x:Math.random()*100,color:["#f0c060","#4ade80","#c084fc","#60a5fa","#ffffff","#f87171"][Math.floor(Math.random()*6)],size:Math.random()*8+4,delay:Math.random()*0.4,dur:Math.random()*1.2+1.0});}
        setConfetti(cf);
        setTimeout(function(){setConfetti([]);},3000);
      },900);
    }
  }

  function handleClose(){
    if(reveal.wonTheme&&onEquipTheme){
      onEquipTheme(reveal.wonId);
    }
    setReveal(null);
  }

  var th=reveal.wonTheme;
  var rc=th?RARITY_COLORS[th.rarity]||"#f0c060":"#f0c060";
  var rg=th?RARITY_GLOW[th.rarity]||"rgba(240,192,96,0.4)":"rgba(240,192,96,0.4)";
  var crateIcon=reveal.crate.icon||"📦";

  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.88)",backdropFilter:"blur(8px)"}}>
      <style>{`
        @keyframes crateShake{0%,100%{transform:rotate(0deg) scale(1)}15%{transform:rotate(-8deg) scale(1.05)}30%{transform:rotate(8deg) scale(1.08)}45%{transform:rotate(-6deg) scale(1.06)}60%{transform:rotate(6deg) scale(1.07)}75%{transform:rotate(-4deg) scale(1.05)}90%{transform:rotate(3deg) scale(1.03)}}
        @keyframes crateExplode{0%{transform:scale(1);opacity:1}40%{transform:scale(1.5);opacity:0.8}100%{transform:scale(0.2);opacity:0}}
        @keyframes revealPop{0%{transform:scale(0.2) rotate(-10deg);opacity:0}60%{transform:scale(1.15) rotate(3deg);opacity:1}80%{transform:scale(0.95) rotate(-1deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 30px ${rg},0 0 60px ${rg}40%}50%{box-shadow:0 0 50px ${rg},0 0 100px ${rg}60%}}
        @keyframes cfFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
        @keyframes tapHint{0%,100%{transform:scale(1);opacity:0.7}50%{transform:scale(1.08);opacity:1}}
      `}</style>

      {/* Confetti */}
      {confetti.map(function(c){return(
        <div key={c.id} style={{position:"fixed",left:c.x+"%",top:"-10px",width:c.size,height:c.size,borderRadius:Math.random()>0.5?"50%":"2px",background:c.color,animation:"cfFall "+(c.dur)+"s "+(c.delay)+"s ease-in both",pointerEvents:"none",zIndex:10000}}/>
      );})}

      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:24,padding:"40px 32px",maxWidth:340,width:"100%",textAlign:"center"}}>

        {/* Title */}
        <div style={{fontFamily:"Cinzel,serif",fontSize:13,letterSpacing:4,color:"#d4a843",textShadow:"0 0 20px rgba(212,168,67,0.5)"}}>
          {phase==="revealed"?"YOU GOT":"MYSTERY CRATE"}
        </div>
        <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:"rgba(255,255,255,0.5)"}}>
          {reveal.crate.name}
        </div>

        {/* Crate / Revealed item */}
        {phase!=="revealed"?(
          <div
            onClick={handleTap}
            style={{
              cursor:"pointer",
              fontSize:100,
              lineHeight:1,
              animation:phase==="shaking"?"crateShake 0.6s ease-in-out infinite":phase==="opening"?"crateExplode 0.9s ease-out forwards":"none",
              filter:"drop-shadow(0 0 30px rgba(212,168,67,0.6))",
              touchAction:"manipulation",
              userSelect:"none",
            }}
          >
            {crateIcon}
          </div>
        ):(
          <div style={{animation:"revealPop 0.6s cubic-bezier(.34,1.56,.64,1) both"}}>
            <div style={{borderRadius:24,padding:"28px 32px",background:"linear-gradient(145deg,rgba(20,20,10,0.95),rgba(10,10,5,0.98))",border:"2px solid "+rc,boxShadow:"0 0 40px "+rg+", inset 0 1px 0 rgba(255,255,255,0.08)",animation:"glowPulse 1.8s ease-in-out infinite",display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
              {/* Theme preview cards */}
              {th&&(
                <div style={{display:"flex",gap:4,marginBottom:4}}>
                  {[0,1,2].map(function(ci){return(
                    <div key={ci} style={{transform:"rotate("+(ci-1)*8+"deg) translateY("+(ci===1?-6:2)+"px)",zIndex:ci===1?2:1}}>
                      <Card card={{suit:"♠",value:"A"}} faceDown size="sm" theme={reveal.wonId}/>
                    </div>
                  );})}
                </div>
              )}
              {!th&&<div style={{fontSize:60}}>{crateIcon}</div>}
              <div style={{fontFamily:"Cinzel,serif",fontSize:18,color:rc,fontWeight:900,letterSpacing:2,textShadow:"0 0 12px "+rc}}>{th?th.name:"Mystery Item"}</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,background:rc+"22",border:"1px solid "+rc+"55",borderRadius:6,padding:"3px 10px",color:rc,letterSpacing:1}}>{th?th.rarity.toUpperCase():"RARE"}</div>
              {th&&<div style={{fontFamily:"Crimson Text,serif",fontSize:14,color:"rgba(255,255,255,0.6)",fontStyle:"italic"}}>{th.desc}</div>}
            </div>
          </div>
        )}

        {/* Tap prompt / close */}
        {phase!=="revealed"&&phase!=="opening"&&(
          <div style={{fontFamily:"Cinzel,serif",fontSize:12,letterSpacing:3,color:"#d4a843",animation:"tapHint 1.2s ease-in-out infinite"}}>
            TAP TO OPEN
          </div>
        )}
        {phase==="opening"&&(
          <div style={{fontFamily:"Cinzel,serif",fontSize:12,letterSpacing:3,color:"rgba(255,255,255,0.4)"}}>
            OPENING...
          </div>
        )}
        {phase==="revealed"&&(
          <>
            {reveal.alreadyOwned&&(
              <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"#f0c060",fontStyle:"italic",textAlign:"center",marginBottom:4}}>Already owned — consolation coins awarded!</div>
            )}
            <button onClick={handleClose} style={{padding:"14px 40px",fontFamily:"Cinzel,serif",fontSize:12,letterSpacing:2.5,background:"linear-gradient(135deg,#c49030,#f0c060)",border:"none",borderRadius:14,color:"#010603",cursor:"pointer",touchAction:"manipulation",fontWeight:900,boxShadow:"0 4px 20px rgba(212,168,67,0.5)"}}>
              {th?"EQUIP & CLOSE":"COLLECT"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EarnSection({addCoins,addGems,pop,dailyStreak,myName,myAvatar}){
  var today=Math.floor(Date.now()/(1000*60*60*24));
  var loginStreak=parseInt((function(){try{return localStorage.getItem("cobra_login_streak")||"0";}catch(e){return"0";}})());
  var rewards=[{coins:100,gems:0},{coins:150,gems:0},{coins:200,gems:1},{coins:250,gems:1},{coins:300,gems:2},{coins:400,gems:2},{coins:500,gems:5}];
  var nextDay=Math.min(loginStreak%7,6);
  var nextReward=rewards[nextDay];

  // Ad watches
  var [adCountdown,setAdCountdown]=useState(null);
  var adWatchData=(function(){try{var d=JSON.parse(localStorage.getItem("cobra_ad_watches")||"{}");if(d.day!==today)return{day:today,count:0};return d;}catch(e){return{day:today,count:0};}})();
  var adWatches=adWatchData.count||0;
  var canWatchAd=adWatches<3;

  // Profile reward
  var profileClaimed=(function(){try{return localStorage.getItem("cobra_profile_reward_claimed")==="1";}catch(e){return false;}})();
  var profileComplete=!!(myName&&myAvatar&&myAvatar!=="😎");

  // First win of day
  var lastWinDay=(function(){try{return parseInt(localStorage.getItem("cobra_last_win_date")||"0");}catch(e){return 0;}})();
  var firstWinClaimed=lastWinDay===today;

  // Share reward
  var lastShareDay=(function(){try{return parseInt(localStorage.getItem("cobra_share_day")||"0");}catch(e){return 0;}})();
  var shareClaimed=lastShareDay===today;

  function watchAd(){
    if(!canWatchAd)return;
    var count=0;
    setAdCountdown(5);
    var iv=setInterval(function(){
      count++;
      if(count>=5){
        clearInterval(iv);
        setAdCountdown(null);
        var newData={day:today,count:adWatches+1};
        try{localStorage.setItem("cobra_ad_watches",JSON.stringify(newData));}catch(e){}
        if(addCoins)addCoins(50);
        if(pop)pop("+50 coins from ad!","success");
      } else {
        setAdCountdown(5-count);
      }
    },1000);
  }

  function claimProfile(){
    if(profileClaimed||!profileComplete)return;
    try{localStorage.setItem("cobra_profile_reward_claimed","1");}catch(e){}
    if(addCoins)addCoins(100);
    if(pop)pop("+100 coins for completing profile!","success");
  }

  function claimShare(){
    if(shareClaimed)return;
    try{
      if(navigator.share){navigator.share({title:"Play COBRA",text:"Play COBRA - the ultimate card game!",url:window.location.href});}
    }catch(e){}
    try{localStorage.setItem("cobra_share_day",String(today));}catch(e){}
    if(addCoins)addCoins(75);
    if(pop)pop("+75 coins for sharing!","success");
  }

  var cardStyle={background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12};

  return(
    <div>
      {adCountdown!==null&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#0a1a0a",border:"2px solid rgba(212,168,67,0.4)",borderRadius:20,padding:"32px 40px",textAlign:"center"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:44,fontWeight:900,color:"#f0c060",marginBottom:8}}>{adCountdown}</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#8a9a8a",letterSpacing:2}}>WATCHING AD...</div>
          </div>
        </div>
      )}
      {/* Daily Streak */}
      <div style={cardStyle}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>📅</span>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#fbbf24",letterSpacing:1,fontWeight:700}}>Daily Streak Bonus</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"rgba(255,255,255,0.45)"}}>Streak: {loginStreak} days · Next: {nextReward.coins} 🪙{nextReward.gems?" + "+nextReward.gems+" 💎":""}</div>
          </div>
        </div>
        <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#8a7a3e",letterSpacing:1,flexShrink:0}}>AUTO</div>
      </div>
      {/* Watch Ad */}
      <div style={{...cardStyle,border:"1px solid "+(canWatchAd?"rgba(74,222,128,0.25)":"rgba(255,255,255,0.06)")}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>📺</span>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:canWatchAd?"#4ade80":"#6a9a6a",letterSpacing:1,fontWeight:700}}>Watch Ad</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"rgba(255,255,255,0.45)"}}>{adWatches}/3 today · +50 🪙 each</div>
          </div>
        </div>
        {canWatchAd?(
          <button onClick={watchAd} style={{background:"linear-gradient(135deg,#166534,#15803d)",border:"none",borderRadius:10,fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:"#4ade80",padding:"8px 14px",cursor:"pointer",fontWeight:700,touchAction:"manipulation",flexShrink:0}}>WATCH</button>
        ):(
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#4ade80",flexShrink:0}}>✓ DONE</div>
        )}
      </div>
      {/* Complete Profile */}
      <div style={{...cardStyle,border:"1px solid "+(profileClaimed?"rgba(255,255,255,0.06)":profileComplete?"rgba(212,168,67,0.3)":"rgba(255,255,255,0.08)")}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>👤</span>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:profileClaimed?"#6a9a6a":profileComplete?"#d4a843":"#8a9a8a",letterSpacing:1,fontWeight:700}}>Complete Profile</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"rgba(255,255,255,0.45)"}}>Set name + avatar · +100 🪙</div>
          </div>
        </div>
        {profileClaimed?(
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#4ade80",flexShrink:0}}>✓ CLAIMED</div>
        ):profileComplete?(
          <button onClick={claimProfile} style={{background:"linear-gradient(135deg,#92600a,#d4a843)",border:"none",borderRadius:10,fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:"#010603",padding:"8px 14px",cursor:"pointer",fontWeight:700,touchAction:"manipulation",flexShrink:0}}>CLAIM</button>
        ):(
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#6a5a2a",flexShrink:0}}>INCOMPLETE</div>
        )}
      </div>
      {/* First Win of Day */}
      <div style={{...cardStyle,border:"1px solid "+(firstWinClaimed?"rgba(255,255,255,0.06)":"rgba(96,165,250,0.2)")}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>🏆</span>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:firstWinClaimed?"#6a9a6a":"#60a5fa",letterSpacing:1,fontWeight:700}}>First Win of Day</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"rgba(255,255,255,0.45)"}}>Win a game today · +150 🪙</div>
          </div>
        </div>
        {firstWinClaimed?(
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#4ade80",flexShrink:0}}>✓ EARNED</div>
        ):(
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#3a6a8a",flexShrink:0}}>PLAY TO EARN</div>
        )}
      </div>
      {/* Share the Game */}
      <div style={{...cardStyle,border:"1px solid "+(shareClaimed?"rgba(255,255,255,0.06)":"rgba(192,132,252,0.2)")}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>📤</span>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:shareClaimed?"#6a9a6a":"#c084fc",letterSpacing:1,fontWeight:700}}>Share the Game</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"rgba(255,255,255,0.45)"}}>Share COBRA once a day · +75 🪙</div>
          </div>
        </div>
        {shareClaimed?(
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#4ade80",flexShrink:0}}>✓ DONE</div>
        ):(
          <button onClick={claimShare} style={{background:"linear-gradient(135deg,#4a1a8a,#7c3aed)",border:"none",borderRadius:10,fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:"#e9d5ff",padding:"8px 14px",cursor:"pointer",fontWeight:700,touchAction:"manipulation",flexShrink:0}}>SHARE</button>
        )}
      </div>
    </div>
  );
}

function ShopScreen({goScreen,coins,gems,ownedItems,onBuy,cardTheme,onEquipTheme,myAvatar,onEquipAvatar,sfxMuted,musicMuted,sfxToggle,musToggle,gameStats,showSettings,setShowSettings,isVIP,addCoins,addGems,pop,dailyStreak,myName}){
  var CATS=["ALL","FEATURED","THEMES","AVATARS","BUNDLES","CRATES","EARN"];
  var [cat,setCat]=useState("ALL");
  var [timeLeft,setTimeLeft]=useState("00:00:00");
  var daySeed=Math.floor(Date.now()/(1000*60*60*24));
  var dailyIdx=daySeed%SHOP_THEMES.length;
  var dailyItem=SHOP_THEMES[dailyIdx];
  var dailyDiscountedPrice=Math.floor(dailyItem.price*0.6);

  useEffect(function(){
    function tick(){
      var now=new Date();
      var midnight=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1));
      var secs=Math.floor((midnight-now)/1000);
      var h=Math.floor(secs/3600);
      var m=Math.floor((secs%3600)/60);
      var s=secs%60;
      setTimeLeft((h<10?"0"+h:h)+":"+(m<10?"0"+m:m)+":"+(s<10?"0"+s:s));
    }
    tick();
    var id=setInterval(tick,1000);
    return function(){clearInterval(id);};
  },[]);

  function RarityBadge({rarity}){
    var rc=RARITY_COLORS[rarity]||"#9ca3af";
    return(
      <span style={{background:rc+"22",border:"1px solid "+rc+"66",borderRadius:6,padding:"2px 7px",fontFamily:"Cinzel,serif",fontSize:7,color:rc,letterSpacing:1,fontWeight:700,textTransform:"uppercase",flexShrink:0}}>
        {rarity||"common"}
      </span>
    );
  }

  var vipThemeIds=SHOP_THEMES.filter(function(t){return t.vipOnly;}).map(function(t){return t.id;});
  var effectiveUnlockedThemes=isVIP?[...ownedItems,...vipThemeIds]:ownedItems;
  var effectiveUnlockedTitles=isVIP?["vip_emperor","vip_apex","vip_phantom","vip_divine"]:[];
  var vipAvatarIds=SHOP_AVATARS.filter(function(a){return a.vipOnly;}).map(function(a){return a.id;});
  var effectiveUnlockedAvatars=isVIP?[...vipAvatarIds]:[];

  function ThemeCard({item,compact}){
    var owned=item.price===0||effectiveUnlockedThemes.indexOf(item.id)>=0;
    var equipped=cardTheme===item.id;
    var canAfford=item.currency==="coins"?coins>=item.price:gems>=item.price;
    var th=CARD_THEMES[item.id]||CARD_THEMES.classic;
    var rc=RARITY_COLORS[item.rarity]||"#9ca3af";
    var rg=RARITY_GLOW[item.rarity]||"rgba(156,163,175,0.3)";
    return(
      <div style={{borderRadius:20,overflow:"hidden",border:equipped?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",boxShadow:equipped?"0 0 28px rgba(212,168,67,0.35),inset 0 1px 0 rgba(255,255,255,0.08)":item.rarity==="legendary"?"0 0 20px "+rg+",0 4px 20px rgba(0,0,0,0.5)":"0 4px 20px rgba(0,0,0,0.5)",transition:"all 0.25s",position:"relative"}}>
        {item.isNew&&<div style={{position:"absolute",top:10,left:10,zIndex:10,background:"#22c55e",borderRadius:6,padding:"2px 7px",fontFamily:"Cinzel,serif",fontSize:7,color:"#fff",letterSpacing:1,fontWeight:700}}>NEW</div>}
        {item.vipOnly&&!isVIP&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",borderRadius:"inherit",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:10}}><span style={{fontSize:20}}>👑</span><span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#d4a843",letterSpacing:2,marginTop:4}}>VIP ONLY</span></div>}
        <div style={{height:compact?80:110,background:th.bg,display:"flex",alignItems:"center",justifyContent:"center",gap:compact?6:10,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 20% 50%,"+th.pat+" 0%,transparent 60%),radial-gradient(circle at 80% 50%,"+th.pat2+" 0%,transparent 60%)"}}/>
          {[0,1,2].map(function(ci){return(
            <div key={ci} style={{transform:"rotate("+(ci-1)*8+"deg) translateY("+(ci===1?-6:2)+"px)",zIndex:ci===1?2:1,position:"relative"}}>
              <Card card={{suit:"♠",value:"A"}} faceDown size={compact?"xs":"sm"} theme={item.id}/>
            </div>
          );})}
          {equipped&&<div style={{position:"absolute",top:10,right:10,background:"linear-gradient(135deg,#a87020,#f0c060)",borderRadius:8,padding:"4px 10px",fontFamily:"Cinzel,serif",fontSize:8,color:"#010603",letterSpacing:1.5,fontWeight:900,boxShadow:"0 2px 8px rgba(0,0,0,0.4)"}}>✓ ACTIVE</div>}
          {!owned&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(1px)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:28,filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.8))"}}>🔒</div></div>}
          {owned&&!equipped&&<div style={{position:"absolute",top:10,right:10,width:22,height:22,borderRadius:"50%",background:"rgba(34,197,94,0.25)",border:"1.5px solid #22c55e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#22c55e"}}>✓</div>}
        </div>
        <div style={{padding:"12px 14px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:equipped?"#f0c060":"#e8f0e8",letterSpacing:1,fontWeight:900,flex:1}}>{item.name}</div>
            <RarityBadge rarity={item.rarity}/>
          </div>
          <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"#c0d8c0",lineHeight:1.4,marginBottom:10}}>{item.desc}</div>
          {owned?(
            <button onClick={function(){audio.buttonClick();if(!equipped)onEquipTheme(item.id);}} style={{width:"100%",padding:"10px",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1.5,border:equipped?"none":"1.5px solid rgba(212,168,67,0.5)",borderRadius:12,cursor:equipped?"default":"pointer",background:equipped?"linear-gradient(135deg,rgba(212,168,67,0.25),rgba(212,168,67,0.1))":"linear-gradient(135deg,rgba(212,168,67,0.18),rgba(212,168,67,0.08))",color:equipped?"#f0c060":"#d4a843",touchAction:"manipulation",fontWeight:900}}>
              {equipped?"✓ EQUIPPED":"EQUIP"}
            </button>
          ):(
            <button onClick={function(){audio.buttonClick();if(canAfford)onBuy(item);}} style={{width:"100%",padding:"10px",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1,border:canAfford?"1.5px solid rgba(212,168,67,0.5)":"1.5px solid rgba(255,255,255,0.1)",borderRadius:12,cursor:canAfford?"pointer":"default",background:canAfford?"linear-gradient(135deg,rgba(212,168,67,0.25),rgba(212,168,67,0.12))":"rgba(255,255,255,0.04)",color:canAfford?"#f0c060":"rgba(255,255,255,0.3)",touchAction:"manipulation",fontWeight:900,boxShadow:canAfford?"0 0 14px rgba(212,168,67,0.15)":"none"}}>
              {item.price===0?"FREE":(item.currency==="coins"?"🪙 "+item.price.toLocaleString():"💎 "+item.price)}
            </button>
          )}
        </div>
      </div>
    );
  }

  function AvatarCard({item}){
    var owned=item.price===0||ownedItems.indexOf("av_"+item.id)>=0;
    var equipped=myAvatar===item.id;
    var canAfford=item.currency==="coins"?coins>=item.price:gems>=item.price;
    var isPremium=item.currency==="gems";
    return(
      <div onClick={function(){
        audio.buttonClick();
        if(owned)onEquipAvatar(item.id);
        else if(canAfford)onBuy({...item,id:"av_"+item.id,displayId:item.id,isAvatar:true});
      }} style={{borderRadius:16,padding:"14px 6px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,border:equipped?"2px solid #f0c060":isPremium&&!owned?"1.5px solid rgba(155,89,248,0.4)":"1.5px solid rgba(255,255,255,0.1)",background:equipped?"linear-gradient(160deg,rgba(212,168,67,0.15),rgba(212,168,67,0.06))":isPremium&&!owned?"linear-gradient(160deg,rgba(80,20,160,0.18),rgba(40,10,80,0.12))":"rgba(255,255,255,0.05)",cursor:"pointer",touchAction:"manipulation",transition:"all 0.2s",boxShadow:equipped?"0 0 20px rgba(212,168,67,0.4)":isPremium&&!owned?"0 0 12px rgba(155,89,248,0.2)":"none",position:"relative",overflow:"hidden"}}>
        {isPremium&&!owned&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(155,89,248,0.8),transparent)"}}/>}
        {equipped&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.9),transparent)"}}/>}
        {owned&&!equipped&&<div style={{position:"absolute",top:6,right:6,width:16,height:16,borderRadius:"50%",background:"rgba(34,197,94,0.2)",border:"1px solid #22c55e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#22c55e"}}>✓</div>}
        <div style={{fontSize:34,lineHeight:1,filter:equipped?"drop-shadow(0 0 8px rgba(240,192,96,0.8))":owned?"none":"grayscale(0.4)",opacity:owned?1:0.6}}>{item.id}</div>
        <div style={{fontFamily:"Cinzel,serif",fontSize:7.5,color:equipped?"#f0c060":owned?"#e8f0e8":"rgba(255,255,255,0.5)",letterSpacing:0.8,fontWeight:equipped?"900":"400",textAlign:"center"}}>{item.name.toUpperCase()}</div>
        {owned?(
          equipped?<div style={{background:"linear-gradient(135deg,rgba(212,168,67,0.3),rgba(212,168,67,0.15))",borderRadius:5,padding:"2px 6px",fontFamily:"Cinzel,serif",fontSize:6.5,color:"#f0c060",letterSpacing:0.8}}>✓ ON</div>
          :<div style={{fontFamily:"Cinzel,serif",fontSize:6.5,color:"#4ade80",letterSpacing:0.8}}>TAP TO USE</div>
        ):(
          <div style={{background:isPremium?"rgba(155,89,248,0.15)":"rgba(212,168,67,0.1)",borderRadius:5,padding:"2px 6px",fontFamily:"Cinzel,serif",fontSize:6.5,color:isPremium?"#c084fc":canAfford?"#d4a843":"rgba(255,255,255,0.3)",letterSpacing:0.5,fontWeight:700}}>
            {item.currency==="coins"?"🪙"+item.price:"💎"+item.price}
          </div>
        )}
        {!owned&&<div style={{position:"absolute",bottom:6,right:6,fontSize:8,opacity:0.4}}>🔒</div>}
      </div>
    );
  }

  function BundleCard({item}){
    var allOwned=item.items.every(function(id){return SHOP_THEMES.find(function(t){return t.id===id;})&&(ownedItems.indexOf(id)>=0||id==="classic");});
    var canAfford=item.currency==="coins"?coins>=item.price:gems>=item.price;
    var rc=RARITY_COLORS[item.rarity]||"#9ca3af";
    var savePct=Math.round((1-item.price/item.originalPrice)*100);
    return(
      <div style={{borderRadius:20,overflow:"hidden",border:"1.5px solid "+rc+"44",background:"rgba(255,255,255,0.05)",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",position:"relative"}}>
        {item.isNew&&<div style={{position:"absolute",top:12,left:12,zIndex:5,background:"#22c55e",borderRadius:6,padding:"2px 7px",fontFamily:"Cinzel,serif",fontSize:7,color:"#fff",letterSpacing:1,fontWeight:700}}>NEW</div>}
        <div style={{position:"absolute",top:12,right:12,zIndex:5,background:"linear-gradient(135deg,#c84020,#f05030)",borderRadius:8,padding:"4px 10px",fontFamily:"Cinzel,serif",fontSize:9,color:"#fff",letterSpacing:1,fontWeight:900,boxShadow:"0 2px 8px rgba(0,0,0,0.4)"}}>SAVE {savePct}%</div>
        <div style={{padding:"18px 16px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{width:48,height:48,borderRadius:12,background:rc+"22",border:"1.5px solid "+rc+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:15,color:"#e8f0e8",letterSpacing:1,fontWeight:900,marginBottom:4}}>{item.name}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><RarityBadge rarity={item.rarity}/></div>
            </div>
          </div>
          <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"#c0d8c0",marginBottom:12}}>{item.desc}</div>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {item.items.map(function(tid){
              var th=CARD_THEMES[tid]||CARD_THEMES.classic;
              var tinfo=SHOP_THEMES.find(function(t){return t.id===tid;})||{name:tid};
              return(
                <div key={tid} style={{flex:1,minWidth:80,borderRadius:12,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)"}}>
                  <div style={{height:52,background:th.bg,display:"flex",alignItems:"center",justifyContent:"center",gap:4,position:"relative"}}>
                    <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 50% 50%,"+th.pat+" 0%,transparent 70%)"}}/>
                    {[0,1].map(function(ci){return(
                      <div key={ci} style={{transform:"rotate("+(ci===0?-6:6)+"deg)",zIndex:1,position:"relative"}}>
                        <Card card={{suit:"♠",value:"A"}} faceDown size="xs" theme={tid}/>
                      </div>
                    );})}
                  </div>
                  <div style={{padding:"4px 8px",background:"rgba(0,0,0,0.3)",fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(255,255,255,0.7)",letterSpacing:0.5,textAlign:"center"}}>{tinfo.name}</div>
                </div>
              );
            })}
          </div>
          {item.bonusGems&&<div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"#c084fc",marginBottom:10}}>+ Bonus 💎{item.bonusGems} Gems included!</div>}
          {allOwned?(
            <div style={{textAlign:"center",padding:"10px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:12,fontFamily:"Cinzel,serif",fontSize:10,color:"#4ade80",letterSpacing:1}}>✓ OWNED</div>
          ):(
            <button onClick={function(){audio.buttonClick();if(canAfford){onBuy({id:"bundle_"+item.id,_bundleItems:item.items,price:item.price,currency:item.currency,_isBundle:true});}}} style={{width:"100%",padding:"12px",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1.5,border:canAfford?"1.5px solid "+rc+"66":"1.5px solid rgba(255,255,255,0.1)",borderRadius:12,cursor:canAfford?"pointer":"default",background:canAfford?"linear-gradient(135deg,"+rc+"22,"+rc+"11)":"rgba(255,255,255,0.04)",color:canAfford?rc:"rgba(255,255,255,0.3)",touchAction:"manipulation",fontWeight:900,boxShadow:canAfford?"0 0 14px "+rc+"22":"none"}}>
              <span style={{textDecoration:"line-through",opacity:0.5,marginRight:8,fontSize:10}}>{item.currency==="coins"?"🪙"+item.originalPrice.toLocaleString():"💎"+item.originalPrice}</span>
              {item.currency==="coins"?"🪙 "+item.price.toLocaleString():"💎 "+item.price}
            </button>
          )}
        </div>
      </div>
    );
  }

  function CrateCard({item}){
    var canAfford=item.currency==="coins"?coins>=item.price:gems>=item.price;
    var rc=RARITY_COLORS[item.rarity]||"#9ca3af";
    var rg=RARITY_GLOW[item.rarity]||"rgba(156,163,175,0.3)";
    return(
      <div style={{borderRadius:18,overflow:"hidden",border:"1.5px solid "+rc+"55",background:"rgba(255,255,255,0.05)",boxShadow:"0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px "+rc+"11",animation:item.rarity==="epic"?"legendaryShimmer 2.5s ease-in-out infinite":"none",position:"relative"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,"+rc+",transparent)",opacity:0.7}}/>
        <div style={{padding:"18px 14px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,textAlign:"center"}}>
          <div style={{fontSize:36,filter:"drop-shadow(0 0 10px "+rc+"88)"}}>{item.icon}</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#e8f0e8",letterSpacing:1,fontWeight:900}}>{item.name}</div>
          <RarityBadge rarity={item.rarity}/>
          <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"#c0d8c0",lineHeight:1.4}}>{item.desc}</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginTop:-2}}>??? MYSTERY CONTENTS</div>
          <div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",fontSize:10,color:"rgba(255,255,255,0.3)"}}>Contents are random</div>
          <button onClick={function(){if(!canAfford)return;audio.buttonClick();onBuy(item);}} disabled={!canAfford} style={{width:"100%",padding:"10px",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1,border:canAfford?"1.5px solid "+rc+"66":"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,cursor:canAfford?"pointer":"default",background:canAfford?"linear-gradient(135deg,"+rc+"22,"+rc+"11)":"rgba(255,255,255,0.04)",color:canAfford?rc:"rgba(255,255,255,0.3)",touchAction:"manipulation",fontWeight:900,boxShadow:canAfford?"0 0 12px "+rc+"33":"none",marginTop:4}}>
            {item.currency==="coins"?"🪙 "+item.price.toLocaleString():"💎 "+item.price} OPEN
          </button>
        </div>
      </div>
    );
  }

  var showFeatured=cat==="ALL"||cat==="FEATURED";
  var showThemes=cat==="ALL"||cat==="THEMES";
  var showAvatars=cat==="ALL"||cat==="AVATARS";
  var showBundles=cat==="ALL"||cat==="BUNDLES";
  var showCrates=cat==="ALL"||cat==="CRATES";
  var showEarn=cat==="EARN";
  var newItems=SHOP_THEMES.filter(function(t){return t.isNew;});
  var featuredItems=SHOP_THEMES.filter(function(t){return t.rarity==="epic"||t.rarity==="legendary";}).slice(0,3);

  function SectionHeader({children}){
    return(
      <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:3,color:"#d4a843",marginBottom:12,marginTop:4,display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.3))"}}/>
        {children}
        <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(212,168,67,0.3),transparent)"}}/>
      </div>
    );
  }

  function RarityBadge({rarity}){
    var rc=RARITY_COLORS[rarity]||"#9ca3af";
    return(
      <span style={{background:rc+"22",border:"1px solid "+rc+"66",borderRadius:6,padding:"2px 7px",fontFamily:"Cinzel,serif",fontSize:7,color:rc,letterSpacing:1,fontWeight:700,textTransform:"uppercase",flexShrink:0}}>
        {rarity||"common"}
      </span>
    );
  }

  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",height:"100%",maxHeight:"100vh",overflow:"hidden"}}>
      <style>{GS}
        {`@keyframes goldPulse{0%,100%{box-shadow:0 0 12px rgba(212,168,67,0.4),inset 0 0 0 1.5px rgba(212,168,67,0.4)}50%{box-shadow:0 0 30px rgba(212,168,67,0.8),inset 0 0 0 1.5px rgba(212,168,67,0.8)}}
        @keyframes crateShimmer{0%,100%{border-color:rgba(192,132,252,0.3)}50%{border-color:rgba(192,132,252,0.8)}}
        @keyframes legendaryShimmer{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.04)}50%{box-shadow:0 4px 28px rgba(0,0,0,0.5),0 0 16px rgba(192,132,252,0.25),0 0 1px rgba(192,132,252,0.3)}}
        `}
      </style>

      {/* HEADER */}
      <div style={{flexShrink:0,paddingTop:"calc(12px + env(safe-area-inset-top))",background:"linear-gradient(180deg,rgba(1,8,3,0.98),rgba(1,6,2,0.95))",borderBottom:"1px solid rgba(255,255,255,0.06)",zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",padding:"0 16px 12px",gap:10}}>
          <button onClick={function(){audio.buttonClick();goScreen("home");}} style={{width:38,height:38,borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1.5px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.8)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",flexShrink:0}}>←</button>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:900,letterSpacing:6,background:"linear-gradient(135deg,#f4cc52,#d4a843,#a87020)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",lineHeight:1}}>SHOP</div>
            <div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",fontSize:11,color:"rgba(212,168,67,0.45)",letterSpacing:2,marginTop:1}}>premium cosmetics</div>
          </div>
          <div style={{width:38,display:"flex",justifyContent:"flex-end"}}>
            <MenuButton onClick={function(){audio.buttonClick();setShowSettings(true);}} active={showSettings}/>
          </div>
        </div>

        {/* CURRENCY BAR */}
        <div style={{margin:"0 16px 12px",background:"linear-gradient(135deg,rgba(18,14,4,0.95),rgba(10,8,2,0.95))",borderRadius:14,padding:"10px 18px",border:"1px solid rgba(212,168,67,0.18)",display:"flex",justifyContent:"space-around",boxShadow:"0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#92600a,#d4a843)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 2px 8px rgba(212,168,67,0.35)"}}>🪙</div>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:16,fontWeight:900,color:"#f0c060",lineHeight:1}}>{coins.toLocaleString()}</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"rgba(240,192,96,0.45)",letterSpacing:1.5}}>COINS</div>
            </div>
          </div>
          <div style={{width:1,background:"rgba(255,255,255,0.07)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#4a1a8a,#9b59f8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 2px 8px rgba(155,89,248,0.35)"}}>💎</div>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:16,fontWeight:900,color:"#d8a0ff",lineHeight:1}}>{gems}</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"rgba(216,160,255,0.45)",letterSpacing:1.5}}>GEMS</div>
            </div>
          </div>
        </div>

        {/* CATEGORY FILTER BAR */}
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",display:"flex",gap:8,padding:"0 16px 12px",scrollbarWidth:"none"}}>
          {CATS.map(function(c){
            var active=cat===c;
            return(
              <button key={c} onClick={function(){audio.buttonClick();setCat(c);}} style={{flexShrink:0,padding:"7px 14px",borderRadius:20,fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1.5,border:active?"none":"1px solid rgba(255,255,255,0.2)",cursor:"pointer",background:active?"linear-gradient(135deg,#d4a843,#a87020)":"rgba(255,255,255,0.06)",color:active?"#010603":"rgba(255,255,255,0.75)",fontWeight:active?"700":"400",touchAction:"manipulation",transition:"all 0.18s",minHeight:32,whiteSpace:"nowrap"}}>
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"16px 16px calc(32px + env(safe-area-inset-bottom))"}}>

        {/* VIP EXCLUSIVE BUTTON */}
        <button onClick={function(){audio.buttonClick();goScreen("vip_shop");}} style={{width:"100%",marginBottom:16,padding:"16px",background:"linear-gradient(135deg,rgba(212,168,67,0.15),rgba(212,168,67,0.05))",border:"1.5px solid rgba(212,168,67,0.45)",borderRadius:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",touchAction:"manipulation"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>👑</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#f0c060",letterSpacing:2,fontWeight:900}}>VIP EXCLUSIVE</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"#8a9a7a",marginTop:1}}>Themes · Avatars · Titles</div>
            </div>
          </div>
          <span style={{fontFamily:"Cinzel,serif",fontSize:18,color:"#f0c060"}}>›</span>
        </button>

        {/* FEATURED CAROUSEL */}
        {showFeatured&&(
          <div style={{marginBottom:20}}>
            <SectionHeader>FEATURED</SectionHeader>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",display:"flex",gap:12,paddingBottom:6,scrollbarWidth:"none"}}>
              {featuredItems.map(function(item){
                var th=CARD_THEMES[item.id]||CARD_THEMES.classic;
                var rc=RARITY_COLORS[item.rarity]||"#9ca3af";
                var owned=item.price===0||ownedItems.indexOf(item.id)>=0;
                var canAfford=item.currency==="coins"?coins>=item.price:gems>=item.price;
                return(
                  <div key={item.id} style={{flexShrink:0,width:230,borderRadius:18,overflow:"hidden",border:"1.5px solid "+rc+"55",background:th.bg,boxShadow:"0 8px 32px rgba(0,0,0,0.6),0 0 16px "+rc+"22",position:"relative"}}>
                    <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 30% 40%,"+th.pat+" 0%,transparent 60%),radial-gradient(circle at 70% 60%,"+th.pat2+" 0%,transparent 60%)"}}/>
                    <div style={{position:"absolute",top:10,left:10,background:"rgba(0,0,0,0.55)",borderRadius:6,padding:"3px 8px",fontFamily:"Cinzel,serif",fontSize:7,color:"#f0c060",letterSpacing:2,backdropFilter:"blur(4px)"}}>FEATURED</div>
                    {item.isNew&&<div style={{position:"absolute",top:10,right:10,background:"#22c55e",borderRadius:6,padding:"2px 7px",fontFamily:"Cinzel,serif",fontSize:7,color:"#fff",letterSpacing:1,fontWeight:700}}>NEW</div>}
                    <div style={{height:100,display:"flex",alignItems:"center",justifyContent:"center",gap:8,position:"relative"}}>
                      {[0,1,2].map(function(ci){return(
                        <div key={ci} style={{transform:"rotate("+(ci-1)*10+"deg) translateY("+(ci===1?-8:3)+"px)",zIndex:ci===1?2:1,position:"relative"}}>
                          <Card card={{suit:"♠",value:"A"}} faceDown size="sm" theme={item.id}/>
                        </div>
                      );})}
                    </div>
                    <div style={{padding:"10px 14px 14px",position:"relative"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                        <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#e8f0e8",fontWeight:900,flex:1}}>{item.name}</div>
                        <span style={{background:rc+"22",border:"1px solid "+rc+"55",borderRadius:5,padding:"2px 6px",fontFamily:"Cinzel,serif",fontSize:6.5,color:rc,letterSpacing:1,fontWeight:700}}>{item.rarity}</span>
                      </div>
                      <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"rgba(255,255,255,0.65)",marginBottom:10}}>{item.desc}</div>
                      {owned?(
                        <button onClick={function(){audio.buttonClick();onEquipTheme(item.id);}} style={{width:"100%",padding:"8px",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,border:"1px solid rgba(212,168,67,0.4)",borderRadius:10,background:"rgba(212,168,67,0.15)",color:"#f0c060",cursor:"pointer",touchAction:"manipulation",fontWeight:700}}>
                          {cardTheme===item.id?"✓ EQUIPPED":"EQUIP"}
                        </button>
                      ):(
                        <button onClick={function(){audio.buttonClick();if(canAfford)onBuy(item);}} style={{width:"100%",padding:"8px",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,border:canAfford?"1px solid "+rc+"55":"1px solid rgba(255,255,255,0.1)",borderRadius:10,background:canAfford?rc+"22":"rgba(255,255,255,0.04)",color:canAfford?rc:"rgba(255,255,255,0.3)",cursor:canAfford?"pointer":"default",touchAction:"manipulation",fontWeight:700}}>
                          {item.currency==="coins"?"🪙 "+item.price.toLocaleString():"💎 "+item.price}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DAILY DEAL */}
        {showFeatured&&dailyItem.price>0&&(
          <div style={{marginBottom:20}}>
            <SectionHeader>DAILY DEAL</SectionHeader>
            <div style={{borderRadius:20,overflow:"hidden",border:"2px solid rgba(212,168,67,0.5)",animation:"goldPulse 2.2s ease-in-out infinite",background:"rgba(20,14,2,0.95)",position:"relative"}}>
              <div style={{background:"linear-gradient(90deg,rgba(212,168,67,0.18),rgba(212,168,67,0.06),rgba(212,168,67,0.18))",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(212,168,67,0.18)"}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#f0c060",letterSpacing:3,fontWeight:900}}>⚡ TODAY ONLY</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(240,192,96,0.7)",letterSpacing:1}}>Resets in {timeLeft}</div>
              </div>
              <div style={{display:"flex",gap:14,padding:"14px 16px 16px",alignItems:"center"}}>
                <div style={{flexShrink:0}}>
                  {(function(){
                    var th=CARD_THEMES[dailyItem.id]||CARD_THEMES.classic;
                    return(
                      <div style={{width:80,height:80,borderRadius:12,background:th.bg,border:"1.5px solid rgba(212,168,67,0.3)",display:"flex",alignItems:"center",justifyContent:"center",gap:2,overflow:"hidden",position:"relative"}}>
                        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 50% 50%,"+th.pat+" 0%,transparent 70%)"}}/>
                        {[0,1].map(function(ci){return(
                          <div key={ci} style={{transform:"rotate("+(ci===0?-7:7)+"deg)",zIndex:1}}>
                            <Card card={{suit:"♠",value:"A"}} faceDown size="xs" theme={dailyItem.id}/>
                          </div>
                        );})}
                      </div>
                    );
                  })()}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:15,color:"#f0c060",fontWeight:900,letterSpacing:1}}>{dailyItem.name}</div>
                    <span style={{background:"#ef444422",border:"1px solid #ef444466",borderRadius:6,padding:"2px 8px",fontFamily:"Cinzel,serif",fontSize:8,color:"#ef4444",letterSpacing:1,fontWeight:700}}>40% OFF</span>
                  </div>
                  <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"rgba(255,255,255,0.65)",marginBottom:10}}>{dailyItem.desc}</div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div>
                      <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"rgba(255,255,255,0.3)",textDecoration:"line-through",marginRight:8}}>🪙{dailyItem.price.toLocaleString()}</span>
                      <span style={{fontFamily:"Cinzel,serif",fontSize:16,fontWeight:900,color:"#f0c060"}}>🪙{dailyDiscountedPrice.toLocaleString()}</span>
                    </div>
                    {(function(){
                      var owned=ownedItems.indexOf(dailyItem.id)>=0||dailyItem.price===0;
                      var canAfford=coins>=dailyItem.price;
                      return owned?(
                        <button onClick={function(){audio.buttonClick();onEquipTheme(dailyItem.id);}} style={{flexShrink:0,padding:"8px 16px",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,border:"1.5px solid rgba(212,168,67,0.4)",borderRadius:10,background:"rgba(212,168,67,0.15)",color:"#f0c060",cursor:"pointer",touchAction:"manipulation",fontWeight:700}}>{cardTheme===dailyItem.id?"✓ ON":"EQUIP"}</button>
                      ):(
                        <button onClick={function(){audio.buttonClick();if(canAfford)onBuy({...dailyItem,price:Math.round(dailyItem.price*0.6)});}} style={{flexShrink:0,padding:"8px 16px",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,border:canAfford?"1.5px solid rgba(212,168,67,0.5)":"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:canAfford?"linear-gradient(135deg,rgba(212,168,67,0.25),rgba(212,168,67,0.12))":"rgba(255,255,255,0.04)",color:canAfford?"#f0c060":"rgba(255,255,255,0.3)",cursor:canAfford?"pointer":"default",touchAction:"manipulation",fontWeight:900}}>BUY NOW</button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NEW THIS WEEK */}
        {showFeatured&&newItems.length>0&&(
          <div style={{marginBottom:20}}>
            <SectionHeader>NEW THIS WEEK</SectionHeader>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",display:"flex",gap:10,paddingBottom:6,scrollbarWidth:"none"}}>
              {newItems.map(function(item){
                var th=CARD_THEMES[item.id]||CARD_THEMES.classic;
                var rc=RARITY_COLORS[item.rarity]||"#9ca3af";
                var owned=item.price===0||ownedItems.indexOf(item.id)>=0;
                var canAfford=item.currency==="coins"?coins>=item.price:gems>=item.price;
                return(
                  <div key={item.id} style={{flexShrink:0,width:160,borderRadius:14,overflow:"hidden",border:"1.5px solid "+rc+"44",background:"rgba(255,255,255,0.05)"}}>
                    <div style={{height:70,background:th.bg,display:"flex",alignItems:"center",justifyContent:"center",gap:4,position:"relative"}}>
                      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 50% 50%,"+th.pat+" 0%,transparent 65%)"}}/>
                      <div style={{position:"absolute",top:6,left:6,background:"#22c55e",borderRadius:5,padding:"1px 5px",fontFamily:"Cinzel,serif",fontSize:6,color:"#fff",letterSpacing:1,fontWeight:700}}>NEW</div>
                      {[0,1,2].map(function(ci){return(
                        <div key={ci} style={{transform:"rotate("+(ci-1)*8+"deg) translateY("+(ci===1?-4:2)+"px)",zIndex:ci===1?2:1,position:"relative"}}>
                          <Card card={{suit:"♠",value:"A"}} faceDown size="xs" theme={item.id}/>
                        </div>
                      );})}
                    </div>
                    <div style={{padding:"8px 10px 10px"}}>
                      <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#e8f0e8",fontWeight:900,letterSpacing:0.5,marginBottom:3}}>{item.name}</div>
                      <span style={{background:rc+"22",border:"1px solid "+rc+"55",borderRadius:5,padding:"1px 5px",fontFamily:"Cinzel,serif",fontSize:6,color:rc,letterSpacing:0.8,fontWeight:700}}>{item.rarity}</span>
                      <div style={{marginTop:8}}>
                        {owned?(
                          <button onClick={function(){audio.buttonClick();onEquipTheme(item.id);}} style={{width:"100%",padding:"6px",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,border:"1px solid rgba(212,168,67,0.4)",borderRadius:8,background:"rgba(212,168,67,0.12)",color:"#f0c060",cursor:"pointer",touchAction:"manipulation",fontWeight:700}}>{cardTheme===item.id?"✓ ON":"EQUIP"}</button>
                        ):(
                          <button onClick={function(){audio.buttonClick();if(canAfford)onBuy(item);}} style={{width:"100%",padding:"6px",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:0.8,border:canAfford?"1px solid "+rc+"55":"1px solid rgba(255,255,255,0.1)",borderRadius:8,background:canAfford?rc+"18":"rgba(255,255,255,0.04)",color:canAfford?rc:"rgba(255,255,255,0.3)",cursor:canAfford?"pointer":"default",touchAction:"manipulation",fontWeight:700}}>
                            {item.currency==="coins"?"🪙"+item.price.toLocaleString():"💎"+item.price}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* THEMES GRID */}
        {showThemes&&(
          <div style={{marginBottom:20}}>
            <SectionHeader>THEMES</SectionHeader>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {SHOP_THEMES.map(function(item){return(<ThemeCard key={item.id} item={item}/>);})}
            </div>
          </div>
        )}

        {/* AVATARS GRID */}
        {showAvatars&&(
          <div style={{marginBottom:20}}>
            <SectionHeader>AVATARS</SectionHeader>
            <div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"rgba(255,255,255,0.55)",fontSize:13,textAlign:"center",marginBottom:12,lineHeight:1.5}}>Your avatar shows on the leaderboard and to other players in online games.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {SHOP_AVATARS.map(function(item){return(<AvatarCard key={item.id} item={item}/>);})}
            </div>
          </div>
        )}

        {/* BUNDLES */}
        {showBundles&&(
          <div style={{marginBottom:20}}>
            <SectionHeader>BUNDLES</SectionHeader>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {BUNDLES.map(function(item){return(<BundleCard key={item.id} item={item}/>);})}
            </div>
          </div>
        )}

        {/* CRATES */}
        {showCrates&&(
          <div style={{marginBottom:20}}>
            <SectionHeader>MYSTERY CRATES</SectionHeader>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
              {CRATES.map(function(item){return(<CrateCard key={item.id} item={item}/>);})}
            </div>
          </div>
        )}

        {showEarn&&(
          <div style={{marginBottom:20}}>
            <SectionHeader>EARN COINS</SectionHeader>
            <EarnSection addCoins={addCoins} addGems={addGems} pop={pop} dailyStreak={dailyStreak} myName={myName} myAvatar={myAvatar}/>
          </div>
        )}

        {/* Feature 16: LIMITED-TIME EVENTS */}
        {(cat==="ALL"||cat==="FEATURED")&&(
          <div style={{marginBottom:20}}>
            <SectionHeader>⏳ LIMITED TIME</SectionHeader>
            {(function(){
              var now=new Date();
              var msLeft=Math.max(0,47*3600000+59*60000+59000-(now.getTime()%(48*3600000)));
              var h=Math.floor(msLeft/3600000);var m=Math.floor((msLeft%3600000)/60000);var s=Math.floor((msLeft%60000)/1000);
              var countdown=(h<10?"0"+h:h)+":"+(m<10?"0"+m:m)+":"+(s<10?"0"+s:s);
              var limitedItems=[
                {id:"bundle_serpent_king",name:"Serpent King Bundle",desc:"3 exclusive card backs + avatar",icon:"🐍",price:999,currency:"coins",originalPrice:1800,rarity:"legendary",badge:"BEST VALUE"},
                {id:"venom_crate_3x",name:"Venom Crate ×3",desc:"3 legendary crates for gems",icon:"🎰",price:180,currency:"gems",originalPrice:240,rarity:"epic",badge:"SALE"},
              ];
              return limitedItems.map(function(item){
                var rc=RARITY_COLORS[item.rarity]||"#9ca3af";
                var canAfford=item.currency==="coins"?coins>=item.price:gems>=item.price;
                return(
                  <div key={item.id} style={{borderRadius:18,overflow:"hidden",border:"2px solid rgba(239,68,68,0.5)",background:"rgba(20,5,5,0.95)",marginBottom:12,boxShadow:"0 0 20px rgba(239,68,68,0.15)",position:"relative"}}>
                    <div style={{background:"linear-gradient(90deg,rgba(239,68,68,0.25),rgba(239,68,68,0.1))",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(239,68,68,0.2)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{background:"#ef4444",borderRadius:6,padding:"2px 8px",fontFamily:"Cinzel,serif",fontSize:8,color:"#fff",letterSpacing:1,fontWeight:700}}>ENDS IN</div>
                        <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#fca5a5",letterSpacing:1}}>{countdown}</div>
                      </div>
                      {item.badge&&<div style={{background:rc+"22",border:"1px solid "+rc+"55",borderRadius:6,padding:"2px 8px",fontFamily:"Cinzel,serif",fontSize:8,color:rc,letterSpacing:1,fontWeight:700}}>{item.badge}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px"}}>
                      <div style={{fontSize:36,flexShrink:0}}>{item.icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:"Cinzel,serif",fontSize:14,color:"#f0c060",fontWeight:900,marginBottom:2}}>{item.name}</div>
                        <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:8}}>{item.desc}</div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontFamily:"Cinzel,serif",fontSize:16,color:"#4ade80",fontWeight:900}}>{item.currency==="coins"?"🪙":"💎"} {item.price.toLocaleString()}</div>
                          <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"rgba(255,255,255,0.3)",textDecoration:"line-through"}}>{item.originalPrice.toLocaleString()}</div>
                        </div>
                      </div>
                      <button onClick={function(){audio.buttonClick();haptic&&haptic.medium&&haptic.medium();if(canAfford){if(item.currency==="coins"){addCoins(-item.price);}else{addGems(-item.price);}pop("🎉 "+item.name+" purchased!","success");}else{pop("Not enough "+(item.currency==="coins"?"coins":"gems"),"error");}}} style={{flexShrink:0,padding:"10px 14px",borderRadius:12,border:canAfford?"1.5px solid rgba(74,222,128,0.5)":"1.5px solid rgba(255,255,255,0.1)",background:canAfford?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.04)",fontFamily:"Cinzel,serif",fontSize:10,color:canAfford?"#4ade80":"rgba(255,255,255,0.3)",cursor:canAfford?"pointer":"default",touchAction:"manipulation",letterSpacing:1}}>
                        {canAfford?"BUY":"NEED\nMORE"}
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

      </div>

      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={onEquipTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}}/>
    </div>
  );
}

function TournamentScreen({onStart,onBack,coins,gems}){
  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px",minHeight:"100vh"}}>
      <style>{GS}</style>
      <div style={{maxWidth:380,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:12}}>🏆</div>
        <h1 style={{fontFamily:"Cinzel,serif",fontSize:28,fontWeight:900,color:"#f0c060",letterSpacing:6,marginBottom:8}}>TOURNAMENT</h1>
        <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#7a9a7e",fontSize:15,marginBottom:32}}>4-player bracket · Best of 1 · Win it all</p>
        {/* Bracket preview */}
        <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(212,168,67,0.2)",borderRadius:16,padding:"20px",marginBottom:24}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#d4a843",letterSpacing:3,marginBottom:16}}>BRACKET</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12}}>
            <div style={{flex:1,background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.25)",borderRadius:8,padding:"8px 6px",fontFamily:"Cinzel,serif",fontSize:9,color:"#f0c060",textAlign:"center"}}>YOU<br/><span style={{color:"#6a8a6e",fontSize:8}}>vs</span><br/>CPU 1</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:20,color:"rgba(212,168,67,0.4)"}}>⚔️</div>
            <div style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 6px",fontFamily:"Cinzel,serif",fontSize:9,color:"#8aaa8a",textAlign:"center"}}>CPU 2<br/><span style={{color:"#4a6a4a",fontSize:8}}>vs</span><br/>CPU 3</div>
          </div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#4a6a4e",letterSpacing:2,textAlign:"center"}}>↓ FINAL ↓</div>
          <div style={{marginTop:12,background:"rgba(212,168,67,0.06)",border:"1px solid rgba(212,168,67,0.15)",borderRadius:8,padding:"10px",fontFamily:"Cinzel,serif",fontSize:9,color:"#8a7a3e",textAlign:"center",letterSpacing:2}}>WINNER vs WINNER</div>
        </div>
        {/* Rewards */}
        <div style={{display:"flex",gap:10,marginBottom:28,justifyContent:"center"}}>
          <div style={{background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.25)",borderRadius:12,padding:"12px 20px",textAlign:"center"}}>
            <div style={{fontSize:20,marginBottom:4}}>🪙</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:16,color:"#f0c060",fontWeight:900}}>1000</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#8a7a3e",letterSpacing:2,marginTop:2}}>WIN REWARD</div>
          </div>
          <div style={{background:"rgba(96,200,240,0.08)",border:"1px solid rgba(96,200,240,0.2)",borderRadius:12,padding:"12px 20px",textAlign:"center"}}>
            <div style={{fontSize:20,marginBottom:4}}>💎</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:16,color:"#60c8f0",fontWeight:900}}>10</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#406070",letterSpacing:2,marginTop:2}}>CHAMPION</div>
          </div>
        </div>
        <button className="btn_btn_gold" style={{width:"100%",padding:"16px",fontSize:14,letterSpacing:4,marginBottom:12}} onClick={onStart}>
          ⚔️ START TOURNAMENT
        </button>
        <button onClick={onBack} style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,fontFamily:"Cinzel,serif",fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:2,cursor:"pointer"}}>
          BACK
        </button>
      </div>
    </div>
  );
}

function TournamentResultScreen({data,onClaim,playerName}){
  var won=data.champion===playerName||data.champion==="You";
  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px",minHeight:"100vh"}}>
      <style>{GS}</style>
      <div style={{maxWidth:380,width:"100%",textAlign:"center",animation:"fadeUp 0.5s cubic-bezier(.22,1,.36,1) both"}}>
        <div style={{fontSize:72,marginBottom:12,animation:"float 2s ease-in-out infinite"}}>{won?"🏆":"🥈"}</div>
        <h1 style={{fontFamily:"Cinzel,serif",fontSize:won?30:24,fontWeight:900,color:won?"#f0c060":"#8aaa8a",letterSpacing:4,marginBottom:8}}>
          {won?"CHAMPION!":"TOURNAMENT OVER"}
        </h1>
        <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#7a9a7e",fontSize:15,marginBottom:8}}>
          {won?"You conquered the tournament!":"Better luck next time, "+playerName}
        </p>
        <p style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#d4a843",letterSpacing:3,marginBottom:28}}>
          CHAMPION: {data.champion}
        </p>
        {/* Bracket results */}
        <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(212,168,67,0.2)",borderRadius:16,padding:"16px",marginBottom:20,textAlign:"left"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:3,marginBottom:12,textAlign:"center"}}>RESULTS</div>
          {data.bracket.map(function(match,i){return(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<data.bracket.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
              <span style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"#6a8a6e"}}>{i===0?"Semi 1":i===1?"Semi 2":"Final"}</span>
              <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#f0c060"}}>{match.winner} wins</span>
            </div>
          );})}
        </div>
        {won&&(
          <div style={{display:"flex",gap:10,marginBottom:20,justifyContent:"center"}}>
            <div style={{background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.3)",borderRadius:12,padding:"10px 18px",fontFamily:"Cinzel,serif",fontSize:15,color:"#f0c060"}}>🪙 +1000</div>
            <div style={{background:"rgba(96,200,240,0.08)",border:"1px solid rgba(96,200,240,0.25)",borderRadius:12,padding:"10px 18px",fontFamily:"Cinzel,serif",fontSize:15,color:"#60c8f0"}}>💎 +10</div>
          </div>
        )}
        <button className="btn_btn_gold" style={{width:"100%",padding:"14px",fontSize:13,letterSpacing:3}} onClick={onClaim}>
          {won?"CLAIM REWARDS":"BACK TO HOME"}
        </button>
      </div>
    </div>
  );
}

function GameSummaryScreen({data,names,onClose}){
  if(!data)return null;
  var declarations=data.declarations||{};
  var cobraHits=data.cobraHits||{};
  var roundScores=data.roundScores||[];
  var rounds=data.rounds||0;
  var winner=data.winner;
  var scores=data.scores;
  var allNames=names||[];

  var mvp=typeof winner==="number"&&allNames[winner]?allNames[winner]:(scores?allNames[scores.indexOf(Math.min.apply(null,scores))]:"Unknown")||"Unknown";
  var topDeclarer=Object.keys(declarations).sort(function(a,b){return (declarations[b]||0)-(declarations[a]||0);})[0]||"-";
  var topCobra=Object.keys(cobraHits).sort(function(a,b){return (cobraHits[b]||0)-(cobraHits[a]||0);})[0]||"-";

  var stats=[
    {icon:"🏆",label:"Champion",value:mvp},
    {icon:"📢",label:"Most Declarations",value:topDeclarer+(declarations[topDeclarer]?" ("+declarations[topDeclarer]+"x)":"")},
    {icon:"🐍",label:"Most Cobras",value:topCobra+(cobraHits[topCobra]?" ("+cobraHits[topCobra]+"x)":"")},
    {icon:"🔄",label:"Total Rounds",value:rounds},
  ];

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(170deg,#0d1f0e,#060e06)",border:"1.5px solid rgba(212,168,67,0.35)",borderBottom:"none",borderRadius:"24px 24px 0 0",padding:"0 0 calc(28px + env(safe-area-inset-bottom))",width:"100%",maxWidth:480,animation:"slideUp 0.38s cubic-bezier(.22,1,.36,1) both",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
          <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)"}}/>
        </div>
        <div style={{padding:"16px 24px 0"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:6}}>📊</div>
            <h2 style={{fontFamily:"Cinzel,serif",fontSize:20,fontWeight:900,color:"#f0c060",letterSpacing:4,marginBottom:4}}>GAME SUMMARY</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {stats.map(function(s,i){return(
              <div key={i} style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(212,168,67,0.15)",borderRadius:12,padding:"12px",textAlign:"center"}}>
                <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#8a9a8a",letterSpacing:2,marginBottom:4}}>{s.label.toUpperCase()}</div>
                <div style={{fontFamily:"Crimson Text,serif",fontSize:14,color:"#f0c060",fontWeight:700}}>{s.value}</div>
              </div>
            );})}
          </div>
          <div style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"16px",marginBottom:16}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:3,marginBottom:12,textAlign:"center"}}>FINAL SCORES</div>
            {allNames.map(function(name,i){
              var s=scores?scores[i]:0;
              var isWinner=scores&&s===Math.min.apply(null,scores);
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<allNames.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                  <span style={{fontFamily:"Crimson Text,serif",fontSize:14,color:isWinner?"#f0c060":"#8a9a8a"}}>{isWinner?"👑 ":""}{name}</span>
                  <span style={{fontFamily:"Cinzel,serif",fontSize:13,color:isWinner?"#f0c060":"#6a8a6e",fontWeight:isWinner?900:400}}>{s} pts</span>
                </div>
              );
            })}
          </div>
          <button onClick={onClose} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#d4a843,#a87020)",border:"none",borderRadius:12,fontFamily:"Cinzel,serif",fontSize:13,fontWeight:700,color:"#010603",letterSpacing:3,cursor:"pointer",marginBottom:8}}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

function VIPBadge(){
  return <span style={{display:"inline-flex",alignItems:"center",background:"linear-gradient(135deg,#d4a843,#f0c060)",borderRadius:6,padding:"1px 6px",fontFamily:"Cinzel,serif",fontSize:7,fontWeight:900,color:"#010603",letterSpacing:1,marginLeft:4}}>VIP</span>;
}

function VIPScreen({onBack,onBuy,isVIP,coins,gems}){
  var PRICE_GEMS=50;
  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"32px 20px",minHeight:"100vh",overflowY:"auto"}}>
      <style>{GS}</style>
      <div style={{maxWidth:400,width:"100%"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#d4a843",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,cursor:"pointer",marginBottom:20}}>← BACK</button>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:56,marginBottom:8}}>👑</div>
          <h1 style={{fontFamily:"Cinzel,serif",fontSize:28,fontWeight:900,background:"linear-gradient(135deg,#f7df80,#d4a843,#a87020)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",letterSpacing:6,marginBottom:6}}>VIP MEMBER</h1>
          <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#7a9a7e",fontSize:15}}>Unlock the full COBRA experience</p>
        </div>
        <div style={{background:"rgba(0,0,0,0.3)",border:"1.5px solid rgba(212,168,67,0.25)",borderRadius:20,padding:"20px",marginBottom:20}}>
          {[
            {icon:"⚡",title:"2x XP Every Game",desc:"Double experience points always"},
            {icon:"🪙",title:"75% More Coins",desc:"350 coins on win vs 200 for free"},
            {icon:"🎁",title:"2x Daily Bonus",desc:"Double coins from daily login rewards"},
            {icon:"👑",title:"Animated Gold Frame",desc:"Spinning gold ring on your avatar"},
            {icon:"🎨",title:"VIP Gold Card Theme",desc:"Exclusive gold card back — free"},
            {icon:"🔒",title:"VIP Exclusive Items",desc:"Access locked shop items"},
          ].map(function(b,i){return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:i<5?"1px solid rgba(255,255,255,0.05)":"none"}}>
              <span style={{fontSize:22,width:32,textAlign:"center"}}>{b.icon}</span>
              <div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#f0c060",letterSpacing:1,marginBottom:2}}>{b.title}</div>
                <div style={{fontFamily:"Crimson Text,serif",color:"#6a8a6e",fontSize:13}}>{b.desc}</div>
              </div>
              <span style={{marginLeft:"auto",color:"#4ade80",fontSize:16}}>✓</span>
            </div>
          );})}
        </div>
        {isVIP?(
          <div style={{textAlign:"center",padding:"20px",background:"rgba(212,168,67,0.1)",border:"1.5px solid rgba(212,168,67,0.4)",borderRadius:16}}>
            <div style={{fontSize:32,marginBottom:8}}>👑</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:16,color:"#f0c060",letterSpacing:3}}>YOU ARE VIP</div>
            <div style={{fontFamily:"Crimson Text,serif",color:"#7a9a7e",fontSize:13,marginTop:4}}>Enjoy your premium benefits!</div>
          </div>
        ):(
          <div>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#8a9a8a",letterSpacing:2,marginBottom:4}}>ONE-TIME PURCHASE</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:36,color:"#60c8f0",fontWeight:900}}>💎 {PRICE_GEMS}</div>
              <div style={{fontFamily:"Crimson Text,serif",color:"#6a8a6e",fontSize:13}}>You have: 💎{gems}</div>
            </div>
            <button onClick={function(){onBuy(PRICE_GEMS);}} disabled={gems<PRICE_GEMS}
              style={{width:"100%",padding:"16px",background:gems>=PRICE_GEMS?"linear-gradient(135deg,#d4a843,#f0c060,#a87020)":"rgba(255,255,255,0.05)",border:gems>=PRICE_GEMS?"none":"1px solid rgba(255,255,255,0.1)",borderRadius:14,fontFamily:"Cinzel,serif",fontSize:15,fontWeight:900,color:gems>=PRICE_GEMS?"#010603":"#4a5a4a",letterSpacing:3,cursor:gems>=PRICE_GEMS?"pointer":"not-allowed",boxShadow:gems>=PRICE_GEMS?"0 4px 24px rgba(212,168,67,0.4)":"none"}}>
              \U0001f451 BECOME VIP
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SeasonPassScreen({goScreen,isVIP,coins,gems,seasonXP,seasonTier,claimedTiers,onClaim,onGetVIP}){
  var SP=SEASON_PASS;
  var now=Date.now();
  var seasonStart=parseInt(function(){try{return localStorage.getItem("cobra_season_start")||"0";}catch(e){return "0";}}());
  if(!seasonStart){seasonStart=now;try{localStorage.setItem("cobra_season_start",String(now));}catch(e){}}
  var seasonEnd=new Date(seasonStart+SP.durationDays*24*3600*1000);
  var daysLeft=Math.max(0,Math.ceil((seasonEnd.getTime()-now)/86400000));
  var endStr=seasonEnd.toLocaleDateString("en-US",{month:"short",day:"numeric"});

  var currentTierIdx=seasonTier; // 0-based index of highest unlocked tier (0 = none unlocked)
  var xpInCurrentTier=seasonXP-(currentTierIdx*SP.xpPerTier);
  var xpNeeded=SP.xpPerTier;

  var hasUnclaimed=SP.tiers.some(function(t){
    return t.tier<=currentTierIdx&&claimedTiers.indexOf(t.tier)<0;
  });

  function claimTier(tier,reward,isVipReward){
    if(claimedTiers.indexOf(tier+(isVipReward?"_vip":""))>=0)return;
    onClaim(tier,reward,isVipReward);
  }

  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",minHeight:"100vh",overflowY:"auto"}}>
      <style>{GS}</style>
      {/* Header */}
      <div style={{background:"linear-gradient(180deg,rgba(60,10,100,0.98),rgba(40,5,70,0.99))",padding:"calc(20px + env(safe-area-inset-top)) 20px 24px",borderBottom:"1px solid rgba(124,58,237,0.4)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 0%,rgba(124,58,237,0.3),transparent 70%)",pointerEvents:"none"}}/>
        <button onClick={function(){goScreen("home");}} style={{background:"none",border:"none",color:"#c4b5fd",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,cursor:"pointer",marginBottom:16,position:"relative",zIndex:1}}>← BACK</button>
        <div style={{textAlign:"center",position:"relative",zIndex:1}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:4,color:"#a78bfa",marginBottom:4}}>SEASON 1</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:26,fontWeight:900,background:"linear-gradient(135deg,#f0c060,#c084fc,#7c3aed)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",letterSpacing:4,marginBottom:6}}>Serpent's Rise</div>
          <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"rgba(196,181,253,0.7)"}}>Ends {endStr} · {daysLeft} days left</div>
        </div>
        {/* XP Progress */}
        <div style={{marginTop:18,position:"relative",zIndex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:"#a78bfa"}}>TIER {currentTierIdx}/{SP.totalTiers}</span>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#c4b5fd"}}>{Math.min(xpInCurrentTier,xpNeeded)} / {xpNeeded} XP</span>
          </div>
          <div style={{height:8,background:"rgba(124,58,237,0.2)",borderRadius:4,overflow:"hidden",border:"1px solid rgba(124,58,237,0.3)"}}>
            <div style={{height:"100%",width:(Math.min(xpInCurrentTier,xpNeeded)/xpNeeded*100)+"%",background:"linear-gradient(90deg,#7c3aed,#c084fc)",borderRadius:4,transition:"width 0.5s ease"}}/>
          </div>
        </div>
      </div>

      {/* VIP Banner */}
      <div style={{margin:"16px 16px 0",borderRadius:14,overflow:"hidden"}}>
        {isVIP?(
          <div style={{background:"linear-gradient(135deg,rgba(124,58,237,0.25),rgba(192,132,252,0.15))",border:"1.5px solid rgba(124,58,237,0.5)",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>👑</span>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#c084fc",letterSpacing:2}}>VIP ACTIVE</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"#a78bfa"}}>All VIP rewards unlocked · 2x Season XP</div>
            </div>
            <span style={{marginLeft:"auto",color:"#4ade80",fontSize:18}}>✓</span>
          </div>
        ):(
          <div style={{background:"linear-gradient(135deg,rgba(30,5,50,0.9),rgba(20,3,35,0.95))",border:"1.5px solid rgba(124,58,237,0.4)",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={onGetVIP}>
            <span style={{fontSize:20}}>🔒</span>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#c084fc",letterSpacing:2}}>UNLOCK VIP REWARDS</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"#7a6a9a"}}>Double XP + exclusive tier rewards</div>
            </div>
            <div style={{background:"linear-gradient(135deg,#7c3aed,#c084fc)",borderRadius:10,padding:"8px 14px",flexShrink:0}}>
              <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#fff",letterSpacing:1}}>GET VIP 💎50</span>
            </div>
          </div>
        )}
      </div>

      {/* Reward Track */}
      <div style={{padding:"16px 0 24px"}}>
        <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:3,color:"#7c3aed",padding:"0 16px 12px"}}>REWARD TRACK</div>
        <div style={{overflowX:"auto",paddingBottom:8}}>
          <div style={{display:"flex",gap:10,padding:"0 16px",width:"max-content"}}>
            {SP.tiers.map(function(t){
              var unlocked=t.tier<=currentTierIdx;
              var freeClaimed=claimedTiers.indexOf(t.tier)>=0;
              var vipClaimed=claimedTiers.indexOf(t.tier+"_vip")>=0;
              var isCurrent=t.tier===currentTierIdx+1;
              return(
                <div key={t.tier} style={{width:100,flexShrink:0,background:unlocked?"rgba(124,58,237,0.15)":isCurrent?"rgba(80,20,150,0.2)":"rgba(0,0,0,0.3)",border:unlocked?"1.5px solid rgba(124,58,237,0.5)":isCurrent?"1.5px solid rgba(124,58,237,0.3)":"1px solid rgba(124,58,237,0.1)",borderRadius:14,padding:"10px 8px",textAlign:"center",opacity:!unlocked&&!isCurrent?0.45:1,boxShadow:isCurrent?"0 0 16px rgba(124,58,237,0.4)":"none",transition:"all 0.3s"}}>
                  {/* Tier number */}
                  <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:unlocked?"#c084fc":"#7c3aed",marginBottom:6}}>TIER {t.tier}</div>

                  {/* Free reward */}
                  <div style={{marginBottom:8}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#8a8a9a",marginBottom:4}}>FREE</div>
                    <div style={{fontSize:20,marginBottom:2}}>{t.free.icon}</div>
                    <div style={{fontFamily:"Crimson Text,serif",fontSize:11,color:"#e8f0e8",lineHeight:1.2,marginBottom:6}}>{t.free.label}</div>
                    {unlocked&&!freeClaimed&&(
                      <button onClick={function(){claimTier(t.tier,t.free,false);}} style={{width:"100%",padding:"5px 0",background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",borderRadius:8,fontFamily:"Cinzel,serif",fontSize:9,color:"#fff",letterSpacing:1,cursor:"pointer"}}>CLAIM</button>
                    )}
                    {freeClaimed&&<div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#4ade80"}}>✓</div>}
                    {!unlocked&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#4a3a6a"}}>🔒</div>}
                  </div>

                  {/* Divider */}
                  <div style={{height:1,background:"rgba(124,58,237,0.3)",margin:"0 0 8px"}}/>

                  {/* VIP reward */}
                  <div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:3,marginBottom:4}}>
                      <span style={{fontSize:9}}>👑</span>
                      <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#d4a843"}}>VIP</span>
                    </div>
                    <div style={{fontSize:16,marginBottom:2}}>{t.vip.icon}</div>
                    <div style={{fontFamily:"Crimson Text,serif",fontSize:10,color:"#d4a843",lineHeight:1.2,marginBottom:6}}>{t.vip.label}</div>
                    {unlocked&&isVIP&&!vipClaimed&&(
                      <button onClick={function(){claimTier(t.tier,t.vip,true);}} style={{width:"100%",padding:"5px 0",background:"linear-gradient(135deg,#a87020,#d4a843)",border:"none",borderRadius:8,fontFamily:"Cinzel,serif",fontSize:9,color:"#010603",letterSpacing:1,cursor:"pointer",fontWeight:700}}>CLAIM</button>
                    )}
                    {vipClaimed&&<div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#4ade80"}}>✓</div>}
                    {(!unlocked||!isVIP)&&!vipClaimed&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#4a3a2a"}}>{isVIP?"🔒":"👑"}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* XP Sources info */}
      <div style={{margin:"0 16px 24px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:14,padding:"16px"}}>
        <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:"#7c3aed",marginBottom:12}}>HOW TO EARN XP</div>
        {[["🏆","Win a round","+50 XP"],["🃏","Play any round","+15 XP"],["🐍","Cobra declaration","+30 XP"],["👑","VIP bonus","2× XP"]].map(function(row,i){return(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<3?"1px solid rgba(255,255,255,0.04)":"none"}}>
            <span style={{fontSize:16,width:24}}>{row[0]}</span>
            <span style={{fontFamily:"Crimson Text,serif",fontSize:14,color:"#c4b5fd",flex:1}}>{row[1]}</span>
            <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#a78bfa",fontWeight:700}}>{row[2]}</span>
          </div>
        )})}
      </div>
    </div>
  );
}

// ─── CLAN SCREEN ────────────────────────────────────────────────────────────
var SAMPLE_CLANS=[
  {name:"Serpent Kings",tag:"SKG",icon:"🐍",members:12,elo:18450},
  {name:"Shadow Reapers",tag:"SHR",icon:"💀",members:9,elo:14200},
  {name:"Storm Eagles",tag:"STE",icon:"🦅",members:15,elo:21600},
  {name:"Dragon Fire",tag:"DRF",icon:"🐉",members:7,elo:10800},
  {name:"Moon Warriors",tag:"MNW",icon:"🌙",members:11,elo:16350},
  {name:"Thunder Blades",tag:"THB",icon:"⚔️",members:8,elo:12100},
];
var TOP_CLANS=[
  {name:"Storm Eagles",tag:"STE",icon:"🦅",members:15,elo:21600},
  {name:"Serpent Kings",tag:"SKG",icon:"🐍",members:12,elo:18450},
  {name:"Moon Warriors",tag:"MNW",icon:"🌙",members:11,elo:16350},
  {name:"Shadow Reapers",tag:"SHR",icon:"💀",members:9,elo:14200},
  {name:"Thunder Blades",tag:"THB",icon:"⚔️",members:8,elo:12100},
  {name:"Dragon Fire",tag:"DRF",icon:"🐉",members:7,elo:10800},
  {name:"Iron Cobras",tag:"IRC",icon:"⚡",members:14,elo:9750},
  {name:"Crimson Hawks",tag:"CRH",icon:"🎯",members:6,elo:8400},
  {name:"Ocean Tide",tag:"OCT",icon:"🌊",members:10,elo:7200},
  {name:"Bone Archers",tag:"BOA",icon:"🏹",members:5,elo:5600},
];
var CLAN_ICONS=["🐍","⚔️","🔥","💀","👑","🌙","⚡","🎯","🦅","🌊","🐉","🏹"];
var MOCK_MEMBERS=[
  {name:"VenomStrike",avatar:"😤",elo:1850,role:"Officer"},
  {name:"NightBlade",avatar:"😈",elo:1620,role:"Member"},
  {name:"CrimsonAce",avatar:"🤠",elo:1490,role:"Member"},
  {name:"SilverFang",avatar:"😎",elo:1380,role:"Member"},
  {name:"DarkPhoenix",avatar:"🦊",elo:1250,role:"Member"},
];

function ClanScreen({goScreen,myName,myAvatar,elo,coins,onSpendCoins}){
  var storedClan=null;
  try{var sc=localStorage.getItem("cobra_clan");if(sc&&sc!=="null")storedClan=JSON.parse(sc);}catch(e){}
  var [clan,setClan]=useState(storedClan);
  var [tab,setTab]=useState(storedClan?"myclan":"browse");
  var [clanName,setClanName]=useState("");
  var [clanTag,setClanTag]=useState("");
  var [clanIcon,setClanIcon]=useState("🐍");
  var [leaveConfirm,setLeaveConfirm]=useState(false);
  var [warScore,setWarScore]=useState(function(){try{return parseInt(localStorage.getItem("cobra_war_score")||"0");}catch(e){return 0;}});
  var [warCountdown,setWarCountdown]=useState("47:59:59");
  useEffect(function(){
    if(tab!=="wars")return;
    function tick(){var now=new Date();var endMs=new Date(now.getFullYear(),now.getMonth(),now.getDate()+Math.ceil((48*3600000-now%86400000)/86400000)).getTime();var left=Math.max(0,endMs-Date.now());var h=Math.floor(left/3600000);var m=Math.floor((left%3600000)/60000);var s=Math.floor((left%60000)/1000);setWarCountdown((h<10?"0"+h:h)+":"+(m<10?"0"+m:m)+":"+(s<10?"0"+s:s));}
    tick();var id=setInterval(tick,1000);return function(){clearInterval(id);};
  },[tab]);

  function saveClan(c){
    setClan(c);
    try{localStorage.setItem("cobra_clan",c?JSON.stringify(c):"null");}catch(e){}
  }

  function joinClan(c){
    var newClan={name:c.name,tag:c.tag,icon:c.icon,role:"Member"};
    saveClan(newClan);
    setTab("myclan");
  }

  function createClan(){
    var trimName=clanName.trim();
    var trimTag=clanTag.trim().toUpperCase();
    if(!trimName||trimName.length<2)return;
    if(!trimTag||trimTag.length!==3)return;
    if(coins<500)return;
    onSpendCoins(500);
    var newClan={name:trimName,tag:trimTag,icon:clanIcon,role:"Leader"};
    saveClan(newClan);
    setTab("myclan");
  }

  function leaveClan(){
    saveClan(null);
    setLeaveConfirm(false);
    setTab("browse");
  }

  var tabStyle=function(t){return{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,padding:"10px 0",cursor:"pointer",background:"none",border:"none",borderBottom:tab===t?"2px solid #ef4444":"2px solid transparent",color:tab===t?"#ef4444":"#6a8a6e",flex:1,touchAction:"manipulation"};};

  var playerElo=elo||1000;
  var allMembers=[{name:myName||"You",avatar:myAvatar||"😎",elo:playerElo,role:clan?clan.role:"Member"},...MOCK_MEMBERS];
  var totalElo=allMembers.reduce(function(s,m){return s+m.elo;},0);
  var clanRank=clan?(function(){var idx=TOP_CLANS.findIndex(function(c){return c.tag===clan.tag;});return idx>=0?idx+1:Math.floor(Math.random()*5)+6;})():"-";
  var weeklyXP=340;
  var weeklyXPGoal=1000;

  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",height:"100%",maxHeight:"100vh",overflow:"hidden"}}>
      <div style={{flexShrink:0,padding:"calc(16px + env(safe-area-inset-top)) 18px 0"}}>
        <button className="btn_btn_ghost" style={{marginBottom:12,padding:"10px 16px",fontSize:11}} onClick={function(){goScreen("home");}}>← BACK</button>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:32,marginBottom:4}}>⚔️</div>
          <h2 style={{fontFamily:"Cinzel,serif",color:"#ef4444",fontSize:20,letterSpacing:4,margin:0}}>CLANS</h2>
          <p style={{fontFamily:"Crimson Text,serif",color:"#8a9a7a",fontSize:13,margin:"4px 0 0"}}>Fight together, rise together</p>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:0}}>
          {clan&&<button style={tabStyle("myclan")} onClick={function(){setTab("myclan");}}>MY CLAN</button>}
          {!clan&&<button style={tabStyle("browse")} onClick={function(){setTab("browse");}}>BROWSE</button>}
          {!clan&&<button style={tabStyle("create")} onClick={function(){setTab("create");}}>CREATE</button>}
          <button style={tabStyle("leaderboard")} onClick={function(){setTab("leaderboard");}}>TOP CLANS</button>
          <button style={tabStyle("wars")} onClick={function(){setTab("wars");}}>⚔️ WARS</button>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"16px 18px calc(32px + env(safe-area-inset-bottom))"}}>

        {tab==="myclan"&&clan&&(
          <div>
            <div style={{textAlign:"center",padding:"20px 0 16px",background:"rgba(239,68,68,0.08)",borderRadius:16,border:"1px solid rgba(239,68,68,0.2)",marginBottom:14}}>
              <div style={{fontSize:52,marginBottom:6}}>{clan.icon}</div>
              <div style={{fontFamily:"Cinzel,serif",color:"#f0c060",fontSize:18,letterSpacing:3}}>{clan.name}</div>
              <div style={{fontFamily:"Cinzel,serif",color:"#ef4444",fontSize:12,letterSpacing:4,marginTop:2}}>[{clan.tag}]</div>
              <div style={{display:"inline-block",marginTop:8,padding:"4px 14px",borderRadius:20,background:clan.role==="Leader"?"rgba(239,68,68,0.25)":"rgba(249,115,22,0.2)",border:clan.role==="Leader"?"1px solid rgba(239,68,68,0.5)":"1px solid rgba(249,115,22,0.4)",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:clan.role==="Leader"?"#ef4444":"#f97316"}}>{clan.role==="Leader"?"👑 LEADER":"⚔️ MEMBER"}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[["MEMBERS",allMembers.length,"👥"],["TOTAL ELO",totalElo.toLocaleString(),"🏆"],["RANK","#"+clanRank,"🎖️"]].map(function(s){return(
                <div key={s[0]} style={{background:"rgba(0,0,0,0.3)",borderRadius:12,padding:"12px 8px",textAlign:"center",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:18,marginBottom:2}}>{s[2]}</div>
                  <div style={{fontFamily:"Cinzel,serif",color:"#f0c060",fontSize:13,fontWeight:700}}>{s[1]}</div>
                  <div style={{fontFamily:"Cinzel,serif",color:"#4a6a5e",fontSize:9,letterSpacing:1.5,marginTop:2}}>{s[0]}</div>
                </div>
              );})}
            </div>
            <div style={{background:"rgba(0,0,0,0.28)",borderRadius:14,padding:"14px 16px",marginBottom:14,border:"1px solid rgba(249,115,22,0.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#f97316",letterSpacing:2}}>WEEKLY CLAN XP</span>
                <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#f0c060"}}>{weeklyXP}/{weeklyXPGoal}</span>
              </div>
              <div style={{height:8,background:"rgba(255,255,255,0.08)",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:(weeklyXP/weeklyXPGoal*100)+"%",background:"linear-gradient(90deg,#ef4444,#f97316)",borderRadius:4}}/>
              </div>
              <div style={{fontFamily:"Crimson Text,serif",color:"#6a8a6e",fontSize:12,marginTop:6}}>Resets Monday — earn XP by playing ranked matches</div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#6a8a6e",letterSpacing:2,marginBottom:8}}>MEMBERS ({allMembers.length})</div>
              {allMembers.map(function(m,i){return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,marginBottom:6,background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.05)"}}>
                  <div style={{fontSize:22,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(239,68,68,0.12)",borderRadius:"50%"}}>{m.avatar}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"Cinzel,serif",color:"#e8d5a0",fontSize:13}}>{m.name}{i===0?" (You)":""}</div>
                    <div style={{fontFamily:"Crimson Text,serif",color:"#6a8a6e",fontSize:12}}>{m.role}</div>
                  </div>
                  <div style={{fontFamily:"Cinzel,serif",color:"#f0c060",fontSize:13}}>{m.elo}</div>
                </div>
              );})}
            </div>
            <div style={{background:"rgba(0,0,0,0.2)",borderRadius:14,padding:"20px",textAlign:"center",border:"1px solid rgba(255,255,255,0.04)",marginBottom:14}}>
              <div style={{fontSize:28,marginBottom:6,opacity:0.4}}>💬</div>
              <div style={{fontFamily:"Crimson Text,serif",color:"#4a5a4e",fontSize:14}}>Clan chat coming soon 🔒</div>
            </div>
            {!leaveConfirm?(
              <button className="btn_btn_ghost" style={{width:"100%",padding:"14px",fontSize:11,letterSpacing:2,color:"#ef4444",border:"1.5px solid rgba(239,68,68,0.35)"}} onClick={function(){setLeaveConfirm(true);}}>🚪 LEAVE CLAN</button>
            ):(
              <div style={{background:"rgba(239,68,68,0.08)",borderRadius:14,padding:"16px",textAlign:"center",border:"1px solid rgba(239,68,68,0.3)"}}>
                <div style={{fontFamily:"Crimson Text,serif",color:"#e8d5a0",fontSize:15,marginBottom:12}}>Are you sure you want to leave {clan.name}?</div>
                <div style={{display:"flex",gap:10}}>
                  <button className="btn_btn_ghost" style={{flex:1,padding:"12px",fontSize:11,color:"#8a9a7a"}} onClick={function(){setLeaveConfirm(false);}}>CANCEL</button>
                  <button className="btn_btn_ghost" style={{flex:1,padding:"12px",fontSize:11,color:"#ef4444",border:"1.5px solid rgba(239,68,68,0.5)"}} onClick={leaveClan}>CONFIRM LEAVE</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="browse"&&!clan&&(
          <div>
            <div style={{fontFamily:"Crimson Text,serif",color:"#8a9a7a",fontSize:14,marginBottom:14}}>Join an existing clan to earn rewards together.</div>
            {SAMPLE_CLANS.map(function(c){return(
              <div key={c.tag} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,marginBottom:10,background:"rgba(0,0,0,0.28)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{fontSize:32,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(239,68,68,0.1)",borderRadius:12}}>{c.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Cinzel,serif",color:"#f0c060",fontSize:13}}>{c.name} <span style={{color:"#ef4444",fontSize:11}}>[{c.tag}]</span></div>
                  <div style={{fontFamily:"Crimson Text,serif",color:"#6a8a6e",fontSize:12}}>{c.members} members · {c.elo.toLocaleString()} ELO</div>
                </div>
                <button className="btn_btn_ghost" style={{padding:"8px 14px",fontSize:10,letterSpacing:2,color:"#ef4444",border:"1.5px solid rgba(239,68,68,0.4)"}} onClick={function(){joinClan(c);}}>JOIN</button>
              </div>
            );})}
          </div>
        )}

        {tab==="create"&&!clan&&(
          <div>
            <div style={{background:"rgba(239,68,68,0.08)",borderRadius:14,padding:"14px 16px",marginBottom:18,border:"1px solid rgba(239,68,68,0.2)"}}>
              <div style={{fontFamily:"Cinzel,serif",color:"#ef4444",fontSize:11,letterSpacing:2,marginBottom:4}}>COST: 500 COINS</div>
              <div style={{fontFamily:"Crimson Text,serif",color:"#8a9a7a",fontSize:13}}>You currently have {(coins||0).toLocaleString()} coins.{coins<500?" Not enough coins to create a clan.":""}</div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:"#6a8a6e",display:"block",marginBottom:6}}>CLAN NAME</label>
              <input value={clanName} onChange={function(e){setClanName(e.target.value);}} maxLength={24} placeholder="Enter clan name..." style={{width:"100%",background:"rgba(0,0,0,0.35)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 14px",color:"#e8d5a0",fontFamily:"Crimson Text,serif",fontSize:15,boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:"#6a8a6e",display:"block",marginBottom:6}}>CLAN TAG (3 LETTERS)</label>
              <input value={clanTag} onChange={function(e){setClanTag(e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3));}} maxLength={3} placeholder="TAG" style={{width:"100%",background:"rgba(0,0,0,0.35)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 14px",color:"#ef4444",fontFamily:"Cinzel,serif",fontSize:15,letterSpacing:4,boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:22}}>
              <label style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:"#6a8a6e",display:"block",marginBottom:10}}>CLAN ICON</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
                {CLAN_ICONS.map(function(ic){return(
                  <button key={ic} onClick={function(){setClanIcon(ic);}} style={{fontSize:24,padding:"10px",borderRadius:10,border:clanIcon===ic?"2px solid #ef4444":"2px solid rgba(255,255,255,0.08)",background:clanIcon===ic?"rgba(239,68,68,0.15)":"rgba(0,0,0,0.2)",cursor:"pointer",touchAction:"manipulation"}}>{ic}</button>
                );})}
              </div>
            </div>
            <button className="btn_btn_ghost" style={{width:"100%",padding:"16px",fontSize:12,letterSpacing:3,color:coins>=500?"#ef4444":"#4a5a4e",border:coins>=500?"1.5px solid rgba(239,68,68,0.5)":"1.5px solid rgba(255,255,255,0.06)",cursor:coins>=500?"pointer":"not-allowed"}} onClick={function(){if(coins>=500&&clanName.trim().length>=2&&clanTag.length===3)createClan();}}>⚔️ CREATE CLAN (500 🪙)</button>
          </div>
        )}

        {tab==="wars"&&(
          <div>
            <div style={{textAlign:"center",marginBottom:16,padding:"12px",background:"rgba(239,68,68,0.08)",borderRadius:14,border:"1px solid rgba(239,68,68,0.2)"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#ef4444",letterSpacing:3,marginBottom:4}}>⚔️ CLAN WARS</div>
              <div style={{fontFamily:"Crimson Text,serif",color:"#8a9a7a",fontSize:13}}>War ends in: <span style={{color:"#f0c060",fontFamily:"Cinzel,serif"}}>{warCountdown}</span></div>
            </div>
            {clan?(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"16px",background:"rgba(0,0,0,0.3)",borderRadius:14,border:"1px solid rgba(255,255,255,0.08)"}}>
                  <div style={{flex:1,textAlign:"center"}}>
                    <div style={{fontSize:28,marginBottom:4}}>{clan.icon}</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#ef4444",fontWeight:700}}>{clan.name}</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:24,color:"#4ade80",fontWeight:900,marginTop:4}}>{(1240+warScore).toLocaleString()}</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#7a9a7a",letterSpacing:1}}>YOUR CLAN</div>
                  </div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:20,color:"#ef4444"}}>VS</div>
                  <div style={{flex:1,textAlign:"center"}}>
                    <div style={{fontSize:28,marginBottom:4}}>⚡</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#f97316",fontWeight:700}}>Thunder Blades</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:24,color:"#f87171",fontWeight:900,marginTop:4}}>1450</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#7a9a7a",letterSpacing:1}}>OPPONENT</div>
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{height:10,background:"rgba(255,255,255,0.06)",borderRadius:5,overflow:"hidden",marginBottom:4}}>
                    <div style={{height:"100%",width:Math.round((1240+warScore)/(1240+warScore+1450)*100)+"%",background:"linear-gradient(90deg,#4ade80,#22c55e)",borderRadius:5,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontFamily:"Cinzel,serif",fontSize:9,color:"#6a8a6e"}}>
                    <span>{clan.name}</span><span>Thunder Blades</span>
                  </div>
                </div>
                <button className="btn_btn_green" style={{width:"100%",padding:"14px",fontSize:12,letterSpacing:2}} onClick={function(){var pts=Math.floor(Math.random()*20)+10;var ns=warScore+pts;setWarScore(ns);try{localStorage.setItem("cobra_war_score",String(ns));}catch(e){}audio.buttonClick&&audio.buttonClick();haptic.light&&haptic.light();}}>
                  ⚔️ CONTRIBUTE (+10–30 pts)
                </button>
                <div style={{fontFamily:"Crimson Text,serif",color:"#6a8a6e",fontSize:12,textAlign:"center",marginTop:8}}>Your contribution: <span style={{color:"#f0c060"}}>{warScore} pts</span></div>
              </div>
            ):(
              <div style={{textAlign:"center",padding:"32px 0",color:"#4a6a4e",fontFamily:"Crimson Text,serif",fontSize:15}}>
                <div style={{fontSize:40,marginBottom:12}}>⚔️</div>
                <div>Join a clan to participate in Clan Wars!</div>
              </div>
            )}
          </div>
        )}

        {tab==="leaderboard"&&(
          <div>
            <div style={{fontFamily:"Crimson Text,serif",color:"#8a9a7a",fontSize:14,marginBottom:14}}>Top 10 clans ranked by total ELO.</div>
            {TOP_CLANS.map(function(c,i){
              var isPlayer=clan&&clan.tag===c.tag;
              return(
                <div key={c.tag} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,marginBottom:8,background:isPlayer?"rgba(239,68,68,0.1)":"rgba(0,0,0,0.28)",border:isPlayer?"1px solid rgba(239,68,68,0.35)":"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontFamily:"Cinzel,serif",color:i<3?"#f0c060":"#4a6a5e",fontSize:14,width:24,textAlign:"center"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"#"+(i+1)}</div>
                  <div style={{fontSize:24}}>{c.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"Cinzel,serif",color:isPlayer?"#ef4444":"#e8d5a0",fontSize:13}}>{c.name} <span style={{fontSize:10,opacity:0.7}}>[{c.tag}]</span>{isPlayer&&<span style={{marginLeft:6,fontSize:10,color:"#ef4444"}}>← YOU</span>}</div>
                    <div style={{fontFamily:"Crimson Text,serif",color:"#6a8a6e",fontSize:12}}>{c.members} members</div>
                  </div>
                  <div style={{fontFamily:"Cinzel,serif",color:"#f0c060",fontSize:13}}>{c.elo.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReferralScreen({goScreen,myName,addCoins,pop}){
  var code=useState(function(){
    try{
      var c=localStorage.getItem("cobra_referral_code");
      if(!c){c=(myName||"PLAY").slice(0,4).toUpperCase()+Math.random().toString(36).slice(2,6).toUpperCase();localStorage.setItem("cobra_referral_code",c);}
      return c;
    }catch(e){return "COBRA";}
  })[0];
  var [inputCode,setInputCode]=useState("");
  var [claimMsg,setClaimMsg]=useState("");
  var referralCount=parseInt((function(){try{return localStorage.getItem("cobra_referral_count")||"0";}catch(e){return"0";}})());

  function handleShare(){
    try{
      if(navigator.share){navigator.share({title:"Play COBRA",text:"Join me on COBRA! Use code "+code,url:window.location.href});}
      else{navigator.clipboard.writeText("Join me on COBRA! Use code "+code+" at "+window.location.href);setClaimMsg("Code copied to clipboard!");}
    }catch(e){try{navigator.clipboard.writeText(code);}catch(e2){}setClaimMsg("Code copied!");}
  }

  function handleClaim(){
    var c=inputCode.trim().toUpperCase();
    if(!c){setClaimMsg("Enter a code first.");return;}
    if(c===code){setClaimMsg("You cannot use your own code!");return;}
    try{
      if(localStorage.getItem("cobra_used_referral")==="1"){setClaimMsg("You have already used a referral code.");return;}
      localStorage.setItem("cobra_used_referral","1");
      addCoins(200);
      setClaimMsg("\u{1F389} +200 coins added! Thanks for using a referral code!");
    }catch(e){setClaimMsg("Error claiming code.");}
  }

  var rewardTable=[
    {n:1,reward:"200 \u{1FA99} coins"},
    {n:3,reward:"500 \u{1FA99} + 1 \u{1F48E} gem"},
    {n:5,reward:"7-day VIP trial"},
  ];

  return(
    <div className="feltbg" style={{display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"28px 20px",overflowY:"auto",minHeight:"100vh"}}>
      <style>{GS}</style>
      <div style={{maxWidth:420,width:"100%",position:"relative",zIndex:1}} className="anim_up_screen_in">
        <button className="btn_btn_ghost" style={{marginBottom:18,padding:"12px 18px",fontSize:12}} onClick={function(){audio.buttonClick();goScreen("home");}}>&#8592; BACK</button>
        <div style={{textAlign:"center",marginBottom:20}}>
          <span style={{fontSize:44}}>🎁</span>
          <h2 style={{fontFamily:"Cinzel,serif",color:"#d4a843",fontSize:22,letterSpacing:4,marginTop:8}}>REFER FRIENDS</h2>
          <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#6a9a6e",fontSize:14,marginTop:4}}>Share COBRA &#8212; earn rewards together</p>
        </div>
        <div style={{background:"rgba(212,168,67,0.08)",border:"2px solid rgba(212,168,67,0.4)",borderRadius:18,padding:"20px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#8a7a3e",letterSpacing:3,marginBottom:8}}>YOUR REFERRAL CODE</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:34,fontWeight:900,letterSpacing:6,color:"#f0c060",marginBottom:12}}>{code}</div>
          <button onClick={handleShare} style={{background:"linear-gradient(135deg,#d4a843,#a87020)",border:"none",borderRadius:12,fontFamily:"Cinzel,serif",fontSize:12,letterSpacing:2,color:"#010603",padding:"12px 28px",cursor:"pointer",fontWeight:700,touchAction:"manipulation"}}>📤 SHARE CODE</button>
        </div>
        <div style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#a0c0a0",letterSpacing:1}}>👥 INVITED FRIENDS</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:900,color:"#4ade80"}}>{referralCount}</div>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#6b5a20",letterSpacing:2,marginBottom:8}}>REWARDS</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {rewardTable.map(function(row){return(
              <div key={row.n} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:referralCount>=row.n?"rgba(74,222,128,0.08)":"rgba(0,0,0,0.2)",border:"1px solid "+(referralCount>=row.n?"rgba(74,222,128,0.3)":"rgba(255,255,255,0.06)"),borderRadius:10}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#a0c0a0",letterSpacing:1}}>{row.n} friend{row.n>1?"s":""}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:referralCount>=row.n?"#4ade80":"#d4a843"}}>{referralCount>=row.n?"✓ ":""}{row.reward}</div>
              </div>
            );})}
          </div>
        </div>
        <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"16px"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#8a7a3e",letterSpacing:2,marginBottom:10}}>ENTER A CODE</div>
          <div style={{display:"flex",gap:8}}>
            <input value={inputCode} onChange={function(e){setInputCode(e.target.value.toUpperCase());}} placeholder="FRIEND'S CODE" maxLength={10}
              style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 14px",fontFamily:"Cinzel,serif",fontSize:12,color:"#d4a843",outline:"none",letterSpacing:2}}/>
            <button onClick={handleClaim} style={{background:"linear-gradient(135deg,#1e3a5f,#1e4080)",border:"none",borderRadius:10,fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1,color:"#60a5fa",padding:"10px 16px",cursor:"pointer",fontWeight:700,touchAction:"manipulation",whiteSpace:"nowrap"}}>CLAIM</button>
          </div>
          {claimMsg&&<div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:claimMsg.includes("\u{1F389}")?"#4ade80":"#f87171",marginTop:8,textAlign:"center"}}>{claimMsg}</div>}
        </div>
      </div>
    </div>
  );
}

function FriendsScreen({goScreen,myName,myAvatar,elo,coins,addCoins,pop}){
  const [tab,setTab]=useState("friends");
  const [localGiftModal,setLocalGiftModal]=useState({friend:null,open:false});
  const [searchQuery,setSearchQuery]=useState("");
  const [searchResults,setSearchResults]=useState([]);
  const [searching,setSearching]=useState(false);
  const [friends,setFriends]=useState(function(){try{var v=localStorage.getItem("cobra_friends");return v?JSON.parse(v):[];}catch(e){return[];}});
  const [requests,setRequests]=useState(function(){try{var v=localStorage.getItem("cobra_friend_requests");return v?JSON.parse(v):[];}catch(e){return[];}});
  const [onlineNames,setOnlineNames]=useState([]);

  // Try to load online status from Supabase
  useEffect(function(){
    (async function(){
      try{
        var res=await supabase.from("cobra_online").select("name");
        if(!res.error&&res.data){setOnlineNames(res.data.map(function(r){return r.name;}));}
      }catch(e){}
    })();
  },[]);

  function saveFriends(arr){
    setFriends(arr);
    try{localStorage.setItem("cobra_friends",JSON.stringify(arr));}catch(e){}
  }

  async function doSearch(){
    if(!searchQuery.trim())return;
    setSearching(true);
    try{
      var res=await supabase.from("cobra_scores").select("*").ilike("name","%"+searchQuery.trim()+"%").limit(10);
      if(!res.error&&res.data){setSearchResults(res.data);}
      else{setSearchResults([]);}
    }catch(e){setSearchResults([]);}
    setSearching(false);
  }

  function addFriend(player){
    var already=friends.some(function(f){return f.name===player.name;});
    if(already)return;
    var newFriends=[...friends,{name:player.name,avatar:player.avatar||"😎",elo:player.elo||1000}];
    saveFriends(newFriends);
    try{
      var sent=JSON.parse(localStorage.getItem("cobra_pending_sent")||"[]");
      if(!sent.includes(player.name)){sent.push(player.name);localStorage.setItem("cobra_pending_sent",JSON.stringify(sent));}
    }catch(e){}
  }

  function removeFriend(name){
    saveFriends(friends.filter(function(f){return f.name!==name;}));
  }

  function acceptRequest(req){
    var newFriends=[...friends,{name:req.name,avatar:req.avatar||"😎",elo:req.elo||1000}];
    saveFriends(newFriends);
    var newReq=requests.filter(function(r){return r.name!==req.name;});
    setRequests(newReq);
    try{localStorage.setItem("cobra_friend_requests",JSON.stringify(newReq));}catch(e){}
  }

  function declineRequest(req){
    var newReq=requests.filter(function(r){return r.name!==req.name;});
    setRequests(newReq);
    try{localStorage.setItem("cobra_friend_requests",JSON.stringify(newReq));}catch(e){}
  }

  var tabStyle=function(t){return{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,padding:"10px 0",cursor:"pointer",background:"none",border:"none",borderBottom:tab===t?"2px solid #f0c060":"2px solid transparent",color:tab===t?"#f0c060":"#6a8a6e",flex:1,touchAction:"manipulation"};};

  return(
    <div className="feltbg" style={{display:"flex",flexDirection:"column",height:"100%",maxHeight:"100vh",overflow:"hidden"}}>
      <div style={{flexShrink:0,padding:"calc(16px + env(safe-area-inset-top)) 18px 0"}}>
        <button className="btn_btn_ghost" style={{marginBottom:12,padding:"10px 16px",fontSize:11}} onClick={function(){goScreen("home");}}>← BACK</button>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:32,marginBottom:4}}>👥</div>
          <h2 style={{fontFamily:"Cinzel,serif",color:"#f0c060",fontSize:20,letterSpacing:4,margin:0}}>FRIENDS</h2>
          <p style={{fontFamily:"Crimson Text,serif",color:"#8a9a7a",fontSize:13,margin:"4px 0 0"}}>Connect & challenge your friends</p>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:0}}>
          <button style={tabStyle("friends")} onClick={function(){setTab("friends");}}>FRIENDS{friends.length>0?" ("+friends.length+")":""}</button>
          <button style={tabStyle("search")} onClick={function(){setTab("search");}}>SEARCH</button>
          <button style={tabStyle("requests")} onClick={function(){setTab("requests");}}>REQUESTS{requests.length>0?" ("+requests.length+")":""}</button>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"16px 18px calc(32px + env(safe-area-inset-bottom))"}}>

        {/* FRIENDS TAB */}
        {tab==="friends"&&(
          <div>
            {friends.length===0&&(
              <div style={{textAlign:"center",padding:"48px 0",color:"#4a6a4e",fontFamily:"Crimson Text,serif",fontSize:15}}>
                <div style={{fontSize:40,marginBottom:12}}>👥</div>
                <div>No friends yet.</div>
                <div style={{marginTop:6,fontSize:13}}>Search for players to add them.</div>
              </div>
            )}
            {friends.map(function(f){
              var tier=getEloTierStatic(f.elo||1000);
              var isOnline=onlineNames.includes(f.name);
              return(
                <div key={f.name} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,marginBottom:8,background:"rgba(0,0,0,0.28)",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <div style={{fontSize:28}}>{f.avatar||"😎"}</div>
                    {isOnline&&<div style={{position:"absolute",bottom:0,right:0,width:10,height:10,background:"#4ade80",borderRadius:"50%",border:"1.5px solid #010603"}}></div>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#e8f0e8",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                    <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:tier.color}}>{tier.icon} {tier.name} · {f.elo||1000}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button className="btn_btn_ghost" style={{fontSize:10,padding:"8px 10px",letterSpacing:1,border:"1.5px solid rgba(240,192,96,0.4)",color:"#f0c060"}}
                      onClick={function(){setLocalGiftModal({friend:f,open:true});}}>🎁</button>
                    <button className="btn_btn_ghost" style={{fontSize:10,padding:"8px 10px",letterSpacing:1,border:"1.5px solid rgba(74,222,128,0.35)",color:"#4ade80"}}
                      onClick={function(){goScreen("multiplayer");}}>⚔️</button>
                    <button className="btn_btn_ghost" style={{fontSize:10,padding:"8px 10px",letterSpacing:1,border:"1.5px solid rgba(255,80,80,0.3)",color:"#f87171"}}
                      onClick={function(){removeFriend(f.name);}}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab==="search"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <input
                value={searchQuery}
                onChange={function(e){setSearchQuery(e.target.value);}}
                onKeyDown={function(e){if(e.key==="Enter")doSearch();}}
                placeholder="Search by username..."
                style={{flex:1,background:"rgba(0,0,0,0.35)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"11px 14px",fontFamily:"Crimson Text,serif",fontSize:14,color:"#e8f0e8",outline:"none"}}
              />
              <button className="btn_btn_ghost" style={{fontSize:11,padding:"11px 16px",letterSpacing:1,border:"1.5px solid rgba(240,192,96,0.4)",color:"#f0c060",flexShrink:0}}
                onClick={doSearch} disabled={searching}>{searching?"...":"SEARCH"}</button>
            </div>
            {searchResults.length===0&&!searching&&searchQuery&&(
              <div style={{textAlign:"center",padding:"32px 0",color:"#4a6a4e",fontFamily:"Crimson Text,serif",fontSize:14}}>No players found.</div>
            )}
            {searchResults.map(function(player){
              var tier=getEloTierStatic(player.elo||1000);
              var isFriend=friends.some(function(f){return f.name===player.name;});
              var isMe=player.name===myName;
              return(
                <div key={player.id||player.name} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,marginBottom:8,background:"rgba(0,0,0,0.28)",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:28,flexShrink:0}}>{player.avatar||"😎"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#e8f0e8",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{player.name}</div>
                    <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:tier.color}}>{tier.icon} {tier.name} · {player.elo||1000}</div>
                  </div>
                  {!isMe&&(
                    <button className="btn_btn_ghost" style={{fontSize:10,padding:"8px 12px",letterSpacing:1,border:isFriend?"1.5px solid rgba(74,222,128,0.35)":"1.5px solid rgba(240,192,96,0.4)",color:isFriend?"#4ade80":"#f0c060",flexShrink:0}}
                      onClick={function(){if(!isFriend)addFriend(player);}}>
                      {isFriend?"✓ ADDED":"+ ADD"}
                    </button>
                  )}
                  {isMe&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#6a8a6e",letterSpacing:1}}>YOU</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab==="requests"&&(
          <div>
            {requests.length===0&&(
              <div style={{textAlign:"center",padding:"48px 0",color:"#4a6a4e",fontFamily:"Crimson Text,serif",fontSize:15}}>
                <div style={{fontSize:40,marginBottom:12}}>📭</div>
                <div>No pending friend requests.</div>
              </div>
            )}
            {requests.map(function(req){
              var tier=getEloTierStatic(req.elo||1000);
              return(
                <div key={req.name} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,marginBottom:8,background:"rgba(0,0,0,0.28)",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:28,flexShrink:0}}>{req.avatar||"😎"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#e8f0e8",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{req.name}</div>
                    <div style={{fontFamily:"Crimson Text,serif",fontSize:12,color:tier.color}}>{tier.icon} {tier.name}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button className="btn_btn_ghost" style={{fontSize:10,padding:"8px 10px",letterSpacing:1,border:"1.5px solid rgba(74,222,128,0.35)",color:"#4ade80"}}
                      onClick={function(){acceptRequest(req);}}>ACCEPT</button>
                    <button className="btn_btn_ghost" style={{fontSize:10,padding:"8px 10px",letterSpacing:1,border:"1.5px solid rgba(255,80,80,0.3)",color:"#f87171"}}
                      onClick={function(){declineRequest(req);}}>DECLINE</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
      {localGiftModal.open&&<GiftModal friend={localGiftModal.friend} open={localGiftModal.open} onClose={function(){setLocalGiftModal({friend:null,open:false});}} coins={coins||0} onSendGift={function(friend,opt){if((coins||0)>=opt.coins){if(addCoins)addCoins(-opt.coins);if(pop)pop("🎁 Gift sent to "+friend.name+"!","success");}else{if(pop)pop("Not enough coins","error");}}}/>}
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
  const [titleUnlock,setTitleUnlock]=useState(null); // title object being shown
  const [unlockedAchs,setUnlockedAchs]=useState(function(){try{var a=localStorage.getItem("cobra_achs");return a?JSON.parse(a):[];}catch(e){return[];}});
  const [emojis,setEmojis]=useState([]);
  const [confetti,setConfetti]=useState([]);
  const [showEmojiPicker,setShowEmojiPicker]=useState(false);
  const [showRules,setShowRules]=useState(false);
  const [showExitConfirm,setShowExitConfirm]=useState(false);
  const [hovOpponent,setHovOpponent]=useState(-1);
  const [tournamentData,setTournamentData]=useState(null);
  // {phase:"semi1"|"final"|"done", bracket:[{p1,p2,winner},{p1,p2,winner},{p1,p2,winner}], champion:null}
  const [turnTime,setTurnTime]=useState(TURN_SEC);
  const [timerOn,setTimerOn]=useState(true);
  const [roundStart,setRoundStart]=useState(null);
  const [roundNum,setRoundNum]=useState(1);
  const [gameStats,setGameStats]=useState(function(){try{var s=localStorage.getItem("cobra_stats");return s?JSON.parse(s):{wins:0,cobras:0,rounds:0,streak:0,bestStreak:0};}catch(e){return{wins:0,cobras:0,rounds:0,streak:0,bestStreak:0};}});
  const [elo,setElo]=useState(function(){try{return parseInt(localStorage.getItem("cobra_elo")||"1000");}catch(e){return 1000;}});
  const [eloToast,setEloToast]=useState(null); // {delta, rankUp, rankName, rankColor}
  const [showYourTurn,setShowYourTurn]=useState(false);
  const [lastCpuPlay,setLastCpuPlay]=useState(null);
  const [showCpuPlay,setShowCpuPlay]=useState(false);
  const [dealAnim,setDealAnim]=useState(false);
  const [shuffleAnim,setShuffleAnim]=useState(false);
  const [pileLandAnim,setPileLandAnim]=useState(false);
  const prevPileLenRef=useRef(0);
  const [playingCardIds,setPlayingCardIds]=useState([]);
  const [pickingUp,setPickingUp]=useState(false);
  const [flashScores,setFlashScores]=useState([]);
  const [myAvatar,setMyAvatar]=useState(function(){try{return localStorage.getItem("cobra_player_avatar")||"😎";}catch(e){return"😎";}});
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installDismissed,setInstallDismissed]=useState(function(){try{return localStorage.getItem("cobra_install_dismissed")==="1";}catch(e){return false;}});
  const [showQR,setShowQR]=useState(false);
  const [dailyLoginData,setDailyLoginData]=useState(null); // {day, coins, gems, streak}
  const [qrDataUrl,setQrDataUrl]=useState("");
  const [elimAnim,setElimAnim]=useState(null); // {name, idx}
  const [cardTheme,setCardTheme]=useState(function(){try{return localStorage.getItem("cobra_card_theme")||"classic";}catch(e){return"classic";}});
  const [ownedItems,setOwnedItems]=useState(function(){try{var v=localStorage.getItem("cobra_owned_items");return v?JSON.parse(v):["classic"];}catch(e){return["classic"];}});
  const [showAvatarPicker,setShowAvatarPicker]=useState(false);
  const [chatMessages,setChatMessages]=useState([]);
  const [chatOpen,setChatOpen]=useState(false);
  const [chatInput,setChatInput]=useState("");
  const [unreadChat,setUnreadChat]=useState(0);
  const [isSpectator,setIsSpectator]=useState(false);
  const [coins,setCoins]=useState(function(){try{return parseInt(localStorage.getItem("cobra_coins")||"500");}catch(e){return 500;}});
  const [gems,setGems]=useState(function(){try{return parseInt(localStorage.getItem("cobra_gems")||"10");}catch(e){return 10;}});
  const [isVIP,setIsVIP]=useState(function(){try{return localStorage.getItem("cobra_vip")==="1";}catch(e){return false;}});
  const [playerXP,setPlayerXP]=useState(function(){try{return parseInt(localStorage.getItem("cobra_xp")||"0");}catch(e){return 0;}});
  const [seasonXP,setSeasonXP]=useState(function(){try{return parseInt(localStorage.getItem("cobra_season_xp")||"0");}catch(e){return 0;}});
  const [seasonTier,setSeasonTier]=useState(function(){try{return parseInt(localStorage.getItem("cobra_season_tier")||"0");}catch(e){return 0;}});
  const [seasonClaimed,setSeasonClaimed]=useState(function(){try{return JSON.parse(localStorage.getItem("cobra_season_claimed")||"[]");}catch(e){return[];}});
  const [playerLevel,setPlayerLevel]=useState(function(){try{return parseInt(localStorage.getItem("cobra_level")||"1");}catch(e){return 1;}});
  const [activeScreen,setActiveScreen]=useState(null);
  const [rewardPopup,setRewardPopup]=useState(null);
  const [crateReveal,setCrateReveal]=useState(null); // {crate, wonId, wonTheme, phase:"shake"|"open"|"reveal"}
  // battle-pass state (safe reads)
  const lsGet=function(k,fb){try{var v=localStorage.getItem(k);return v!==null?v:fb;}catch(e){return fb;}};
  const [bpLevel,setBpLevel]=useState(function(){return parseInt(lsGet("cobra_bp_level","1"));});
  const [bpPremium,setBpPremium]=useState(function(){return lsGet("cobra_bp_premium","false")==="true";});
  const [bpClaimed,setBpClaimed]=useState(function(){try{return JSON.parse(lsGet("cobra_bp_claimed","[]"));}catch(e){return[];}});
  const [claimedAchs,setClaimedAchs]=useState(function(){try{var v=localStorage.getItem("cobra_claimed_achs");return v?JSON.parse(v):[];}catch(e){return[];}});
  const [achProgress,setAchProgress]=useState(function(){try{var v=localStorage.getItem("cobra_ach_progress");return v?JSON.parse(v):{};;}catch(e){return{};}});
  const [dailyMissions,setDailyMissions]=useState(function(){try{var v=localStorage.getItem("cobra_daily_missions");return v?JSON.parse(v):null;}catch(e){return null;}});
  const [shakeHand,setShakeHand]=useState(false);
  // Feature 8: Prestige
  const [prestige,setPrestige]=useState(function(){try{return parseInt(localStorage.getItem("cobra_prestige")||"0");}catch(e){return 0;}});
  const [showPrestigeModal,setShowPrestigeModal]=useState(false);
  // Feature 9: Win streak
  const [winStreak,setWinStreak]=useState(function(){try{return parseInt(localStorage.getItem("cobra_win_streak")||"0");}catch(e){return 0;}});
  // Feature 13: SFX Pack
  const [sfxPack,setSfxPack]=useState(function(){try{return localStorage.getItem("cobra_sfx_pack")||"classic";}catch(e){return"classic";}});
  _sfxPackGlobal=sfxPack;
  _setSfxPackGlobal=function(p){setSfxPack(p);try{localStorage.setItem("cobra_sfx_pack",p);}catch(e){};};
  // Feature 6: Profile modal
  const [profileModal,setProfileModal]=useState(null); // {name,avatar,elo,level,winRate,cobras,title,frame}
  // Feature 15: Gift modal
  const [giftModal,setGiftModal]=useState({friend:null,open:false});
  const [quickMatchOpen,setQuickMatchOpen]=useState(false);
  const [quickMatchStatus,setQuickMatchStatus]=useState("finding"); // "finding"|"notfound"|"unavailable"
  const quickMatchRowRef=useRef(null);
  const quickMatchTimerRef=useRef(null);
  const quickMatchPollRef=useRef(null);
  const [weeklyMissions,setWeeklyMissions]=useState(function(){try{var v=localStorage.getItem("cobra_weekly_missions");return v?JSON.parse(v):null;}catch(e){return null;}});
  const [equippedTitle,setEquippedTitle]=useState(function(){try{return localStorage.getItem("cobra_title")||"";}catch(e){return"";}});
  const [equippedFrame,setEquippedFrame]=useState(function(){try{return localStorage.getItem("cobra_frame")||"none";}catch(e){return"none";}});
  const [unlockedTitles,setUnlockedTitles]=useState(function(){try{var v=localStorage.getItem("cobra_titles");return v?JSON.parse(v):[];}catch(e){return[];}});
  const [unlockedFrames,setUnlockedFrames]=useState(function(){try{var v=localStorage.getItem("cobra_frames");return v?JSON.parse(v):["none"];}catch(e){return["none"];}});
  const [dailyLast,setDailyLast]=useState(function(){return parseInt(lsGet("cobra_daily_last","0"));});
  const [dailyStreak,setDailyStreak]=useState(function(){return parseInt(lsGet("cobra_daily_streak","0"));});
  const [spinLast,setSpinLast]=useState(function(){return parseInt(lsGet("cobra_spin_last","0"));});
  const [seasonEndModal,setSeasonEndModal]=useState(null); // {tier,coins,prevRank}
  const [joiningRoom,setJoiningRoom]=useState(false);
  const [creatingRoom,setCreatingRoom]=useState(false);
  const [startingGame,setStartingGame]=useState(false);
  const [scoreLimit,setScoreLimit]=useState(function(){return parseInt(lsGet("cobra_score_limit","100"));});
  const [connStatus,setConnStatus]=useState(""); // "reconnecting"|"connected"|""
  const [rejoinData,setRejoinData]=useState(null); // {roomCode,myIdx,names,scores,mode,timestamp}
  const [notifsEnabled,setNotifsEnabled]=useState(function(){try{return localStorage.getItem("cobra_notifs_enabled")==="1";}catch(e){return false;}});
  const [showSummary,setShowSummary]=useState(false);
  const gameSummaryRef=useRef({declarations:{},cobraHits:{},roundScores:[],rounds:0});
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
  useEffect(function(){
    var newLen=(openPile.cards||[]).length;
    if(newLen>prevPileLenRef.current){setPileLandAnim(true);setTimeout(function(){setPileLandAnim(false);},350);}
    prevPileLenRef.current=newLen;
  },[openPile]);
  useEffect(function(){phaseRef.current=phase;},[phase]);
  useEffect(function(){handsRef.current=hands;},[hands]);
  useEffect(function(){deckRef.current=deck;},[deck]);
  useEffect(function(){currentPlayerRef.current=currentPlayer;},[currentPlayer]);
  useEffect(function(){nPlayersRef.current=nPlayers;},[nPlayers]);
  useEffect(function(){scoresRef.current=scores;},[scores]);
  useEffect(function(){modeRef.current=mode;},[mode]);
  useEffect(function(){roomCodeRef.current=roomCode;},[roomCode]);
  useEffect(function(){screenRef.current=screen;},[screen]);
  function scheduleDailyReminder(){
    try{
      if(!("Notification" in window)||Notification.permission!=="granted")return;
      var delay=23*60*60*1000;
      setTimeout(function(){
        if(document.visibilityState==="hidden"){
          new Notification("🐍 COBRA",{
            body:"Your daily bonus is ready! Come claim your coins.",
            icon:"/icons/icon-192.png",
            badge:"/icons/icon-72.png",
            tag:"daily-bonus",
            renotify:true
          });
        }
      },delay);
    }catch(e){}
  }

  useEffect(function(){
    try{
      var today=Math.floor(Date.now()/(1000*60*60*24));
      var last=parseInt(localStorage.getItem("cobra_last_login")||"0");
      var loginStreak=parseInt(localStorage.getItem("cobra_login_streak")||"0");
      if(today===last)return;
      var newStreak=today===last+1?loginStreak+1:1;
      var day=(newStreak-1)%7;
      var rewards=[
        {coins:100,gems:0},{coins:150,gems:0},{coins:200,gems:1},
        {coins:250,gems:1},{coins:300,gems:2},{coins:400,gems:2},{coins:500,gems:5}
      ];
      var reward=rewards[day];
      localStorage.setItem("cobra_last_login",today.toString());
      localStorage.setItem("cobra_login_streak",newStreak.toString());
      var loginCoins=isVIP?reward.coins*2:reward.coins;
      var loginGems=isVIP?Math.ceil(reward.gems*1.5):reward.gems;
      setCoins(function(c){var n=c+loginCoins;try{localStorage.setItem("cobra_coins",n);}catch(e){}return n;});
      if(loginGems>0)setGems(function(g){var n=g+loginGems;try{localStorage.setItem("cobra_gems",n);}catch(e){}return n;});
      setTimeout(function(){setDailyLoginData({day:day,coins:loginCoins,gems:loginGems,streak:newStreak,vipBonus:isVIP});},2800);
      scheduleDailyReminder();
      if("Notification" in window&&Notification.permission==="default"){
        Notification.requestPermission();
      }
    }catch(e){}
  },[]);

  // Season reset check
  useEffect(function(){
    try{
      var todayMs=Date.now();
      var todayDay=Math.floor(todayMs/(1000*60*60*24));
      var seasonStart=parseInt(localStorage.getItem("cobra_season_start_date")||"0");
      if(!seasonStart){localStorage.setItem("cobra_season_start_date",String(todayDay));return;}
      if(todayDay-seasonStart>=30){
        // Season ended
        var tierRewards={Bronze:100,Silver:200,Gold:400,Platinum:700,Diamond:1000,Master:1500,Grandmaster:2500};
        var currentElo=parseInt(localStorage.getItem("cobra_elo")||"1000");
        var tierInfo=getEloTierStatic(currentElo);
        var reward=tierRewards[tierInfo.name]||100;
        var newElo=Math.max(800,Math.floor(currentElo*0.6));
        localStorage.setItem("cobra_season_start_date",String(todayDay));
        localStorage.setItem("cobra_elo",String(newElo));
        localStorage.setItem("cobra_prev_season_rank",tierInfo.name);
        setElo(newElo);
        setSeasonEndModal({tier:tierInfo,reward:reward});
        setTimeout(function(){
          setCoins(function(c){var v=c+reward;try{localStorage.setItem("cobra_coins",String(v));}catch(e){}return v;});
        },500);
      }
    }catch(e){}
  },[]);

  const H=myIdx;

  const xpForLevel=function(lvl){return lvl*100;};
  const addCoins=function(n){setCoins(function(c){var v=c+n;try{localStorage.setItem("cobra_coins",String(v));}catch(e){}return v;});};
  const addGems=function(n){setGems(function(g){var v=g+n;try{localStorage.setItem("cobra_gems",String(v));}catch(e){}return v;});};

  const _buyLock=useRef(false);
  const buyItem=function(item){
    if(_buyLock.current)return;
    _buyLock.current=true;
    setTimeout(function(){_buyLock.current=false;},1200);

    var cost=item.price;
    if(item.currency==="coins"){
      if(coins<cost){pop("Not enough coins! Need 🪙"+cost.toLocaleString(),"error");_buyLock.current=false;return;}
      setCoins(function(v){var n=v-cost;try{localStorage.setItem("cobra_coins",String(n));}catch(e){}return n;});
    } else {
      if(gems<cost){pop("Not enough gems! Need 💎"+cost,"error");_buyLock.current=false;return;}
      setGems(function(v){var n=v-cost;try{localStorage.setItem("cobra_gems",String(n));}catch(e){}return n;});
    }

    // Bundle: single charge, add all items
    if(item._isBundle&&item._bundleItems){
      setOwnedItems(function(prev){
        var n=[...prev];
        item._bundleItems.forEach(function(tid){if(n.indexOf(tid)<0)n.push(tid);});
        try{localStorage.setItem("cobra_owned_items",JSON.stringify(n));}catch(e){}
        return n;
      });
      var first=item._bundleItems[0];
      setCardTheme(first);
      try{localStorage.setItem("cobra_card_theme",first);}catch(e){}
      pop("Bundle unlocked! "+item._bundleItems.length+" themes added!","success");
      audio.purchase();
      return;
    }

    // Crate: show reveal modal, award item after animation
    if(item.id&&item.id.startsWith("crate_")&&item.pool){
      var pool=item.pool;
      var won=pool[Math.floor(Math.random()*pool.length)];
      var wonTheme=SHOP_THEMES.find(function(t){return t.id===won;});
      var alreadyOwned=ownedItems.indexOf(won)>=0;
      // Add item to owned now (payment already deducted)
      setOwnedItems(function(prev){
        if(prev.indexOf(won)>=0)return prev;
        var n=[...prev,won];try{localStorage.setItem("cobra_owned_items",JSON.stringify(n));}catch(e){}return n;
      });
      // Consolation if already owned
      if(alreadyOwned){
        if(item.currency==="coins"){
          var refund=Math.round(item.price*0.5);
          setCoins(function(v){var n=v+refund;try{localStorage.setItem("cobra_coins",String(n));}catch(e){}return n;});
        } else {
          setCoins(function(v){var n=v+200;try{localStorage.setItem("cobra_coins",String(n));}catch(e){}return n;});
        }
      }
      setCrateReveal({crate:item,wonId:won,wonTheme:wonTheme,phase:"shake",alreadyOwned:alreadyOwned});
      return;
    }

    var itemId=item.id;
    setOwnedItems(function(prev){
      if(prev.indexOf(itemId)>=0)return prev;
      var n=[...prev,itemId];try{localStorage.setItem("cobra_owned_items",JSON.stringify(n));}catch(e){}return n;
    });
    if(item.isAvatar){
      var displayId=item.displayId||item.id.replace("av_","");
      setMyAvatar(displayId);
      try{localStorage.setItem("cobra_player_avatar",displayId);}catch(e){}
      pop("Got "+displayId+" avatar!","success");
    } else {
      setCardTheme(itemId);
      try{localStorage.setItem("cobra_card_theme",itemId);}catch(e){}
      pop("Theme unlocked & equipped!","success");
    }
    audio.purchase();
  };

  const gainXP=function(amount){
    var actualAmount=isVIP?amount*2:amount;
    var curXP=parseInt(lsGet("cobra_xp","0"))+actualAmount;
    var curLvl=parseInt(lsGet("cobra_level","1"));
    var bonusCoins=0;
    while(curLvl<100&&curXP>=curLvl*100){curXP-=curLvl*100;curLvl++;bonusCoins+=100;}
    try{localStorage.setItem("cobra_xp",String(curXP));localStorage.setItem("cobra_level",String(curLvl));}catch(e){}
    setPlayerXP(curXP);setPlayerLevel(curLvl);
    if(bonusCoins>0)addCoins(bonusCoins);
  };

  const gainSeasonXP=function(amount){
    var actualAmount=isVIP?amount*2:amount;
    var curXP=parseInt(function(){try{return localStorage.getItem("cobra_season_xp")||"0";}catch(e){return "0";}}())+actualAmount;
    var curTier=parseInt(function(){try{return localStorage.getItem("cobra_season_tier")||"0";}catch(e){return "0";}}());
    while(curTier<SEASON_PASS.totalTiers&&curXP>=(curTier+1)*SEASON_PASS.xpPerTier){curTier++;}
    try{localStorage.setItem("cobra_season_xp",String(curXP));localStorage.setItem("cobra_season_tier",String(curTier));}catch(e){}
    setSeasonXP(curXP);setSeasonTier(curTier);
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
      // Save reconnection data for non-host players
      try{
        var activeGameData={roomCode:room.code,myIdx:myIdx,names:room.players.map(function(p){return p.name;}),scores:gs.scores||[],mode:"online",timestamp:Date.now()};
        localStorage.setItem("cobra_active_room",room.code);
        localStorage.setItem("cobra_active_game",JSON.stringify(activeGameData));
      }catch(e){}
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

  // ── Push Notifications helper ────────────────────────
  function sendNotification(title,body,icon){
    try{
      if(!("Notification" in window)||Notification.permission!=="granted")return;
      new Notification(title,{body:body,icon:icon||"/icons/icon-192.png"});
    }catch(e){}
  }

  // Extend scheduleDailyReminder with additional triggers
  function scheduleNotifTriggers(){
    try{
      if(!("Notification" in window)||Notification.permission!=="granted")return;
      // Idle 24h reminder
      var idleKey="cobra_last_play_time";
      var lastPlay=parseInt(localStorage.getItem(idleKey)||"0");
      var now=Date.now();
      if(!lastPlay){localStorage.setItem(idleKey,String(now));}
      var idleMs=24*60*60*1000-(now-lastPlay);
      if(idleMs<0)idleMs=100;
      setTimeout(function(){
        if(document.visibilityState==="hidden"){
          sendNotification("🐍 Your COBRA streak is at risk!","Play today to keep it","/icons/icon-192.png");
        }
      },idleMs);
      // Daily missions reset at midnight
      var msUntilMidnight=(function(){var d=new Date();var mn=new Date(d);mn.setHours(24,0,0,0);return mn.getTime()-d.getTime();}());
      setTimeout(function(){
        sendNotification("🎯 New missions available!","Come collect your rewards","/icons/icon-192.png");
      },msUntilMidnight);
    }catch(e){}
  }

  // On visibility change, check pending notifications
  useEffect(function(){
    function onVisible(){
      if(document.visibilityState==="visible"){
        try{
          var pending=JSON.parse(localStorage.getItem("cobra_notif_schedule")||"[]");
          var now=Date.now();
          var remaining=pending.filter(function(n){
            if(n.at&&n.at<=now){
              sendNotification(n.title,n.body,n.icon);
              return false;
            }
            return true;
          });
          localStorage.setItem("cobra_notif_schedule",JSON.stringify(remaining));
        }catch(e){}
      }
    }
    document.addEventListener("visibilitychange",onVisible);
    return function(){document.removeEventListener("visibilitychange",onVisible);};
  },[]);

  // ── Multiplayer Reconnection check ───────────────────
  useEffect(function(){
    try{
      var raw=localStorage.getItem("cobra_active_game");
      if(!raw)return;
      var data=JSON.parse(raw);
      if(!data||!data.timestamp)return;
      var age=Date.now()-data.timestamp;
      if(age>2*60*60*1000){
        localStorage.removeItem("cobra_active_game");
        localStorage.removeItem("cobra_active_room");
        return;
      }
      setRejoinData(data);
    }catch(e){}
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
        // Check if daily bonus is available — modal handles display, skip double-notification
        try{
          var today2=Math.floor(Date.now()/(1000*60*60*24));
          var last2=parseInt(localStorage.getItem("cobra_last_login")||"0");
          if(today2>last2&&"Notification" in window&&Notification.permission==="granted"){
            // Don't show notification when app is open/visible — the modal handles it
          }
        }catch(e){}
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
    audio.init();
  },[]);

  useEffect(function(){
    document.addEventListener("touchstart",initAudio,{once:true});
    document.addEventListener("click",initAudio,{once:true});
    return function(){document.removeEventListener("touchstart",initAudio);document.removeEventListener("click",initAudio);};
  },[initAudio]);

  function clearActiveGame(){
    try{localStorage.removeItem("cobra_active_game");localStorage.removeItem("cobra_active_room");}catch(e){}
  }

  const goScreen=useCallback(function(s){
    audio.init();audio.resume();
    if(s==="home"){
      rtUnsubscribe();
      if(chatChannelRef.current&&supabase){try{supabase.removeChannel(chatChannelRef.current);}catch(e){}chatChannelRef.current=null;}
      setIsSpectator(false);setChatMessages([]);setUnreadChat(0);setChatOpen(false);
      clearActiveGame();
    }
    setScreen(s);
  },[rtUnsubscribe]);

  const pop=function(msg,type,ms){
    type=type||"info";ms=ms||2600;
    clearTimeout(toastT.current);setToast({msg:msg,type:type});
    toastT.current=setTimeout(function(){setToast({msg:"",type:"info"});},ms);
  };
  _settingsPop=pop;
  _notifsEnabled=notifsEnabled;

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
    // Auto-claim: give rewards and unlock title/frame immediately
    setClaimedAchs(function(prev){
      if(prev.indexOf(id)>=0)return prev;
      var n=[...prev,id];try{localStorage.setItem("cobra_claimed_achs",JSON.stringify(n));}catch(e){}return n;
    });
    if(ach.reward&&ach.reward.coins)addCoins(ach.reward.coins);
    if(ach.reward&&ach.reward.gems)addGems(ach.reward.gems);
    if(ach.title){
      var titleId=ach.title.toLowerCase().replace(/ /g,"_");
      setUnlockedTitles(function(prev){
        if(prev.indexOf(titleId)>=0)return prev;
        var n=[...prev,titleId];try{localStorage.setItem("cobra_titles",JSON.stringify(n));}catch(e){}
        var titleObj=TITLES.find(function(t){return t.id===titleId;});
        if(titleObj){setTimeout(function(){setTitleUnlock(titleObj);audio.levelUp&&audio.levelUp();},600);}
        return n;
      });
    }
    if(id==="win_50")setUnlockedFrames(function(prev){if(prev.indexOf("emerald")>=0)return prev;var n=[...prev,"emerald"];try{localStorage.setItem("cobra_frames",JSON.stringify(n));}catch(e){}return n;});
    if(id==="cobra_10")setUnlockedFrames(function(prev){if(prev.indexOf("cobra")>=0)return prev;var n=[...prev,"cobra"];try{localStorage.setItem("cobra_frames",JSON.stringify(n));}catch(e){}return n;});
    if(id==="win_100")setUnlockedFrames(function(prev){if(prev.indexOf("diamond")>=0)return prev;var n=[...prev,"diamond"];try{localStorage.setItem("cobra_frames",JSON.stringify(n));}catch(e){}return n;});
    if(id==="streak_10")setUnlockedFrames(function(prev){if(prev.indexOf("champion")>=0)return prev;var n=[...prev,"champion"];try{localStorage.setItem("cobra_frames",JSON.stringify(n));}catch(e){}return n;});
  }

  // Generate missions for today/this week
  const getMissions=function(type){
    var seed=type==="daily"?Math.floor(Date.now()/(1000*60*60*24)):Math.floor(Date.now()/(1000*60*60*24*7));
    var pool=type==="daily"?[
      {id:"play3",desc:"Play 3 rounds",icon:"🃏",goal:3,stat:"rounds",reward:{xp:100,coins:100,gems:0}},
      {id:"win2",desc:"Win 2 games today",icon:"🏆",goal:2,stat:"wins",reward:{xp:150,coins:150,gems:0}},
      {id:"daily",desc:"Claim daily reward",icon:"📅",goal:1,stat:"dailyClaims",reward:{xp:120,coins:120,gems:0}},
      {id:"spin",desc:"Use lucky spin",icon:"🎡",goal:1,stat:"spinCount",reward:{xp:100,coins:100,gems:0}},
      {id:"play5",desc:"Play 5 rounds",icon:"🃏",goal:5,stat:"rounds",reward:{xp:120,coins:100,gems:0}},
      {id:"win3",desc:"Win 3 games",icon:"🥇",goal:3,stat:"wins",reward:{xp:200,coins:200,gems:0}},
      {id:"cobra3",desc:"Survive 3 cobra penalties",icon:"🐍",goal:3,stat:"cobras",reward:{xp:250,coins:200,gems:0}},
      {id:"declare3",desc:"Declare 3 times",icon:"📣",goal:3,stat:"rounds",reward:{xp:180,coins:175,gems:0}},
      {id:"cards20",desc:"Play 20 rounds total",icon:"🃏",goal:20,stat:"rounds",reward:{xp:150,coins:120,gems:0}},
      {id:"winnocobra",desc:"Win a game without getting cobra",icon:"✨",goal:1,stat:"wins",reward:{xp:350,coins:300,gems:1}},
    ]:[
      {id:"w_win15",desc:"Win 15 games",icon:"👑",goal:15,stat:"wins",reward:{xp:500,coins:1000,gems:5}},
      {id:"w_play30",desc:"Play 30 rounds",icon:"🃏",goal:30,stat:"rounds",reward:{xp:400,coins:800,gems:3}},
      {id:"w_coins",desc:"Earn 1000 coins",icon:"🪙",goal:1000,stat:"coinsEarned",reward:{xp:600,coins:1200,gems:5}},
      {id:"w_streak3",desc:"Win 3 games in a row",icon:"🔥",goal:3,stat:"bestStreak",reward:{xp:600,coins:500,gems:2}},
      {id:"w_spin5",desc:"Use lucky spin 5 times",icon:"🎡",goal:5,stat:"spinCount",reward:{xp:300,coins:600,gems:3}},
      {id:"w_daily5",desc:"Claim daily reward 5 times",icon:"📅",goal:5,stat:"dailyClaims",reward:{xp:400,coins:700,gems:4}},
      {id:"w_play20",desc:"Play 20 rounds this week",icon:"🃏",goal:20,stat:"rounds",reward:{xp:450,coins:400,gems:2}},
      {id:"w_cobra5win",desc:"Get cobra 5 times and still win",icon:"🐍",goal:5,stat:"cobras",reward:{xp:700,coins:600,gems:3}},
    ];
    // deterministic pick based on seed
    var picked=[];var used={};
    for(var i=0;i<(type==="daily"?3:5);i++){
      var idx=(seed*7+i*13)%pool.length;
      while(used[idx])idx=(idx+1)%pool.length;
      used[idx]=true;picked.push({...pool[idx],progress:0,claimed:false});
    }
    return{missions:picked,seed:seed,type:type};
  };

  const getOrRefreshMissions=function(type,current){
    var seed=type==="daily"?Math.floor(Date.now()/(1000*60*60*24)):Math.floor(Date.now()/(1000*60*60*24*7));
    if(current&&current.seed===seed)return current;
    var fresh=getMissions(type);
    try{localStorage.setItem("cobra_"+(type==="daily"?"daily":"weekly")+"_missions",JSON.stringify(fresh));}catch(e){}
    return fresh;
  };

  const unlockTitle=function(titleId){
    if(!titleId)return;
    setUnlockedTitles(function(prev){
      if(prev.indexOf(titleId)>=0)return prev;
      var n=[...prev,titleId];try{localStorage.setItem("cobra_titles",JSON.stringify(n));}catch(e){}
      // Show full-screen title unlock modal
      var titleObj=TITLES.find(function(t){return t.id===titleId;});
      if(titleObj){setTimeout(function(){setTitleUnlock(titleObj);audio.levelUp&&audio.levelUp();},400);}
      return n;
    });
  };

  const unlockFrame=function(frameId){
    if(!frameId)return;
    setUnlockedFrames(function(prev){
      if(prev.indexOf(frameId)>=0)return prev;
      var n=[...prev,frameId];try{localStorage.setItem("cobra_frames",JSON.stringify(n));}catch(e){}
      pop("Frame unlocked: "+frameId+" ✨","success",2500);
      return n;
    });
  };

  const claimAchievement=function(achId){
    var ach=ACHIEVEMENTS.find(function(a){return a.id===achId;});
    if(!ach||claimedAchs.indexOf(achId)>=0)return;
    var newClaimed=[...claimedAchs,achId];
    setClaimedAchs(newClaimed);
    try{localStorage.setItem("cobra_claimed_achs",JSON.stringify(newClaimed));}catch(e){}
    if(ach.reward.coins)addCoins(ach.reward.coins);
    if(ach.reward.gems)addGems(ach.reward.gems);
    if(ach.title)unlockTitle(ach.title.toLowerCase().replace(/ /g,"_"));
    // unlock frame for certain achievements
    if(achId==="win_50")unlockFrame("emerald");
    if(achId==="cobra_10")unlockFrame("cobra");
    if(achId==="win_100")unlockFrame("diamond");
    if(achId==="streak_10")unlockFrame("champion");
    setRewardPopup({coins:ach.reward.coins,gems:ach.reward.gems,label:ach.name+" unlocked! 🏆"});
    audio.achievement();
  };

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
    setShuffleAnim(true);setTimeout(function(){setShuffleAnim(false);},400);
    setDealAnim(true);setTimeout(function(){setDealAnim(false);},900);
    setRoundStart(Date.now());
    setRoundNum(function(r){return r+1;});
    setShowYourTurn(true);
    clearTimeout(yourTurnTimer.current);
    yourTurnTimer.current=setTimeout(function(){setShowYourTurn(false);},2000);
    haptic.light();
    audio.init();audio.resume();
    audio.turnChange();
    setTimeout(function(){audio.shuffle_sfx();},100);
  }

  function cancelQuickMatch(){
    clearTimeout(quickMatchTimerRef.current);
    clearInterval(quickMatchPollRef.current);
    var rowId=quickMatchRowRef.current;
    if(rowId){try{supabase.from("cobra_matchmaking").delete().eq("id",rowId).then(function(){}).catch(function(){});}catch(e){}}
    quickMatchRowRef.current=null;
    setQuickMatchOpen(false);
    setQuickMatchStatus("finding");
  }

  function startQuickMatch(){
    if(!myName.trim()){pop("Enter your name first","warning");return;}
    setQuickMatchOpen(true);setQuickMatchStatus("finding");
    quickMatchRowRef.current=null;
    var pName=myName.trim();
    var rowData={player_name:pName,avatar:myAvatar,status:"waiting",created_at:new Date().toISOString()};
    (async function(){
      try{
        var ins=await supabase.from("cobra_matchmaking").insert([rowData]).select();
        if(!ins||ins.error){setQuickMatchStatus("unavailable");clearTimeout(quickMatchTimerRef.current);clearInterval(quickMatchPollRef.current);return;}
        var myRow=ins.data&&ins.data[0];
        if(!myRow){setQuickMatchStatus("unavailable");return;}
        quickMatchRowRef.current=myRow.id;
        var cutoff=new Date(Date.now()-30000).toISOString();
        quickMatchTimerRef.current=setTimeout(function(){
          clearInterval(quickMatchPollRef.current);
          try{supabase.from("cobra_matchmaking").delete().eq("id",myRow.id).then(function(){}).catch(function(){});}catch(e){}
          quickMatchRowRef.current=null;
          setQuickMatchStatus("notfound");
        },20000);
        quickMatchPollRef.current=setInterval(async function(){
          try{
            var cutoff2=new Date(Date.now()-30000).toISOString();
            var res=await supabase.from("cobra_matchmaking").select("*").eq("status","waiting").neq("player_name",pName).gte("created_at",cutoff2).limit(1);
            if(res&&res.data&&res.data.length>0){
              clearTimeout(quickMatchTimerRef.current);clearInterval(quickMatchPollRef.current);
              var opponent=res.data[0];
              var code=[pName,opponent.player_name].sort().join("_").replace(/[^a-zA-Z0-9]/g,"").slice(0,6).toUpperCase();
              try{await supabase.from("cobra_matchmaking").delete().in("id",[myRow.id,opponent.id]);}catch(e){}
              quickMatchRowRef.current=null;
              setQuickMatchOpen(false);setQuickMatchStatus("finding");
              var ns=[pName,opponent.player_name];
              setMode("cpu");setNPlayers(2);setNames(ns);setMyIdx(0);
              gameSummaryRef.current={declarations:{},cobraHits:{},roundScores:[],rounds:0};
              deal(Array(2).fill(0),2);goScreen("game");
              pop("Matched with "+opponent.player_name+"!","success");
            }
          }catch(e){}
        },2000);
      }catch(e){setQuickMatchStatus("unavailable");}
    })();
  }

  function startCPU(){
    var n=1+cpuCount,ns=names.slice(0,n),s=Array(n).fill(0);
    gameSummaryRef.current={declarations:{},cobraHits:{},roundScores:[],rounds:0};
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
        var pnames=room.players.map(function(p){return p.name;});
        setNames(pnames);setNPlayers(n);
        setHands(h);setDeck(d);setOpenPile({cards:[],owner:-1});setMyPlayed([]);
        setCurrentPlayer(0);setPhase("declare");setSel([]);setScores(Array(n).fill(0));
        try{
          var activeGame={roomCode:roomCode,myIdx:myIdx,names:pnames,scores:Array(n).fill(0),mode:"online",timestamp:Date.now()};
          localStorage.setItem("cobra_active_room",roomCode);
          localStorage.setItem("cobra_active_game",JSON.stringify(activeGame));
        }catch(e){}
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
    if(!supabase){pop("Online requires internet connection","error");return;}
    pop("Finding a game...","info",3000);
    // Try to find an open global lobby room
    supabase.from("cobra_rooms")
      .select("id,data")
      .like("id","GLOBAL_%")
      .then(function(res){
        var rooms=(res.data||[]).map(function(r){return r.data;}).filter(function(r){
          return r&&r.status==="lobby"&&r.players&&r.players.length>0&&r.players.length<(r.maxPlayers||5);
        });
        var room=rooms.length>0?rooms[0]:null;
        var globalCode=room?room.code:("GLOBAL_"+Math.random().toString(36).substr(2,5).toUpperCase());
        if(!room){
          room={code:globalCode,host:"Global",players:[],maxPlayers:5,status:"lobby",gameState:null,ts:Date.now()};
        }
        var idx=room.players.length;
        room.players.push({name:myName.trim(),idx:idx,avatar:myAvatar||"😎"});
        saveRoom(globalCode,room).then(function(){
          setMode("online");
          setRoomCode(globalCode);setIsHost(idx===0);setMyIdx(idx);
          setOnlinePlayers(room.players.map(function(p){return p.name;}));
          startLobbyPoll(globalCode);
          rtBroadcast(room);
          goScreen("lobby");
          pop(idx===0?"Lobby created — waiting for players...":"Joined! Waiting to start...","success");
        }).catch(function(){pop("Connection error","error");});
      }).catch(function(){pop("Connection error — try again","error");});
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
    if(!isValidSeq(sel)){pop("Invalid play — must be a sequence or single card","error");haptic.error();try{audio._tone(200,"sine",0.3,0.1);}catch(e){}setShakeHand(true);setTimeout(function(){setShakeHand(false);},500);return;}
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
    audio.init();audio.resume();audio.cardPickup();haptic.light();haptic.medium();
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
      var thinkTime=[1400,900,500][cpuDiff]*CPU_P[idx%CPU_P.length].thinkMs/1000+rnd(-80,80);
      setTimeout(function(){
        var hand=[...ch[idx]];
        var myTotal=ht(hand);
        var totals=ch.map(function(h){return ht(h);});
        var minT=Math.min.apply(null,totals);
        var iAmLowest=myTotal===minT&&totals.filter(function(t){return t===minT;}).length===1;

        // ── DECLARE COBRA LOGIC ───────────────────────────────────────────
        var shouldDeclare=false;
        if(cpuDiff===0){
          // Easy: only declares if total <= 5, rare
          shouldDeclare=myTotal<=5&&Math.random()<0.3;
        } else if(cpuDiff===1){
          // Medium: current behaviour
          shouldDeclare=myTotal<=10&&iAmLowest&&Math.random()<CPU_P[idx%CPU_P.length].risk;
        } else {
          // Hard: smart declare — checks if truly lowest, considers opponent hand sizes
          var opponentMin=Math.min.apply(null,totals.filter(function(_,i){return i!==idx;}));
          var safeMargin=myTotal<opponentMin-3;
          shouldDeclare=myTotal<=8&&iAmLowest&&(safeMargin||Math.random()<0.8);
        }

        if(shouldDeclare){
          audio.win();haptic.success();
          var res=names.map(function(n,i){return{name:n,total:totals[i],added:i===idx?0:totals[i],cobra:false,winner:i===idx};});
          var ns=scores.map(function(s,i){return i===idx?s:s+totals[i];});
          setHands([...ch]);
          setRevealData({ns:ns,res:res,declarerIdx:idx,hands:ch.map(function(h){return h.slice();})});
          setScreen("reveal");setCpuThinking(false);return;
        }

        // ── CARD PLAY LOGIC ───────────────────────────────────────────────
        var played=null;
        if(cpuDiff===0){
          // Easy: always plays single highest card, no sequences
          var sorted=[...hand].sort(function(a,b){return cv(b)-cv(a);});
          played=[sorted[0]];
        } else if(cpuDiff===1){
          // Medium: tries sequences up to 4 cards
          var best=null;
          for(var sz=Math.min(hand.length,4);sz>=1;sz--){
            for(var i=0;i<=hand.length-sz;i++){
              var c=hand.slice(i,i+sz);
              if(isValidSeq(c)){var score=ht(c)*(sz>1?sz*1.2:1);if(!best||score>ht(best))best=c;}
            }
          }
          played=best||[[...hand].sort(function(a,b){return cv(b)-cv(a);})[0]];
        } else {
          // Hard: full hand search for best sequence, prefers multi-card plays
          var best2=null,bestScore2=-1;
          for(var sz2=hand.length;sz2>=1;sz2--){
            for(var j=0;j<=hand.length-sz2;j++){
              var c2=hand.slice(j,j+sz2);
              if(isValidSeq(c2)){
                // Bonus for multi-card plays that reduce hand total significantly
                var playScore=ht(c2)*(sz2>1?sz2*1.5:1)+(sz2>2?10:0);
                if(playScore>bestScore2){bestScore2=playScore;best2=c2;}
              }
            }
          }
          played=best2||[[...hand].sort(function(a,b){return cv(b)-cv(a);})[0]];
        }

        audio.cardPlay();haptic.light();
        setLastCpuPlay({cards:played,player:names[idx]||"CPU",seq:seqLabel(played)});
        setShowCpuPlay(true);setTimeout(function(){setShowCpuPlay(false);},2000);
        ch=[...ch];ch[idx]=hand.filter(function(c){return!played.find(function(pp){return pp.id===c.id;});});

        // ── PICKUP LOGIC ──────────────────────────────────────────────────
        var prev=cp.cards||[];
        var pileVal=prev.length>0?cv(prev[0]):99;
        var playerHandSize=ch[0]?ch[0].length:7;
        var pickFromPile=false;
        if(prev.length>0&&cp.owner!==idx){
          if(cpuDiff===0){
            // Easy: rarely picks from pile, only if very high value card
            pickFromPile=pileVal>=10&&Math.random()<0.2;
          } else if(cpuDiff===1){
            var roundCount=(scores[idx]||0)/5+1;
            var aggression=Math.min(roundCount*0.5,3);
            pickFromPile=pileVal<=(5+aggression);
          } else {
            // Hard: strategic — steal if pile card is high value OR opponent has few cards (pressure)
            var opponentHandsSmall=ch.some(function(h,i){return i!==idx&&h.length<=3;});
            pickFromPile=pileVal>=8||(opponentHandsSmall&&pileVal>=5);
          }
        }

        if(pickFromPile){
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
    audio.init();audio.resume();audio.declare();haptic.declare();haptic.heavy();
    gameSummaryRef.current.declarations[names[H]]=(gameSummaryRef.current.declarations[names[H]]||0)+1;
    var totals=hands.map(function(h){return ht(h);});
    var minT=Math.min.apply(null,totals);
    var iWin=myTotal===minT&&totals.filter(function(t){return t===minT;}).length===1;
    var ns=[...scores],res=[];
    if(iWin){
      ns=ns.map(function(s,i){return i===H?s:s+totals[i];});
      res=names.map(function(n,i){return{name:n,total:totals[i],added:i===H?0:totals[i],cobra:false,winner:i===H};});
      setTimeout(function(){audio.win();haptic.success();haptic.heavy();},600);
      unlockAch("first_win");
      if(myTotal<=5){unlockAch("low_score");unlockAch("lowscore");}
      var elapsed=(Date.now()-roundStart)/1000;
      if(elapsed<10)unlockAch("speed_win");
      setGameStats(function(g){var streak=(g.streak||0)+1;var n={...g,wins:g.wins+1,rounds:g.rounds+1,streak:streak,bestStreak:Math.max(streak,g.bestStreak||0)};try{localStorage.setItem("cobra_stats",JSON.stringify(n));}catch(e){}return n;});
      // Feature 9: win streak rewards
      setWinStreak(function(ws){
        var ns2=ws+1;
        try{localStorage.setItem("cobra_win_streak",String(ns2));}catch(e){}
        if(ns2===3){setTimeout(function(){addCoins(50);pop("🔥 3 Win Streak! +50 coins","success");},700);}
        else if(ns2===5){setTimeout(function(){addCoins(100);addGems(1);pop("🔥 5 Win Streak! +100 coins +1 gem","success");},700);unlockAch("streak5");}
        else if(ns2===10){setTimeout(function(){addCoins(300);addGems(5);pop("⚡ 10 Win Streak! +300 coins +5 gems!","success");},700);unlockAch("streak10");}
        return ns2;
      });
      // ELO: +12 win vs AI, standard formula vs human
      if(mode==="cpu"){applyEloChange(12);}else{var exp=1/(1+Math.pow(10,(1200-elo)/400));applyEloChange(Math.round(32*(1-exp)));}
      // Confetti
      var conf=[];
      for(var ci=0;ci<22;ci++){
        conf.push({id:ci,x:Math.random()*100,color:["#d4a843","#4ade80","#f87171","#60a5fa","#fff","#fbbf24"][Math.floor(Math.random()*6)],size:Math.random()*6+4,delay:Math.random()*0.6,dur:Math.random()*1+1.2});
      }
      setConfetti(conf);setTimeout(function(){setConfetti([]);},2500);
    } else {
      var pen=COBRA_PEN+myTotal;ns[H]+=pen;
      res=names.map(function(n,i){return{name:n,total:totals[i],added:i===H?pen:0,cobra:i===H,winner:false};});
      gameSummaryRef.current.cobraHits[names[H]]=(gameSummaryRef.current.cobraHits[names[H]]||0)+1;
      setTimeout(function(){audio.cobraStrike();haptic.cobra();},300);
      unlockAch("cobra_survive");
      setGameStats(function(g){var n={...g,cobras:g.cobras+1,rounds:g.rounds+1,streak:0};try{localStorage.setItem("cobra_stats",JSON.stringify(n));}catch(e){}return n;});
      setWinStreak(0);try{localStorage.setItem("cobra_win_streak","0");}catch(e){}
      gainSeasonXP(30); // cobra declaration bonus XP
      // ELO cobra penalty: -5
      applyEloChange(-5);
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

  function getEloTier(e){
    if(e>=2000)return{name:"Grandmaster",icon:"👑",color:"linear-gradient(135deg,#f0c060,#fff,#f0c060)",min:2000,max:Infinity};
    if(e>=1800)return{name:"Master",icon:"🏆",color:"#ff8f00",min:1800,max:1999};
    if(e>=1600)return{name:"Diamond",icon:"💠",color:"#b39ddb",min:1600,max:1799};
    if(e>=1400)return{name:"Platinum",icon:"💎",color:"#4dd0e1",min:1400,max:1599};
    if(e>=1200)return{name:"Gold",icon:"🥇",color:"#ffd700",min:1200,max:1399};
    if(e>=1000)return{name:"Silver",icon:"🥈",color:"#c0c0c0",min:1000,max:1199};
    return{name:"Bronze",icon:"🥉",color:"#cd7f32",min:0,max:999};
  }

  function applyEloChange(delta){
    var capturedPrevTier,capturedNewElo,capturedNewTier;
    setElo(function(prev){
      capturedPrevTier=getEloTier(prev);
      capturedNewElo=Math.max(0,prev+delta);
      capturedNewTier=getEloTier(capturedNewElo);
      try{localStorage.setItem("cobra_elo",String(capturedNewElo));}catch(e){}
      return capturedNewElo;
    });
    setTimeout(function(){
      setEloToast({delta:delta,rankUp:capturedPrevTier&&capturedNewTier&&capturedPrevTier.name!==capturedNewTier.name&&delta>0,rankName:capturedNewTier?capturedNewTier.name:"",rankColor:capturedNewTier?capturedNewTier.color:"#d4a843"});
      setTimeout(function(){setEloToast(null);},3500);
    },400);
  }

  function syncAchProgress(newStats){
    setAchProgress(function(prev){
      var updated=Object.assign({},prev);
      ACHIEVEMENTS.forEach(function(a){
        if(a.stat==="wins")updated[a.stat]=newStats.wins||0;
        else if(a.stat==="rounds")updated[a.stat]=newStats.rounds||0;
        else if(a.stat==="cobras")updated[a.stat]=newStats.cobras||0;
        else if(a.stat==="bestStreak")updated[a.stat]=newStats.bestStreak||0;
      });
      try{localStorage.setItem("cobra_ach_progress",JSON.stringify(updated));}catch(e){}
      return updated;
    });
  }

  function finishRound(ns,res){
    // XP rewards for local player
    gainXP(25); // participation XP
    gainSeasonXP(15); // season XP for participation
    var winnerIdx=ns.indexOf(Math.min.apply(null,ns));
    if(winnerIdx===myIdx){gainXP(50);gainSeasonXP(50);if(isVIP){var vipCoinBonus=Math.round(200*0.25);addCoins(vipCoinBonus);} // win bonus
      // First win of day bonus
      var todayWinDay=Math.floor(Date.now()/(1000*60*60*24));
      var lastWinDaySaved=parseInt((function(){try{return localStorage.getItem("cobra_last_win_date")||"0";}catch(e){return"0";}})());
      if(lastWinDaySaved!==todayWinDay){try{localStorage.setItem("cobra_last_win_date",String(todayWinDay));}catch(e){}addCoins(150);pop("+150 coins — First Win of the Day! 🏆","success");}
    }
    // Unlock streak frames
    var curStreak=gameStats.streak||0;
    if(winnerIdx===myIdx){
      if(curStreak>=3)unlockFrame("bronze");
      if(curStreak>=5)unlockFrame("silver");
      if(curStreak>=10)unlockFrame("gold");
    }
    // Update achievement progress (synced from gameStats)
    syncAchProgress(gameStats);
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
      // ELO: -8 loss vs AI, standard formula vs human (only if game is over and I'm the loser)
      if(loser===H){if(mode==="cpu"){applyEloChange(-8);}else{var exp2=1/(1+Math.pow(10,(1200-elo)/400));applyEloChange(Math.round(32*(0-exp2)));}}
      // ELO: cobra success (+8) when others get cobrad: tracked per-round already via -5 penalty for victim, +8 for success

      // Show elimination animation then go to gameOver
      setElimAnim({name:names[loser],idx:loser});
      clearActiveGame();setTimeout(function(){setElimAnim(null);setScreen("gameOver");},2500);
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
  const notifToggle=function(){
    if(!("Notification" in window))return;
    var enabling=!notifsEnabled;
    if(enabling){
      Notification.requestPermission().then(function(p){
        if(p==="granted"){
          setNotifsEnabled(true);try{localStorage.setItem("cobra_notifs_enabled","1");}catch(e){}
          scheduleNotifTriggers();
          pop("Notifications enabled!","success");
        } else {
          pop("Notification permission denied","warning");
        }
      });
    } else {
      setNotifsEnabled(false);try{localStorage.setItem("cobra_notifs_enabled","0");}catch(e){}
      pop("Notifications disabled","info");
    }
  };
  _notifToggle=notifToggle;

  if(showSplash)return(
    <div>
      <style>{GS}</style>
      <SplashScreen onDone={function(){setShowSplash(false);audio.init();audio.resume();}}/>
    </div>
  );

  // ─── ACHIEVEMENTS ───────────────────────────────────
  if(screen==="achievements"){
    return <AchievementsScreen
      goScreen={goScreen}
      gameStats={gameStats}
      achProgress={achProgress}
      claimedAchs={claimedAchs}
      playerLevel={playerLevel}
      onClaim={claimAchievement}
      showSettings={showSettings}
      setShowSettings={setShowSettings}
      sfxMuted={sfxMuted}
      musicMuted={musicMuted}
      sfxToggle={sfxToggle}
      musToggle={musToggle}
      cardTheme={cardTheme}
      setCardTheme={setCardTheme}
    />;
  }

  if(screen==="missions"){
    var dm=getOrRefreshMissions("daily",dailyMissions);
    var wm=getOrRefreshMissions("weekly",weeklyMissions);
    if(!dailyMissions||dailyMissions.seed!==dm.seed)setDailyMissions(dm);
    if(!weeklyMissions||weeklyMissions.seed!==wm.seed)setWeeklyMissions(wm);
    return <MissionsScreen
      goScreen={goScreen}
      gameStats={gameStats}
      achProgress={achProgress}
      dailyMissions={dm}
      weeklyMissions={wm}
      onClaimMission={function(type,idx,m){
        var setter=type==="daily"?setDailyMissions:setWeeklyMissions;
        var key="cobra_"+(type==="daily"?"daily":"weekly")+"_missions";
        setter(function(prev){
          if(!prev)return prev;
          var updated={...prev,missions:prev.missions.map(function(ms,i){return i===idx?{...ms,claimed:true}:ms;})};
          try{localStorage.setItem(key,JSON.stringify(updated));}catch(e){}
          return updated;
        });
        if(m.reward.xp)gainXP(m.reward.xp);
        if(m.reward.coins)addCoins(m.reward.coins);
        if(m.reward.gems)addGems(m.reward.gems);
        setRewardPopup({coins:m.reward.coins||0,gems:m.reward.gems||0,label:"Mission Complete! 🎯"});
        audio.achievement();
      }}
      missionStreak={parseInt(localStorage.getItem("cobra_mission_streak")||"0")}
      showSettings={showSettings}
      setShowSettings={setShowSettings}
      sfxMuted={sfxMuted}
      musicMuted={musicMuted}
      sfxToggle={sfxToggle}
      musToggle={musToggle}
      cardTheme={cardTheme}
      setCardTheme={setCardTheme}
    />;
  }

  if(screen==="collection"){
    return <CollectionScreen
      goScreen={goScreen}
      ownedItems={ownedItems}
      myAvatar={myAvatar}
      cardTheme={cardTheme}
      equippedTitle={equippedTitle}
      equippedFrame={equippedFrame}
      unlockedTitles={unlockedTitles}
      unlockedFrames={unlockedFrames}
      onEquipTitle={function(id){setEquippedTitle(id);try{localStorage.setItem("cobra_title",id);}catch(e){}}}
      onEquipFrame={function(id){setEquippedFrame(id);try{localStorage.setItem("cobra_frame",id);}catch(e){}}}
      onEquipAvatar={function(id){setMyAvatar(id);try{localStorage.setItem("cobra_player_avatar",id);}catch(e){}}}
      onEquipTheme={function(id){setCardTheme(id);try{localStorage.setItem("cobra_card_theme",id);}catch(e){}}}
      showSettings={showSettings}
      setShowSettings={setShowSettings}
      sfxMuted={sfxMuted}
      musicMuted={musicMuted}
      sfxToggle={sfxToggle}
      musToggle={musToggle}
      gameStats={gameStats}
      setCardTheme={setCardTheme}
      isVIP={isVIP}
    />;
  }

  // ─── TOURNAMENT ─────────────────────────────────────
  if(screen==="tournament"&&!tournamentData){
    return <TournamentScreen
      onBack={function(){setScreen("home");}}
      onStart={function(){
        audio.buttonClick();haptic.medium();
        var bracket=[{p1:"You",p2:"CPU 1",winner:null},{p1:"CPU 2",p2:"CPU 3",winner:null},{p1:null,p2:null,winner:null}];
        setTournamentData({phase:"semi1",bracket:bracket,champion:null});
        setMode("cpu");
        var tNames=["You","CPU 1","CPU 2","CPU 3","CPU 4"];
        setNPlayers(2);setNames(tNames);setCpuCount(1);setCpuDiff(1);setMyIdx(0);
        setRoundRes(null);setRoundEndData(null);setRevealData(null);setGameOverData(null);
        deal(Array(2).fill(0),2);
        goScreen("game");
      }}
      coins={coins}
      gems={gems}
    />;
  }

  if(screen==="tournamentResult"){
    return <TournamentResultScreen
      data={tournamentData||{bracket:[],champion:""}}
      playerName={names[0]||"You"}
      onClaim={function(){
        if(tournamentData&&(tournamentData.champion===(names[0]||"You")||tournamentData.champion==="You")){
          setCoins(function(c){var n=c+1000;try{localStorage.setItem("cobra_coins",n);}catch(e){}return n;});
          setGems(function(g){var n=g+10;try{localStorage.setItem("cobra_gems",n);}catch(e){}return n;});
          if(audio.win)audio.win();haptic.success();
        }
        setTournamentData(null);setScreen("home");
      }}
    />;
  }

  // ─── HOME ───────────────────────────────────────────
  if(screen==="home")return(
    <div className="feltbg" onClick={initAudio} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"28px 20px",position:"relative"}}>
      <style>{GS}</style>
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
        {/* Ambient orbs */}
        {[{t:"-10%",l:"5%",w:500,c:"rgba(10,55,18,0.45)"},{t:"60%",r:"3%",w:380,c:"rgba(10,18,45,0.35)"},{t:"30%",l:"45%",w:700,c:"rgba(8,45,14,0.18)"}].map(function(o,i){return(
          <div key={i} className="orb_float" style={{position:"absolute",top:o.t,left:o.l,right:o.r,width:o.w,height:o.w,borderRadius:"50%",background:"radial-gradient(circle,"+o.c+",transparent 70%)",animationDelay:(i*2.8)+"s"}}/>
        );})}
        {/* Animated floating cards */}
        {[
          {b:"8%",l:"15%",theme:"classic",anim:"cardDrift1",dur:"7s",delay:"0s",size:"sm"},
          {b:"5%",l:"70%",theme:"midnight",anim:"cardDrift2",dur:"9s",delay:"1.5s",size:"sm"},
          {b:"3%",l:"40%",theme:"crimson",anim:"cardDrift3",dur:"8s",delay:"3s",size:"xs"},
          {b:"10%",l:"82%",theme:"emerald",anim:"cardDrift4",dur:"10s",delay:"0.8s",size:"xs"},
          {b:"6%",l:"5%",theme:"gold",anim:"cardDrift5",dur:"7.5s",delay:"2.2s",size:"xs"},
          {b:"4%",l:"55%",theme:"galaxy",anim:"cardDrift1",dur:"11s",delay:"4s",size:"sm"},
        ].map(function(c,i){return(
          <div key={i} style={{position:"absolute",bottom:c.b,left:c.l,animation:c.anim+" "+c.dur+" "+c.delay+" ease-in infinite",willChange:"transform,opacity"}}>
            <Card card={{suit:"♠",value:"A"}} faceDown size={c.size} theme={c.theme}/>
          </div>
        );})}
        {/* Sparkle particles */}
        {[{t:"20%",l:"10%",d:"0s"},{t:"40%",l:"88%",d:"0.7s"},{t:"65%",l:"25%",d:"1.4s"},{t:"15%",l:"60%",d:"2.1s"},{t:"55%",l:"78%",d:"0.3s"},{t:"80%",l:"48%",d:"1.8s"},{t:"35%",l:"5%",d:"2.8s"},{t:"70%",l:"92%",d:"1.1s"}].map(function(s,i){return(
          <div key={i} style={{position:"absolute",top:s.t,left:s.l,width:4,height:4,borderRadius:"50%",background:"#d4a843",animation:"sparkle 3s "+s.d+" ease-in-out infinite",boxShadow:"0 0 6px #d4a843"}}/>
        );})}
        {/* Bottom glow strip */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:120,background:"linear-gradient(0deg,rgba(10,40,12,0.6),transparent)",animation:"homeGlow 4s ease-in-out infinite"}}/>
      </div>
      <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",maxWidth:400,width:"100%"}} className="anim_up">
        <div className="float" style={{marginBottom:10}}>
          <span style={{fontSize:88,lineHeight:1,display:"block",textAlign:"center"}}>🐍</span>
        </div>
        <h1 style={{fontFamily:"Cinzel,serif",fontSize:58,fontWeight:900,letterSpacing:10,margin:"4px 0 0",lineHeight:1,background:"linear-gradient(175deg,#f4cc52 0%,#d4a843 36%,#a87020 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>COBRA</h1>
        <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#6a9a6e",fontSize:15,letterSpacing:4,marginTop:4,marginBottom:myName?2:10}}>the card game</p>
        {myName&&<p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#7a6a2e",fontSize:15,marginBottom:6}}>Welcome back, {myName} {myAvatar}</p>}
        {(function(){var tier=getEloTier(elo);var nextMin=tier.max===Infinity?null:tier.max+1;var pct=tier.max===Infinity?100:Math.round(Math.min(100,(elo-tier.min)/(tier.max-tier.min+1)*100));return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:10,gap:4}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(0,0,0,0.35)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:20,padding:"4px 14px"}}>
            <span style={{fontSize:16}}>{tier.icon}</span>
            <span style={{fontFamily:"Cinzel,serif",fontSize:11,background:tier.color,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontWeight:700,letterSpacing:1}}>{tier.name}</span>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(255,255,255,0.4)"}}>{elo} ELO</span>
          </div>
          {tier.max!==Infinity&&<div style={{width:140,height:4,borderRadius:2,background:"rgba(255,255,255,0.08)",overflow:"hidden"}}>
            <div style={{height:"100%",width:pct+"%",background:tier.color,borderRadius:2,transition:"width 0.6s ease"}}/>
          </div>}
          {tier.max!==Infinity&&<div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"rgba(255,255,255,0.3)",letterSpacing:1}}>{tier.max+1-elo} ELO TO {getEloTier(tier.max+1).name.toUpperCase()}</div>}
          {(function(){try{var sd=parseInt(localStorage.getItem("cobra_season_start_date")||"0");if(!sd)return null;var daysLeft=30-(Math.floor(Date.now()/(1000*60*60*24))-sd);return(<div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"rgba(255,255,255,0.25)",letterSpacing:1,marginTop:2}}>Season ends in {Math.max(0,daysLeft)} day{daysLeft!==1?"s":""}</div>);}catch(e){return null;}})()}
        </div>);})()}
        <div style={{textAlign:"center",marginBottom:4}}>
        </div>
        <div style={{display:"inline-block",background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.2)",borderRadius:20,padding:"3px 12px",marginBottom:6}}
          onClick={function(){audio.init();audio.resume();}}>
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
        {/* ── PRIMARY PLAY MODES ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          {/* VS COMPUTER — big hero card */}
          <button onClick={function(){audio.init();audio.resume();audio.buttonClick();haptic.medium();goScreen("setupCPU");}}
            style={{padding:"20px 14px 16px",background:"linear-gradient(160deg,#211500,#2e1c00,#1a1000)",border:"2px solid rgba(212,168,67,0.5)",borderRadius:20,cursor:"pointer",touchAction:"manipulation",textAlign:"left",display:"flex",flexDirection:"column",gap:12,position:"relative",overflow:"hidden",boxShadow:"0 0 24px rgba(212,168,67,0.15),0 6px 20px rgba(0,0,0,0.5)"}}>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(212,168,67,0.06),transparent 60%)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",bottom:-10,right:-10,fontSize:72,opacity:0.1,lineHeight:1}}>🤖</div>
            <div style={{width:46,height:46,borderRadius:14,background:"linear-gradient(135deg,rgba(212,168,67,0.25),rgba(212,168,67,0.1))",border:"1px solid rgba(212,168,67,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🤖</div>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#f0c060",letterSpacing:1,fontWeight:900,marginBottom:3}}>VS COMPUTER</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:11,color:"rgba(240,192,96,0.5)",lineHeight:1.4}}>Solo · Easy to Hard</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:"auto"}}>
              <div style={{flex:1,height:2,borderRadius:1,background:"rgba(212,168,67,0.2)"}}/>
              <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(212,168,67,0.5)",letterSpacing:1}}>PLAY</span>
              <span style={{fontSize:10,color:"rgba(212,168,67,0.5)"}}>▶</span>
            </div>
          </button>
          {/* MULTIPLAYER — big hero card */}
          <button onClick={function(){audio.init();audio.resume();audio.buttonClick();haptic.medium();goScreen("setupRoom");}}
            style={{padding:"20px 14px 16px",background:"linear-gradient(160deg,#070d28,#0c1438,#060c20)",border:"2px solid rgba(96,165,250,0.45)",borderRadius:20,cursor:"pointer",touchAction:"manipulation",textAlign:"left",display:"flex",flexDirection:"column",gap:12,position:"relative",overflow:"hidden",boxShadow:"0 0 24px rgba(96,165,250,0.12),0 6px 20px rgba(0,0,0,0.5)"}}>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(96,165,250,0.06),transparent 60%)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",bottom:-10,right:-10,fontSize:72,opacity:0.1,lineHeight:1}}>👥</div>
            <div style={{width:46,height:46,borderRadius:14,background:"linear-gradient(135deg,rgba(96,165,250,0.25),rgba(96,165,250,0.1))",border:"1px solid rgba(96,165,250,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>👥</div>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#93c5fd",letterSpacing:1,fontWeight:900,marginBottom:3}}>MULTIPLAYER</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:11,color:"rgba(147,197,253,0.5)",lineHeight:1.4}}>Friends · Private room</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:"auto"}}>
              <div style={{flex:1,height:2,borderRadius:1,background:"rgba(96,165,250,0.2)"}}/>
              <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(96,165,250,0.5)",letterSpacing:1}}>PLAY</span>
              <span style={{fontSize:10,color:"rgba(96,165,250,0.5)"}}>▶</span>
            </div>
          </button>
        </div>

        {/* ── SECONDARY PLAY ROW ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <button onClick={function(){audio.init();audio.resume();audio.buttonClick();haptic.light();goScreen("setupGlobal");}}
            style={{padding:"12px 14px",background:"linear-gradient(145deg,#071a0e,#0a2214)",border:"1px solid rgba(74,222,128,0.25)",borderRadius:16,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:10,position:"relative",overflow:"hidden"}}>
            <span style={{fontSize:22,filter:"drop-shadow(0 0 5px rgba(74,222,128,0.5))"}}>🌐</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#4ade80",letterSpacing:1,fontWeight:900}}>ONLINE</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:10,color:"rgba(74,222,128,0.4)"}}>Global matchmaking</div>
            </div>
          </button>
          <button onClick={function(){audio.init();audio.resume();audio.buttonClick();haptic.light();startQuickMatch();}}
            style={{padding:"12px 14px",background:"linear-gradient(145deg,#0a0f28,#0c1235)",border:"1px solid rgba(147,197,253,0.2)",borderRadius:16,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:10,position:"relative",overflow:"hidden"}}>
            <span style={{fontSize:22,filter:"drop-shadow(0 0 5px rgba(147,197,253,0.5))"}}>⚡</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#93c5fd",letterSpacing:1,fontWeight:900}}>QUICK MATCH</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:10,color:"rgba(147,197,253,0.4)"}}>Instant game</div>
            </div>
          </button>
        </div>

        {/* ── EXPLORE SECTION ── */}
        <div style={{marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.25))"}}/>
            <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(212,168,67,0.5)",letterSpacing:3}}>EXPLORE</span>
            <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(212,168,67,0.25),transparent)"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
            {[
              {icon:"🏆",label:"Tournament",action:function(){setScreen("tournament");},color:"#f0c060",glow:"rgba(240,192,96,0.3)",bg:"linear-gradient(145deg,#1a1200,#120d00)",border:"rgba(240,192,96,0.3)"},
              {icon:"🛒",label:"Shop",action:function(){goScreen("shop");},color:"#c084fc",glow:"rgba(192,132,252,0.3)",bg:"linear-gradient(145deg,#160a28,#0f0618)",border:"rgba(192,132,252,0.3)"},
              {icon:"📊",label:"Ranks",action:function(){goScreen("leaderboard");},color:"#60a5fa",glow:"rgba(96,165,250,0.3)",bg:"linear-gradient(145deg,#06122a,#040c1e)",border:"rgba(96,165,250,0.3)"},
              {icon:"⚔️",label:"Clan",action:function(){goScreen("clan");},color:"#f87171",glow:"rgba(248,113,113,0.3)",bg:"linear-gradient(145deg,#280808,#1a0404)",border:"rgba(248,113,113,0.3)"},
              {icon:"👥",label:"Friends",action:function(){goScreen("friends");},color:"#4ade80",glow:"rgba(74,222,128,0.3)",bg:"linear-gradient(145deg,#061a0e,#041008)",border:"rgba(74,222,128,0.3)"},
              {icon:"🎫",label:"Season",action:function(){goScreen("season");},badge:SEASON_PASS.tiers.some(function(t){return t.tier<=seasonTier&&seasonClaimed.indexOf(t.tier)<0;}),color:"#e879f9",glow:"rgba(232,121,249,0.3)",bg:"linear-gradient(145deg,#1a0620,#100414)",border:"rgba(232,121,249,0.3)"},
              {icon:"🎯",label:"Missions",action:function(){goScreen("missions");},badge:(function(){var dm2=dailyMissions;return dm2&&dm2.missions&&dm2.missions.some(function(m){return!m.claimed;});}()),color:"#fb923c",glow:"rgba(251,146,60,0.3)",bg:"linear-gradient(145deg,#1a0e04,#120800)",border:"rgba(251,146,60,0.3)"},
              {icon:"📚",label:"Collection",action:function(){goScreen("collection");},color:"#a3e635",glow:"rgba(163,230,53,0.3)",bg:"linear-gradient(145deg,#0e1a02,#081000)",border:"rgba(163,230,53,0.3)"},
            ].map(function(t){return(
              <button key={t.label} onClick={function(){audio.buttonClick();haptic.light();t.action();}}
                style={{padding:"14px 4px 12px",background:t.bg,border:"1px solid "+t.border,borderRadius:16,cursor:"pointer",touchAction:"manipulation",display:"flex",flexDirection:"column",alignItems:"center",gap:6,position:"relative",boxShadow:"0 4px 12px rgba(0,0,0,0.4)"}}>
                {t.badge&&<div style={{position:"absolute",top:7,right:7,width:8,height:8,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 6px rgba(239,68,68,0.9)",animation:"availablePulse 1.5s ease-in-out infinite"}}/>}
                <span style={{fontSize:24,filter:"drop-shadow(0 0 6px "+t.glow+")"}}>{t.icon}</span>
                <span style={{fontFamily:"Cinzel,serif",fontSize:8,color:t.color,letterSpacing:0.5,fontWeight:700,textAlign:"center",lineHeight:1.2}}>{t.label}</span>
              </button>
            );})}
          </div>
        </div>

        {/* ── PLAYER CARD ── */}
        <div style={{marginBottom:14,borderRadius:20,overflow:"hidden",border:"1.5px solid rgba(212,168,67,0.2)",background:"linear-gradient(145deg,#0e1a0e,#080f08)",boxShadow:"0 8px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
          <div style={{padding:"16px",display:"flex",alignItems:"center",gap:14}}>
            <div onClick={function(){audio.buttonClick();setShowAvatarPicker(true);}} style={{position:"relative",flexShrink:0,cursor:"pointer"}}>
              {isVIP&&<div style={{position:"absolute",inset:-3,borderRadius:"50%",background:"linear-gradient(135deg,#f0c060,#d4a843,#f0c060,#a87020)",animation:"tileSpinWheel 3s linear infinite",zIndex:0}}/>}
              {isVIP&&<div style={{position:"absolute",inset:-1,borderRadius:"50%",background:"#080f08",zIndex:1}}/>}
              <div style={{width:50,height:50,borderRadius:"50%",background:"linear-gradient(135deg,#1a2a1a,#0e180e)",border:isVIP?"none":"2px solid rgba(212,168,67,0.35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,position:"relative",zIndex:2}}>{myAvatar||"🐍"}</div>
              <div style={{position:"absolute",bottom:-1,right:-1,width:16,height:16,borderRadius:"50%",background:"#d4a843",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,zIndex:3,boxShadow:"0 2px 4px rgba(0,0,0,0.5)"}}>✏️</div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                <span style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#f0c060",letterSpacing:1,fontWeight:900}}>{myName||"Player"}</span>
                {isVIP&&<VIPBadge/>}
                {prestige>0&&<span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#f0c060",background:"rgba(240,192,96,0.15)",border:"1px solid rgba(240,192,96,0.35)",borderRadius:8,padding:"1px 6px"}}>{"⭐".repeat(Math.min(prestige,10))}</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(212,168,67,0.6)",letterSpacing:1}}>LVL {playerLevel}</span>
                <span style={{color:"rgba(255,255,255,0.15)",fontSize:10}}>·</span>
                {(function(){var tier=getEloTier(elo);return(<span style={{fontFamily:"Cinzel,serif",fontSize:10,background:tier.color,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",letterSpacing:1}}>{tier.icon} {tier.name}</span>);}())}
              </div>
              <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                <div style={{height:"100%",width:Math.min(100,Math.round(playerXP/(playerLevel*100)*100))+"%",background:"linear-gradient(90deg,#c49030,#f0c060)",borderRadius:3,boxShadow:"0 0 6px rgba(212,168,67,0.5)",transition:"width 0.8s cubic-bezier(.22,1,.36,1)"}}/>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.2)",borderRadius:10,padding:"4px 10px"}}>
                <span style={{fontSize:13}}>🪙</span>
                <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#f0c060",fontWeight:700}}>{coins.toLocaleString()}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(192,132,252,0.1)",border:"1px solid rgba(192,132,252,0.2)",borderRadius:10,padding:"4px 10px"}}>
                <span style={{fontSize:13}}>💎</span>
                <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#c084fc",fontWeight:700}}>{gems}</span>
              </div>
            </div>
          </div>
          {/* Stats row */}
          {gameStats.rounds>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
              {[["🏆",gameStats.wins,"Wins"],["🐍",gameStats.cobras,"Cobras"],["🔥",gameStats.streak||0,"Streak"],["🃏",gameStats.rounds,"Rounds"]].map(function(row){return(
                <div key={row[2]} style={{padding:"10px 0",textAlign:"center",borderRight:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{fontSize:16,marginBottom:2}}>{row[0]}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:700,color:"#d4a843"}}>{row[1]}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"rgba(255,255,255,0.25)",letterSpacing:1}}>{row[2]}</div>
                </div>
              );})}
            </div>
          )}
          {/* View profile */}
          <button onClick={function(){audio.buttonClick();haptic.light();setActiveScreen("profile");}} style={{width:"100%",padding:"10px",background:"rgba(255,255,255,0.02)",border:"none",borderTop:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",touchAction:"manipulation",fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(212,168,67,0.4)",letterSpacing:2}}>
            VIEW FULL PROFILE →
          </button>
        </div>

        {/* ── DAILY REWARDS ROW ── */}
        <div style={{marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(212,168,67,0.25))"}}/>
            <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(212,168,67,0.5)",letterSpacing:3}}>DAILY</span>
            <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(212,168,67,0.25),transparent)"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            {/* Battle Pass */}
            <button onClick={function(){audio.buttonClick();haptic.light();setActiveScreen("battlepass");}}
              style={{padding:"14px 10px",background:"linear-gradient(145deg,#0f2010,#0a1408)",border:"1px solid rgba(212,168,67,0.25)",borderRadius:16,cursor:"pointer",touchAction:"manipulation",display:"flex",flexDirection:"column",alignItems:"center",gap:8,boxShadow:"0 4px 12px rgba(0,0,0,0.4)"}}>
              <span style={{fontSize:26,filter:"drop-shadow(0 0 6px rgba(212,168,67,0.5))"}}>🎭</span>
              <div style={{textAlign:"center"}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:1,fontWeight:700}}>BATTLE PASS</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(212,168,67,0.35)",marginTop:2}}>Lv {bpLevel}/50</div>
              </div>
              <div style={{width:"100%",height:3,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                <div style={{height:"100%",background:"linear-gradient(90deg,#d4a843,#f0c060)",width:Math.min(100,Math.round((bpLevel/50)*100))+"%",borderRadius:2}}/>
              </div>
            </button>
            {/* Daily Reward */}
            {(function(){
              var canClaim=Date.now()-dailyLast>=86400000;
              var msUntil=Math.max(0,86400000-(Date.now()-dailyLast));
              var hrs=Math.floor(msUntil/3600000),mins=Math.floor((msUntil%3600000)/60000);
              return(
                <button onClick={function(){audio.buttonClick();haptic.light();setActiveScreen("daily");}}
                  style={{padding:"14px 10px",background:canClaim?"linear-gradient(145deg,#2a1a00,#1a1000)":"linear-gradient(145deg,#1a1200,#100c00)",border:canClaim?"1.5px solid rgba(251,191,36,0.5)":"1px solid rgba(160,120,48,0.2)",borderRadius:16,cursor:"pointer",touchAction:"manipulation",display:"flex",flexDirection:"column",alignItems:"center",gap:8,position:"relative",boxShadow:canClaim?"0 0 20px rgba(251,191,36,0.15),0 4px 12px rgba(0,0,0,0.4)":"0 4px 12px rgba(0,0,0,0.4)",animation:canClaim?"availablePulse 2s ease-in-out infinite":"none"}}>
                  {canClaim&&<div style={{position:"absolute",top:8,right:8,width:8,height:8,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 8px rgba(239,68,68,0.9)"}}/>}
                  <span style={{fontSize:26,filter:canClaim?"drop-shadow(0 0 8px rgba(251,191,36,0.8))":"none"}}>📅</span>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:canClaim?"#fbbf24":"#a07830",letterSpacing:1,fontWeight:700}}>DAILY</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:canClaim?"rgba(251,191,36,0.6)":"rgba(160,120,48,0.3)",marginTop:2}}>{canClaim?"CLAIM!":hrs+"h "+mins+"m"}</div>
                  </div>
                </button>
              );
            })()}
            {/* Lucky Spin */}
            {(function(){
              var canSp=Date.now()-spinLast>=86400000;
              var msUntil=Math.max(0,86400000-(Date.now()-spinLast));
              var hrs=Math.floor(msUntil/3600000),mins=Math.floor((msUntil%3600000)/60000);
              return(
                <button onClick={function(){audio.buttonClick();haptic.light();setActiveScreen("spin");}}
                  style={{padding:"14px 10px",background:canSp?"linear-gradient(145deg,#1e0830,#160420)":"linear-gradient(145deg,#160616,#0e040e)",border:canSp?"1.5px solid rgba(168,85,247,0.5)":"1px solid rgba(122,74,122,0.2)",borderRadius:16,cursor:"pointer",touchAction:"manipulation",display:"flex",flexDirection:"column",alignItems:"center",gap:8,position:"relative",boxShadow:canSp?"0 0 20px rgba(168,85,247,0.15),0 4px 12px rgba(0,0,0,0.4)":"0 4px 12px rgba(0,0,0,0.4)",animation:canSp?"availablePulse 2.2s ease-in-out infinite":"none"}}>
                  {canSp&&<div style={{position:"absolute",top:8,right:8,width:8,height:8,borderRadius:"50%",background:"#a855f7",boxShadow:"0 0 8px rgba(168,85,247,0.9)"}}/>}
                  <span style={{fontSize:26,filter:canSp?"drop-shadow(0 0 8px rgba(168,85,247,0.8))":"none"}}>🎡</span>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:canSp?"#c084fc":"#7a4a7a",letterSpacing:1,fontWeight:700}}>LUCKY SPIN</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:canSp?"rgba(192,132,252,0.6)":"rgba(122,74,122,0.3)",marginTop:2}}>{canSp?"SPIN!":hrs+"h "+mins+"m"}</div>
                  </div>
                </button>
              );
            })()}
          </div>
        </div>

        {/* ── ACHIEVEMENTS ── */}
        <div style={{marginBottom:14,borderRadius:18,overflow:"hidden",border:"1px solid rgba(212,168,67,0.18)",background:"linear-gradient(145deg,#0e1408,#080e04)",boxShadow:"0 6px 24px rgba(0,0,0,0.4)",cursor:"pointer"}}
          onClick={function(){audio.buttonClick();haptic.light();goScreen("achievements");}}>
          <div style={{padding:"14px 16px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#d4a843",letterSpacing:2,fontWeight:700}}>ACHIEVEMENTS</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:11,color:"rgba(212,168,67,0.4)",marginTop:2}}>{unlockedAchs.length} of {ACHIEVEMENTS.length} unlocked</div>
            </div>
            <div style={{background:"rgba(212,168,67,0.12)",border:"1px solid rgba(212,168,67,0.25)",borderRadius:10,padding:"5px 12px",fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:1}}>VIEW ALL →</div>
          </div>
          <div style={{display:"flex",height:6,borderRadius:0,background:"rgba(255,255,255,0.04)",overflow:"hidden",margin:"0 16px 12px"}}>
            <div style={{height:"100%",width:Math.round(unlockedAchs.length/ACHIEVEMENTS.length*100)+"%",background:"linear-gradient(90deg,#c49030,#f0c060,#c49030)",backgroundSize:"200% 100%",animation:"legendaryShimmer 2s ease-in-out infinite"}}/>
          </div>
          <div style={{display:"flex",gap:8,padding:"0 16px 14px",flexWrap:"wrap"}}>
            {ACHIEVEMENTS.map(function(a){return(<div key={a.id} style={{fontSize:22,opacity:unlockedAchs.includes(a.id)?1:0.15,filter:unlockedAchs.includes(a.id)?"drop-shadow(0 0 5px rgba(212,168,67,0.6))":"grayscale(1)",transition:"all 0.3s"}}>{a.icon}</div>);})}
          </div>
        </div>
        {/* ── BOTTOM ROW: VIP + REFER + HOW TO ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <button onClick={function(){audio.buttonClick();setScreen("vip");}}
            style={{padding:"13px 12px",background:isVIP?"linear-gradient(135deg,rgba(212,168,67,0.2),rgba(212,168,67,0.08))":"linear-gradient(135deg,rgba(212,168,67,0.1),rgba(212,168,67,0.04))",border:isVIP?"1.5px solid rgba(212,168,67,0.55)":"1.5px solid rgba(212,168,67,0.3)",borderRadius:14,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:8,boxShadow:isVIP?"0 0 18px rgba(212,168,67,0.12)":"none"}}>
            <span style={{fontSize:20}}>👑</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#f0c060",letterSpacing:1,fontWeight:700}}>{isVIP?"VIP MEMBER":"GET VIP"}</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:10,color:"rgba(240,192,96,0.4)"}}>{isVIP?"Active":"Unlock all perks"}</div>
            </div>
          </button>
          <button onClick={function(){audio.buttonClick();goScreen("referral");}}
            style={{padding:"13px 12px",background:"rgba(74,222,128,0.07)",border:"1px solid rgba(74,222,128,0.25)",borderRadius:14,cursor:"pointer",touchAction:"manipulation",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>🎁</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#4ade80",letterSpacing:1,fontWeight:700}}>REFER FRIENDS</div>
              <div style={{fontFamily:"Crimson Text,serif",fontSize:10,color:"rgba(74,222,128,0.4)"}}>Earn coins</div>
            </div>
          </button>
        </div>
        {playerLevel>=100&&(
          <button onClick={function(){audio.buttonClick();haptic.medium();setShowPrestigeModal(true);}}
            style={{width:"100%",padding:"14px 20px",background:"linear-gradient(135deg,rgba(240,192,96,0.2),rgba(212,168,67,0.08))",border:"2px solid rgba(240,192,96,0.55)",borderRadius:16,fontFamily:"Cinzel,serif",fontSize:13,color:"#f0c060",letterSpacing:3,cursor:"pointer",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:10,animation:"legendaryShimmer 2s ease-in-out infinite",boxShadow:"0 0 24px rgba(240,192,96,0.2)"}}>
            <span style={{fontSize:22}}>⭐</span> PRESTIGE — Level 100!
          </button>
        )}
        <div style={{display:"flex",gap:8,marginBottom:4}}>
          <button className="btn_btn_ghost" style={{flex:1,padding:"11px",fontSize:10,letterSpacing:1.5,color:"#8a9a8a"}} onClick={function(){audio.buttonClick();goScreen("howto");}}>📖 HOW TO PLAY</button>
          <button className="btn_btn_ghost" style={{flex:1,padding:"11px",fontSize:10,letterSpacing:1.5,color:"#8a9a8a"}} onClick={function(){audio.buttonClick();audio.init();audio.resume();var ns=["You","CPU"];setMode("cpu");setNPlayers(2);setNames(ns);setMyIdx(0);setTutorialStep(0);deal(Array(2).fill(0),2);goScreen("game");}}>🎓 TUTORIAL</button>
        </div>
        {gameStats.rounds>0&&(
          <button className="btn_btn_ghost" style={{fontSize:10,padding:"10px",letterSpacing:1,marginTop:6,width:"100%",color:"rgba(255,255,255,0.2)"}}
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
      {quickMatchOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"linear-gradient(170deg,#0d1f0e,#060e06)",border:"1.5px solid rgba(96,165,250,0.35)",borderRadius:20,padding:"32px 24px",width:"100%",maxWidth:360,textAlign:"center",animation:"slideUp 0.35s cubic-bezier(.22,1,.36,1) both"}}>
            {quickMatchStatus==="finding"&&(<>
              <div style={{fontSize:44,marginBottom:12,animation:"float 2s ease-in-out infinite"}}>⚡</div>
              <h2 style={{fontFamily:"Cinzel,serif",fontSize:18,letterSpacing:3,color:"#60a5fa",marginBottom:8}}>FINDING OPPONENT</h2>
              <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#6a9a6e",fontSize:14,marginBottom:24}}>Searching for a worthy challenger...</p>
              <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:24}}>
                {[0,1,2].map(function(i){return(<div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#60a5fa",animation:"thinkDot 1.2s ease-in-out infinite",animationDelay:(i*0.2)+"s"}}/>);})}
              </div>
              <button className="btn_btn_ghost" style={{width:"100%",padding:14,fontSize:12,letterSpacing:2}} onClick={function(){cancelQuickMatch();}}>✕ CANCEL</button>
            </>)}
            {quickMatchStatus==="notfound"&&(<>
              <div style={{fontSize:44,marginBottom:12}}>😔</div>
              <h2 style={{fontFamily:"Cinzel,serif",fontSize:16,letterSpacing:3,color:"#f87171",marginBottom:8}}>NO OPPONENTS FOUND</h2>
              <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#6a9a6e",fontSize:14,marginBottom:24}}>No one is waiting right now — try again!</p>
              <button className="btn_btn_blue" style={{width:"100%",padding:14,fontSize:12,letterSpacing:2,marginBottom:10}} onClick={function(){setQuickMatchStatus("finding");startQuickMatch();}}>TRY AGAIN</button>
              <button className="btn_btn_ghost" style={{width:"100%",padding:14,fontSize:12,letterSpacing:2}} onClick={function(){setQuickMatchOpen(false);setQuickMatchStatus("finding");}}>CLOSE</button>
            </>)}
            {quickMatchStatus==="unavailable"&&(<>
              <div style={{fontSize:44,marginBottom:12}}>⚠️</div>
              <h2 style={{fontFamily:"Cinzel,serif",fontSize:16,letterSpacing:3,color:"#f0c060",marginBottom:8}}>MATCHMAKING UNAVAILABLE</h2>
              <p style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#6a9a6e",fontSize:14,marginBottom:24}}>Could not connect to matchmaking service.</p>
              <button className="btn_btn_ghost" style={{width:"100%",padding:14,fontSize:12,letterSpacing:2}} onClick={function(){setQuickMatchOpen(false);setQuickMatchStatus("finding");}}>CLOSE</button>
            </>)}
          </div>
        </div>
      )}
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}} notifsEnabled={notifsEnabled} onToggleNotifs={notifToggle}/>
      {activeScreen==="profile"&&<ProfileScreen name={myName} avatar={myAvatar} level={playerLevel} xp={playerXP} xpForLevel={xpForLevel} coins={coins} gems={gems} stats={gameStats} isVIP={isVIP} onClose={function(){setActiveScreen(null);}}/>}
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
            if(r.type==="label"){
              // BP skin rewards unlock special card themes or avatars
              var bpUnlocks=["midnight","crimson","emerald","galaxy","gold","🐉","🧙","🥷","👻","🤖","🦁"];
              var unlockIdx=Math.floor(i/5);
              var unlockId=bpUnlocks[unlockIdx%bpUnlocks.length];
              if(unlockId){
                var isAv=unlockId.length<=2||unlockId.codePointAt(0)>127;
                var storeId=isAv?"av_"+unlockId:unlockId;
                setOwnedItems(function(prev){
                  if(prev.indexOf(storeId)>=0)return prev;
                  var n=[...prev,storeId];try{localStorage.setItem("cobra_owned_items",JSON.stringify(n));}catch(e){}return n;
                });
                setRewardPopup({coins:0,gems:0,label:"Unlocked "+(isAv?unlockId+" avatar":unlockId+" theme")+"! 🎉"});
                audio.achievement();
                return;
              }
            }
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
      {seasonEndModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background:"linear-gradient(170deg,#0a1a0a,#060e06)",border:"2px solid rgba(212,168,67,0.5)",borderRadius:20,padding:"32px 28px",maxWidth:360,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:8}}>{seasonEndModal.tier.icon}</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:14,color:"rgba(255,255,255,0.4)",letterSpacing:3,marginBottom:4}}>SEASON ENDED</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:26,fontWeight:900,letterSpacing:3,background:seasonEndModal.tier.color,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",marginBottom:12}}>{seasonEndModal.tier.name}</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:15,color:"#8a9a8a",marginBottom:20}}>Final rank this season. New season has begun!</div>
            <div style={{background:"rgba(212,168,67,0.1)",border:"1px solid rgba(212,168,67,0.3)",borderRadius:12,padding:"14px",marginBottom:20}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#8a7a3e",letterSpacing:2,marginBottom:4}}>SEASON REWARD</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:28,fontWeight:900,color:"#f0c060"}}>+{seasonEndModal.reward} 🪙</div>
            </div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:13,color:"rgba(255,255,255,0.35)",marginBottom:20}}>ELO reset for new season (kept 60%, min 800)</div>
            <button onClick={function(){setSeasonEndModal(null);}} style={{background:"linear-gradient(135deg,#d4a843,#a87020)",border:"none",borderRadius:12,fontFamily:"Cinzel,serif",fontSize:13,letterSpacing:2,color:"#010603",padding:"14px 32px",cursor:"pointer",fontWeight:700,touchAction:"manipulation",width:"100%"}}>CLAIM & CONTINUE</button>
          </div>
        </div>
      )}
      {rewardPopup&&<RewardPopup reward={rewardPopup} onClose={function(){setRewardPopup(null);}}/> }
      {/* Feature 8: Prestige Confirmation Modal */}
      {showPrestigeModal&&(
        <div style={{position:"fixed",inset:0,zIndex:9992,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.88)",backdropFilter:"blur(8px)",padding:20}}>
          <div style={{background:"linear-gradient(160deg,#1a1000,#0d0800)",border:"2px solid rgba(240,192,96,0.5)",borderRadius:24,padding:28,width:"100%",maxWidth:340,textAlign:"center",animation:"declarePop 0.3s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{fontSize:52,marginBottom:8}}>{"⭐".repeat(Math.min(prestige+1,5))}</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:20,color:"#f0c060",letterSpacing:3,marginBottom:8}}>PRESTIGE {prestige+1}</div>
            <div style={{fontFamily:"Crimson Text,serif",fontSize:14,color:"#8a9a8a",marginBottom:16,lineHeight:1.6}}>Reset to Level 1 and earn your Prestige {prestige+1} badge. Your coins, gems, and cosmetics are kept!</div>
            <div style={{background:"rgba(240,192,96,0.1)",border:"1px solid rgba(240,192,96,0.2)",borderRadius:12,padding:"12px",marginBottom:20}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#8a7a3e",letterSpacing:2,marginBottom:4}}>REWARD</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:16,color:"#f0c060"}}>{"⭐".repeat(prestige+1)} Prestige Badge + 500 🪙</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn_btn_ghost" style={{flex:1,padding:"14px",fontSize:11,letterSpacing:1}} onClick={function(){setShowPrestigeModal(false);}}>CANCEL</button>
              <button className="btn_btn_gold" style={{flex:1,padding:"14px",fontSize:11,letterSpacing:1}} onClick={function(){
                var np=prestige+1;setPrestige(np);try{localStorage.setItem("cobra_prestige",String(np));}catch(e){}
                setPlayerLevel(1);try{localStorage.setItem("cobra_level","1");}catch(e){}
                setPlayerXP(0);try{localStorage.setItem("cobra_xp","0");}catch(e){}
                addCoins(500);
                unlockAch("prestige1");
                setShowPrestigeModal(false);
                pop("⭐ Prestige "+np+"! Welcome to a new journey!","success");
              }}>PRESTIGE!</button>
            </div>
          </div>
        </div>
      )}
      {/* Feature 6: Profile Modal */}
      {profileModal&&<ProfileModal profile={profileModal} onClose={function(){setProfileModal(null);}} friends={(function(){try{var v=localStorage.getItem("cobra_friends");return v?JSON.parse(v):[];}catch(e){return[];}})()} onAddFriend={function(p){var cur=[];try{var v=localStorage.getItem("cobra_friends");if(v)cur=JSON.parse(v);}catch(e){}if(!cur.some(function(f){return f.name===p.name;})){var nf=[...cur,{name:p.name,avatar:p.avatar||"😎",elo:p.elo||1000}];try{localStorage.setItem("cobra_friends",JSON.stringify(nf));}catch(e){}}}}/>}
      {/* Feature 15: Gift Modal */}
      {giftModal.open&&<GiftModal friend={giftModal.friend} open={giftModal.open} onClose={function(){setGiftModal({friend:null,open:false});}} coins={coins} onSendGift={function(friend,opt){if(coins>=opt.coins){setCoins(function(c){var n=c-opt.coins;try{localStorage.setItem("cobra_coins",n);}catch(e){}return n;});pop("🎁 Gift sent to "+friend.name+"!","success");}else{pop("Not enough coins","error");}}}/>}
      {eloToast&&(function(){var t=eloToast;var tier=getEloTier(elo);return(<div style={{position:"fixed",top:"calc(20px + env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",zIndex:500,animation:"statSlideIn 0.4s both",pointerEvents:"none"}}>
        {t.rankUp&&<div style={{background:"linear-gradient(135deg,rgba(20,40,20,0.97),rgba(10,20,10,0.97))",border:"2px solid rgba(212,168,67,0.6)",borderRadius:16,padding:"12px 20px",textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.6)",marginBottom:8,whiteSpace:"nowrap"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:900,letterSpacing:2,color:"#f0c060",marginBottom:2}}>🎉 RANK UP!</div>
          <div style={{fontFamily:"Crimson Text,serif",fontSize:15,color:typeof tier.color==="string"&&!tier.color.includes("gradient")?tier.color:"#f0c060"}}>{tier.icon} You're now {tier.name}!</div>
        </div>}
        <div style={{background:"rgba(0,0,0,0.85)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,padding:"8px 16px",textAlign:"center",whiteSpace:"nowrap",backdropFilter:"blur(8px)"}}>
          <span style={{fontFamily:"Cinzel,serif",fontSize:13,fontWeight:700,color:t.delta>=0?"#4ade80":"#f87171"}}>{t.delta>=0?"+":""}{t.delta} ELO</span>
          <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(255,255,255,0.4)",marginLeft:8}}>({elo} total)</span>
        </div>
      </div>);})()}
      {showAvatarPicker&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:250,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={function(){setShowAvatarPicker(false);}}>
          <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(170deg,#0d1f0e,#060e06)",border:"1.5px solid rgba(212,168,67,0.35)",borderBottom:"none",borderRadius:"24px 24px 0 0",padding:"20px 20px calc(24px + env(safe-area-inset-bottom))",width:"100%",maxWidth:480,animation:"slideUp 0.35s cubic-bezier(.22,1,.36,1) both"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)"}}/></div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:14,color:"#d4a843",letterSpacing:3,textAlign:"center",marginBottom:16}}>CHOOSE AVATAR</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,maxHeight:"50vh",overflowY:"auto"}}>
              {SHOP_AVATARS.map(function(item){
                var owned=item.price===0||(ownedItems.indexOf("av_"+item.id)>=0);
                var equipped=myAvatar===item.id;
                return(
                  <div key={item.id} onClick={function(){
                    if(owned){audio.buttonClick();setMyAvatar(item.id);try{localStorage.setItem("cobra_player_avatar",item.id);}catch(e){}setShowAvatarPicker(false);}
                    else{audio.buttonClick();setShowAvatarPicker(false);goScreen("shop");}
                  }} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"10px 4px",borderRadius:12,border:equipped?"2px solid #d4a843":"1.5px solid rgba(255,255,255,0.07)",background:equipped?"rgba(212,168,67,0.1)":"rgba(0,0,0,0.3)",cursor:"pointer",touchAction:"manipulation",opacity:owned?1:0.5}}>
                    <div style={{fontSize:28}}>{item.id}</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:equipped?"#d4a843":"#7a9a7a",letterSpacing:0.5}}>{owned?(equipped?"✓ ON":"tap"):"🔒"}</div>
                  </div>
                );
              })}
            </div>
            <button onClick={function(){setShowAvatarPicker(false);goScreen("shop");}} style={{width:"100%",marginTop:14,padding:"12px",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,background:"rgba(212,168,67,0.08)",border:"1.5px solid rgba(212,168,67,0.2)",borderRadius:12,color:"#d4a843",cursor:"pointer",touchAction:"manipulation"}}>🛒 GET MORE IN SHOP</button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── REFERRAL ──────────────────────────────────────
  if(screen==="referral")return(
    <ReferralScreen goScreen={goScreen} myName={myName} addCoins={addCoins} pop={pop}/>
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
                <p style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#8ab080",letterSpacing:2,marginBottom:7,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>{icon}</span>{t}
                </p>
                {txt&&<p style={{fontFamily:"Crimson Text,serif",color:"#a0bba0",fontSize:15,lineHeight:1.6}}>{txt}</p>}
                {items&&<ul style={{paddingLeft:0,listStyle:"none"}}>{items.map(function(item){return(
                  <li key={item} style={{fontFamily:"Crimson Text,serif",color:"#a0bba0",fontSize:15,lineHeight:1.7,display:"flex",gap:8}}>
                    <span style={{color:"#d4a843",flexShrink:0}}>.</span>{item}
                  </li>
                );})}</ul>}
              </div>
            );
          })}
          <button className="btn_btn_gold" style={{width:"100%",padding:16,fontSize:13,letterSpacing:3,marginTop:4}} onClick={function(){audio.buttonClick();goScreen("home");}}>GOT IT</button>
        </div>
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}} notifsEnabled={notifsEnabled} onToggleNotifs={notifToggle}/>
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
              {[{l:"EASY",sub:"Plays randomly",c:"#4ade80"},{l:"MEDIUM",sub:"Some strategy",c:"#d4a843"},{l:"HARD",sub:"Plays to win",c:"#f87171"}].map(function(item,i){
                var l=item.l,c=item.c;
                return(
                  <button key={l} className="btn" onClick={function(){audio.buttonClick();setCpuDiff(i);}}
                    style={{flex:1,padding:"10px 4px",fontFamily:"Cinzel,serif",fontWeight:700,borderRadius:11,letterSpacing:1,background:cpuDiff===i?"rgba(212,168,67,0.12)":"rgba(255,255,255,0.05)",border:cpuDiff===i?"2px solid "+c:"1.5px solid rgba(255,255,255,0.08)",color:cpuDiff===i?c:"#2a3d28",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:52,touchAction:"manipulation",gap:2}}>
                    <span style={{fontSize:10,letterSpacing:1}}>{l}</span>
                    <span style={{fontSize:8,fontFamily:"Crimson Text,serif",opacity:0.7,letterSpacing:0,fontWeight:400}}>{item.sub}</span>
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
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}} notifsEnabled={notifsEnabled} onToggleNotifs={notifToggle}/>
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
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}} notifsEnabled={notifsEnabled} onToggleNotifs={notifToggle}/>
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
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#7ab07a",letterSpacing:2}}>GLOBAL MATCHMAKING ACTIVE</span>
          </div>
          <button className="btn_btn_green" style={{width:"100%",padding:16,fontSize:14,letterSpacing:2.5}} onClick={joinGlobal}>PLAY NOW</button>
        </div>
      </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}} notifsEnabled={notifsEnabled} onToggleNotifs={notifToggle}/>
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
          {onlinePlayers.map(function(p,i){
            var rp=roomRef.current&&roomRef.current.players&&roomRef.current.players[i];
            var pAvatar=(i===myIdx)?myAvatar:(rp&&rp.avatar)||null;
            return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",background:i===myIdx?"rgba(212,168,67,0.09)":"rgba(0,0,0,0.22)",borderRadius:12,marginBottom:8,border:i===myIdx?"1px solid rgba(212,168,67,0.25)":"1px solid rgba(255,255,255,0.04)"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 8px #4ade80"}} className="shimmer"/>
              {pAvatar&&<span style={{fontSize:18}}>{pAvatar}</span>}
              <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                <span style={{fontFamily:"Crimson Text,serif",fontSize:16,color:i===myIdx?"#d4a843":"#9ca3af"}}>{p}</span>
              </div>
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
          {chatMessages.length===0&&<div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#7a9a7a",fontSize:14,textAlign:"center",marginTop:20}}>No messages yet. Say hello!</div>}
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
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}} notifsEnabled={notifsEnabled} onToggleNotifs={notifToggle}/>
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
    // Fire confetti on round win
    if(rdeclWon&&confetti.length===0){
      var rConf=[];for(var rci=0;rci<28;rci++){rConf.push({id:rci,x:Math.random()*100,color:["#d4a843","#4ade80","#f87171","#60a5fa","#fff","#fbbf24","#c084fc"][Math.floor(Math.random()*7)],size:Math.random()*6+4,delay:Math.random()*0.5,dur:Math.random()*1.2+1});}
      setTimeout(function(){setConfetti(rConf);setTimeout(function(){setConfetti([]);},2800);},200);
    }
    return(
      <div className="feltbg" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
        <style>{GS}</style>
        {confetti.map(function(c){return(<div key={c.id} style={{position:"fixed",left:c.x+"%",top:"-10px",width:c.size,height:c.size*1.4,borderRadius:2,background:c.color,zIndex:300,pointerEvents:"none",animation:"confettiFall "+c.dur+"s "+c.delay+"s ease-in forwards"}}/>);})}
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
              <div key={i} style={{marginBottom:10,padding:"12px 16px",borderRadius:14,background:isDeclarer&&isWinner?"rgba(212,168,67,0.12)":isDeclarer&&!isWinner?"rgba(185,28,28,0.1)":"rgba(0,0,0,0.35)",border:isDeclarer&&isWinner?"1.5px solid rgba(212,168,67,0.4)":isDeclarer&&!isWinner?"1.5px solid rgba(185,28,28,0.4)":"1px solid rgba(255,255,255,0.08)",animation:"fadeUp 0.4s cubic-bezier(.22,1,.36,1) both",animationDelay:(i*0.1)+"s"}}>
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
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button className="btn_btn_ghost" style={{flex:1,padding:14,fontSize:11,letterSpacing:2}}
              onClick={function(){
                audio.buttonClick();haptic.medium();
                gameSummaryRef.current={declarations:{},cobraHits:{},roundScores:[],rounds:0};
                setRevealData(null);setRoundEndData(null);setScores([]);setGameOverData(null);
                if(mode==="cpu"){startCPU();}
                else{deal(Array(nPlayers).fill(0),nPlayers);setScreen("game");}
              }}>🔄 REMATCH</button>
            <button className="btn_btn_green" style={{flex:1,padding:14,fontSize:10,letterSpacing:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}
              onClick={function(){
                audio.buttonClick();haptic.medium();
                gameSummaryRef.current={declarations:{},cobraHits:{},roundScores:[],rounds:0};
                setRevealData(null);setRoundEndData(null);setScores([]);setGameOverData(null);
                if(mode==="cpu"){startCPU();}
                else{deal(Array(nPlayers).fill(0),nPlayers);setScreen("game");}
              }}>
              <span>▶ PLAY AGAIN</span>
              <span style={{fontSize:8,fontFamily:"Crimson Text,serif",textTransform:"none",letterSpacing:0,opacity:0.8}}>+2x XP this round!</span>
            </button>
          </div>
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
              gameSummaryRef.current.rounds=(gameSummaryRef.current.rounds||0)+1;
              setHands([]);setDeck([]);setMyPlayed([]);setSel([]);setOpenPile({cards:[],owner:-1});
              setRevealData(null);
              if(loser>=0){var winner=ns.indexOf(Math.min.apply(null,ns));setGameOverData({scores:ns,winner:winner,loser:loser});if(winner===H)saveLeaderboardWin();clearActiveGame();setScreen("gameOver");}
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
                    <div style={{fontSize:8,color:"#8aaa8a",fontWeight:400,marginTop:2}}>{r.winner?"won":r.cobra?"cobra":"added"}</div>
                  </div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:900,textAlign:"right",color:ns>=80?"#f87171":ns>=50?"#fbbf24":r.winner?"#d4a843":"#c8d8c8",animation:"scorePop 0.5s cubic-bezier(.22,1,.36,1) both",animationDelay:(i*0.1)+"s"}}>{ns}</div>
                </div>
              );
            })}
          </div>
          <div style={{background:"rgba(0,0,0,0.25)",borderRadius:14,padding:"14px 16px",marginBottom:18,border:"1px solid rgba(255,255,255,0.05)"}}>
            <p style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#8aaa8a",letterSpacing:2,marginBottom:12,textAlign:"center"}}>STANDINGS — FIRST TO {scoreLimit} IS OUT</p>
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
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}} notifsEnabled={notifsEnabled} onToggleNotifs={notifToggle}/>
      </div>
    );
  }

  // ─── GAME OVER ──────────────────────────────────────
  if(screen==="gameOver"){
    if(!gameOverData)return(<div className="feltbg"><style>{GS}</style></div>);
    var iWonGame=gameOverData.winner===H;
    // Trigger confetti if local player won (once)
    if(iWonGame&&confetti.length===0){
      setTimeout(function(){audio.win();haptic.heavy();},300);
      var wConf=[];for(var wci=0;wci<50;wci++){wConf.push({id:wci,x:Math.random()*100,color:["#d4a843","#4ade80","#f87171","#60a5fa","#fff","#fbbf24","#c084fc"][Math.floor(Math.random()*7)],size:Math.random()*9+4,delay:Math.random()*1.0,dur:Math.random()*1.5+1.4});}
      setTimeout(function(){setConfetti(wConf);setTimeout(function(){setConfetti([]);},4000);},100);
    }
    var xpEarned=iWonGame?(isVIP?300:150):(isVIP?100:50);
    var coinsEarned=iWonGame?(isVIP?350:200):(isVIP?80:50);
    var winnerAvatar=gameOverData.winner===H?myAvatar:"🤖";
    var sortedPlayers=[...Array(nPlayers).keys()].sort(function(a,b){return gameOverData.scores[a]-gameOverData.scores[b];});
    var rankMedals=["🥇","🥈","🥉","4️⃣"];
    return(
      <div className="feltbg" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"0",position:"relative",overflowY:"auto",minHeight:"100%"}}>
        <style>{GS}</style>
        {confetti.map(function(c){return(<div key={c.id} style={{position:"fixed",left:c.x+"%",top:"-10px",width:c.size,height:c.size*1.4,borderRadius:2,background:c.color,zIndex:300,pointerEvents:"none",animation:"confettiFall "+c.dur+"s "+c.delay+"s ease-in forwards"}}/>);})}
        <MenuButton onClick={function(){audio.buttonClick();setShowSettings(function(v){return!v;});}} active={showSettings}/>

        {/* Hero banner */}
        <div style={{width:"100%",background:iWonGame?"linear-gradient(180deg,rgba(10,40,15,0.95),rgba(5,20,8,0.98))":"linear-gradient(180deg,rgba(20,10,5,0.95),rgba(10,5,3,0.98))",paddingTop:"calc(56px + env(safe-area-inset-top))",paddingBottom:28,textAlign:"center",borderBottom:"1px solid rgba(255,255,255,0.07)",position:"relative",overflow:"hidden"}}>
          {/* Background glow */}
          <div style={{position:"absolute",inset:0,background:iWonGame?"radial-gradient(ellipse at 50% 0%,rgba(74,222,128,0.15),transparent 70%)":"radial-gradient(ellipse at 50% 0%,rgba(212,168,67,0.12),transparent 70%)",pointerEvents:"none"}}/>
          {/* Winner avatar */}
          <div style={{fontSize:80,lineHeight:1,marginBottom:8,animation:"trophyBounce 1s ease-in-out 4",display:"inline-block",filter:iWonGame?"drop-shadow(0 0 20px rgba(74,222,128,0.6))":"drop-shadow(0 0 20px rgba(212,168,67,0.5))"}}>{iWonGame?myAvatar||"🏆":winnerAvatar}</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:iWonGame?34:26,fontWeight:900,letterSpacing:6,color:iWonGame?"#4ade80":"#d4a843",textShadow:iWonGame?"0 0 40px rgba(74,222,128,0.7)":"0 0 40px rgba(212,168,67,0.6)",margin:"0 0 6px"}}>{iWonGame?"VICTORY!":"GAME OVER"}</div>
          <div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",fontSize:18,color:"rgba(255,255,255,0.5)"}}>{iWonGame?"Flawless performance":""+names[gameOverData.winner]+" takes the crown"}</div>
          {/* XP + coins earned */}
          {iWonGame&&(
            <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:16}}>
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(96,165,250,0.12)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:20,padding:"6px 14px",animation:"statSlideIn 0.4s 0.5s both"}}>
                <span style={{fontSize:14}}>⭐</span>
                <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#93c5fd",fontWeight:700}}>+{xpEarned} XP</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(212,168,67,0.12)",border:"1px solid rgba(212,168,67,0.3)",borderRadius:20,padding:"6px 14px",animation:"statSlideIn 0.4s 0.7s both"}}>
                <span style={{fontSize:14}}>🪙</span>
                <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#f0c060",fontWeight:700}}>+{coinsEarned}</span>
              </div>
            </div>
          )}
          {iWonGame&&isVIP&&<div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#f0c060",letterSpacing:2,marginTop:4}}>👑 VIP: +150 bonus coins · 2x XP</div>}
          {/* ELO delta display */}
          {(function(){var tier=getEloTier(elo);return(<div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:20,padding:"6px 16px",marginTop:8,animation:"statSlideIn 0.4s 0.9s both"}}>
            <span style={{fontSize:14}}>{tier.icon}</span>
            <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:1}}>{tier.name}</span>
            <span style={{fontFamily:"Cinzel,serif",fontSize:13,fontWeight:700,color:iWonGame?"#4ade80":"#f87171",letterSpacing:1}}>{elo} ELO</span>
          </div>);})()}
        </div>

        <div style={{width:"100%",maxWidth:440,padding:"20px 16px calc(24px + env(safe-area-inset-bottom))",display:"flex",flexDirection:"column",gap:14}}>

          {/* Final standings */}
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:3,color:"rgba(212,168,67,0.6)",textAlign:"center",marginBottom:2}}>FINAL STANDINGS</div>
          <div style={{borderRadius:20,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)"}}>
            {sortedPlayers.map(function(i,rank){
              var isWinner=i===gameOverData.winner;
              var isLoser=i===gameOverData.loser;
              var isMe=i===H;
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderBottom:rank<nPlayers-1?"1px solid rgba(255,255,255,0.05)":"none",background:isWinner?"linear-gradient(135deg,rgba(212,168,67,0.1),rgba(212,168,67,0.05))":isLoser?"rgba(185,28,28,0.07)":"transparent",animation:"statSlideIn 0.35s "+(rank*0.08)+"s both"}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:22,width:32,textAlign:"center",animation:rank===0?"rankReveal 0.5s 0.3s both":"none"}}>{rankMedals[rank]||"·"}</div>
                  <div style={{width:36,height:36,borderRadius:"50%",background:isWinner?"linear-gradient(135deg,#d4a843,#a87020)":"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,border:isMe?"2px solid rgba(212,168,67,0.5)":"none"}}>{isMe?myAvatar||"🐍":"🤖"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:isWinner?"#f0c060":isLoser?"#f87171":"#e8f0e8",fontWeight:700,letterSpacing:0.5}}>{names[i]}{isMe?" (You)":""}</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(255,255,255,0.35)",letterSpacing:1,marginTop:2}}>{isWinner?"WINNER":isLoser?"ELIMINATED":"PLAYER"}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:26,fontWeight:900,color:isWinner?"#f0c060":isLoser?"#f87171":"#c8d8c8",lineHeight:1}}>{gameOverData.scores[i]}</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1}}>PTS</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Game stats */}
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:3,color:"rgba(212,168,67,0.6)",textAlign:"center",marginBottom:2}}>YOUR STATS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["🏆",gameStats.wins,"TOTAL WINS","#f0c060"],["🐍",gameStats.cobras,"COBRAS","#4ade80"],["🔥",gameStats.streak||0,"BEST STREAK","#f97316"],["🃏",gameStats.rounds,"ROUNDS PLAYED","#60a5fa"]].map(function(row,i){return(
              <div key={i} style={{borderRadius:14,padding:"14px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",textAlign:"center",animation:"statSlideIn 0.35s "+(0.3+i*0.07)+"s both"}}>
                <div style={{fontSize:22,marginBottom:4}}>{row[0]}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:900,color:row[3],lineHeight:1}}>{row[1]}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"rgba(255,255,255,0.4)",letterSpacing:1.5,marginTop:3}}>{row[2]}</div>
              </div>
            );})}
          </div>

          {/* Action buttons */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
            {!tournamentData&&(mode==="online"&&!isHost?(
              <div style={{padding:18,fontSize:12,letterSpacing:2,fontFamily:"Cinzel,serif",color:"rgba(255,255,255,0.4)",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8,border:"1px solid rgba(255,255,255,0.07)",borderRadius:14}}>
                <ThinkingDots/> Waiting for host to rematch...
              </div>
            ):(
              <button className="btn_btn_gold" style={{width:"100%",padding:18,fontSize:14,letterSpacing:2.5,borderRadius:14}}
                onClick={function(){
                  audio.init();audio.resume();audio.buttonClick();haptic.medium();audio.shuffle_sfx();
                  gameSummaryRef.current={declarations:{},cobraHits:{},roundScores:[],rounds:0};
                  setShowSummary(false);
                  setGameOverData(null);
                  if(mode==="cpu"){startCPU();}
                  else if(mode==="online"){startOnlineGame();}
                  else{deal(Array(nPlayers).fill(0),nPlayers);setScreen("game");}
                }}>
                🔄 REMATCH
              </button>
            ))}
            <button className="btn_btn_ghost" style={{width:"100%",padding:16,fontSize:12,letterSpacing:2}}
              onClick={function(){
                audio.buttonClick();
                // Tournament advancement
                if(tournamentData){
                  var td=tournamentData;
                  var humanName=names[0]||"You";
                  var humanWon=gameOverData&&gameOverData.winner===0;
                  if(td.phase==="semi1"){
                    var semi1Winner=humanWon?humanName:"CPU 1";
                    var semi2Winner=Math.random()<0.5?"CPU 2":"CPU 3";
                    var newBracket=[
                      Object.assign({},td.bracket[0],{winner:semi1Winner}),
                      Object.assign({},td.bracket[1],{winner:semi2Winner}),
                      Object.assign({},td.bracket[2],{p1:semi1Winner,p2:semi2Winner})
                    ];
                    var newTd=Object.assign({},td,{phase:"final",bracket:newBracket});
                    if(semi1Winner!==humanName){
                      // Human lost semi1 — simulate final and show result
                      var simFinal=Math.random()<0.5?semi1Winner:semi2Winner;
                      newBracket[2]=Object.assign({},newBracket[2],{winner:simFinal});
                      setTournamentData(Object.assign({},newTd,{bracket:newBracket,champion:simFinal,phase:"done"}));
                      setScores([]);setGameOverData(null);
                      setScreen("tournamentResult");
                      return;
                    }
                    // Human made final — play it
                    setTournamentData(newTd);
                    setMode("cpu");
                    var fNames=["You",semi2Winner,"CPU 2","CPU 3","CPU 4"];
                    setNames(fNames);setCpuCount(1);setCpuDiff(2);setMyIdx(0);
                    setRoundRes(null);setRoundEndData(null);setRevealData(null);setGameOverData(null);
                    deal(Array(2).fill(0),2);
                    goScreen("game");
                    return;
                  }
                  if(td.phase==="final"){
                    var finalWinner=humanWon?humanName:(td.bracket[2]?td.bracket[2].p2:"CPU 2");
                    var finalBracket=[td.bracket[0],td.bracket[1],Object.assign({},td.bracket[2],{winner:finalWinner})];
                    setTournamentData(Object.assign({},td,{bracket:finalBracket,champion:finalWinner,phase:"done"}));
                    setScores([]);setGameOverData(null);
                    setScreen("tournamentResult");
                    return;
                  }
                }
                setScores([]);goScreen("home");
              }}>
              🏠 {tournamentData?"CONTINUE TOURNAMENT":"BACK TO HOME"}
            </button>
            <button onClick={function(){setShowSummary(true);}} style={{width:"100%",padding:"12px",background:"rgba(212,168,67,0.08)",border:"1px solid rgba(212,168,67,0.2)",borderRadius:12,fontFamily:"Cinzel,serif",fontSize:11,color:"#d4a843",letterSpacing:3,cursor:"pointer",marginTop:4}}>
              📊 GAME SUMMARY
            </button>
          </div>
        </div>
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);goScreen("howto");}} notifsEnabled={notifsEnabled} onToggleNotifs={notifToggle}/>
      {showSummary&&<GameSummaryScreen
        data={Object.assign({},gameSummaryRef.current,{winner:gameOverData&&gameOverData.winner,scores:gameOverData&&gameOverData.scores,names:names.slice(0,nPlayers)})}
        names={names.slice(0,nPlayers)}
        onClose={function(){setShowSummary(false);}}
      />}
      </div>
    );
  }

  // ─── VIP SHOP ────────────────────────────────────────
  if(screen==="vip_shop"){
    var vipThemes=SHOP_THEMES.filter(function(t){return t.vipOnly;});
    var vipAvatarList=SHOP_AVATARS.filter(function(a){return a.vipOnly;});
    var vipTitleList=TITLES.filter(function(t){return t.vipOnly;});
    var vipUnlockedThemes=isVIP?SHOP_THEMES.filter(function(t){return t.vipOnly;}).map(function(t){return t.id;}):[];
    var vipUnlockedAvatars=isVIP?SHOP_AVATARS.filter(function(a){return a.vipOnly;}).map(function(a){return a.id;}):[];
    return(
      <div className="feltbg" style={{display:"flex",flexDirection:"column",height:"100%",maxHeight:"100vh",overflow:"hidden"}}>
        <style>{GS}</style>
        <div style={{flexShrink:0,padding:"calc(16px + env(safe-area-inset-top)) 18px 0"}}>
          <button className="btn_btn_ghost" style={{marginBottom:12,padding:"10px 16px",fontSize:11}} onClick={function(){audio.buttonClick();goScreen("shop");}}>← BACK</button>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:32,marginBottom:4}}>👑</div>
            <h2 style={{fontFamily:"Cinzel,serif",color:"#f0c060",fontSize:20,letterSpacing:4,margin:0}}>VIP EXCLUSIVE</h2>
            <p style={{fontFamily:"Crimson Text,serif",color:"#8a9a7a",fontSize:13,margin:"4px 0 0"}}>Premium items only for VIP members</p>
          </div>
          {!isVIP&&(
            <div style={{background:"linear-gradient(135deg,rgba(212,168,67,0.12),rgba(212,168,67,0.04))",border:"1.5px solid rgba(212,168,67,0.35)",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontFamily:"Crimson Text,serif",color:"#c0a850",fontSize:13}}>Unlock everything with VIP</div>
              <button onClick={function(){audio.buttonClick();goScreen("vip");}} style={{padding:"8px 16px",background:"linear-gradient(135deg,#d4a843,#f0c060)",border:"none",borderRadius:10,fontFamily:"Cinzel,serif",fontSize:10,fontWeight:900,color:"#010603",letterSpacing:1.5,cursor:"pointer",flexShrink:0}}>GET VIP 💎50</button>
            </div>
          )}
        </div>
        <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"8px 18px calc(32px + env(safe-area-inset-bottom))"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#8a7a3e",letterSpacing:3,marginBottom:10}}>CARD THEMES</div>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
            {vipThemes.map(function(theme){
              var owned=vipUnlockedThemes.includes(theme.id);
              var active=cardTheme===theme.id;
              var th=CARD_THEMES[theme.id]||CARD_THEMES.classic;
              return(
                <div key={theme.id} style={{position:"relative",borderRadius:16,overflow:"hidden",border:active?"2px solid #f0c060":owned?"1.5px solid rgba(212,168,67,0.4)":"1.5px solid rgba(212,168,67,0.15)",boxShadow:active?"0 0 22px rgba(212,168,67,0.35)":"0 4px 16px rgba(0,0,0,0.5)",cursor:isVIP?"pointer":"default"}}
                  onClick={function(){if(!isVIP)return;setCardTheme(active?"classic":theme.id);try{localStorage.setItem("cobra_card_theme",active?"classic":theme.id);}catch(e){}audio.buttonClick();}}>
                  {/* card fan preview */}
                  <div style={{height:110,background:th.bg,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                    {[0,1,2,3].map(function(ci){return(
                      <div key={ci} style={{transform:"rotate("+(ci*7-10.5)+"deg)",margin:"0 5px",flexShrink:0}}>
                        <Card card={{suit:"♠",value:"A"}} faceDown={true} size="xs" theme={theme.id}/>
                      </div>
                    );})}
                    {active&&<div style={{position:"absolute",top:8,right:10,background:"rgba(0,0,0,0.7)",borderRadius:6,padding:"3px 8px",fontFamily:"Cinzel,serif",fontSize:7,color:"#f0c060",letterSpacing:2}}>✓ ACTIVE</div>}
                    {!isVIP&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,pointerEvents:"none"}}><span style={{fontSize:22}}>👑</span><span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#d4a843",letterSpacing:2}}>VIP ONLY</span></div>}
                  </div>
                  <div style={{padding:"10px 14px",background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#f0c060",fontWeight:700}}>{theme.name}</div>
                      <div style={{fontFamily:"Crimson Text,serif",color:"#6a8a6e",fontSize:12,marginTop:1}}>{theme.desc}</div>
                    </div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:active?"#4ade80":isVIP?"#d4a843":"#555",letterSpacing:1,flexShrink:0,marginLeft:8}}>
                      {active?"TAP TO UNEQUIP":isVIP?"TAP TO EQUIP":"🔒 LOCKED"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#8a7a3e",letterSpacing:3,marginBottom:10}}>EXCLUSIVE AVATARS</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20}}>
            {vipAvatarList.map(function(av){
              var active=myAvatar===av.id;
              return(
                <div key={av.id} style={{position:"relative",width:56,height:56,borderRadius:14,background:active?"rgba(212,168,67,0.2)":"rgba(0,0,0,0.3)",border:active?"2px solid #f0c060":"1px solid rgba(212,168,67,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,cursor:isVIP?"pointer":"default",opacity:isVIP?1:0.5}}
                  onClick={function(){if(!isVIP)return;setMyAvatar(active?"😎":av.id);try{localStorage.setItem("cobra_player_avatar",active?"😎":av.id);}catch(e){}audio.buttonClick();}}>
                  {av.id}
                  {!isVIP&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",borderRadius:"inherit",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}><span style={{fontSize:13}}>👑</span></div>}
                  {active&&<div style={{position:"absolute",bottom:2,right:2,width:14,height:14,background:"#4ade80",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#000"}}>✓</div>}
                </div>
              );
            })}
          </div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#8a7a3e",letterSpacing:3,marginBottom:10}}>LEGENDARY TITLES</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {vipTitleList.map(function(title){
              var eq=equippedTitle===title.id;
              return(
                <div key={title.id} style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.3)",border:eq?"1.5px solid rgba(212,168,67,0.5)":"1px solid rgba(212,168,67,0.15)",borderRadius:12,padding:"14px 16px",cursor:isVIP?"pointer":"default",opacity:isVIP?1:0.6}}
                  onClick={function(){if(!isVIP)return;var next=eq?"":title.id;setEquippedTitle(next);try{localStorage.setItem("cobra_title",next);}catch(e){}audio.buttonClick();}}>
                  {!isVIP&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",borderRadius:"inherit",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}><span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#d4a843",letterSpacing:2}}>👑 VIP ONLY</span></div>}
                  <div>
                    <span style={{fontFamily:"Cinzel,serif",fontSize:13,background:title.color,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontWeight:900}}>{title.name}</span>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"#8a7a3e",letterSpacing:2,marginTop:2}}>LEGENDARY · FREE WITH VIP</div>
                  </div>
                  {eq&&<span style={{color:"#4ade80",fontSize:16}}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── FRIENDS ─────────────────────────────────────────
  if(screen==="friends"){
    return <FriendsScreen goScreen={goScreen} myName={myName} myAvatar={myAvatar} elo={elo} coins={coins} addCoins={addCoins} pop={pop}/>;
  }

  // ─── CLAN ────────────────────────────────────────────
  if(screen==="clan"){
    return <ClanScreen
      goScreen={goScreen}
      myName={myName}
      myAvatar={myAvatar}
      elo={elo}
      coins={coins}
      onSpendCoins={function(amount){
        setCoins(function(c){var n=c-amount;try{localStorage.setItem("cobra_coins",n);}catch(e){}return n;});
      }}
    />;
  }

  // ─── SEASON PASS ─────────────────────────────────────
  if(screen==="season"){
    return <SeasonPassScreen
      goScreen={goScreen}
      isVIP={isVIP}
      coins={coins}
      gems={gems}
      seasonXP={seasonXP}
      seasonTier={seasonTier}
      claimedTiers={seasonClaimed}
      onClaim={function(tier,reward,isVipReward){
        var key=tier+(isVipReward?"_vip":"");
        if(seasonClaimed.indexOf(key)>=0)return;
        var newClaimed=[...seasonClaimed,key];
        setSeasonClaimed(newClaimed);
        try{localStorage.setItem("cobra_season_claimed",JSON.stringify(newClaimed));}catch(e){}
        if(reward.type==="coins")addCoins(reward.amount);
        if(reward.type==="gems")addGems(reward.amount);
        if(reward.bonusCoins)addCoins(reward.bonusCoins);
        if(reward.type==="avatar"){
          var avId="av_"+reward.id;
          setOwnedItems(function(prev){if(prev.indexOf(avId)>=0)return prev;var n=[...prev,avId];try{localStorage.setItem("cobra_owned_items",JSON.stringify(n));}catch(e){}return n;});
        }
        if(reward.type==="theme"){
          setOwnedItems(function(prev){if(prev.indexOf(reward.id)>=0)return prev;var n=[...prev,reward.id];try{localStorage.setItem("cobra_owned_items",JSON.stringify(n));}catch(e){}return n;});
        }
        if(reward.type==="title"){
          setOwnedItems(function(prev){if(prev.indexOf("title_"+reward.id)>=0)return prev;var n=[...prev,"title_"+reward.id];try{localStorage.setItem("cobra_owned_items",JSON.stringify(n));}catch(e){}return n;});
        }
        pop("Reward claimed! "+reward.icon,"success");
        audio.purchase&&audio.purchase();
      }}
      onGetVIP={function(){setScreen("vip");}}
    />;
  }

  // ─── VIP ─────────────────────────────────────────────
  if(screen==="vip"){
    return <VIPScreen
      isVIP={isVIP}
      coins={coins}
      gems={gems}
      onBack={function(){setScreen("home");}}
      onBuy={function(price){
        if(gems<price){pop("Not enough gems","error");return;}
        setGems(function(g){var n=g-price;try{localStorage.setItem("cobra_gems",n);}catch(e){}return n;});
        setIsVIP(true);
        try{localStorage.setItem("cobra_vip","1");}catch(e){}
        audio.win&&audio.win();haptic.success();
        pop("Welcome to VIP! 👑","success");
        setTimeout(function(){setScreen("home");},1500);
      }}
    />;
  }

  // ─── SHOP ────────────────────────────────────────────
  if(screen==="shop"){
    return(
      <>
        <ShopScreen
          goScreen={goScreen}
          coins={coins}
          gems={gems}
          ownedItems={ownedItems}
          onBuy={buyItem}
          cardTheme={cardTheme}
          onEquipTheme={function(id){setCardTheme(id);try{localStorage.setItem("cobra_card_theme",id);}catch(e){}}}
          myAvatar={myAvatar}
          onEquipAvatar={function(id){setMyAvatar(id);try{localStorage.setItem("cobra_player_avatar",id);}catch(e){}}}
          sfxMuted={sfxMuted}
          musicMuted={musicMuted}
          sfxToggle={sfxToggle}
          musToggle={musToggle}
          gameStats={gameStats}
          isVIP={isVIP}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          addCoins={addCoins}
          addGems={addGems}
          pop={pop}
          dailyStreak={dailyStreak}
          myName={myName}
        />
        {crateReveal&&(
          <CrateOpenModal
            reveal={crateReveal}
            setReveal={setCrateReveal}
            onEquipTheme={function(id){setCardTheme(id);try{localStorage.setItem("cobra_card_theme",id);}catch(e){}}}
          />
        )}
      </>
    );
  }

  // ─── LEADERBOARD ────────────────────────────────────
  if(screen==="leaderboard"){
    return <LeaderboardScreen goScreen={goScreen} showSettings={showSettings} setShowSettings={setShowSettings} sfxMuted={sfxMuted} musicMuted={musicMuted} sfxToggle={sfxToggle} musToggle={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} elo={elo} myName={myName}/>;
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
    <div className="feltbg screen_in" style={{height:"100vh",maxHeight:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",userSelect:"none"}}>
      <style>{GS}</style>
      <TableParticles/>
      {showTutorial&&<Tutorial onDone={function(){setShowTutorial(false);setTutorialDone(true);try{localStorage.setItem("cobra_tutorial_done","1");}catch(e){}}}/>}
      {earnedAch&&<AchievementBadge ach={earnedAch} onDone={function(){setEarnedAch(null);}}/>}
      {titleUnlock&&<TitleUnlockModal title={titleUnlock} onClose={function(){setTitleUnlock(null);}} onGoCollection={function(){setTitleUnlock(null);goScreen("collection");}}/>}
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
        <div style={{position:"fixed",top:80,left:"50%",transform:"translateX(-50%)",zIndex:140,pointerEvents:"none",background:"rgba(10,20,10,0.92)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:20,padding:"10px 20px",boxShadow:"0 4px 20px rgba(0,0,0,0.5)",whiteSpace:"nowrap",animation:"toastIn 0.35s cubic-bezier(.22,1,.36,1) both"}}>
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
              style={{width:30,height:30,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:"#a0bba0",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>🏠</button>
            <button onClick={function(){setShowRules(true);haptic.light();}}
              style={{width:30,height:30,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:"#a0bba0",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>?</button>
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
              <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#7a9a7a",letterSpacing:1,padding:"2px 8px",background:"rgba(255,255,255,0.04)",borderRadius:8}}>R{roundNum}</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#16a34a",boxShadow:"0 0 6px #16a34a"}}/>
                <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"#5a7a60",letterSpacing:2}}>{deck.length}</span>
              </div>
            </div>
          </div>
        </div>
        <ScoreStrip names={names} scores={scores} currentPlayer={currentPlayer} nPlayers={nPlayers} flashScores={flashScores} avatars={Array.from({length:nPlayers},function(_,i){return i===H?myAvatar:null;})} scoreLimit={scoreLimit}/>
      </div>
      {/* Win streak indicator */}
      {(gameStats.streak||0)>=3&&(
        <div style={{position:"absolute",top:8,right:12,zIndex:10,display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:(gameStats.streak||0)>=10?"linear-gradient(135deg,rgba(212,168,67,0.25),rgba(212,168,67,0.1))":((gameStats.streak||0)>=5?"linear-gradient(135deg,rgba(192,192,192,0.2),rgba(192,192,192,0.08))":"linear-gradient(135deg,rgba(205,127,50,0.2),rgba(205,127,50,0.08))"),border:"1px solid "+((gameStats.streak||0)>=10?"rgba(212,168,67,0.5)":((gameStats.streak||0)>=5?"rgba(192,192,192,0.4)":"rgba(205,127,50,0.4)")),boxShadow:(gameStats.streak||0)>=10?"0 0 14px rgba(212,168,67,0.3)":((gameStats.streak||0)>=5?"0 0 10px rgba(192,192,192,0.2)":"none")}}>
          <span style={{fontSize:12}}>{(gameStats.streak||0)>=10?"💛":((gameStats.streak||0)>=5?"⚪":"🟤")}</span>
          <span style={{fontFamily:"Cinzel,serif",fontSize:9,fontWeight:700,color:(gameStats.streak||0)>=10?"#f0c060":((gameStats.streak||0)>=5?"#c0c0c0":"#cd7f32"),letterSpacing:1}}>{gameStats.streak} STREAK</span>
        </div>
      )}

      {/* OPPONENTS */}
      <div style={{flexShrink:0,padding:"4px 10px 4px",display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",position:"relative",zIndex:4}}>
        {Array(nPlayers-1).fill(0).map(function(_,i){
          var ci=i+1,ch=hands[ci]||[],active=ci===currentPlayer;
          return(
            <div key={ci} style={{padding:"4px 10px 6px",borderRadius:10,textAlign:"center",background:active?"linear-gradient(160deg,rgba(212,168,67,0.16),rgba(212,168,67,0.07))":"rgba(0,0,0,0.3)",border:active?"1.5px solid rgba(212,168,67,0.42)":"1px solid rgba(255,255,255,0.05)",boxShadow:active?"0 0 22px rgba(212,168,67,0.14)":"none",transition:"all 0.35s cubic-bezier(.22,1,.36,1)"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:7.5,letterSpacing:1.5,marginBottom:3,color:active?"#d4a843":"#8aaa8a",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
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
          <div className={canPickPile?"glow_pile":""} style={{flex:1,borderRadius:18,background:canPickPile?"linear-gradient(160deg,rgba(14,60,22,0.9),rgba(6,28,10,0.85))":pile.length>0?"linear-gradient(160deg,rgba(20,20,40,0.85),rgba(10,10,24,0.8))":"rgba(0,0,0,0.35)",border:canPickPile?"2px solid rgba(74,222,128,0.6)":pile.length>0?"1.5px solid rgba(212,168,67,0.3)":"1.5px solid rgba(255,255,255,0.1)",padding:"12px 14px",display:"flex",flexDirection:"column",boxShadow:canPickPile?"0 0 24px rgba(74,222,128,0.2)":pile.length>0?"0 0 30px rgba(74,222,128,0.3),0 0 60px rgba(74,222,128,0.1)":"none",animation:pile.length>0?"glowPulse 2.5s ease-in-out infinite":"none",transition:"all 0.35s cubic-bezier(.22,1,.36,1)"}}>
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
                :pile.map(function(c,i){var isTopCard=i===pile.length-1;return(
                  <div key={i} style={{animation:pickingUp?"cardPickup 0.35s cubic-bezier(.22,1,.36,1) both":isTopCard&&pileLandAnim?"cardLand 0.3s cubic-bezier(.22,1,.36,1) both":"none",animationDelay:(i*0.05)+"s",transform:canPickPile?"translateY(-4px)":"none",transition:"transform 0.3s cubic-bezier(.34,1.56,.64,1)"}}>
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
        <div style={{position:"fixed",top:"36%",left:"50%",transform:"translate(-50%,-50%)",background:toast.type==="error"?"linear-gradient(135deg,rgba(28,4,4,0.97),rgba(16,3,3,0.97))":toast.type==="success"?"linear-gradient(135deg,rgba(3,16,6,0.97),rgba(2,10,4,0.97))":"linear-gradient(135deg,rgba(12,9,2,0.97),rgba(9,7,2,0.97))",color:toast.type==="error"?"#fca5a5":toast.type==="success"?"#86efac":"#d4a843",padding:"13px 28px",borderRadius:14,fontSize:13,fontFamily:"Cinzel,serif",letterSpacing:2.5,border:"1px solid rgba(212,168,67,0.44)",boxShadow:"0 18px 55px rgba(0,0,0,0.88)",zIndex:500,textAlign:"center",maxWidth:"82vw",backdropFilter:"blur(20px)",animation:"toastIn 0.32s cubic-bezier(.22,1,.36,1) both"}}>{toast.msg}</div>
      )}

      {/* MY HAND or SPECTATOR */}
      {isSpectator?(
        <div style={{flexShrink:0,padding:"16px 12px calc(12px + env(safe-area-inset-bottom))",position:"relative",zIndex:5,background:"linear-gradient(0deg,rgba(0,0,0,0.92)0%,rgba(0,0,0,0.6)100%)",borderTop:"1px solid rgba(255,255,255,0.07)",backdropFilter:"blur(16px)",display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:18,color:"#d4a843",letterSpacing:4}}>👁 SPECTATING</div>
          <button className="btn_btn_ghost" style={{padding:"12px 28px",fontSize:12,letterSpacing:2}} onClick={function(){audio.buttonClick();goScreen("home");}}>LEAVE</button>
        </div>
      ):(
      <div style={{flexShrink:0,padding:"7px 12px calc(8px + env(safe-area-inset-bottom))",position:"relative",zIndex:5,background:"linear-gradient(0deg,rgba(0,0,0,0.92)0%,rgba(0,0,0,0.6)100%)",borderTop:isMyTurn?"1.5px solid rgba(212,168,67,0.5)":"1px solid rgba(255,255,255,0.07)",backdropFilter:"blur(16px)",animation:isMyTurn?"yourTurnGlow 2s ease-in-out infinite":"none"}}>
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
        <div id="tut-hand" style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:3,paddingTop:2,justifyContent:myHand.length<=6?"center":"flex-start",alignItems:"flex-end",minHeight:108,flexWrap:"wrap",maxWidth:"100%",animation:shakeHand?"shake 0.5s ease-in-out":"none"}}>
          {myHand.map(function(card,idx){
            var isPlaying=playingCardIds.includes(card.id);
            var total=myHand.length;
            var fanRot=(idx-(total-1)/2)*1.8;
            var fanY=Math.abs(idx-(total-1)/2)*2;
            var isSelected=!!sel.find(function(c){return c.id===card.id;});
            var fanTransform=isSelected||isPlaying?"rotate("+fanRot+"deg) translateY(-18px) scale(1.08)":"rotate("+fanRot+"deg) translateY("+fanY+"px)";
            return(
              <div key={card.id} style={{animation:isPlaying?"cardPlay 0.28s cubic-bezier(.4,0,.6,1) forwards":shuffleAnim?"cardShuffle 0.4s ease-in-out both":dealAnim?"cardDeal 0.42s cubic-bezier(.22,1,.36,1) both":"none",animationDelay:shuffleAnim?(idx*0.03)+"s":dealAnim?(0.15+idx*0.09)+"s":"0s",display:"inline-block",transform:isPlaying?"none":fanTransform,transition:isPlaying?"none":"transform 0.2s cubic-bezier(.34,1.56,.64,1)"}}>
                <Card card={card}
                  selected={isSelected}
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
              {chatMessages.length===0&&<div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#7a9a7a",fontSize:14,textAlign:"center",marginTop:20}}>No messages yet. Say hello!</div>}
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
      <SettingsPanel open={showSettings} onClose={function(){setShowSettings(false);}} sfxMuted={sfxMuted} musicMuted={musicMuted} onToggleSfx={sfxToggle} onToggleMusic={musToggle} gameStats={gameStats} cardTheme={cardTheme} setCardTheme={setCardTheme} onHowToPlay={function(){setShowSettings(false);setShowRules(true);}} notifsEnabled={notifsEnabled} onToggleNotifs={notifToggle}/>
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
      {dailyLoginData&&<DailyLoginModal data={dailyLoginData} onClose={function(){setDailyLoginData(null);}}/>}
      {/* Multiplayer Reconnection Modal */}
      {rejoinData&&(
        <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"linear-gradient(180deg,rgba(5,20,8,0.99),rgba(2,12,5,0.99))",border:"1.5px solid rgba(212,168,67,0.35)",borderRadius:22,padding:"28px 24px",maxWidth:360,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.8)",textAlign:"center"}}>
            <div style={{fontSize:42,marginBottom:10}}>🔗</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:16,letterSpacing:3,color:"#d4a843",marginBottom:6}}>REJOIN GAME?</div>
            <div style={{fontFamily:"Crimson Text,serif",fontStyle:"italic",color:"#6a9a6e",fontSize:14,marginBottom:4}}>Room: <b style={{color:"#d4a843"}}>{rejoinData.roomCode}</b></div>
            <div style={{fontFamily:"Crimson Text,serif",color:"#8aad8a",fontSize:13,marginBottom:20}}>{(rejoinData.names||[]).join(", ")}</div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn_btn_ghost" style={{flex:1,padding:14,fontSize:11,letterSpacing:2}} onClick={function(){
                clearActiveGame();setRejoinData(null);
              }}>ABANDON</button>
              <button className="btn_btn_gold" style={{flex:1,padding:14,fontSize:11,letterSpacing:2}} onClick={function(){
                var rd=rejoinData;
                setRejoinData(null);
                setRoomCode(rd.roomCode);
                setRoomInput(rd.roomCode);
                setMyIdx(rd.myIdx||0);
                if(rd.names)setNames(rd.names);
                if(rd.scores)setScores(rd.scores);
                setMode("online");
                rtSubscribe(rd.roomCode);
                loadRoom(rd.roomCode).then(function(room){if(room)onRoomUpdate(room);}).catch(function(){});
                setScreen("setupGlobal");
              }}>REJOIN</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
