const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const P=require('../prop-rules.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function harness(paths=250){
  const renders=[],button={disabled:false,textContent:'Run',style:{},setAttribute(k,v){this[k]=v;}},verdict={textContent:''};
  let seed=712,yields=0;
  const workers=[];
  class Worker {
    constructor(){this.terminated=false;workers.push(this);}
    terminate(){this.terminated=true;}
    postMessage(cfg){
      setImmediate(()=>{
        if(this.terminated)return;
        if(Worker.fail){this.onerror();return;}
        const self={postMessage:data=>this.onmessage({data})};
        vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../simulation-worker.js'),'utf8'),{self,PropRules:P,importScripts(){}});
        self.onmessage({data:cfg});
      });
    }
  }
  const c=vm.createContext({PropRules:P,Worker,location:{protocol:'https:'},performance,crypto:{getRandomValues(a){a[0]=++seed;return a;}},Uint32Array,Promise,
    setTimeout(fn){yields++;return setTimeout(fn,0);},clearTimeout,
    debounceTimer:null,MAX_SAMPLE_CURVES:40,RUN_LABEL:'Run',runBtn:button,verdictText:verdict,
    winRateEl:{value:'65'},rrMode:1,riskEl:{value:'1'},tpdEl:{value:'1'},horizonEl:{value:'30'},
    profitTargetEl:{value:'10'},maxLossEl:{value:'10'},dailyLossEl:{value:'3'},maxLossMode:'eodTrailing',
    minTradingDaysEl:{value:'0'},bestDayRuleEl:{checked:true},activePreset:'ftmo1',simRuns:paths,
    renderResults(res,cfg){renders.push({res,cfg});}
  });
  vm.runInContext(html.slice(html.indexOf('  let simulationGeneration = 0;'),html.indexOf('  // ---------- RENDER ----------')),c);
  return {c,renders,button,verdict,workers,Worker,get yields(){return yields;}};
}
test('repeated runs use background workers, fresh paths and no progress label',async()=>{
  const h=harness();
  const pending=h.c.runSimulation();assert.equal(h.button.disabled,true);assert.equal(h.button['aria-busy'],'true');assert.equal(h.button.textContent,'Run');
  await pending;assert.equal(h.button.disabled,false);assert.equal(h.button.textContent,'Run');
  await h.c.runSimulation();assert.equal(h.renders.length,2);assert.equal(h.yields,0);assert.equal(h.workers.length,2);assert.ok(h.workers.every(w=>w.terminated));
  assert.notDeepEqual(h.renders[0].res.curves,h.renders[1].res.curves);
  for(const {res} of h.renders)assert.ok(Math.abs(res.pass+res.failMax+res.failDaily+res.timeout-100)<1e-9);
  const expected=P.simulate({rules:P.get('ftmo1'),payoff:1,winRate:.65,risk:1,paths:250,horizon:30,tradesPerDay:1,seed:713,compound:false});
  assert.ok(Math.abs(h.renders[0].res.pass-expected.pass)<1e-9);
  assert.equal(h.renders[0].res.avgDays,expected.passTimes.reduce((a,b)=>a+b,0)/expected.passTimes.length);
});
test('a newer run cancels pending work and renders only its captured configuration',async()=>{
  const h=harness();const older=h.c.runSimulation();h.c.winRateEl.value='75';const newer=h.c.runSimulation();
  await older;assert.equal(h.button.disabled,true);await newer;
  assert.equal(h.renders.length,1);assert.equal(h.renders[0].cfg.p,.75);assert.equal(h.button.disabled,false);
});
test('engine errors restore the button so another run can succeed',async()=>{
  const h=harness();h.Worker.fail=true;
  await h.c.runSimulation();assert.equal(h.button.disabled,false);assert.match(h.verdict.textContent,/Background simulation could not start/);
  h.Worker.fail=false;await h.c.runSimulation();assert.equal(h.renders.length,1);
});
test('opening the simulation tab schedules a redraw of existing results',()=>{
  let draws=0;const classes={classList:{toggle(){}}};
  const c=vm.createContext({tabBtnSim:classes,tabBtnAudit:classes,tabBtnQuant:classes,tabBtnLot:classes,
    tabSim:classes,tabAudit:classes,tabQuant:classes,tabLot:classes,lastCurves:[1],lastConfig:{},
    requestAnimationFrame(fn){fn();},drawChart(){draws++;}});
  const start=html.indexOf('  function switchTab(name){');const end=html.indexOf("  tabBtnSim.addEventListener",start);
  vm.runInContext(html.slice(start,end),c);c.switchTab('sim');assert.equal(draws,1);
});

test('local-file fallback stays functional without a Worker',async()=>{
  const h=harness();h.c.location.protocol='file:';await h.c.runSimulation();
  assert.equal(h.workers.length,0);assert.equal(h.renders.length,1);assert.equal(h.button.disabled,false);
});
test('actual background worker matches shared engine results',async()=>{
  const {Worker}=require('node:worker_threads');const path=require('node:path');
  const base=path.join(__dirname,'..');
  const cfg={preset:'ftmo1',target:10,maxLoss:10,dailyLoss:3,maxLossMode:'eodTrailing',minDays:0,bestDay:true,RR:1,p:.65,risk:1,tpd:1,horizon:30,iterations:10000,seed:713};
  const worker=new Worker(`
    const {parentPort}=require('node:worker_threads');
    const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
    global.self={postMessage:data=>parentPort.postMessage(data)};
    global.importScripts=file=>vm.runInThisContext(fs.readFileSync(path.join(${JSON.stringify(base)},file),'utf8'));
    vm.runInThisContext(fs.readFileSync(path.join(${JSON.stringify(base)},'simulation-worker.js'),'utf8'));
    parentPort.on('message',data=>self.onmessage({data}));
  `,{eval:true});
  try{
    const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage(cfg);});
    assert.equal(result.error,undefined);assert.equal(result.result.pass,55.05);assert.equal(result.result.curves.length,40);
    assert.equal(result.result.failDaily,0);
  }finally{await worker.terminate();}
});
