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
 const r=rng(seed),passes=[],fails=[],passCurve=Array(horizon).fill(0),failCurve=Array(horizon).fill(0);let daily=0,max=0,idea=0;
 for(let n=0;n<reps;n++){
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
 renderDay();
}
function renderDay(){const d=state.days.find(d=>d.date===selected);$('jaDayTitle').textContent=selected?'Daily ledger · '+selected:'Select a date to inspect its trades';$('jaDayLedger').innerHTML=d?'<div class="ja-day-total">Net '+amount(d.net)+' · '+d.trades.length+' closed trades</div><table class="quant-table"><thead><tr><th>Close time</th><th>Symbol</th><th>Side</th><th>Net P/L</th></tr></thead><tbody>'+d.trades.map(t=>'<tr><td>'+t.close.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+'</td><td>'+escapeText(t.symbol||'—')+'</td><td>'+escapeText(t.direction||'—')+'</td><td>'+amount(t.net)+'</td></tr>').join('')+'</tbody></table>':selected?'No closed trades recorded on this date.':'Click any day in the calendar.';if(d&&window.firmComparisonDay)$('jaDayLedger').innerHTML+=window.firmComparisonDay(selected);}
function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderForecast(){
 const {a,p,days}=state,windowSize=Number($('jaSample').value),sample=windowSize?days.slice(-windowSize):days,horizon=Number($('jaHorizon').value),f=cachedForecast||(cachedForecast=forecast(sample,a,p,{horizon}));
 $('jaAsOf').textContent='From last close · '+days.at(-1).date+' · '+p.name;
 if(f.resolved||f.insufficient){$('jaForecastTitle').textContent=f.resolved||'Insufficient daily history';$('jaForecastCopy').textContent=f.resolved?'This modeled challenge has already resolved in the imported closed history. A new challenge requires a separate starting deposit and history.':'At least three active close-date days are required.';$('jaForecastStats').innerHTML='';$('jaRace').innerHTML='';$('jaRaceBars').innerHTML='';$('jaForecastMethod').textContent='Closed-history eligibility does not verify official compliance or floating-equity risk.';return;}
 const dominant=f.unfinished>=Math.max(f.pass,f.fail)?'Unresolved is the most common outcome':f.pass>f.fail?'Pass first is more likely in this model':f.fail>f.pass?'Failure first is more likely in this model':'Pass and failure are evenly matched';
 $('jaForecastTitle').textContent=dominant;$('jaForecastCopy').textContent='From your latest balance, '+percent(f.pass)+' of paths become target eligible first, '+percent(f.fail)+' breach first, and '+percent(f.unfinished)+' remain active after '+horizon+' future active trading days.';
 const cadence=activeCadence(days),eta=t=>{if(!t)return 'No events in sample';return Math.ceil(t.median)+' active days';},range=t=>t?'10th–90th: '+Math.ceil(t.low)+'–'+Math.ceil(t.high)+' active days · '+t.count+' paths · roughly '+Math.ceil(t.median/cadence)+' calendar days at observed cadence':'Conditional on this outcome; none observed';
 $('jaForecastStats').innerHTML=stat('Pass first',percent(f.pass),eta(f.passTime))+stat('Failure first',percent(f.fail),eta(f.failTime))+stat('Time to pass · conditional',eta(f.passTime),range(f.passTime))+stat('Time to fail · conditional',eta(f.failTime),range(f.failTime));
 $('jaRaceBars').innerHTML='<div class="ja-prob-bar" role="img" aria-label="Pass '+percent(f.pass)+', fail '+percent(f.fail)+', unfinished '+percent(f.unfinished)+'"><span class="profit" style="width:'+f.pass+'%"></span><span class="loss" style="width:'+f.fail+'%"></span><span class="pending" style="width:'+f.unfinished+'%"></span></div><div class="ja-prob-labels"><span>Pass '+percent(f.pass)+'</span><span>Fail '+percent(f.fail)+'</span><span>Active '+percent(f.unfinished)+'</span></div>';
 const points=(arr)=>'0,170 '+arr.map((v,i)=>(50+(i/(horizon-1))*590).toFixed(1)+','+(170-v*1.5).toFixed(1)).join(' ');
 $('jaRace').innerHTML='<svg viewBox="0 0 660 208" role="img" aria-label="Cumulative pass and failure probability across future active days"><g class="ja-svg-grid">'+[0,25,50,75,100].map(v=>'<path d="M50 '+(170-v*1.5)+' H640"/><text x="42" y="'+(174-v*1.5)+'" text-anchor="end">'+v+'%</text>').join('')+'</g><polyline class="ja-pass-line" points="'+points(f.passCurve).replace('0,170','50,170')+'"/><polyline class="ja-fail-line" points="'+points(f.failCurve).replace('0,170','50,170')+'"/><text class="ja-svg-text" x="50" y="195">Next trading day</text><text class="ja-svg-text" x="640" y="195" text-anchor="end">'+horizon+' active days</text></svg>';
 const drift=avg(sample.map(d=>d.net)),remaining=Math.max(0,a.targetBalance-a.balance),driftText=drift>0?'Simple target-distance pace: '+Math.ceil(remaining/drift)+' active days before extra eligibility conditions.':drift<0?'Average daily drift is negative; straight-line target ETA is unavailable.':'Average daily drift is flat; straight-line target ETA is unavailable.';
 $('jaForecastMethod').textContent='Method: 2,000 seeded whole-day bootstrap paths, preserving each sampled day’s closed-trade order and reported dollar P/L. Starts at current balance, EOD high-water mark, accumulated positive-day profit and best day; checks daily and maximum loss before EOD target eligibility, minimum days and Best Day condition. Future days assume a new active opening day; overnight or overlapping positions may violate that assumption. Fixed observed dollar size; no Kelly resizing. '+sample.length+' active days sampled ('+sample[0].date+' to '+sample.at(-1).date+'). '+driftText+' Daily breach '+percent(f.daily)+' / max breach '+percent(f.max)+' / realized idea breach '+percent(f.idea)+' (daily assigned first if both cross). Calendar-day estimates extrapolate active-day density between first and latest closes, including weekends. '+(sample.length<20?'Small sample: probabilities and timing are fragile. ':'')+'Resampled outcomes assume this history remains representative. Intratrade floating equity, gaps, changing risk and edge decay are excluded; this is a conditional scenario estimate, not official firm verification. WMT known realized idea-loss cap violations stop paths; planned and floating idea risk remain unavailable.';
}
function activeCadence(days){const date=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};const span=(date(days.at(-1).date)-date(days[0].date))/86400000+1;return Math.min(1,days.length/Math.max(1,span));}
function render(q,a,p,privacy){if(!q?.trades?.length||!a)return;const days=groupDays(q.trades),sig=days.map(d=>d.date+':'+d.trades.map(t=>t.net).join(',')).join('|');if(q!==state?.q||sig!==signature){signature=sig;month=days.at(-1).date.slice(0,7);selected=days.at(-1).date;}state={q,a,p,privacy,days};$('jaAnalytics').hidden=false;cachedForecast=null;renderCalendar();renderForecast();}
if(typeof window!=='undefined')window.renderJourneyAnalytics=render;
if(typeof module!=='undefined')module.exports={groupDays,monthCells,forecast,activeCadence};
if(typeof document!=='undefined'){
 $('jaPrev').addEventListener('click',()=>shiftMonth(-1));$('jaNext').addEventListener('click',()=>shiftMonth(1));$('jaLatest').addEventListener('click',()=>{month=state.days.at(-1).date.slice(0,7);selected=state.days.at(-1).date;renderCalendar();});
 $('jaCells').addEventListener('click',e=>{const b=e.target.closest('[data-date]');if(!b||b.disabled)return;selected=b.dataset.date;renderCalendar();});
 for(const id of ['jaSample','jaHorizon'])$(id).addEventListener('change',()=>{cachedForecast=null;renderForecast();});
}
function shiftMonth(n){if(!state)return;const [y,m]=month.split('-').map(Number);month=key(new Date(y,m-1+n,1)).slice(0,7);selected='';renderCalendar();}
})();

