(function(){
  const themes={
    fountain:{name:'Water Fountain',water:'#36d9ff',accent:'#ffd94a',bg:'#021018'},
    ocean:{name:'Ocean Wave',water:'#4aa9ff',accent:'#8fe8ff',bg:'#020a18'},
    lotus:{name:'Lotus Pond',water:'#63e6d6',accent:'#ff7bd8',bg:'#03110d'},
    rainbow:{name:'Rainbow Aquarium',water:'#b477ff',accent:'#ffdf6e',bg:'#090318'},
    sunflower:{name:'Sunflower Field',water:'#ffd24a',accent:'#ff8a2a',bg:'#100b02'},
    galaxy:{name:'Galaxy Space',water:'#9d8cff',accent:'#65eaff',bg:'#05020f'}
  };
  const flowers=[
    {name:'গোলাপ',color:'#ffd21a',text:'স্যার আসসালামু আলাইকুম, স্যার আপনি কেমন আছেন? আমি ভালো আছি আলহামদুলিল্লাহ। আমি এখন আপনাকে আজকের অপারেশন ম্যানেজমেন্ট সিস্টেমের এখন পর্যন্ত আপডেট দিতে এসেছি।'},
    {name:'জবা',color:'#ff355f',text:'স্যার, আজকের অপারেশনাল অগ্রগতি, গুরুত্বপূর্ণ কাজ, KPI এবং ব্যতিক্রমগুলোর সর্বশেষ আপডেট নিয়ে এসেছি।'},
    {name:'সূর্যমুখী',color:'#ffc928',text:'স্যার, আজকের পারফরম্যান্স, উপস্থিতি, ডকুমেন্ট এবং ব্যবস্থাপনা কার্যক্রমের আপডেট প্রস্তুত আছে।'},
    {name:'নীল গোলাপ',color:'#55dfff',text:'স্যার, সিস্টেমের লাইভ ডেটা প্রবাহ, ডকুমেন্ট প্রসেসিং এবং গুরুত্বপূর্ণ সতর্কতাগুলো পর্যবেক্ষণে আছে।'},
    {name:'পদ্ম',color:'#ff7bd8',text:'স্যার, বিভাগ, সেকশন ও দায়িত্বভিত্তিক অপারেশনাল স্ট্যাটাস এখন ড্যাশবোর্ডে সমন্বিতভাবে দেখা যাচ্ছে।'}
  ];
  function init(){
    if(window.RIZVI_LIVE_STOP) window.RIZVI_LIVE_STOP();
    const root=document.getElementById('liveDash'); if(!root) return;
    const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
    let W=0,H=0,dpr=1,raf=0,theme='fountain',paused=false,voice=false,flowerIndex=0,flowerStart=performance.now(),cycleMs=12*60*1000,lastSpeech=-1;
    const fish=[]; const bubbles=[]; const particles=[];
    const speech=root.querySelector('#liveSpeechText'), flowerName=root.querySelector('#liveFlowerName'), themeLabel=root.querySelector('#liveThemeLabel');
    const stats={tasks:2845,kpi:96.7,attendance:10256,documents:15368,audits:234,capa:156};
    function resize(){const r=root.getBoundingClientRect();W=Math.max(320,r.width);H=Math.max(500,r.height);dpr=Math.min(2,devicePixelRatio||1);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
    function rand(a,b){return a+Math.random()*(b-a)}
    function makeFish(){return {x:rand(-W,W),y:rand(H*.36,H*.88),s:rand(9,25),speed:rand(.35,1.35),h:rand(0,360),wig:rand(0,6.28),a:rand(.45,1),dir:1}}
    function seed(){fish.length=0;bubbles.length=0;particles.length=0;for(let i=0;i<170;i++)fish.push(makeFish());for(let i=0;i<100;i++)bubbles.push({x:rand(0,W),y:rand(H*.25,H),r:rand(1.5,6),v:rand(.25,.9),a:rand(.2,.75)});for(let i=0;i<90;i++)particles.push({x:rand(0,W),y:rand(H*.2,H),r:rand(.5,2),a:rand(.2,.8)})}
    function hexToRgb(hex){const n=parseInt(hex.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255]}
    function rgba(hex,a){const [r,g,b]=hexToRgb(hex);return `rgba(${r},${g},${b},${a})`}
    function drawBackground(t){const th=themes[theme];ctx.fillStyle=th.bg;ctx.fillRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,rgba(th.water,.12));g.addColorStop(.3,rgba(th.water,.04));g.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(W*(.12+i*.17),H*(.16+.04*Math.sin(t/1500+i)),rand(30,80),0,Math.PI*2);ctx.fillStyle=rgba(th.accent,.025);ctx.fill()}}
    function drawFountain(t){const th=themes[theme],cx=W*.5;const top=H*.16,base=H*.54;ctx.save();ctx.globalCompositeOperation='lighter';
      for(let i=0;i<14;i++){const x=cx+Math.sin(t/600+i)*70, y=top+i*8;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(cx+rand(-40,40),y+70,cx+rand(-180,180),base);ctx.strokeStyle=rgba(th.water,.08);ctx.lineWidth=rand(2,7);ctx.stroke()}
      const tiers=[{y:base-55,w:170},{y:base-25,w:270},{y:base+10,w:390},{y:base+48,w:540}];tiers.forEach((q,i)=>{ctx.beginPath();ctx.ellipse(cx,q.y,q.w/2,18+i*3,0,0,Math.PI*2);ctx.fillStyle=rgba(th.water,.11);ctx.fill();ctx.strokeStyle=rgba(th.water,.32);ctx.stroke()});
      ctx.beginPath();ctx.ellipse(cx,base+55,Math.min(W*.46,520),38,0,0,Math.PI*2);ctx.fillStyle=rgba(th.water,.13);ctx.fill();ctx.strokeStyle=rgba(th.water,.28);ctx.stroke();ctx.restore();
    }
    function drawFish(f,t){const th=themes[theme];f.x+=f.speed;f.y+=Math.sin(t/500+f.wig)*.15;if(f.x>W+40)f.x=-50;const y=f.y+Math.sin(t/600+f.wig)*6;ctx.save();ctx.translate(f.x,y);ctx.scale(f.dir,1);ctx.globalAlpha=f.a;const grad=ctx.createRadialGradient(-f.s*.2,-f.s*.1,1,f.s*.2,0,f.s);grad.addColorStop(0,`hsla(${f.h},100%,92%,.95)`);grad.addColorStop(.35,`hsla(${f.h},95%,62%,.95)`);grad.addColorStop(1,`hsla(${(f.h+35)%360},90%,35%,.95)`);ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(0,0,f.s*1.25,f.s*.58,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-f.s*1.1,0);ctx.lineTo(-f.s*1.9,-f.s*.72);ctx.lineTo(-f.s*1.9,f.s*.72);ctx.closePath();ctx.fillStyle=`hsla(${f.h},95%,55%,.85)`;ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(f.s*.65,-f.s*.16,Math.max(1.5,f.s*.11),0,Math.PI*2);ctx.fill();ctx.fillStyle='#071018';ctx.beginPath();ctx.arc(f.s*.68,-f.s*.16,Math.max(1,f.s*.055),0,Math.PI*2);ctx.fill();ctx.restore();
      if(Math.random()<.008){bubbles.push({x:f.x+f.s,y:y-f.s*.5,r:rand(2,5),v:rand(.5,1.3),a:.55,carry:true})}
    }
    function drawBubbles(t){const th=themes[theme];for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];b.y-=b.v;if(b.y<H*.15){if(b.carry) updateBubbleCount();bubbles.splice(i,1);continue}ctx.beginPath();ctx.arc(b.x+Math.sin(t/800+i)*2,b.y,b.r,0,Math.PI*2);ctx.strokeStyle=rgba(th.water,b.a);ctx.lineWidth=1.2;ctx.stroke();if(b.carry){ctx.fillStyle=rgba(th.accent,.12);ctx.fill()}}}
    function updateBubbleCount(){const el=root.querySelector('#liveUpdates');if(el)el.textContent=(+el.textContent.replace(/,/g,'')+1).toLocaleString()}
    function drawFlower(t){const f=flowers[flowerIndex],phase=(t-flowerStart)/cycleMs;let p=phase;let scale=p<.72?p/.72:1-(p-.72)/.28;scale=Math.max(0,Math.min(1,scale));const cx=W*.5,cy=H*(.84-.34*scale);ctx.save();ctx.translate(cx,cy);ctx.globalAlpha=Math.sin(Math.PI*scale);ctx.shadowBlur=35;ctx.shadowColor=f.color;ctx.fillStyle=f.color;const petals=14,rr=45+95*scale;for(let i=0;i<petals;i++){ctx.save();ctx.rotate(i*Math.PI*2/petals);ctx.beginPath();ctx.ellipse(0,-rr*.48,22+24*scale,58+65*scale,0,0,Math.PI*2);ctx.fill();ctx.restore()}ctx.beginPath();ctx.arc(0,0,34+32*scale,0,Math.PI*2);ctx.fillStyle=theme==='galaxy'?'#f9b33d':f.color;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.8)';ctx.font=`${Math.max(10,12*scale)}px system-ui`;ctx.textAlign='center';ctx.fillText(f.name,0,5);ctx.restore();
      if(p>=1){flowerIndex=(flowerIndex+1)%flowers.length;flowerStart=t;}
    }
    function updateSpeech(t){const phase=(t-flowerStart)/cycleMs;const f=flowers[flowerIndex];if(phase<.12||phase>.82){speech.textContent=f.text;flowerName.textContent=f.name;themeLabel.textContent=themes[theme].name}if(phase>.12&&phase<.82&&lastSpeech!==flowerIndex){lastSpeech=flowerIndex;if(voice)speak(f.text)}}
    function speak(text){if(!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='bn-BD';u.rate=.86;u.pitch=1.12;const vs=speechSynthesis.getVoices();u.voice=vs.find(v=>/bn[-_](BD|IN)/i.test(v.lang))||vs.find(v=>/bengali|bangla/i.test(v.name))||null;speechSynthesis.speak(u)}
    function loop(t){if(!paused){drawBackground(t);drawFountain(t);particles.forEach(p=>{p.y-=.08;if(p.y<0)p.y=H;ctx.fillStyle=rgba(themes[theme].water,p.a);ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()});fish.forEach(f=>drawFish(f,t));drawBubbles(t);drawFlower(t);updateSpeech(t);}
      raf=requestAnimationFrame(loop)}
    function setTheme(x){theme=x;root.dataset.theme=x;root.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===x));themeLabel.textContent=themes[x].name}
    function setCycle(min){cycleMs=min*60*1000;root.querySelector('#cycleLabel').textContent=min+' min';flowerStart=performance.now();lastSpeech=-1}
    root.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
    root.querySelector('#voiceBtn').onclick=()=>{voice=!voice;root.querySelector('#voiceBtn').classList.toggle('active',voice);root.querySelector('#voiceState').textContent=voice?'বাংলা কণ্ঠ চালু':'কণ্ঠ বন্ধ';if(voice)speak(flowers[flowerIndex].text)};
    root.querySelector('#pauseBtn').onclick=()=>{paused=!paused;root.querySelector('#pauseBtn').textContent=paused?'▶ চালু':'⏸ বিরতি'};
    root.querySelectorAll('[data-cycle]').forEach(b=>b.onclick=()=>setCycle(+b.dataset.cycle));
    root.querySelector('#refreshDemo').onclick=()=>{flowerIndex=(flowerIndex+1)%flowers.length;flowerStart=performance.now();lastSpeech=-1;seed()};
    const ro=new ResizeObserver(resize);ro.observe(root);resize();seed();themeLabel.textContent=themes[theme].name;raf=requestAnimationFrame(loop);
    window.RIZVI_LIVE_STOP=()=>{cancelAnimationFrame(raf);ro.disconnect();if(window.speechSynthesis)window.speechSynthesis.cancel()};
  }
  window.initRizviLiveDashboard=init;
})();
