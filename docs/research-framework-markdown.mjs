const table=(head,rows)=>{
  const cell=x=>String(x).replaceAll('|','\\|').replaceAll('\n','<br>');
  return ['| '+head.map(cell).join(' | ')+' |','| '+head.map(()=> '---').join(' | ')+' |',...rows.map(r=>'| '+r.map(cell).join(' | ')+' |')].join('\n');
};
export function researchMarkdown(stock,plan,model,reviewBlock=''){
  const pct=x=>(x*100).toFixed(2)+'%',money=x=>(stock.model.currency==='港元'?'HK$':'¥')+x.toFixed(2);
  const block=b=>{
    if(b.p)return b.p;
    if(b.h3)return '### '+b.h3;
    if(b.bullets)return b.bullets.map(x=>'- '+x).join('\n');
    if(b.table)return table(b.table.head,b.table.rows)+(b.table.note?'\n\n口径：'+b.table.note:'');
    const e=b.evidence;
    return `### ${e.claim}\n\n类别：${e.state}\n\n依据：${e.basis}\n\n反证与缺口：${e.counterpoint}\n\n来源：${e.sourceRefs.length?e.sourceRefs.map(i=>'[S'+(i+1)+'] '+stock.sources[i][0]).join('；'):'待补证，不冒充已核事实'}`;
  };
  const content=[`# ${stock.name}（${stock.code}）研究归档`,'<!-- RESEARCH_FRAMEWORK: evidence-first-v1 -->',`> ${plan.reviewState==='pending'?'IRR待重新评估、参考买入价暂不提供、旧估算撤回、暂停排名。':'条件模型服务于研究比较，原参数沿用，不是经概率校准的预期收益或新一轮经营预测。'}`,`方法整理：${plan.methodReviewedAt}；行情：${stock.priceDate}；实际财报：${stock.model.financialPeriod}（截至${stock.model.financialAsOf || '原报告所列日期'}）。不因结构迁移刷新事实。`];
  for(const s of plan.sections){
    content.push('## '+s.title,s.intro);
    if(s.id==='summary')content.push(plan.summary,`价格基准：${money(stock.price)}；类型：${plan.businessType}；研究状态：${plan.reviewState}。`);
    content.push(...s.blocks.map(block));
    if(s.id==='status')content.push('### 原有行业与公司事实（历史证据，非本轮重新核验）',...stock.industryStatus,...stock.companyStatus);
    if(s.id==='forecast'){
      content.push('### 原有盈利起点与口径',stock.profitForecast.note);
      if(model.isPending(stock))content.push('盈利情景待重新评估，旧参数已撤回。');
      else content.push(table(['情景','起始EPS','盈利起点说明'],stock.model.assumptions.map(a=>[a.name,a.eps.toFixed(4),a.profit || a.reason])));
      content.push('### 原有关键事实',table(['指标','数值','期间','口径'],stock.facts));
    }
    if(s.id==='valuation'){
      if(model.isPending(stock))content.push('IRR待重新评估，参考买入价暂不提供。旧估算已撤回，未知分红不以十年零分红填补。',stock.model.pendingReason);
      else{
        const result=model.evaluate(stock),b=result.base;
        content.push('### 原参数的条件演算（不是本轮新预测）',table(['情景','起始EPS','逐年增长','逐年分红率','退出PE','十年IRR'],result.scenarios.map(a=>[a.name,a.eps.toFixed(4),a.growthRates.map(pct).join(' / '),a.payoutRates.map(pct).join(' / '),a.exitPE+'倍',pct(a.irr)])),`基准 IRR 为 ${pct(b.irr)}；达标参考买入价为 ${money(b.fairPrice)}。回报要求 ${pct(stock.model.requiredReturn)} 为主观门槛，不改变同组现金流IRR。`,stock.model.assumptionNote,stock.model.dividendNote,stock.dividendView,table(['年度','EPS','股息','卖出所得','净现金流'],[['买入','—','—','—','−'+money(stock.price)],...b.rows.map(r=>[r.year,r.eps.toFixed(4),r.dividend.toFixed(4),r.sale.toFixed(4),r.cashFlow.toFixed(4)])]));
      }
    }
    if(s.id==='risks' && stock.evidenceTracking){
      const t=stock.evidenceTracking;
      content.push('### 原有经营证据跟踪（历史观察日不刷新）',t.intro);
      for(const o of t.observations || [])content.push(`#### ${o.label}`,`${o.date}；${o.value}`,o.detail,`来源：[${o.source[0]}](${o.source[1]})`);
      if(t.analystForecasts){const f=t.analystForecasts;content.push('### '+f.title,f.note,table(['机构','原报告日','入库日','2026E','2027E','2028E','2027增速','来源'],f.rows.map(r=>[r.institution,r.reportDate,r.indexedDate,...r.profits.map(n=>n.toFixed(2)),((r.profits[1]/r.profits[0]-1)*100).toFixed(2)+'%',`[原文第${r.page}页](${r.url})`])));}
      if(t.prices)content.push('### 国窖1573与普五价格记录',t.prices.note,table(['采价日','国窖','普五','价差','来源'],t.prices.rows.map(([date,g,w,url])=>[date,g,w,g-w,`[原文](${url})`])));
    }
  }
  content.push('## 来源与研究边界',...stock.sources.map((s,i)=>`- [S${i+1}] [${s[0]}](${s[2].startsWith('reports/')?'../../'+s[2]:s[2]})（${s[1]}）`),'事实、推导、假设与缺口分开；不以模拟大师口吻替代证据。结构检查不代表原始财务或未来预测获证实。仅为研究记录，不构成投资建议。');
  if(reviewBlock)content.push(reviewBlock);
  return content.join('\n\n')+'\n';
}
