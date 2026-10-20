/* Kelly × prop-rule matrix.
   Replays the imported win/loss order at many fractions of full Kelly and checks every firm preset.
   Part 1 is a pure engine (Node-testable). Part 2 renders the card mounted at #kellyRulesMount. */
(function(root){
  'use strict';
  const R=root.PropRules||(typeof require==='function'?require('./prop-rules.js'):null);

  /* ---------- Part 1 · engine ---------- */
  const RATIOS=[1/16,1/8,1/4,1/3,1/2,3/4,1,1.5];
  const RATIO_NAMES=['1/16 Kelly','1/8 Kelly','1/4 Kelly','1/3 Kelly','Half Kelly','3/4 Kelly','Full Kelly','1.5× Kelly'];
  const SCAN_LO=.01,SCAN_MAX=3,SCAN_STEPS=300,SCAN_GROWTH=Math.pow(SCAN_MAX/SCAN_LO,1/(SCAN_STEPS-1));
  const ratioAt=k=>SCAN_LO*Math.pow(SCAN_GROWTH,k);
  const FAIL=new Set(['daily','max','both','idea']);
  const LABEL={target:'Target reached',daily:'Daily loss breach',max:'Max loss breach',both:'Daily + max loss breach',idea:'Per-trade risk cap exceeded',pending:'Target pending other rules',alive:'Alive · no outcome yet'};
  const EVENT_CODE={'Daily loss':'daily','Max loss':'max','Daily + max loss':'both'};

  /* Sort once and reduce each trade to what the replay needs: close day, open day and outcome sign. */
  function prepare(trades){
    return [...trades].sort((a,b)=>a.close-b.close).map(t=>({day:R.key(t.close),open:R.key(t.open||t.close),dir:t.net>0?1:t.net<0?-1:0}));
  }

  /* One replay. A winner earns risk × observed payoff (kelly.b); a loser costs risk; risk = Kelly fraction × ratio.
     Rule order mirrors the app's own Kelly replay: day roll-over target check, per-idea cap, P/L, floor checks,
     then an intraday target check for plans without a Best Day rule. The first modeled outcome decides the verdict;
     the run continues so a later breach after an earlier target can still be reported. */
  function replayKelly(trades,initial,kelly,rules,ratio,opts={}){
    const seq=opts.prepared||prepare(trades),compound=!!opts.compound,f=Math.min(.99,Math.max(0,kelly.full*ratio));
    const dailyAllow=initial*rules.daily/100,maxAllow=initial*rules.max/100,target=initial*(1+rules.target/100)-1e-9;/* 100 × 1.1 = 110.00000000000001 would otherwise miss an exact 10% */
    const ideaCap=rules.ideaRisk?initial*rules.ideaRisk/100+1e-9:Infinity;
    let balance=initial,dayStart=initial,peakEod=initial,day=null,positive=0,best=0;
    let first=null,firstBreach=null,atFirst=null,peakDaily=0,peakMax=0,toDaily=0,toMax=0;
    const openDays=new Set(),path=opts.path?[100]:null;
    const eligible=()=>balance>=target&&openDays.size>=rules.minDays&&R.consistent(rules,best,positive,balance-initial);
    const mark=ev=>{if(!first){first=ev;atFirst=balance;}};
    const closeDay=()=>{const pnl=balance-dayStart;if(pnl>0){positive+=pnl;best=Math.max(best,pnl);}peakEod=Math.max(peakEod,balance);dayStart=balance;};
    seq.forEach((t,i)=>{
      if(day!==null&&day!==t.day){
        closeDay();
        if(!first&&eligible())mark({code:'target',reason:rules.outcome,trade:i,day});
      }
      day=t.day;openDays.add(t.open);
      const live=first===null,risk=f*(compound?balance:initial);
      if(risk>ideaCap){const ev={code:'idea',reason:'Per-trade risk cap',trade:i+1,day};mark(ev);if(!firstBreach)firstBreach=ev;}
      balance+=t.dir>0?risk*kelly.b:t.dir<0?-risk:0;
      const dFloor=R.dailyFloor(rules,initial,dayStart),mFloor=R.maxFloor(rules,initial,peakEod);
      const du=Math.max(0,(dayStart-balance)/dailyAllow*100),mu=Math.max(0,(mFloor+maxAllow-balance)/maxAllow*100);
      peakDaily=Math.max(peakDaily,du);peakMax=Math.max(peakMax,mu);
      if(live){toDaily=Math.max(toDaily,du);toMax=Math.max(toMax,mu);}
      const dHit=R.hit(balance,dFloor,rules),mHit=R.hit(balance,mFloor,rules);
      if(dHit||mHit){
        const reason=dHit&&mHit?'Daily + max loss':dHit?'Daily loss':'Max loss',ev={code:EVENT_CODE[reason],reason,trade:i+1,day};
        mark(ev);if(!firstBreach)firstBreach=ev;
      }else if(!first&&!rules.bestDay&&eligible())mark({code:'target',reason:rules.outcome,trade:i+1,day});
      if(path)path.push(balance/initial*100);
    });
    if(day!==null){closeDay();if(!first&&eligible())mark({code:'target',reason:rules.outcome,trade:seq.length,day});}
    const code=first?first.code:balance>=target?'pending':'alive';
    return {ratio,fraction:f,riskPct:f*100,code,label:LABEL[code],failed:FAIL.has(code),passed:code==='target',
      trade:first?first.trade:null,day:first?first.day:null,
      laterBreach:code==='target'&&firstBreach?{reason:firstBreach.reason,trade:firstBreach.trade,day:firstBreach.day}:null,
      hadBreach:!!firstBreach,peakDaily,peakMax,toDaily,toMax,ending:balance/initial*100,atFirst:atFirst===null?null:atFirst/initial*100,
      trades:seq.length,path};
  }

  /* Fine ratio scan on a log grid, 0.01× to 3× full Kelly, used for the strips, usage lines and flip points. */
  function scan(trades,initial,kelly,rules,opts={}){
    const prepared=opts.prepared||prepare(trades),out=[];
    for(let k=0;k<SCAN_STEPS;k++)out.push(replayKelly(trades,initial,kelly,rules,ratioAt(k),{...opts,prepared,path:false}));
    return out;
  }
  function summarize(results){
    const firstFail=results.find(r=>r.failed)||null;
    let clean=0;for(const r of results){if(r.hadBreach)break;clean=r.ratio;}
    return {firstFail,cleanCeiling:clean,cleanAll:clean>=results[results.length-1].ratio-1e-9};
  }

  /* Forward-looking cross-check: the app's own seeded Monte Carlo at the same Kelly-sized risk. */
  function monteCarlo(trades,kelly,rules,ratio,{compound=false,paths=300}={}){
    const days=Math.max(1,R.group(trades).length),tpd=Math.max(1,Math.round(trades.length/days));
    const seed=trades.reduce((s,t,i)=>(s+Math.round(t.net*100)*(i+1))|0,713);
    const x=R.simulate({rules,payoff:kelly.b,winRate:kelly.p,risk:Math.min(99,kelly.full*ratio*100),paths,horizon:90*tpd,tradesPerDay:tpd,seed,compound});
    return {pass:x.pass,daily:x.daily,max:x.max+x.idea,unfinished:x.unfinished,tpd,paths};
  }

  const api={RATIOS,RATIO_NAMES,SCAN_LO,SCAN_MAX,SCAN_STEPS,ratioAt,LABEL,FAIL,prepare,replayKelly,scan,summarize,monteCarlo};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.KellyRules=api;
  if(typeof document==='undefined')return;

  /* ---------- Part 2 · interface ---------- */
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=(v,d=1)=>Number.isFinite(v)?v.toFixed(d)+'%':'—';
  const times=r=>r.toFixed(2)+'× Kelly';
  const SHORT={ftmo1:'FTMO 1-Step',ftmo2:'FTMO 2S · Chall.',ftmo2v:'FTMO 2S · Verif.',wmtNoPC:'WMT NoPC–EU'};
  const short=id=>SHORT[id]||(R.presets[id]&&R.presets[id].name)||id;
  const PALETTE={ftmo1:'#57a8ff',ftmo2:'#b48cff',ftmo2v:'#2fd0c0',wmtNoPC:'#f06ba8'};
  const palette=(id,i)=>PALETTE[id]||['#57a8ff','#b48cff','#2fd0c0','#f06ba8','#ffb547'][i%5];
  const ORANGE='#e8772e';
  const EQ=[[1/8,'#57a8ff','1/8 Kelly'],[1/4,'#35d07f','1/4 Kelly'],[1/2,'#ffb547','Half Kelly'],[1,'#ff5c68','Full Kelly'],[1.5,'#c77dff','1.5× Kelly']];

  const CSS=`
.kr-controls{display:flex;gap:6px 22px;flex-wrap:wrap}
.kr-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:8px 0 14px}
.kr-chip{display:grid;gap:3px;align-content:start;padding:11px 12px;border:1px solid var(--border);border-left:4px solid var(--blue);border-radius:6px;background:var(--bg);min-width:0}
.kr-chip.kr-ok{border-left-color:var(--green)}.kr-chip.kr-bad{border-left-color:var(--red)}
.kr-chip b{font-size:12.5px;color:var(--text)}.kr-chip .kr-big{font-size:15px;font-weight:700;color:var(--text)}
.kr-chip small{font-size:11.7px;line-height:1.45;color:var(--text-dim)}
.kr-scroll{overflow-x:auto;margin-bottom:14px}
.kr-matrix{width:100%;min-width:780px;border-collapse:separate;border-spacing:0}
.kr-matrix th{padding:8px 9px;text-align:left;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border);white-space:nowrap}
.kr-matrix td{padding:0;border-bottom:1px solid var(--border-soft);vertical-align:top}
.kr-matrix td.kr-rowhead{padding:9px;white-space:nowrap;font-size:12.5px}
.kr-matrix td.kr-rowhead small{display:block;color:var(--text-faint);font-size:11.2px}
.kr-matrix tr.kr-full td.kr-rowhead{box-shadow:inset 3px 0 0 var(--amber)}
.kr-cell{display:grid;gap:2px;padding:8px 9px;height:100%;min-width:150px}
.kr-cell .kr-top{display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--text)}
.kr-cell small{display:block;font-size:11.2px;line-height:1.4;color:var(--text-dim)}
.kr-pass{background:var(--surface-2)}.kr-fail{background:var(--surface-2)}.kr-idea{background:var(--surface-2)}.kr-pend{background:var(--surface-2)}.kr-live{background:var(--surface-2)}
@supports(background:color-mix(in srgb,red 10%,white)){
.kr-pass{background:color-mix(in srgb,var(--green) 17%,var(--bg))}.kr-fail{background:color-mix(in srgb,var(--red) 17%,var(--bg))}
.kr-idea{background:color-mix(in srgb,#e8772e 19%,var(--bg))}.kr-pend{background:color-mix(in srgb,var(--amber) 17%,var(--bg))}.kr-live{background:color-mix(in srgb,var(--blue) 9%,var(--bg))}}
.kr-glyph{display:inline-grid;place-items:center;flex:none;width:18px;height:18px;border-radius:50%;font-size:11px;font-weight:700;color:#fff;background:var(--blue)}
.kr-pass .kr-glyph{background:var(--green)}.kr-fail .kr-glyph{background:var(--red)}.kr-idea .kr-glyph{background:#e8772e}.kr-pend .kr-glyph{background:var(--amber)}
.kr-wide{grid-column:1/-1}
.kr-barcode{height:212px;cursor:crosshair}
.kr-readout{min-height:20px;margin-top:8px;font-size:12px;color:var(--text-dim)}
.kr-key i{display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:2px;vertical-align:-1px}
.kr-key.line i{height:3px;vertical-align:3px;border-radius:0}
@media(max-width:800px){.kr-wide{grid-column:auto}}`;

  const SKELETON=`
<section class="quant-card" id="krCard">
  <div class="quant-chart-head"><div><h3>Kelly × prop rules · does it fail yet?</h3><span>Every Kelly ratio replayed against every firm preset</span></div></div>
  <p class="quant-copy">Takes the imported win/loss order and observed average payoff, sizes each trade at a share of full Kelly, then applies each plan’s daily-loss, total-loss (static or end-of-day trailing), minimum-day, Best Day and per-idea risk rules. A plan <b>fails</b> only if a breach is its <b>first</b> modeled outcome; if the target comes first it counts as reached, and any later breach is flagged.</p>
  <div class="kr-controls">
    <label class="kelly-replay-controls" for="krSizing">Risk amount based on <select id="krSizing"><option value="initial">Initial deposit (fixed risk)</option><option value="current">Balance before each trade (compound)</option></select></label>
    <label class="kelly-replay-controls" for="krFocus">Focus plan for the charts below <select id="krFocus"></select></label>
  </div>
  <div id="krEmpty" class="quant-insights" hidden></div>
  <div id="krBody">
    <div class="kr-chips" id="krChips"></div>
    <div id="krInsight" class="quant-insights"></div>
    <div class="kr-scroll" id="krMatrix"></div>
    <div class="quant-chart-grid">
      <section class="quant-chart-card kr-wide"><div class="quant-chart-head"><h3>Where each plan flips</h3><span>One strip per plan · 0.01× to 3× full Kelly, log scale · first modeled outcome</span></div>
        <canvas class="quant-chart kr-barcode" id="krBarcode" aria-label="Outcome strip for every plan across Kelly ratios"></canvas>
        <div class="quant-chart-legend" id="krBarcodeLegend"></div><div class="kr-readout" id="krReadout">Hover or tap a strip to read an exact ratio.</div>
        <p class="quant-chart-note">The ratio axis is logarithmic so small fractions stay readable. Each thin slice is one replay at that Kelly ratio. Green means the profit target was reached first, red a rule breach came first, orange the per-trade risk cap was exceeded, amber the balance target was met but another objective (minimum days / Best Day) was not, blue the whole history ended with no outcome.</p></section>
      <section class="quant-chart-card"><div class="quant-chart-head"><h3>Daily-loss limit used</h3><span>Worst point over the whole CSV · 100% = limit</span></div>
        <canvas class="quant-chart" id="krDaily"></canvas><div class="quant-chart-legend" id="krDailyLegend"></div>
        <p class="quant-chart-note">Each plan’s worst day-start-to-now drop as a share of its own daily allowance. Dots mark where a line first touches 100%. This view ignores earlier target hits, so it is stricter than the strips.</p></section>
      <section class="quant-chart-card"><div class="quant-chart-head"><h3>Total-loss limit used</h3><span>Worst point over the whole CSV · 100% = limit</span></div>
        <canvas class="quant-chart" id="krMax"></canvas><div class="quant-chart-legend" id="krMaxLegend"></div>
        <p class="quant-chart-note">Distance below the static or end-of-day trailing floor as a share of the allowance. A steeper line means that plan runs out of room at a lower Kelly ratio.</p></section>
      <section class="quant-chart-card"><div class="quant-chart-head"><h3>How fast it ends</h3><span id="krTimeSub">Focus plan · trade number of first outcome</span></div>
        <canvas class="quant-chart" id="krTime"></canvas><div class="quant-chart-legend" id="krTimeLegend"></div>
        <p class="quant-chart-note">Each dot is one Kelly ratio. Higher ratios usually end sooner, either by reaching the target or by breaching. Hollow dots sit on the last trade and never reached an outcome.</p></section>
      <section class="quant-chart-card"><div class="quant-chart-head"><h3>Equity against the rules</h3><span id="krEqSub">Focus plan · indexed to 100</span></div>
        <canvas class="quant-chart" id="krEquity"></canvas><div class="quant-chart-legend" id="krEquityLegend"></div>
        <p class="quant-chart-note" id="krEquityNote"></p></section>
      <section class="quant-chart-card kr-wide"><div class="quant-chart-head"><h3>Forward odds by Kelly ratio</h3><span id="krMcSub">Focus plan · seeded Monte Carlo</span></div>
        <canvas class="quant-chart" id="krMc"></canvas><div class="quant-chart-legend" id="krMcLegend"></div>
        <p class="quant-chart-note" id="krMcNote"></p></section>
    </div>
    <div class="quant-insights"><div class="quant-insight warn">Historical replay uses one observed win/loss order and a single average payoff, so it is a stress test rather than out-of-sample evidence. Kelly fractions here are uncapped, not approved trade sizes. Floating equity, overnight exposure and the firm’s true reset clock cannot be verified from a closed-trade CSV.</div></div>
  </div>
</section>`;

  const state={compound:false,focus:null,focusPinned:false};
  let last=null,cache=null,mcToken=0,barcodeLayout=null;

  function injectStyles(){
    if($('krStyles'))return;
    const el=document.createElement('style');el.id='krStyles';el.textContent=CSS;document.head.appendChild(el);
  }
  function mountSkeleton(mount){
    if(mount.dataset.ready)return;
    injectStyles();mount.innerHTML=SKELETON;mount.dataset.ready='1';
    $('krSizing').addEventListener('change',e=>{state.compound=e.target.value==='current';if(last)render(last.q,last.audit);});
    $('krFocus').addEventListener('change',e=>{state.focus=e.target.value;state.focusPinned=true;if(last)render(last.q,last.audit);});
    const cv=$('krBarcode');
    const probe=e=>{
      if(!cache||!barcodeLayout)return;
      const rect=cv.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,L=barcodeLayout;
      const row=Math.floor((y-L.T)/(L.rowH+L.gap)),ratio=ratioFromX((x-L.L)/L.pw);
      if(row<0||row>=cache.ids.length||x<L.L||x>L.L+L.pw){$('krReadout').textContent='Hover or tap a strip to read an exact ratio.';return;}
      const id=cache.ids[row],k=Math.min(SCAN_STEPS-1,Math.max(0,Math.round(Math.log(ratio/SCAN_LO)/Math.log(SCAN_GROWTH)))),r=cache.scans[id][k];
      $('krReadout').innerHTML='<strong>'+esc(R.presets[id].name)+'</strong> · '+times(r.ratio)+' (risk '+pct(r.riskPct,2)+' per loss) → <strong>'+esc(r.label)+'</strong>'+(r.trade?' · trade '+r.trade+' · '+esc(r.day):'')+(r.laterBreach?' · later breach: '+esc(r.laterBreach.reason)+' at trade '+r.laterBreach.trade:'');
    };
    cv.addEventListener('pointermove',probe);cv.addEventListener('pointerdown',probe);
  }

  function compute(q,audit){
    const trades=q.trades,initial=audit.initial,kelly=q.kelly,compound=state.compound;
    if(cache&&cache.trades===trades&&cache.initial===initial&&cache.compound===compound&&cache.full===kelly.full&&cache.b===kelly.b)return cache;
    const prepared=prepare(trades),ids=Object.keys(R.presets),scans={},sums={},matrix={},opts={compound,prepared};
    ids.forEach(id=>{
      const rules=R.presets[id];
      scans[id]=scan(trades,initial,kelly,rules,opts);sums[id]=summarize(scans[id]);
      matrix[id]=RATIOS.map(r=>replayKelly(trades,initial,kelly,rules,r,opts));
    });
    cache={trades,initial,compound,full:kelly.full,b:kelly.b,kelly,prepared,ids,scans,sums,matrix,mc:null};
    const mine=cache,token=++mcToken;
    setTimeout(()=>{
      if(token!==mcToken||cache!==mine)return;
      const mc={};ids.forEach(id=>{mc[id]=RATIOS.map(r=>monteCarlo(trades,kelly,R.presets[id],r,{compound}));});
      if(token!==mcToken||cache!==mine)return;
      mine.mc=mc;if(last)paint();
    },30);
    return cache;
  }

  /* ---- canvas helpers (read the panel's theme variables, like the other quant charts) ---- */
  function setup(canvas){
    const w=Math.floor(canvas.clientWidth),h=Math.floor(canvas.clientHeight),dpr=Math.min(2,window.devicePixelRatio||1);
    if(w<40||h<40)return null;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const css=getComputedStyle(canvas.closest('.tab-panel')||document.documentElement),v=n=>css.getPropertyValue(n).trim();
    return {ctx,w,h,c:{text:v('--text'),dim:v('--text-dim'),faint:v('--text-faint'),grid:v('--border'),blue:v('--blue'),green:v('--green'),amber:v('--amber'),red:v('--red'),bg:v('--bg')}};
  }
  function txt(ctx,s,x,y,color,align='left',size=11){ctx.fillStyle=color;ctx.font=size+"px 'JetBrains Mono',monospace";ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(s,x,y);}
  function frame(s,{x0,x1,y0,y1,xt,yt,xf,yf,l=52,r=14,t=14,b=34}){
    const {ctx,w,h,c}=s,pw=w-l-r,ph=h-t-b,X=v=>l+(v-x0)/(x1-x0||1)*pw,Y=v=>t+ph-(v-y0)/(y1-y0||1)*ph;
    ctx.strokeStyle=c.grid;ctx.lineWidth=1;
    yt.forEach(v=>{const y=Y(v);ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(w-r,y);ctx.stroke();txt(ctx,yf(v),l-7,y,c.faint,'right');});
    xt.forEach(v=>txt(ctx,xf(v),X(v),t+ph+16,c.faint,'center'));
    return {X,Y,l,r,t,b,pw,ph};
  }
  const niceTicks=top=>{const step=top<=150?50:100;return Array.from({length:Math.floor(top/step)+1},(_,i)=>i*step);};
  const RATIO_TICKS=[.01,.03,.1,.3,1,3],LOG_SPAN=Math.log(SCAN_MAX/SCAN_LO);
  const LX=v=>Math.log(Math.max(v,SCAN_LO)/SCAN_LO)/LOG_SPAN;/* ratio -> 0..1 on the log axis */
  const tickLabel=v=>String(+v.toPrecision(2))+'×';
  const ratioFromX=u=>SCAN_LO*Math.exp(u*LOG_SPAN);
  function codeColor(code,c){return code==='target'?c.green:code==='idea'?ORANGE:code==='pending'?c.amber:code==='alive'?c.blue:c.red;}
  const keySwatch=(color,label,line)=>'<span class="quant-chart-key kr-key'+(line?' line':'')+'"><i style="background:'+color+'"></i>'+label+'</span>';

  /* ---- 1 · outcome strips ---- */
  function drawBarcode(data){
    const cv=$('krBarcode'),L=124,Rm=14,T=26,rowH=30,gap=10,n=data.ids.length;
    cv.style.height=(T+n*(rowH+gap)+14)+'px';
    const s=setup(cv);if(!s)return;
    const {ctx,w,c}=s,pw=w-L-Rm,X=v=>L+LX(v)*pw;barcodeLayout={L,T,rowH,gap,pw};
    RATIO_TICKS.forEach(v=>{txt(ctx,tickLabel(v),X(v),T-13,c.faint,'center');});
    data.ids.forEach((id,row)=>{
      const y=T+row*(rowH+gap),res=data.scans[id],sum=data.sums[id];
      ctx.globalAlpha=.5;ctx.fillStyle=c.grid;ctx.fillRect(L,y,pw,rowH);ctx.globalAlpha=1;
      res.forEach(r=>{
        const half=Math.sqrt(SCAN_GROWTH),x0=Math.floor(Math.max(L,X(r.ratio/half))),x1=Math.ceil(Math.min(L+pw,X(r.ratio*half)));
        ctx.globalAlpha=r.code==='alive'?.38:.92;ctx.fillStyle=codeColor(r.code,c);ctx.fillRect(x0,y,Math.max(1,x1-x0),rowH);
      });
      ctx.globalAlpha=1;
      txt(ctx,short(id),L-9,y+rowH*.32,c.text,'right',11.5);
      const ff=sum.firstFail;
      txt(ctx,ff?'fails from '+ff.ratio.toFixed(2)+'×':'no fail ≤ '+SCAN_MAX+'×',L-9,y+rowH*.72,ff?c.red:c.green,'right',10.5);
    });
    ctx.save();ctx.strokeStyle=c.text;ctx.globalAlpha=.55;ctx.setLineDash([4,4]);ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(X(1),T-4);ctx.lineTo(X(1),T+n*(rowH+gap)-gap+4);ctx.stroke();ctx.restore();
    txt(ctx,'Full Kelly',X(1)+5,T+n*(rowH+gap)+4,c.dim,'left',10.5);
  }

  /* ---- 2/3 · limit usage lines ---- */
  function drawUsage(data,metric,canvasId){
    const s=setup($(canvasId));if(!s)return;
    const {ctx,c}=s;let top=120;
    data.ids.forEach(id=>data.scans[id].forEach(r=>{top=Math.max(top,Math.min(300,r[metric]));}));
    top=Math.min(300,Math.ceil(top/50)*50);
    const f=frame(s,{x0:0,x1:1,y0:0,y1:top,xt:RATIO_TICKS.map(LX),yt:niceTicks(top),xf:v=>tickLabel(ratioFromX(v)),yf:v=>v+'%'});
    ctx.save();ctx.beginPath();ctx.rect(f.l,f.t,f.pw,f.ph);ctx.clip();
    ctx.globalAlpha=.08;ctx.fillStyle=c.red;ctx.fillRect(f.l,f.Y(top),f.pw,f.Y(100)-f.Y(top));ctx.globalAlpha=1;
    data.ids.forEach((id,i)=>{
      ctx.strokeStyle=palette(id,i);ctx.lineWidth=2.1;ctx.beginPath();
      data.scans[id].forEach((r,k)=>{const x=f.X(LX(r.ratio)),y=f.Y(Math.min(top,r[metric]));k?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
    });
    ctx.restore();
    ctx.strokeStyle=c.red;ctx.lineWidth=1.4;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(f.l,f.Y(100));ctx.lineTo(f.l+f.pw,f.Y(100));ctx.stroke();ctx.setLineDash([]);
    txt(ctx,'limit',f.l+f.pw-4,f.Y(100)-9,c.red,'right',10.5);
    data.ids.forEach((id,i)=>{
      const hit=data.scans[id].find(r=>r[metric]>=100);if(!hit)return;
      ctx.beginPath();ctx.arc(f.X(LX(hit.ratio)),f.Y(100),4.6,0,Math.PI*2);ctx.fillStyle=palette(id,i);ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle=c.bg;ctx.stroke();
    });
    ctx.strokeStyle=c.dim;ctx.globalAlpha=.5;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(f.X(LX(1)),f.t);ctx.lineTo(f.X(LX(1)),f.t+f.ph);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    txt(ctx,'Full Kelly',f.X(LX(1))+4,f.t+8,c.dim,'left',10);
  }

  /* ---- 4 · time to outcome ---- */
  function drawTime(data,focus){
    const s=setup($('krTime'));if(!s)return;
    const {ctx,c}=s,res=data.scans[focus],n=res[0].trades;
    const f=frame(s,{x0:0,x1:1,y0:0,y1:n,xt:RATIO_TICKS.map(LX),yt:[0,.25,.5,.75,1].map(v=>Math.round(n*v)),xf:v=>tickLabel(ratioFromX(v)),yf:v=>String(v),l:50});
    ctx.strokeStyle=c.dim;ctx.globalAlpha=.55;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(f.l,f.Y(n));ctx.lineTo(f.l+f.pw,f.Y(n));ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    txt(ctx,'end of CSV · '+n+' trades',f.l+f.pw-4,f.Y(n)+11,c.faint,'right',10);
    res.forEach(r=>{
      const x=f.X(LX(r.ratio)),open=r.trade===null,y=f.Y(open?n:r.trade),col=codeColor(r.code,c);
      ctx.beginPath();ctx.arc(x,y,open?3:2.8,0,Math.PI*2);
      if(open){ctx.lineWidth=1.3;ctx.strokeStyle=col;ctx.stroke();}else{ctx.fillStyle=col;ctx.globalAlpha=.9;ctx.fill();ctx.globalAlpha=1;}
    });
    ctx.strokeStyle=c.dim;ctx.globalAlpha=.5;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(f.X(LX(1)),f.t);ctx.lineTo(f.X(LX(1)),f.t+f.ph);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  }

  /* ---- 5 · equity paths against target and floor ---- */
  function drawEquity(data,focus){
    const s=setup($('krEquity'));if(!s)return;
    const {ctx,c}=s,rules=R.presets[focus],kelly=data.kelly,n=data.prepared.length;
    const runs=EQ.map(([ratio,color,name])=>({color,name,run:replayKelly(data.trades,data.initial,kelly,rules,ratio,{compound:data.compound,prepared:data.prepared,path:true})}));
    const floor=100-rules.max,target=100+rules.target;
    let lo=floor,hi=target,end=8;
    runs.forEach(({run})=>{const stop=run.trade===null?n:Math.min(n,run.trade);end=Math.max(end,stop);for(let i=0;i<=stop;i++){const v=run.path[i];if(Number.isFinite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);}}});end=Math.min(n,Math.ceil(end*1.05));
    const pad=(hi-lo)*.06+1,y0=lo-pad,y1=hi+pad,span=y1-y0,step=span>40?10:span>16?5:2;
    const yt=[];for(let v=Math.ceil(y0/step)*step;v<=y1;v+=step)yt.push(v);
    const f=frame(s,{x0:0,x1:Math.max(1,end),y0,y1,xt:[0,.25,.5,.75,1].map(v=>Math.round(end*v)),yt,xf:v=>String(v),yf:v=>v.toFixed(0)});
    ctx.save();ctx.beginPath();ctx.rect(f.l,f.t,f.pw,f.ph);ctx.clip();
    ctx.globalAlpha=.07;ctx.fillStyle=c.red;ctx.fillRect(f.l,f.Y(floor),f.pw,f.Y(y0)-f.Y(floor));ctx.fillStyle=c.green;ctx.fillRect(f.l,f.Y(y1),f.pw,f.Y(target)-f.Y(y1));ctx.globalAlpha=1;
    runs.forEach(({color,run})=>{
      const stop=run.trade===null?n:Math.min(n,run.trade);
      [[0,stop,1,[]]].forEach(([a,b,alpha,dash])=>{
        if(b<=a)return;ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=alpha<1?1.3:2.2;ctx.setLineDash(dash);ctx.beginPath();
        for(let i=a;i<=b;i++){const x=f.X(i),y=f.Y(run.path[i]);i===a?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();
      });
      ctx.setLineDash([]);ctx.globalAlpha=1;
      if(run.trade!==null){ctx.beginPath();ctx.arc(f.X(stop),f.Y(run.path[stop]),4.2,0,Math.PI*2);ctx.fillStyle=run.failed?c.red:c.green;ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle=color;ctx.stroke();}
    });
    ctx.restore();
    ctx.lineWidth=1.4;ctx.setLineDash([6,4]);
    ctx.strokeStyle=c.green;ctx.beginPath();ctx.moveTo(f.l,f.Y(target));ctx.lineTo(f.l+f.pw,f.Y(target));ctx.stroke();
    ctx.strokeStyle=c.red;ctx.beginPath();ctx.moveTo(f.l,f.Y(floor));ctx.lineTo(f.l+f.pw,f.Y(floor));ctx.stroke();ctx.setLineDash([]);
    txt(ctx,'target '+target.toFixed(0),f.l+6,f.Y(target)+(f.Y(target)-f.t<14?10:-8),c.green,'left',10.5);
    txt(ctx,(rules.trailing?'starting floor ':'floor ')+floor.toFixed(0),f.l+6,f.Y(floor)+(f.t+f.ph-f.Y(floor)<14?-9:10),c.red,'left',10.5);
    $('krEquityLegend').innerHTML=EQ.map(([,color,name])=>keySwatch(color,name,true)).join('')+keySwatch(c.green,'stopped: target')+keySwatch(c.red,'stopped: breach');
    $('krEquityNote').textContent='Each line stops at the plan’s first modeled outcome and the x-axis is zoomed to the last of those stops (trades 0–'+end+' of '+n+'). '+(rules.trailing?'This plan’s real loss floor trails the highest end-of-day balance, so the dashed floor shows only its starting level. ':'')+'The daily-loss floor resets every day and is not drawn.';
  }

  /* ---- 6 · Monte Carlo stacked bars ---- */
  function drawMc(data,focus){
    const s=setup($('krMc'));if(!s)return;
    const {ctx,c}=s;
    if(!data.mc){txt(ctx,'Computing Monte Carlo odds…',s.w/2,s.h/2,c.faint,'center',13);return;}
    const rows=data.mc[focus],f=frame(s,{x0:0,x1:RATIOS.length,y0:0,y1:100,xt:[],yt:[0,25,50,75,100],xf:()=>'',yf:v=>v+'%'}),slot=f.pw/RATIOS.length,bw=Math.min(64,slot*.62);
    const layers=[['pass',c.green],['unfinished',c.blue],['max',ORANGE],['daily',c.red]];
    rows.forEach((m,i)=>{
      const cx=f.l+slot*(i+.5);let acc=0;
      layers.forEach(([key,color])=>{
        const v=m[key]||0;ctx.globalAlpha=key==='unfinished'?.35:.9;ctx.fillStyle=color;ctx.fillRect(cx-bw/2,f.Y(acc+v),bw,f.Y(acc)-f.Y(acc+v));ctx.globalAlpha=1;
        if(v>=9)txt(ctx,v.toFixed(0)+'%',cx,f.Y(acc+v/2),key==='unfinished'?c.text:'#fff','center',10.5);acc+=v;
      });
      txt(ctx,RATIO_NAMES[i].replace(' Kelly',''),cx,f.t+f.ph+16,c.faint,'center',10.5);
    });
    const m0=rows[0];
    $('krMcLegend').innerHTML=keySwatch(c.green,'Target first')+keySwatch(c.blue,'Unfinished in 90 active days')+keySwatch(ORANGE,'Max-loss / risk-cap failure')+keySwatch(c.red,'Daily-loss failure');
    $('krMcNote').textContent=m0.paths+' seeded paths per bar · '+m0.tpd+' trades per active day · 90 active days · observed win rate and average payoff · '+(data.compound?'compounding':'fixed')+' risk. Forward-looking counterpart to the one-sequence replay above; the same seed is reused for every ratio.';
  }

  /* ---- tables and summaries ---- */
  function renderChips(data){
    $('krChips').innerHTML=data.ids.map(id=>{
      const rules=R.presets[id],sum=data.sums[id],ff=sum.firstFail;
      const clean=sum.cleanCeiling<=0?'Some breach exists at every tested ratio':sum.cleanAll?'Breach-free through the whole CSV at every ratio up to '+SCAN_MAX+'×':'Breach-free through the whole CSV up to '+times(sum.cleanCeiling);
      return '<div class="kr-chip '+(ff?'kr-bad':'kr-ok')+'"><b>'+esc(rules.name)+'</b><span class="kr-big">'+(ff?'Fails from '+times(ff.ratio):'No failure up to '+SCAN_MAX+'× Kelly')+'</span><small>'+(ff?pct(ff.riskPct,2)+' risk per loss · '+esc(ff.label)+(ff.trade?' · trade '+ff.trade:''):rules.target+'% target · '+rules.daily+'% daily · '+rules.max+'% '+(rules.trailing?'trailing':'static')+' total')+'</small><small>'+clean+'</small></div>';
    }).join('');
    const flips=data.ids.map(id=>({id,ff:data.sums[id].firstFail})).filter(x=>x.ff).sort((a,b)=>a.ff.ratio-b.ff.ratio);
    const ok=RATIOS.filter((r,i)=>data.ids.every(id=>RATIOS.slice(0,i+1).every((_,j)=>!data.matrix[id][j].failed)));
    const top=ok.length?RATIO_NAMES[ok.length-1]:null;
    $('krInsight').innerHTML=(top?'<div class="quant-insight good"><strong>Tested ratios that fail no plan:</strong> '+(ok.length===RATIOS.length?'all tested ratios up to '+RATIO_NAMES[RATIOS.length-1]:'up to '+top)+'.</div>':'<div class="quant-insight risk"><strong>Every tested ratio fails at least one plan</strong>, even the smallest fraction in the table.</div>')
      +(flips.length?'<div class="quant-insight '+(flips[0].ff.ratio<1?'warn':'')+'"><strong>Tightest plan:</strong> '+esc(R.presets[flips[0].id].name)+' fails from '+times(flips[0].ff.ratio)+(flips.length>1?'; the most forgiving failing plan is '+esc(R.presets[flips[flips.length-1].id].name)+' from '+times(flips[flips.length-1].ff.ratio):'')+'.</div>':'<div class="quant-insight good"><strong>No plan fails</strong> anywhere up to '+SCAN_MAX+'× Kelly on this history.</div>');
  }
  function cellHtml(r,mc){
    const cls=r.code==='target'?'kr-pass':r.code==='idea'?'kr-idea':r.failed?'kr-fail':r.code==='pending'?'kr-pend':'kr-live';
    const glyph=r.passed?'✓':r.failed?'✕':r.code==='pending'?'◔':'●';
    const where=r.trade?'trade '+r.trade+' · '+esc(r.day):'through all '+r.trades+' trades';
    const later=r.laterBreach?'<small>later breach: '+esc(r.laterBreach.reason)+' · trade '+r.laterBreach.trade+'</small>':'';
    const mcLine=mc?'<small>forward: '+pct(mc.pass,0)+' target · '+pct(mc.daily+mc.max,0)+' breach</small>':'<small>forward odds computing…</small>';
    return '<td><div class="kr-cell '+cls+'"><div class="kr-top"><span class="kr-glyph" aria-hidden="true">'+glyph+'</span><b>'+esc(r.label)+'</b></div><small>'+where+'</small>'+later+'<small>limits used: daily '+pct(r.toDaily,0)+' · total '+pct(r.toMax,0)+'</small>'+mcLine+'</div></td>';
  }
  function renderMatrix(data){
    const head='<thead><tr><th>Kelly ratio</th>'+data.ids.map(id=>'<th>'+esc(R.presets[id].name)+'</th>').join('')+'</tr></thead>';
    const body=RATIOS.map((ratio,i)=>{
      const sample=data.matrix[data.ids[0]][i];
      return '<tr'+(ratio===1?' class="kr-full"':'')+'><td class="kr-rowhead"><b>'+RATIO_NAMES[i]+'</b><small>risk '+pct(sample.riskPct,2)+' per loss'+(data.compound?' of balance':'')+'</small></td>'+data.ids.map(id=>cellHtml(data.matrix[id][i],data.mc?data.mc[id][i]:null)).join('')+'</tr>';
    }).join('');
    $('krMatrix').innerHTML='<table class="quant-table kr-matrix">'+head+'<tbody>'+body+'</tbody></table>';
  }

  function paint(){
    if(!last||!cache)return;
    const data=cache,focus=state.focus,rules=R.presets[focus];
    data.trades=last.q.trades;data.initial=last.audit.initial;data.compound=state.compound;data.kelly=last.q.kelly;
    renderChips(data);renderMatrix(data);
    $('krBarcodeLegend').innerHTML=keySwatch('var(--green)','Target reached first')+keySwatch('var(--red)','Breach first')+keySwatch(ORANGE,'Per-trade risk cap')+keySwatch('var(--amber)','Target pending other rules')+keySwatch('var(--blue)','Alive, no outcome');
    $('krDailyLegend').innerHTML=data.ids.map((id,i)=>keySwatch(palette(id,i),short(id),true)).join('');
    $('krMaxLegend').innerHTML=$('krDailyLegend').innerHTML;
    $('krTimeLegend').innerHTML=keySwatch('var(--green)','Target')+keySwatch('var(--red)','Breach')+keySwatch(ORANGE,'Risk cap')+keySwatch('var(--amber)','Pending')+keySwatch('var(--blue)','No outcome');
    $('krTimeSub').textContent=rules.name+' · trade number of first outcome';
    $('krEqSub').textContent=rules.name+' · indexed to 100';
    $('krMcSub').textContent=rules.name+' · seeded Monte Carlo';
    drawBarcode(data);drawUsage(data,'peakDaily','krDaily');drawUsage(data,'peakMax','krMax');drawTime(data,focus);drawEquity(data,focus);drawMc(data,focus);
  }

  function render(q,audit){
    const mount=$('kellyRulesMount');if(!mount)return;
    if(!q||!q.trades||!q.trades.length||!audit){mount.hidden=true;return;}
    mountSkeleton(mount);mount.hidden=false;last={q,audit};
    const kelly=q.kelly,body=$('krBody'),empty=$('krEmpty');
    if(!kelly||!kelly.usable||!(kelly.full>0)){
      body.hidden=true;empty.hidden=false;
      empty.innerHTML='<div class="quant-insight warn"><strong>Replay unavailable.</strong> The history needs at least one winner, one loser and a positive empirical Kelly edge before Kelly ratios can be tested against the prop rules.</div>';
      return;
    }
    body.hidden=false;empty.hidden=true;
    const ids=Object.keys(R.presets),sel=$('krFocus');
    if(!state.focusPinned||!R.presets[state.focus])state.focus=R.presets[audit.presetKey]?audit.presetKey:ids[0];
    if(sel.options.length!==ids.length)sel.innerHTML=ids.map(id=>'<option value="'+esc(id)+'">'+esc(R.presets[id].name)+'</option>').join('');
    sel.value=state.focus;$('krSizing').value=state.compound?'current':'initial';
    compute(q,audit);paint();
  }
  root.renderKellyRulesMatrix=render;
})(typeof window!=='undefined'?window:globalThis);
