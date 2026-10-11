/* Monte Carlo calculations run away from the browser's UI thread. */
importScripts('prop-rules.js');
self.onmessage=({data:cfg})=>{
  try{
    const base=PropRules.presets[cfg.preset]||PropRules.presets.ftmo1;
    const rules={...base,target:cfg.target,max:cfg.maxLoss,daily:cfg.dailyLoss,trailing:cfg.maxLossMode==='eodTrailing',minDays:cfg.minDays,bestDay:cfg.bestDay,ideaRisk:cfg.preset==='custom'?undefined:base.ideaRisk};
    const x=PropRules.simulate({rules,payoff:cfg.RR,winRate:cfg.p,risk:cfg.risk,tradesPerDay:cfg.tpd,horizon:cfg.horizon*cfg.tpd,paths:cfg.iterations,seed:cfg.seed,compound:false});
    self.postMessage({result:{pass:x.pass,failMax:x.max+x.idea,failDaily:x.daily,timeout:x.unfinished,ideaFailure:x.idea,
      avgDays:x.passTimes.length?x.passTimes.reduce((sum,t)=>sum+Math.ceil(t/cfg.tpd),0)/x.passTimes.length:null,
      curves:x.curves.slice(0,40).map((points,i)=>({points,outcome:x.curveOutcomes[i]}))}});
  }catch(err){self.postMessage({error:err.message});}
};
