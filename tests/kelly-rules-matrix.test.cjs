const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../prop-rules.js');
const K=require('../kelly-rules-matrix.js');
const trade=(day,net,hour=12)=>({open:new Date(2026,8,day,hour-1),close:new Date(2026,8,day,hour),net,symbol:'XAUUSD',direction:'buy'});
/* p=.5 and b=2 give full Kelly 25%, a clean number for hand checks. */
const kelly={usable:true,p:.5,b:2,full:.25};
const loose={...R.get('ftmo2'),minDays:0};

test('a plan fails when a loss run crosses the daily floor, and the fraction scales the loss',()=>{
  const trades=[trade(1,-1),trade(1,-1),trade(1,-1)];
  /* ratio .1 -> 2.5% per loss. Two losses land exactly on the 5% floor (FTMO is exclusive), the third breaches. */
  const x=K.replayKelly(trades,100,kelly,{...loose,max:50},.1);
  assert.equal(x.code,'daily');assert.equal(x.trade,3);assert.equal(x.failed,true);
});
test('small fractions survive the same history',()=>{
  const trades=[trade(1,-1),trade(1,-1),trade(1,-1)];
  const x=K.replayKelly(trades,100,kelly,{...loose,max:50},.02);
  assert.equal(x.failed,false);assert.equal(x.code,'alive');
});
test('target first beats a later breach and the later breach is reported',()=>{
  const rules={...loose,target:10,daily:50,max:20};
  /* ratio .2 -> 5% risk, win = +10% reaches target on day 1; next day losses breach? use big loss */
  const trades=[trade(1,1),trade(2,-1),trade(3,-1),trade(4,-1),trade(5,-1),trade(6,-1),trade(7,-1),trade(8,-1),trade(9,-1),trade(10,-1),trade(11,-1),trade(12,-1)];
  const x=K.replayKelly(trades,100,kelly,rules,.2);
  assert.equal(x.code,'target');assert.equal(x.passed,true);assert.ok(x.laterBreach,'later breach expected');
});
test('Best Day rule keeps a single-day jump from passing FTMO 1-Step',()=>{
  const trades=[trade(1,1),trade(2,-1)];
  const x=K.replayKelly(trades,100,kelly,R.get('ftmo1'),.4);
  /* 10% risk => +20% on day one, only positive day, so best/positive = 100% > 50% */
  assert.notEqual(x.code,'target');
});
test('minimum trading days delay the pass on 2-Step',()=>{
  const trades=[trade(1,1),trade(2,1),trade(3,1),trade(4,1)];
  const x=K.replayKelly(trades,100,kelly,{...R.get('ftmo2'),target:10},.2);
  assert.equal(x.code,'target');assert.equal(x.trade,4);
});
test('per-idea risk cap marks WMT-style plans as failed',()=>{
  const trades=[trade(1,-1)];
  const x=K.replayKelly(trades,100,kelly,R.get('wmtNoPC'),.5);
  assert.equal(x.code,'idea');assert.equal(x.failed,true);
});
test('compound sizing risks a share of balance',()=>{
  const trades=[trade(1,1),trade(2,-1)];
  const fixed=K.replayKelly(trades,100,kelly,{...loose,max:90,daily:90},.2,{compound:false});
  const comp=K.replayKelly(trades,100,kelly,{...loose,max:90,daily:90},.2,{compound:true});
  assert.ok(Math.abs(fixed.ending-(100+10-5))<1e-9);
  assert.ok(Math.abs(comp.ending-(110*0.95))<1e-9);
});
test('scan is monotone in outcome: once a plan fails at a ratio, no bigger ratio is breach-free',()=>{
  const trades=[];for(let d=1;d<=20;d++){trades.push(trade(d,d%3?1:-1));trades.push(trade(d,d%2?-1:1,15));}
  const res=K.scan(trades,100,kelly,R.get('ftmo1'));
  assert.equal(res.length,K.SCAN_STEPS);
  const s=K.summarize(res);
  if(s.firstFail)assert.ok(res.filter(r=>r.ratio>s.cleanCeiling).every(r=>r.hadBreach));
});
test('prepare does not mutate the input order',()=>{
  const t=[trade(3,1),trade(1,-1)];const before=t.map(x=>x.net);
  K.prepare(t);assert.deepEqual(t.map(x=>x.net),before);
});
test('Monte Carlo cross-check returns percentages that add up',()=>{
  const trades=[trade(1,1),trade(2,-1),trade(3,1),trade(4,1)];
  const m=K.monteCarlo(trades,{p:.6,b:1.2,full:.3},R.get('ftmo2'),.25,{paths:100});
  assert.ok(Math.abs(m.pass+m.daily+m.max+m.unfinished-100)<1e-6);
});

