const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../prop-rules.js');
const trade=(day,net,extra={})=>({open:new Date(2026,8,day,9),close:new Date(2026,8,day,12),net,symbol:'XAUUSD',direction:'buy',...extra});
test('WMT daily floor includes profitable overnight equity, FTMO balance only',()=>{
 assert.equal(R.dailyFloor(R.get('wmtNoPC'),100000,105000,107000),105000);
 assert.equal(R.dailyFloor(R.get('ftmo1'),100000,105000,107000),102000);
});
test('FTMO trailing floor differs from static floor after gains',()=>{
 assert.equal(R.maxFloor(R.get('ftmo1'),100000,110000),100000);
 assert.equal(R.maxFloor(R.get('ftmo2'),100000,110000),90000);
 assert.equal(R.maxFloor(R.get('wmtNoPC'),100000,110000),96000);
});
test('WMT boundary fails at floor; FTMO fails below it',()=>{
 assert.equal(R.hit(98000,98000,R.get('wmtNoPC')),true);
 assert.equal(R.hit(97000,97000,R.get('ftmo1')),false);
 assert.equal(R.hit(96999,97000,R.get('ftmo1')),true);
});
test('same recorded history can breach WMT but remain active under FTMO',()=>{
 const trades=[trade(1,-500),trade(2,-500),trade(3,-500),trade(4,-500),trade(5,-500),trade(6,-500),trade(7,-500),trade(8,-500)];
 assert.equal(R.replay(trades,100000,R.get('wmtNoPC')).first.reason,'Total loss');
 assert.equal(R.replay(trades,100000,R.get('ftmo2')).first,null);
});
test('target first remains distinct from later full-history breach',()=>{
 const p={...R.get('wmtNoPC'),ideaRisk:undefined};
 const x=R.replay([trade(1,6000),trade(2,-3000)],100000,p);
 assert.equal(x.first.kind,'target');assert.equal(x.first.day,'2026-09-01');
 assert.equal(x.firstBreach.kind,'breach');assert.equal(x.balance,103000);
});
test('best day eligibility uses only positive days for FTMO',()=>{
 const p=R.get('ftmo1');
 assert.equal(R.consistent(p,6000,12000,10000),true);
 assert.equal(R.consistent(p,6000,10000,8000),false);
 assert.equal(R.consistent(R.get('wmtNoPC'),6000,6000,6000),true);
});
test('WMT combines simultaneous same-symbol same-direction closes',()=>{
 const trades=[trade(1,-600),trade(1,-600)];
 assert.equal(R.replay(trades,100000,R.get('wmtNoPC')).first.reason,'Realized idea loss exceeds cap');
 const independent=[trade(1,-600),trade(1,-600,{direction:'sell'})];
 assert.equal(R.replay(independent,100000,R.get('wmtNoPC')).first,null);
});
test('rule simulation is deterministic and enforces WMT risk before a winning entry',()=>{
 const args={rules:R.get('wmtNoPC'),payoff:2,winRate:1,risk:1.5,paths:20,horizon:10};
 const x=R.simulate(args);assert.equal(x.idea,100);assert.equal(x.pass,0);
 assert.deepEqual(x,R.simulate(args));
 const compound=R.simulate({...args,risk:1});assert.equal(compound.idea,100);
 const fixed=R.simulate({...args,risk:1,compound:false});assert.equal(fixed.pass,100);
});
test('static and trailing simulations honor different floors on the same draws',()=>{
 const base={payoff:2,winRate:.55,risk:.5,paths:100,horizon:300,tradesPerDay:3};
 for(const p of Object.values(R.presets)){
 const x=R.simulate({...base,rules:p});assert.ok(Math.abs(x.pass+x.daily+x.max+x.idea+x.unfinished-100)<1e-9);
 assert.equal(x.curves.length,x.curveOutcomes.length);
 }
});
