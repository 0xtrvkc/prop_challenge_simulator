/* Comparison views share the imported CSV, never rewrite it or rescale reported P/L. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),R=PropRules;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const percent=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
  let current=null;
  function render(q,a,privacy,select){
    if(!q?.trades?.length||!a)return;
    current={q,a,privacy,select};
    const amount=v=>privacy?percent(v/a.initial*100):new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
    const results=Object.entries(R.presets).map(([id,p])=>({id,p,result:R.replay(q.trades,a.initial,p)}));
    current.results=results;
    $('firmCompare').hidden=false;
    $('firmCompareTable').innerHTML='<table><thead><tr><th>Firm / package / stage</th><th>First modeled outcome</th><th>Target remaining now</th><th>Next-day allowance*</th><th>Total buffer now</th><th>Worst historical buffer</th><th>Inspect</th></tr></thead><tbody>'+results.map(({id,p,result:x})=>{
      const first=x.first,status=first?.kind==='breach'?'Recorded breach':first?.kind==='target'?p.outcome:'No closed-history breach';
      return '<tr><td><strong>'+esc(p.name)+'</strong><small>'+p.target+'% target · '+p.daily+'% daily · '+p.max+'% '+(p.trailing?'EOD trailing':'static')+' total'+(p.ideaRisk?' · '+p.ideaRisk+'% idea risk':'')+'</small></td><td class="'+(first?.kind==='breach'?'breach':first?.kind==='target'?'reached':'')+'">'+esc(status)+'<small>'+(first?esc(first.day)+' · '+esc(first.reason):'Floating equity / reset unverified')+(first?.kind==='target'&&x.firstBreach?'<br>Later full-history breach: '+esc(x.firstBreach.day):'')+'</small></td><td>'+amount(x.remaining)+'</td><td>'+amount(x.nextDaily)+'</td><td>'+amount(x.totalBuffer)+'</td><td>'+amount(Math.min(x.worstDaily,x.worstMax))+'<small>Daily '+amount(x.worstDaily)+' / total '+amount(x.worstMax)+'</small></td><td><button type="button" data-compare-plan="'+id+'" aria-pressed="'+(a.presetKey===id)+'">'+(a.presetKey===id?'Selected':'Open audit')+'</button></td></tr>';
    }).join('')+'</tbody></table><p class="rule-note">*Next-day allowance assumes zero overnight floating P/L. Buffers and progress describe the end of the complete CSV, even after an earlier target or breach. First outcome stops each hypothetical plan at its first modeled event. WMT payout target is not payout approval; risk consistency, floating equity and timezone alignment cannot be certified.</p>';
    $('firmSources').innerHTML=results.map(({p})=>'<p><strong>'+esc(p.name)+'</strong> · checked '+p.checked+'<br>Daily reference: '+(p.dailyReference==='higher'?'higher of day-start balance / equity':'day-start balance')+'. Total floor: '+(p.trailing?'highest end-of-day balance minus allowance':'initial deposit minus allowance')+'. Reset: '+esc(p.reset)+'. '+esc(p.note||'All positions must be closed for official target eligibility. FTMO phases are evaluated independently.')+'<br>'+p.sources.map((url,i)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Official source '+(i+1)+'</a>').join(' · ')+'</p>').join('');
    $('firmCompareTable').onclick=e=>{const button=e.target.closest('[data-compare-plan]');if(button)select(button.dataset.comparePlan);};
    $('firmRiskSweep').ontoggle=()=>{if($('firmRiskSweep').open)renderSweep();};
    if($('firmRiskSweep').open)renderSweep();
  }
  function renderSweep(){
    if(!current)return;const {q,results}=current;
    if(!q.kelly?.usable){$('firmSweepTable').textContent='At least one winner and one loser are required to estimate win rate and payoff.';return;}
    const seed=q.trades.reduce((s,t,i)=>(s+Math.round(t.net*100)*(i+1))|0,713),tpd=Math.max(1,Math.round(q.trades.length/R.group(q.trades).length));
    const horizon=90*tpd,risks=[.1,.25,.5,.75,1,1.5];
    $('firmSweepTable').innerHTML='<table><thead><tr><th>Risk / trade</th>'+results.map(({p})=>'<th>'+esc(p.name)+'</th>').join('')+'</tr></thead><tbody>'+risks.map(risk=>'<tr><td>'+risk.toFixed(2)+'%'+'</td>'+results.map(({p})=>{
      const sim=R.simulate({rules:p,payoff:q.kelly.b,winRate:q.kelly.p,risk,seed,paths:600,horizon,tradesPerDay:tpd});
      return '<td>'+percent(sim.pass)+' target first<small>'+percent(sim.daily+sim.max+sim.idea)+' breach · '+percent(sim.unfinished)+' unfinished'+(sim.idea?' · '+percent(sim.idea)+' idea-risk failures':'')+'</small></td>';
    }).join('')+'</tr>').join('')+'</tbody></table><p class="rule-note">600 identical seeded outcome paths per setting · 90 future active days · '+tpd+' trades/day. WMT risk is checked against initial capital, so a compounding 1% balance risk can exceed its 1% initial-capital cap after gains. Observed average payoff includes reported costs; separate commissions are not charged again.</p>';
  }
  window.renderFirmComparison=render;
  window.firmComparisonDay=day=>{
    if(!current)return '';const {a,privacy,results}=current,amount=v=>privacy?percent(v/a.initial*100):new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
    return '<details class="firm-detail"><summary>How this day used each firm’s allowance</summary><div class="firm-scroll"><table class="quant-table"><thead><tr><th>Plan</th><th>Day-start balance</th><th>Daily floor</th><th>Lowest closed daily buffer</th><th>Lowest closed total buffer</th></tr></thead><tbody>'+results.map(({p,result})=>{const d=result.ledger.find(d=>d.day===day);return d?'<tr><td>'+esc(p.name)+'</td><td>'+amount(d.start)+'</td><td>'+amount(d.dailyFloor)+'</td><td>'+amount(d.dailyBuffer)+'</td><td>'+amount(d.maxBuffer)+'</td></tr>':'';}).join('')+'</tbody></table></div><p class="rule-note">No overnight equity or intratrade lows included. Rows follow the full CSV, including trades after an earlier modeled outcome.</p></details>';
  };
})();
