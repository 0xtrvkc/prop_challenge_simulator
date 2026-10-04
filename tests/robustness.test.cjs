const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../robustness.js');
const P=require('../prop-rules.js');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const trade=(day,net,hour=12)=>({open:new Date(2026,8,day,9),close:new Date(2026,8,day,hour),net,symbol:'XAUUSD',direction:'buy'});
test('metrics retain unlimited PF and distinguish no edge data',()=>{
  assert.equal(R.metrics([20,30],1000).pf,Infinity);
  assert.ok(Number.isNaN(R.metrics([0,0],1000).pf));
  assert.ok(Number.isNaN(R.metrics([],1000).expectancy));
  const m=R.metrics([100,-220,20],1000);
  assert.equal(m.net,-100);assert.equal(m.dd,20);assert.equal(m.pf,120/220);
  assert.equal(R.percentile([1,Infinity,Infinity],.975),Infinity);
  assert.equal(R.percentile([Infinity,Infinity],.5),Infinity);
});
test('moving block samples preserve day and trade order without end wrapping',()=>{
  const g=R.days([trade(3,30),trade(1,11,13),trade(2,20),trade(1,10,12),trade(4,40),trade(5,50),trade(6,60)]);
  assert.deepEqual(R.blockSample(g,3,()=>0),[10,11,20,30,10,11,20,30]);
  assert.deepEqual(R.blockSample(g,3,()=>.999),[40,50,60,40,50,60]);
});
test('block diagnostics are repeatable and withhold tiny samples',()=>{
  const trades=Array.from({length:18},(_,i)=>trade(i+1,i%3?-15:60));
  const a=R.bootstrap(trades,1000,{seed:9});
  assert.deepEqual(a,R.bootstrap(trades,1000,{seed:9}));assert.equal(a.block,3);assert.equal(a.reps,600);
  assert.ok(a.expectancy[0]<=a.expectancy[1]);assert.ok(a.dd95>=0);
  assert.equal(R.bootstrap(trades.slice(0,5),1000).available,false);
  assert.deepEqual(R.bootstrap([],1000),{available:false,days:0});
  const winners=R.bootstrap(Array.from({length:12},(_,i)=>trade(i+1,20)),1000);
  assert.deepEqual(winners.pf,[Infinity,Infinity]);assert.equal(winners.positiveShare,100);
});
test('chronological tests use only prior whole days and cover the later half once',()=>{
  const trades=Array.from({length:17},(_,i)=>trade(i+1,i<8?20:-10));
  trades.push(trade(10,100,15));
  const folds=R.chronological([...trades].reverse(),1000);
  assert.equal(folds.length,3);assert.equal(folds[0].priorDays,8);
  assert.equal(folds.reduce((s,f)=>s+f.testDays,0),9);
  assert.equal(folds.reduce((s,f)=>s+f.test.n,0),10);
  assert.equal(folds[0].prior.expectancy,20);
  assert.equal(folds[1].start,'2026-09-12');assert.equal(folds[2].end,'2026-09-17');
  assert.deepEqual(R.chronological(trades.slice(0,5),1000),[]);
});
test('extra costs preserve original records and can cause daily failure',()=>{
  const trades=[trade(1,-495)];
  const s=R.costs(trades,10000,.1,P.get('ftmo2'),P);
  assert.equal(s[0].audit.first,null);assert.equal(s[1].audit.first.reason,'Daily loss');
  assert.equal(s[1].net,-505);assert.equal(s[2].net,-515);assert.equal(trades[0].net,-495);
  assert.equal(R.costs(trades,10000,0,P.get('ftmo2'),P).length,1);
});
test('cost replay retains target first versus later breach across each preset',()=>{
  for(const rules of Object.values(P.presets)){
    const trades=Array.from({length:4},(_,i)=>trade(i+1,300));trades.push(trade(5,-1500));
    const s=R.costs(trades,10000,.01,rules,P)[0];
    assert.equal(s.audit.first.kind,'target');assert.equal(s.audit.firstBreach.kind,'breach');
  }
});
test('browser rendering refreshes cost input, rule changes and new imports',()=>{
  const nodes=new Map();
  for(const id of ['robustBootstrap','robustChronological','robustCosts','robustCostNote','robustSummary','robustExtraCost'])nodes.set(id,{innerHTML:'',textContent:'',value:'0.01',addEventListener(type,fn){this[type]=fn;}});
  const window={PropRules:P},context=vm.createContext({window,document:{getElementById:id=>nodes.get(id)},console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../robustness.js'),'utf8'),context);
  const q={trades:Array.from({length:24},(_,i)=>trade(i+1,i%3?-10:40))};
  window.renderRobustness(q,{initial:10000,presetKey:'ftmo1'});
  assert.match(nodes.get('robustBootstrap').innerHTML,/600 resamples/);
  assert.match(nodes.get('robustChronological').innerHTML,/2026-09-13/);
  const before=nodes.get('robustCosts').innerHTML;
  nodes.get('robustExtraCost').value='0.1';nodes.get('robustExtraCost').input();
  assert.notEqual(nodes.get('robustCosts').innerHTML,before);
  window.renderRobustness({trades:[trade(1,-495)]},{initial:10000,presetKey:'ftmo2'});
  assert.match(nodes.get('robustCosts').innerHTML,/Daily loss/);
  assert.match(nodes.get('robustBootstrap').innerHTML,/Need at least 6/);
  assert.match(nodes.get('robustChronological').innerHTML,/Need at least 12/);
  assert.equal(nodes.get('robustCostNote').textContent.includes('$'),false);
});
test('HTML contains each diagnostic target and loads valid local scripts',()=>{
  const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8');
  for(const id of ['robustBootstrap','robustChronological','robustCosts','robustCostNote','robustSummary','robustExtraCost'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  assert.match(html,/window\.renderRobustness\(q,currentAudit\)/);
  for(const script of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    const src=script[1].match(/src="([^"]+)"/);
    const code=src?fs.readFileSync(path.join(base,src[1]),'utf8'):script[2];
    assert.doesNotThrow(()=>new vm.Script(code));
  }
});
