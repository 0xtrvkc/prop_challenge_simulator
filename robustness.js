/* PyBroker-inspired diagnostics for closed records, not a PyBroker execution engine. */
(function(root){
  'use strict';
  const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
  function percentile(a,p){
    if(!a.length)return NaN;
    const x=[...a].sort((a,b)=>a-b),i=(x.length-1)*p,l=Math.floor(i),h=Math.ceil(i);
    if(l===h||x[l]===x[h])return x[l];
    if(!Number.isFinite(x[h]))return x[h];
    return x[l]+(x[h]-x[l])*(i-l);
  }
  function metrics(values,initial){
    let net=0,profit=0,loss=0,balance=initial,peak=initial,dd=0;
    for(const v of values){net+=v;profit+=Math.max(0,v);loss+=Math.max(0,-v);balance+=v;peak=Math.max(peak,balance);dd=Math.max(dd,(peak-balance)/peak*100);}
    return {n:values.length,net,expectancy:values.length?net/values.length:NaN,pf:loss?profit/loss:profit?Infinity:NaN,dd};
  }
  function days(trades){
    const grouped=new Map();
    [...trades].sort((a,b)=>a.close-b.close).forEach(t=>{
      const d=t.close,k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      if(!grouped.has(k))grouped.set(k,{key:k,trades:[]});
      grouped.get(k).trades.push(t);
    });
    return [...grouped.values()];
  }
  function seeded(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  function blockSample(grouped,length,r){
    // Moving blocks do not wrap from the latest observed day to the earliest.
    const out=[],size=Math.min(Math.max(1,length),grouped.length);
    while(out.length<grouped.length){const start=Math.floor(r()*(grouped.length-size+1));out.push(...grouped.slice(start,start+size));}
    return out.slice(0,grouped.length).flatMap(d=>d.trades.map(t=>t.net));
  }
  function bootstrap(trades,initial,{block=3,reps=600,seed=713}={}){
    const grouped=days(trades),length=Math.min(block,grouped.length);
    if(grouped.length<Math.max(6,block*2))return {available:false,days:grouped.length};
    const r=seeded(seed),ex=[],pf=[],dd=[];
    for(let i=0;i<reps;i++){const m=metrics(blockSample(grouped,length,r),initial);ex.push(m.expectancy);if(!Number.isNaN(m.pf))pf.push(m.pf);dd.push(m.dd);}
    return {available:true,days:grouped.length,block:length,reps,expectancy:[percentile(ex,.025),percentile(ex,.975)],pf:[percentile(pf,.025),percentile(pf,.975)],dd95:percentile(dd,.95),positiveShare:ex.filter(x=>x>0).length/reps*100};
  }
  function chronological(trades,initial){
    const grouped=days(trades),warm=Math.floor(grouped.length/2);
    if(grouped.length<12)return [];
    const folds=[];
    for(let i=0;i<3;i++){
      const start=warm+Math.floor((grouped.length-warm)*i/3),end=warm+Math.floor((grouped.length-warm)*(i+1)/3);
      const prior=grouped.slice(0,start),test=grouped.slice(start,end);
      folds.push({priorDays:prior.length,testDays:test.length,start:test[0].key,end:test.at(-1).key,
        prior:metrics(prior.flatMap(d=>d.trades.map(t=>t.net)),initial),test:metrics(test.flatMap(d=>d.trades.map(t=>t.net)),initial)});
    }
    return folds;
  }
  function costs(trades,initial,extraPct,rules,ruleEngine){
    const rate=Number.isFinite(extraPct)?Math.max(0,Math.min(1,extraPct)):0;
    return [...new Set([0,rate,rate*2])].map(pct=>{
      const adjusted=trades.map(t=>({...t,net:t.net-initial*pct/100}));
      return {extraPct:pct,...metrics(adjusted.map(t=>t.net),initial),audit:ruleEngine.replay(adjusted,initial,rules)};
    });
  }
  const api={metrics,days,percentile,blockSample,bootstrap,chronological,costs};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.Robustness=api;
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id),pct=v=>Number.isFinite(v)?v.toFixed(3)+'%': '—',pf=v=>v===Infinity?'∞':Number.isFinite(v)?v.toFixed(2):'—';
  const table=(heads,rows)=>'<table class="quant-table"><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  let current,cached;
  function render(q,audit){
    if(!q?.trades?.length)return;current={q,audit};
    const initial=audit?.initial||10000,trades=q.trades,rules=audit?.rules||root.PropRules.get(audit?.presetKey);
    if(!cached||cached.trades!==trades||cached.initial!==initial){
      const seed=trades.reduce((s,t,i)=>(s+Math.round(t.net*100)*(i+1))|0,713);
      cached={trades,initial,b:bootstrap(trades,initial,{seed}),folds:chronological(trades,initial),base:metrics(trades.map(t=>t.net),initial)};
    }
    const {b,folds,base}=cached;
    $('robustBootstrap').innerHTML=b.available?table(['Diagnostic','Result'],[
      ['Expectancy / trade · 95% interval',b.expectancy.map(v=>pct(v/initial*100)).join(' to ')],
      ['Profit factor · 95% interval',b.pf.map(pf).join(' to ')],
      ['Maximum closed drawdown · 95th percentile',pct(b.dd95)],
      ['Positive-expectancy resamples',b.positiveShare.toFixed(1)+'%'],
      ['Sample structure',b.days+' active days · '+b.block+'-day blocks · '+b.reps+' resamples']
    ]):'<p class="quant-copy">Need at least 6 active closing days for 3-day block resampling.</p>';
    $('robustChronological').innerHTML=folds.length?table(['Later period','Prior days','Test days / trades','Prior expectancy','Test expectancy','Test PF'],folds.map(f=>[
      f.start+' → '+f.end,f.priorDays,f.testDays+' / '+f.test.n,pct(f.prior.expectancy/initial*100),pct(f.test.expectancy/initial*100),pf(f.test.pf)
    ])):'<p class="quant-copy">Need at least 12 active closing days for three separate later-period checks.</p>';
    const input=$('robustExtraCost'),extra=Number(input.value),stress=costs(trades,initial,extra,rules,root.PropRules);
    $('robustCosts').innerHTML=table(['Extra / trade','Net / initial','Expectancy / trade','PF','First modeled outcome','Later breach'],stress.map(s=>[
      pct(s.extraPct),pct(s.net/initial*100),pct(s.expectancy/initial*100),pf(s.pf),
      s.audit.first?(s.audit.first.kind==='breach'?s.audit.first.reason:rules.outcome)+' · '+s.audit.first.day:'Unresolved',
      s.audit.firstBreach?s.audit.firstBreach.reason+' · '+s.audit.firstBreach.day:'None in closed history'
    ]));
    $('robustCostNote').textContent='Extra cost to erase observed average net edge: '+pct(Math.max(0,base.expectancy)/initial*100)+' of initial capital per trade. Extra costs are added to reported net P/L, which already includes reported commission and swap. This flat per-trade stress is not a lot-aware slippage model.';
    $('robustSummary').textContent=folds.length?'Later periods with positive expectancy: '+folds.filter(f=>f.test.expectancy>0).length+'/3. Each test contains new complete closing days; its baseline uses only earlier days.':'More active days are needed to check edge stability across later periods.';
  }
  root.renderRobustness=render;
  $('robustExtraCost').addEventListener('input',()=>{if(current)render(current.q,current.audit);});
})(typeof window!=='undefined'?window:globalThis);