/* ---------- 100,000-path Monte Carlo benchmark ---------- */
const hist=h=>[...h].reduce((a,b)=>a+b,0);
/* 30 days, two trades a day, 55% winners: enough history for tpd=2 and a stable seed. */
const history=()=>{const t=[];for(let d=1;d<=30;d++){t.push(trade(d,d%2?10:-8,10));t.push(trade(d,d%3?9:-8,15));}return t;};
const benchKelly={usable:true,p:.55,b:1.2,full:.2};
const mk=(i,pass,breach,o={})=>({id:o.id||'x',ratioIndex:i,ratio:K.RATIOS[i],riskPct:K.RATIOS[i]*20,paths:100000,tpd:2,pass,breach,daily:o.daily??breach,max:o.max??0,idea:o.idea??0,
  unfinished:100-pass-breach,ci:o.ci??.3,medPassDays:o.med??10,p90PassDays:20,medFailDays:5,attempts:pass>0?100/pass:null,
  end:{p10:92,p50:104,p90:110},dd:{p10:-8,p50:-3,p90:-1},days:pass>0?{p10:4,p50:10,p90:20}:{p10:null,p50:null,p90:null}});

test('benchmark chunks add up to one run: chunking never changes the result',()=>{
  const spec=K.benchSpec(history(),benchKelly,'ftmo2',3,{paths:1000});
  const whole=K.benchRun(spec);
  const parts=K.benchEmpty(spec);K.benchAdd(parts,K.benchChunk(spec,0,400));K.benchAdd(parts,K.benchChunk(spec,400,600));
  assert.equal(parts.paths,1000);
  for(const k of ['pass','daily','max','idea'])assert.equal(parts[k],whole[k]);
  assert.deepEqual([...parts.passHist],[...whole.passHist]);assert.deepEqual([...parts.failHist],[...whole.failHist]);
});
test('the benchmark and the 300-path preview agree on shared paths and add up to 100%',()=>{
  const trades=history(),spec=K.benchSpec(trades,benchKelly,'ftmo2',2,{paths:300});
  const b=K.benchFinish(spec,K.benchRun(spec)),m=K.monteCarlo(trades,benchKelly,R.get('ftmo2'),K.RATIOS[2],{paths:300});
  assert.ok(Math.abs(b.pass-m.pass)<1e-9);assert.ok(Math.abs(b.daily-m.daily)<1e-9);assert.ok(Math.abs(b.max+b.idea-m.max)<1e-9);
  assert.ok(Math.abs(b.pass+b.breach+b.unfinished-100)<1e-9);
  assert.equal(b.tpd,2);assert.equal(b.paths,300);
});
test('histograms hold every pass and every breach, and times are in active days',()=>{
  const spec=K.benchSpec(history(),benchKelly,'ftmo2',2,{paths:2000});
  const acc=K.benchRun(spec),r=K.benchFinish(spec,acc);
  assert.equal(hist(acc.passHist),acc.pass);assert.equal(hist(acc.failHist),acc.daily+acc.max+acc.idea);
  if(acc.pass)assert.ok(r.medPassDays>=spec.rules.minDays&&r.medPassDays<=90&&r.p90PassDays>=r.medPassDays);
  assert.ok(Math.abs(r.ci-1.96*Math.sqrt(r.pass/100*(1-r.pass/100)/2000)*100)<1e-9);
});
test('the per-trade risk cap shows up as its own failure column for WMT',()=>{
  const spec=K.benchSpec(history(),benchKelly,'wmtNoPC',5,{paths:500});/* 0.75 × 20% = 15% risk ≫ 1% cap */
  const r=K.benchFinish(spec,K.benchRun(spec));
  assert.equal(r.idea,100);assert.equal(r.pass,0);assert.equal(K.benchTone(r),'idea');
});
test('analysis finds the pass-odds peak, the plateau and where breach overtakes target',()=>{
  const pass=[40,62,81,80.8,70,30,5,0],breach=[0,2,10,13,25,60,95,100];
  const cells={a:pass.map((p,i)=>mk(i,p,breach[i],{id:'a'}))};
  const an=K.analyzeBenchmark(cells,['a']),P=an.plans.a;
  assert.equal(P.peak.ratioIndex,2);
  assert.deepEqual(P.plateau.map(r=>r.ratioIndex),[2,3]);/* 80.8 is within noise of 81 */
  assert.equal(P.safest.ratioIndex,2);
  assert.equal(P.overtaken.ratioIndex,5);/* first ratio where breach ≥ pass */
  assert.equal(P.full.ratioIndex,6);assert.equal(an.complete,true);
  const text=K.benchInsights(an,['a'],'a').map(x=>x.html).join(' ');
  assert.match(text,/Best pass odds/);assert.match(text,/Breach overtakes target from 3\/4 Kelly/);assert.match(text,/Full Kelly/);assert.match(text,/Precision/);
});
test('analysis reports a plan that never passes and a half-finished plan is not analysed yet',()=>{
  const dead={d:K.RATIOS.map((_,i)=>mk(i,0,i>3?100:0,{id:'d'}))};
  const an=K.analyzeBenchmark(dead,['d']);
  assert.equal(an.plans.d.noPass,true);
  assert.match(K.benchInsights(an,['d'],'d')[0].html,/never reaches its target/);
  const partial=new Array(K.RATIOS.length).fill(null);partial[7]=mk(7,10,50);/* only the last ratio is in: sparse arrays must not look complete */
  const half=K.analyzeBenchmark({p:partial},['p']);
  assert.equal(half.plans.p,undefined);assert.equal(half.complete,false);
  assert.deepEqual(K.benchInsights(half,['p'],'p'),[]);
});
test('one ratio that is best for every plan is reported with the limiting plan',()=>{
  const a=[10,30,60,50,20,5,0,0],b=[20,40,50,60,30,5,0,0];
  const cells={a:a.map((p,i)=>mk(i,p,5,{id:'a'})),b:b.map((p,i)=>mk(i,p,5,{id:'b'}))};
  const an=K.analyzeBenchmark(cells,['a','b']);
  assert.equal(an.common.index,2);assert.equal(an.common.min,50);assert.equal(an.common.limiting,'b');
});
test('replay and benchmark cells put the colour class on the td itself so it fills the whole cell',()=>{
  const fail=K.replayKelly([trade(1,-1),trade(1,-1),trade(1,-1)],100,kelly,{...loose,max:50},.1);
  const pass=K.replayKelly([trade(1,1),trade(2,1),trade(3,1),trade(4,1)],100,kelly,{...R.get('ftmo2'),target:10},.2);
  assert.match(K.cellHtml(fail,null),/^<td class="kr-cell kr-fail">/);
  assert.match(K.cellHtml(pass,{label:'100k paths',pass:60,breach:20,digits:1}),/^<td class="kr-cell kr-pass">/);
  assert.match(K.cellHtml(pass,{label:'100k paths',pass:60,breach:20,digits:1}),/forward \(100k paths\): 60\.0% target · 20\.0% breach/);
  for(const html of [K.cellHtml(fail,null),K.cellHtml(pass,null),K.benchCellHtml(mk(2,80,10)),K.benchCellHtml(mk(2,10,80)),K.benchCellHtml(null)]){
    assert.equal(html.startsWith('<td class="kr-cell '),true);
    assert.equal((html.match(/class="kr-cell /g)||[]).length,1);/* no nested coloured div any more */
    assert.equal(html.endsWith('</div></td>'),true);
  }
  assert.match(K.benchCellHtml(mk(2,80,10)),/kr-pass/);assert.match(K.benchCellHtml(mk(2,10,80)),/kr-fail/);assert.match(K.benchCellHtml(mk(2,10,10)),/kr-live/);
});
test('the benchmark table lists every Kelly ratio and plan',()=>{
  const cells={a:K.RATIOS.map((_,i)=>mk(i,50,20,{id:'a'}))};
  const html=K.benchTableHtml({...cells,ftmo1:cells.a},['ftmo1'],false);
  K.RATIO_NAMES.forEach(n=>assert.ok(html.includes(n)));
  assert.equal((html.match(/<tr/g)||[]).length,K.RATIOS.length+1);
});
test('the real benchmark worker returns the same numbers as the main thread',async()=>{
  const {Worker}=require('node:worker_threads');const path=require('node:path');const base=path.join(__dirname,'..');
  const spec=K.benchSpec(history(),benchKelly,'ftmo2',2,{paths:3000});
  const worker=new Worker(`
    const {parentPort}=require('node:worker_threads');
    const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
    global.self={postMessage:data=>parentPort.postMessage(data)};
    global.importScripts=(...files)=>files.forEach(file=>vm.runInThisContext(fs.readFileSync(path.join(${JSON.stringify(base)},file),'utf8')));
    vm.runInThisContext(fs.readFileSync(path.join(${JSON.stringify(base)},'kelly-benchmark-worker.js'),'utf8'));
    parentPort.on('message',data=>self.onmessage({data}));
  `,{eval:true});
  try{
    const out=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage(spec);});
    assert.equal(out.error,undefined);assert.equal(out.ratioIndex,2);
    assert.deepEqual(out.result,K.benchFinish(spec,K.benchRun(spec)));
  }finally{await worker.terminate();}
});
test('insights say so when the peak sits on the smallest ratio and when the per-trade cap blocks a plan outright',()=>{
  const edge=K.RATIOS.map((_,i)=>mk(i,[60,40,20,10,5,2,1,0][i],[40,60,80,90,95,98,99,100][i],{id:'ftmo1'}));
  const an=K.analyzeBenchmark({ftmo1:edge},['ftmo1']),text=K.benchInsights(an,['ftmo1'],'ftmo1').map(x=>x.html).join(' ');
  assert.match(text,/smallest ratio tested, so an even smaller fraction may do better/);
  assert.match(text,/Breach overtakes target from 1\/8 Kelly/);
  const capped=K.RATIOS.map((_,i)=>mk(i,0,100,{id:'wmtNoPC',idea:100,daily:0}));
  const wmt=K.analyzeBenchmark({wmtNoPC:capped},['wmtNoPC']),w=K.benchInsights(wmt,['wmtNoPC'],'wmtNoPC')[0];
  assert.equal(w.cls,'risk');assert.match(w.html,/per-trade risk cap \(1% of the deposit\) is exceeded on the first trade/);
  const first=K.RATIOS.map((_,i)=>mk(i,0,100,{id:'ftmo1'}));
  assert.match(K.benchInsights(K.analyzeBenchmark({ftmo1:first},['ftmo1']),['ftmo1'],'ftmo1').map(x=>x.html).join(' '),/closest is 1\/16 Kelly/);
});

test('the lean run also bins final equity and drawdown, and chunking keeps them identical',()=>{
  const spec=K.benchSpec(history(),benchKelly,'ftmo2',3,{paths:1000});
  const whole=K.benchRun(spec),parts=K.benchEmpty(spec);
  K.benchAdd(parts,K.benchChunk(spec,0,250));K.benchAdd(parts,K.benchChunk(spec,250,750));
  assert.equal(hist(whole.endHist),1000);assert.equal(hist(whole.ddHist),1000);
  assert.deepEqual([...parts.endHist],[...whole.endHist]);assert.deepEqual([...parts.ddHist],[...whole.ddHist]);
});
test('spread percentiles are ordered and match the full engine within one bin',()=>{
  const trades=history(),spec=K.benchSpec(trades,benchKelly,'ftmo2',2,{paths:4000});
  const r=K.benchFinish(spec,K.benchRun(spec));
  assert.ok(r.end.p10<=r.end.p50&&r.end.p50<=r.end.p90);
  assert.ok(r.dd.p10<=r.dd.p50&&r.dd.p50<=r.dd.p90&&r.dd.p90<=0);
  if(r.days.p50!==null)assert.ok(r.days.p10<=r.days.p50&&r.days.p50<=r.days.p90);
  const full=R.simulate({rules:spec.rules,payoff:spec.b,winRate:spec.p,risk:spec.full*spec.ratio*100,paths:4000,horizon:90*spec.tpd,tradesPerDay:spec.tpd,seed:spec.seed,compound:false});
  const sorted=[...full.ends].sort((a,b)=>a-b),ddSorted=[...full.dds].sort((a,b)=>a-b),q=(a,p)=>a[Math.min(a.length-1,Math.ceil(a.length*p)-1)];
  const bin=R.LEAN_BINS.step;
  assert.ok(Math.abs(r.end.p50-q(sorted,.5))<=bin,'median ending equity');assert.ok(Math.abs(r.end.p10-q(sorted,.1))<=bin,'P10 ending equity');assert.ok(Math.abs(r.end.p90-q(sorted,.9))<=bin,'P90 ending equity');
  assert.ok(Math.abs(r.dd.p50-q(ddSorted,.5))<=bin,'median drawdown');assert.ok(Math.abs(r.dd.p10-q(ddSorted,.1))<=bin,'worst-10% drawdown');
});
test('benchmark cells and insights show the spread when it is available',()=>{
  assert.match(K.benchCellHtml(mk(2,80,10)),/ending equity P10 92\.0 · P50 104\.0 · P90 110\.0/);
  assert.match(K.benchCellHtml(mk(2,80,10)),/max drawdown typical -3\.0% · bad case -8\.0%/);
  const an=K.analyzeBenchmark({a:[40,62,81,70,60,30,5,0].map((p,i)=>mk(i,p,10,{id:'a'}))},['a']);
  assert.match(K.benchInsights(an,['a'],'a').map(i=>i.html).join(' '),/Spread at 1\/4 Kelly:.*bottom 10% of paths end the run at or below 92\.0.*4 \/ 10 \/ 20 active days/);
});
