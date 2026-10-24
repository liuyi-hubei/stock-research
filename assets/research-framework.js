/* Evidence-first presentation only. It cannot change financial assumptions or ranking. */
(function(root){
  'use strict';
  const ids=['summary','status','forecast','path','valuation','risks'];
  const companyIds=['summary','business','culture','valuation','perspectives','risks'];
  const states=['已披露事实','研究推导','情景假设','待补证'];
  function validate(plan,stock){
    if(!plan || !['evidence-first-v1','company-study-v2'].includes(plan.version) || plan.code!==stock.code)throw Error('Unsupported research framework');
    const sectionIds=plan.version==='company-study-v2'?companyIds:ids;
    if(plan.integratedNarrative!==undefined && typeof plan.integratedNarrative!=='boolean')throw Error('Invalid integrated narrative mode');
    if(!['ready','conditional','pending'].includes(plan.reviewState))throw Error('Invalid research state');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(plan.methodReviewedAt || '') || !plan.businessType || !plan.summary)throw Error('Missing research metadata');
    if(!Array.isArray(plan.sections) || plan.sections.length!==6 || plan.sections.some((s,i)=>s.id!==sectionIds[i] || !s.title || typeof s.intro!=='string' || (s.id!=='summary' && !s.intro) || !Array.isArray(s.blocks) || !s.blocks.length))throw Error('Expected six research sections in order');
    for(const section of plan.sections)for(const b of section.blocks){
      if(Object.keys(b).length!==1)throw Error('Expected exactly one research block type');
      if(b.p || b.h3){if(typeof (b.p || b.h3)!=='string')throw Error('Invalid research text');continue;}
      if(b.bullets){if(!Array.isArray(b.bullets)||!b.bullets.length||b.bullets.some(x=>typeof x!=='string'))throw Error('Invalid research list');continue;}
      if(b.table){const t=b.table;if(!Array.isArray(t.head)||!t.head.length||!Array.isArray(t.rows)||!t.rows.length||t.rows.some(r=>!Array.isArray(r)||r.length!==t.head.length||r.some(x=>typeof x!=='string')))throw Error('Invalid research table');continue;}
      if(b.evidence){const e=b.evidence;if(!e.claim||!e.basis||!e.counterpoint||!states.includes(e.state)||!Array.isArray(e.sourceRefs)||e.sourceRefs.some(i=>!Number.isInteger(i)||i<0||i>=stock.sources.length))throw Error('Invalid evidence or source reference');if(e.state==='已披露事实'&&!e.sourceRefs.length)throw Error('Disclosed fact needs a source');continue;}
      throw Error('Unknown research block');
    }
    if(root.ShareholderModel?.isPending(stock) && plan.reviewState!=='pending')throw Error('Pending model cannot be presented as researched');
    if(plan.reviewState==='pending' && !root.ShareholderModel?.isPending(stock))throw Error('Pending description requires model withdrawal');
    return plan;
  }
  const labels={ready:'可建立基准路径',conditional:'条件演算 · 经营路径待补证',pending:'待重新评估 · 不提供收益数字'};
  function renderBlocks(plan,stock,esc){
    validate(plan,stock);
    return section=>section.blocks.map(b=>{
      if(b.p)return `<p class="research-copy">${esc(b.p)}</p>`;
      if(b.h3)return `<h3>${esc(b.h3)}</h3>`;
      if(b.bullets)return `<ul class="research-list">${b.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
      if(b.table)return `<div class="table-wrap"><table><thead><tr>${b.table.head.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${b.table.note?`<p class="method-note">${esc(b.table.note)}</p>`:''}`;
      const e=b.evidence;
      return `<article class="research-evidence"><span class="section-label">${esc(e.state)}</span><h3>${esc(e.claim)}</h3><dl><div><dt>依据</dt><dd>${esc(e.basis)}</dd></div><div><dt>反证与缺口</dt><dd>${esc(e.counterpoint)}</dd></div></dl>${e.sourceRefs.length?`<p class="research-citations">${e.sourceRefs.map(i=>`<a href="#research-source-${i}">[S${i+1}] ${esc(stock.sources[i][0])}</a>`).join(' · ')}</p>`:''}</article>`;
    }).join('');
  }
  root.ResearchFramework={validate,renderBlocks,labels,ids};
})(typeof window!=='undefined'?window:globalThis);
