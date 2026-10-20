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
