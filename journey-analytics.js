/* Monthly closed-P/L ledger and current-state, day-block bootstrap forecast. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), sum=a=>a.reduce((s,v)=>s+v,0), avg=a=>a.length?sum(a)/a.length:0;
const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const quantile=(a,p)=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*p;return b[Math.floor(i)]+(b[Math.ceil(i)]-b[Math.floor(i)])*(i%1);};
const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
function groupDays(trades){const m=new Map();[...trades].sort((a,b)=>a.close-b.close).forEach(t=>{const k=key(t.close);if(!m.has(k))m.set(k,{date:k,trades:[],net:0});const d=m.get(k);d.trades.push(t);d.net+=t.net;});return [...m.values()].sort((a,b)=>a.date.localeCompare(b.date));}
function monthCells(month){const [y,m]=month.split('-').map(Number),first=new Date(y,m-1,1),offset=(first.getDay()+6)%7,count=new Date(y,m,0).getDate(),n=Math.ceil((offset+count)/7)*7;return Array.from({length:n},(_,i)=>{const d=new Date(y,m-1,i-offset+1);return {date:key(d),day:d.getDate(),inside:d.getMonth()===m-1};});}
function forecast(days,a,p,{horizon=90,reps=2000}={}){
 if(a.failed||a.passedClosed)return {resolved:a.failed?'Failed in recorded history':'Target reached in closed history; official eligibility unverified'};
 if(days.length<3)return {insufficient:true};
 const seed=days.reduce((s,d,i)=>(s+Math.round(d.net*100)*(i+1))|0,137)^Math.round(a.balance*100)^horizon;
 const passes=[],fails=[],passCurve=Array(horizon).fill(0),failCurve=Array(horizon).fill(0);let daily=0,max=0,idea=0;
 for(let n=0;n<reps;n++){
  const r=rng(seed+n*7919);
  let balance=a.balance,peak=a.peakEod,positive=a.positiveDaysProfit,best=a.bestDay,active=a.tradingDays;
  for(let day=1;day<=horizon;day++){
   const block=days[Math.floor(r()*days.length)],start=balance,dailyFloor=start-a.initial*p.daily/100,maxFloor=(p.trailing?Math.max(a.initial,peak):a.initial)-a.initial*p.max/100;
   let reason=p.ideaRisk&&PropRules.ideaLosses(block.trades).some(x=>-x.net>a.initial*p.ideaRisk/100+1e-9)?'idea':'';
   for(const t of block.trades){if(reason)break;balance+=t.net;if(PropRules.hit(balance,dailyFloor,p)||PropRules.hit(balance,maxFloor,p)){reason=PropRules.hit(balance,dailyFloor,p)?'daily':'max';break;}}
   if(reason){fails.push(day);if(reason==='daily')daily++;else if(reason==='idea')idea++;else max++;for(let i=day-1;i<horizon;i++)failCurve[i]++;break;}
   const pnl=balance-start;if(pnl>0){positive+=pnl;best=Math.max(best,pnl);}peak=Math.max(peak,balance);active++;
   if(balance>=a.targetBalance&&active>=p.minDays&&PropRules.consistent(p,best,positive,balance-a.initial)){passes.push(day);for(let i=day-1;i<horizon;i++)passCurve[i]++;break;}
  }
 }
 const timing=xs=>xs.length?{median:quantile(xs,.5),low:quantile(xs,.1),high:quantile(xs,.9),count:xs.length}:null;
 return {pass:passes.length/reps*100,fail:fails.length/reps*100,unfinished:(reps-passes.length-fails.length)/reps*100,daily:daily/reps*100,max:max/reps*100,idea:idea/reps*100,passTime:timing(passes),failTime:timing(fails),passCurve:passCurve.map(x=>x/reps*100),failCurve:failCurve.map(x=>x/reps*100),horizon,reps};
}
let state=null,month='',selected='',signature='',cachedForecast=null;
const percent=v=>Number.isFinite(v)?v.toFixed(2)+'%':'—';
function amount(v,signed=true){if(!state)return '';const n=state.privacy?v/state.a.initial*100:v;return (signed&&n>0?'+':'')+(state.privacy?percent(n):new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n));}
function stat(label,value,note){return '<div class="ja-stat"><span>'+label+'</span><strong>'+value+'</strong><small>'+note+'</small></div>';}
function renderCalendar(){
 const {days}=state,map=new Map(days.map(d=>[d.date,d])),inMonth=days.filter(d=>d.date.startsWith(month)),vals=inMonth.map(d=>d.net),trades=inMonth.flatMap(d=>d.trades),wins=trades.filter(t=>t.net>0).length;
 $('jaMonth').textContent=new Date(month+'-01T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
 $('jaMonthStats').innerHTML=stat('Month net',amount(sum(vals)),trades.length+' closed trades')+stat('Active days',String(inMonth.length),vals.filter(v=>v>0).length+' green / '+vals.filter(v=>v<0).length+' red / '+vals.filter(v=>v===0).length+' flat')+stat('Trade win rate',trades.length?percent(wins/trades.length*100):'—',wins+' wins / '+trades.filter(t=>t.net<0).length+' losses')+stat('Average active day',inMonth.length?amount(avg(vals)):'—','Net of reported costs');
 const cells=monthCells(month),scale=Math.max(1,...vals.map(Math.abs));let html='';
 for(let i=0;i<cells.length;i+=7){const week=cells.slice(i,i+7);if(!week.slice(0,5).some(c=>c.inside))continue;for(const c of week.slice(0,5)){const d=map.get(c.date),v=d?.net||0,cls=!c.inside?'outside':d?(v>0?'profit':v<0?'loss':'flat'):'empty';html+='<button type="button" class="ja-day '+cls+(c.date===selected?' selected':'')+'" data-date="'+c.date+'" '+(!c.inside?'disabled ':'')+'aria-label="'+c.date+(d?' net '+amount(v)+', '+d.trades.length+' trades':', no closed trades')+'" style="--heat:'+(.04+.16*Math.abs(v)/scale).toFixed(3)+'"><span class="ja-date">'+c.day+(c.date===key(new Date())?'<i>Today</i>':'')+'</span>'+(c.inside&&d?'<strong>'+amount(v)+'</strong><small>'+d.trades.length+' trade'+(d.trades.length===1?'':'s')+' · '+d.trades.filter(t=>t.net>0).length+'W / '+d.trades.filter(t=>t.net<0).length+'L</small>':c.inside?'<small>No closes</small>':'')+'</button>';}
 const wd=week.filter(c=>c.inside).map(c=>map.get(c.date)).filter(Boolean);html+='<div class="ja-week"><span>Week net</span><strong>'+amount(sum(wd.map(d=>d.net)))+'</strong><small>'+wd.length+' active days</small></div>';}
 $('jaCells').innerHTML=html;$('jaCalendarNote').textContent='Monday–Friday view. Closed trades grouped by the CSV close date. Week totals include this month only. Latest CSV month: '+days.at(-1).date.slice(0,7)+'. No-closes days are not zero-return observations.';
 hideDayCard();renderDay();
}
let pinned=false,hideTimer;
function hideDayCard(){clearTimeout(hideTimer);pinned=false;$('jaDayPopover').hidden=true;}
function placeDayCard(x,y){const card=$('jaDayPopover'),pad=12;card.style.left=Math.max(pad,Math.min(x+14,innerWidth-card.offsetWidth-pad))+'px';card.style.top=Math.max(pad,Math.min(y+14,innerHeight-card.offsetHeight-pad))+'px';}
function showDayCard(button,event,pin=false){if(!state||button.disabled)return;clearTimeout(hideTimer);const date=button.dataset.date,d=state.days.find(d=>d.date===date);pinned=pin;const card=$('jaDayPopover');card.innerHTML='<div class="ja-pop-heading"><strong>'+date+'</strong><button type="button" aria-label="Close day details">×</button></div>'+(d?'<div class="ja-pop-net">'+amount(d.net)+' <small>· '+d.trades.length+' trade'+(d.trades.length===1?'':'s')+' · '+d.trades.filter(t=>t.net>0).length+'W / '+d.trades.filter(t=>t.net<0).length+'L</small></div><div class="ja-pop-scroll"><table class="quant-table"><thead><tr><th>Time</th><th>Symbol / side</th><th>Net</th></tr></thead><tbody>'+d.trades.map(t=>'<tr><td>'+t.close.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+'</td><td>'+escapeText(t.symbol||'—')+' <small>'+escapeText(t.direction||'—')+'</small></td><td>'+amount(t.net)+'</td></tr>').join('')+'</tbody></table></div>':'<p>No closed trades.</p>');card.hidden=false;const rect=button.getBoundingClientRect();placeDayCard(event?.clientX||rect.left,event?.clientY||rect.bottom);}
function renderDay(){if(window.rememberFirmDayDisclosure)window.rememberFirmDayDisclosure();const d=state.days.find(d=>d.date===selected);$('jaDayAllowance').innerHTML=d&&window.firmComparisonDay?window.firmComparisonDay(selected):'';}
function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const planColors=['#2563eb','#a855f7','#d97706','#0891b2'];
function renderForecast(){
 const {a,days,q}=state,windowSize=Number($('jaSample').value),sample=windowSize?days.slice(-windowSize):days,horizon=Number($('jaHorizon').value);
 const entries=cachedForecast||(cachedForecast=Object.entries(PropRules.presets).map(([id,p],i)=>{const x=PropRules.replay(q.trades,a.initial,p),start={initial:a.initial,balance:x.balance,peakEod:x.peak,positiveDaysProfit:x.positive,bestDay:x.best,tradingDays:x.tradingDays,targetBalance:a.initial*(1+p.target/100),failed:x.first?.kind==='breach',passedClosed:x.first?.kind==='target'};return {id,p,color:planColors[i],f:forecast(sample,start,p,{horizon})};}));
 $('jaAsOf').textContent='From last close · '+days.at(-1).date+' · all rule sets';$('jaForecastTitle').textContent='Target / breach probability by rule set';
 $('jaForecastCopy').textContent='Each plan starts from its own replay of the complete CSV. Colors identify rule sets; solid lines show target eligibility first and dashed lines show breach first.';
 $('jaForecastStats').innerHTML=entries.map(({p,color,f})=>'<section class="ja-forecast-card" style="--plan-color:'+color+'"><strong>'+escapeText(p.name)+'</strong><small>'+p.target+'% target · '+p.daily+'% daily · '+p.max+'% '+(p.trailing?'trailing':'static')+' total</small>'+(f.resolved||f.insufficient?'<p>'+escapeText(f.resolved||'At least three active days required')+'</p>':'<div class="ja-forecast-values"><span>Target <b>'+percent(f.pass)+'</b></span><span>Breach <b>'+percent(f.fail)+'</b></span><span>Active <b>'+percent(f.unfinished)+'</b></span></div><small>Median target: '+(f.passTime?Math.ceil(f.passTime.median)+' active days':'—')+' · breach: '+(f.failTime?Math.ceil(f.failTime.median)+' active days':'—')+'</small><small>Breaches: daily '+percent(f.daily)+' · total '+percent(f.max)+(p.ideaRisk?' · idea '+percent(f.idea):'')+'</small>')+'</section>').join('');
 $('jaRaceBars').innerHTML='<div class="ja-forecast-legend">'+entries.map(({id,p,color,f})=>'<button type="button" data-forecast-plan="'+id+'" aria-pressed="true" '+(!f.passCurve?'disabled ':'')+'><i style="background:'+color+'"></i>'+escapeText(p.name)+'</button>').join('')+'<span>━━ Target first</span><span>┄┄ Breach first</span></div>';
 const points=arr=>'50,170 '+arr.map((v,i)=>(50+((i+1)/horizon)*590).toFixed(1)+','+(170-v*1.5).toFixed(1)).join(' '),live=entries.filter(x=>x.f.passCurve);
 $('jaRace').innerHTML=live.length?'<svg viewBox="0 0 660 208" role="img" aria-label="Target and breach probability for every unresolved rule set across future active days"><g class="ja-svg-grid">'+[0,25,50,75,100].map(v=>'<path d="M50 '+(170-v*1.5)+' H640"/><text x="42" y="'+(174-v*1.5)+'" text-anchor="end">'+v+'%</text>').join('')+'</g>'+live.map(({id,p,color,f})=>'<polyline data-plan="'+id+'" fill="none" stroke="'+color+'" stroke-width="2.5" points="'+points(f.passCurve)+'"><title>'+escapeText(p.name)+' · target first</title></polyline><polyline data-plan="'+id+'" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-dasharray="6 4" points="'+points(f.failCurve)+'"><title>'+escapeText(p.name)+' · breach first</title></polyline>').join('')+'<text class="ja-svg-text" x="50" y="195">Now</text><text class="ja-svg-text" x="640" y="195" text-anchor="end">'+horizon+' active days</text></svg>':'<p class="ja-note">No unresolved plans with enough history to forecast.</p>';
 $('jaForecastMethod').textContent='Identical probabilities overlap; toggle legend labels to show or hide plan lines. Method: 2,000 matched seeded whole-day bootstrap paths per unresolved plan; '+sample.length+' active days sampled. Preserves trade order and reported dollar P/L, with fixed observed sizing. Each plan uses its own target, daily / total floors, trailing balance, minimum days, Best Day condition and realized idea-loss cap. Plans already resolved at their first historical event stay labeled and have no future curve. Timing is conditional on that outcome; a dash means no observed events. '+(sample.length<20?'Small sample: estimates are fragile. ':'')+'Assumes fresh active-day openings. Floating equity, overnight overlap, timezone alignment and planned idea risk are unavailable. Target eligibility is not official approval.';
}
function activeCadence(days){const date=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};const span=(date(days.at(-1).date)-date(days[0].date))/86400000+1;return Math.min(1,days.length/Math.max(1,span));}
function render(q,a,p,privacy){if(!q?.trades?.length||!a)return;const days=groupDays(q.trades),sig=days.map(d=>d.date+':'+d.trades.map(t=>t.net).join(',')).join('|');if(q!==state?.q||sig!==signature){signature=sig;month=days.at(-1).date.slice(0,7);selected=days.at(-1).date;}state={q,a,p,privacy,days};$('jaAnalytics').hidden=false;cachedForecast=null;renderCalendar();renderForecast();}
if(typeof window!=='undefined')window.renderJourneyAnalytics=render;
if(typeof module!=='undefined')module.exports={groupDays,monthCells,forecast,activeCadence};
if(typeof document!=='undefined'){
 $('jaPrev').addEventListener('click',()=>shiftMonth(-1));$('jaNext').addEventListener('click',()=>shiftMonth(1));$('jaLatest').addEventListener('click',()=>{month=state.days.at(-1).date.slice(0,7);selected=state.days.at(-1).date;renderCalendar();});
 $('jaRaceBars').addEventListener('click',e=>{const button=e.target.closest('[data-forecast-plan]');if(!button||button.disabled)return;const show=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(show));$('jaRace').querySelectorAll('[data-plan="'+button.dataset.forecastPlan+'"]').forEach(line=>line.style.display=show?'':'none');});
 const cells=$('jaCells'),card=$('jaDayPopover');
 cells.addEventListener('pointerover',e=>{const b=e.target.closest('[data-date]');if(b&&e.pointerType!=='touch'&&!pinned)showDayCard(b,e);});
 cells.addEventListener('pointermove',e=>{if(!card.hidden&&!pinned)placeDayCard(e.clientX,e.clientY);});
 cells.addEventListener('pointerleave',()=>{if(!pinned)hideTimer=setTimeout(hideDayCard,120);});
 cells.addEventListener('focusin',e=>{const b=e.target.closest('[data-date]');if(b)showDayCard(b,null);});
 cells.addEventListener('focusout',e=>{if(!pinned&&!card.contains(e.relatedTarget))hideTimer=setTimeout(hideDayCard,120);});
 cells.addEventListener('click',e=>{const b=e.target.closest('[data-date]');if(!b||b.disabled)return;selected=b.dataset.date;cells.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');renderDay();showDayCard(b,e,true);});
 card.addEventListener('pointerenter',()=>clearTimeout(hideTimer));card.addEventListener('pointerleave',()=>{if(!pinned)hideDayCard();});
 card.addEventListener('click',e=>{if(e.target.closest('button'))hideDayCard();});
 document.addEventListener('pointerdown',e=>{if(!card.hidden&&!card.contains(e.target)&&!cells.contains(e.target))hideDayCard();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hideDayCard();});
 window.addEventListener('resize',()=>{if(!card.hidden){const box=card.getBoundingClientRect();placeDayCard(box.left-14,box.top-14);}});
 for(const id of ['jaSample','jaHorizon'])$(id).addEventListener('change',()=>{cachedForecast=null;renderForecast();});
}
function shiftMonth(n){if(!state)return;const [y,m]=month.split('-').map(Number);month=key(new Date(y,m-1+n,1)).slice(0,7);selected='';renderCalendar();}
})();


