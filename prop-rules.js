/* Shared rule definitions. All percentages use initial capital unless stated otherwise. */
(function(root){
  'use strict';
  const checked='2026-09-30';
  const ftmo='https://ftmo.com/en/trading-objectives/';
  const wmt='https://wemastertrade.com/announcement/more-ways-to-trade-xau247-and-nopc-eu/';
  const presets={
    ftmo1:{name:'FTMO 1-Step',firm:'FTMO',stage:'Challenge',target:10,daily:3,max:10,trailing:true,minDays:0,bestDay:true,consistency:.5,consistencyBasis:'positive',dailyReference:'balance',inclusive:false,outcome:'Target eligible',reset:'00:00 Europe/Prague (CE(S)T)',sources:[ftmo],checked},
    ftmo2:{name:'FTMO 2-Step · Challenge',firm:'FTMO',stage:'Challenge',target:10,daily:5,max:10,trailing:false,minDays:4,bestDay:false,dailyReference:'balance',inclusive:false,outcome:'Phase target eligible',reset:'00:00 Europe/Prague (CE(S)T)',sources:[ftmo],checked},
    ftmo2v:{name:'FTMO 2-Step · Verification',firm:'FTMO',stage:'Verification',target:5,daily:5,max:10,trailing:false,minDays:4,bestDay:false,dailyReference:'balance',inclusive:false,outcome:'Phase target eligible',reset:'00:00 Europe/Prague (CE(S)T)',sources:[ftmo],checked},
    wmtNoPC:{name:'WMT NoPC–EU · Instant',firm:'WeMasterTrade',stage:'Instant / payout',target:6,daily:2,max:4,trailing:false,minDays:0,bestDay:false,dailyReference:'higher',inclusive:true,ideaRisk:1,outcome:'Payout target reached',reset:'Firm reset timezone unverified; CSV day assumption',sources:[wmt,'https://faq.wemastertrade.com/what-is-the-daily-loss-limit-and-what-happens-if-i-break-it/','https://faq.wemastertrade.com/what-is-the-max-loss-limit-and-what-happens-if-i-break-it/'],checked,
      note:'NoPC–EU only: no profit consistency, 1% risk consistency per trade idea. Package page describes balance-based total loss; general FAQ describes equity-based total loss. This model uses the fixed 96% initial-capital floor, monitors equity in live sizing conservatively, and cannot certify payout eligibility or overnight compliance.'}
  };
  const get=key=>presets[key]||presets.ftmo1;
  const hit=(value,floor,p)=>p.inclusive?value<=floor:value<floor;
  const dailyFloor=(p,initial,balance,equity=balance)=>(p.dailyReference==='higher'?Math.max(balance,equity):balance)-initial*p.daily/100;
  const maxFloor=(p,initial,peak)=> (p.trailing?Math.max(initial,peak):initial)-initial*p.max/100;
  function consistent(p,best,positive,net){const denominator=p.consistencyBasis==='net'?net:positive;return !p.bestDay||(denominator>0&&best<=denominator*(p.consistency||.5)+1e-9);}
  const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  function group(trades){const days=new Map();[...trades].sort((a,b)=>a.close-b.close).forEach(t=>{const d=key(t.close);if(!days.has(d))days.set(d,[]);days.get(d).push(t);});return [...days];}
  function ideaLosses(trades){
    const groups=new Map();
    trades.forEach((t,i)=>{const id=t.symbol&&t.symbol!=='Unknown'&&t.direction?t.symbol+'|'+t.direction+'|'+t.close.getTime():'position-'+i;
      if(!groups.has(id))groups.set(id,{net:0,last:t});const idea=groups.get(id);idea.net+=t.net;idea.last=t;});
    return [...groups.values()];
  }
  function replay(trades,initial,p){
    let balance=initial,peak=initial,positive=0,best=0,first=null,worstDaily=initial*p.daily/100,worstMax=initial*p.max/100;
    const openDays=new Set(),ledger=[];let firstBreach=null;
    const ideas=ideaLosses(trades),ideaBreach=new Map(ideas.filter(x=>p.ideaRisk&&-x.net>initial*p.ideaRisk/100+1e-9).map(x=>[x.last,x]));
    for(const [day,block] of group(trades)){
      const start=balance,df=dailyFloor(p,initial,start),mf=maxFloor(p,initial,peak);let low=balance;
      for(const t of block){
        openDays.add(key(t.open||t.close));balance+=t.net;low=Math.min(low,balance);
        worstDaily=Math.min(worstDaily,balance-df);worstMax=Math.min(worstMax,balance-mf);
        if(hit(balance,df,p)||hit(balance,mf,p)||ideaBreach.has(t)){
          const event={kind:'breach',day,reason:hit(balance,df,p)&&hit(balance,mf,p)?'Daily + total loss':hit(balance,df,p)?'Daily loss':hit(balance,mf,p)?'Total loss':'Realized idea loss exceeds cap',balance,dailyFloor:df,maxFloor:mf};
          if(!first)first=event;if(!firstBreach)firstBreach=event;
        }
      }
      const net=balance-start;if(net>0){positive+=net;best=Math.max(best,net);}peak=Math.max(peak,balance);
      ledger.push({day,net,start,balance,dailyFloor:df,maxFloor:mf,dailyBuffer:low-df,maxBuffer:low-mf});
      if(!first&&balance>=initial*(1+p.target/100)&&openDays.size>=p.minDays&&consistent(p,best,positive,balance-initial))first={kind:'target',day,reason:p.outcome,balance};
    }
    return {balance,net:balance-initial,peak,best,positive,first,firstBreach,ledger,worstDaily,worstMax,worstIdeaLoss:Math.max(0,...ideas.map(x=>-x.net)),nextDaily:balance-dailyFloor(p,initial,balance),totalBuffer:balance-maxFloor(p,initial,peak),remaining:Math.max(0,initial*(1+p.target/100)-balance),tradingDays:openDays.size};
  }
  function seeded(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  /* Identical seeds yield identical win/loss draws across rule sets, even after an early stop. */
  function simulate({rules,payoff,winRate,risk,paths=400,horizon=200,tradesPerDay=1,seed=713,compound=true}){
    let pass=0,daily=0,max=0,idea=0;const ends=[],dds=[],times=[],passTimes=[],curves=[],curveOutcomes=[];
    for(let n=0;n<paths;n++){
      const random=seeded(seed+n*7919);let balance=100,peak=100,peakEod=100,dayStart=100,positive=0,best=0,dd=0,done=false,arr=[100],outcome='timeout';
      for(let i=0;i<horizon;i++){
        if(i%tradesPerDay===0)dayStart=balance;
        const riskAmount=(compound?balance:100)*risk/100;
        if(rules.ideaRisk&&riskAmount>rules.ideaRisk+1e-9){idea++;times.push(i+1);done=true;outcome='failMax';break;}
        balance+=random()<winRate?riskAmount*payoff:-riskAmount;arr.push(balance);peak=Math.max(peak,balance);dd=Math.min(dd,(balance/peak-1)*100);
        if(hit(balance,dailyFloor(rules,100,dayStart),rules)){daily++;times.push(i+1);done=true;outcome='failDaily';break;}
        if(hit(balance,maxFloor(rules,100,peakEod),rules)){max++;times.push(i+1);done=true;outcome='failMax';break;}
        if((i+1)%tradesPerDay===0||i===horizon-1){const pnl=balance-dayStart;if(pnl>0){positive+=pnl;best=Math.max(best,pnl);}peakEod=Math.max(peakEod,balance);
          if(balance>=100+rules.target&&Math.ceil((i+1)/tradesPerDay)>=rules.minDays&&consistent(rules,best,positive,balance-100)){pass++;times.push(i+1);passTimes.push(i+1);done=true;outcome='pass';break;}}
      }
      ends.push(balance);dds.push(dd);if(n<250){curves.push(arr);curveOutcomes.push(outcome);}
    }
    return {pass:pass/paths*100,daily:daily/paths*100,max:max/paths*100,idea:idea/paths*100,unfinished:(paths-pass-daily-max-idea)/paths*100,ends,dds,times,passTimes,curves,curveOutcomes,horizon,risk};
  }
  const api={presets,get,hit,dailyFloor,maxFloor,consistent,replay,simulate,group,key,ideaLosses};
  if(typeof module!=='undefined')module.exports=api;
  root.PropRules=api;
})(typeof window!=='undefined'?window:globalThis);
