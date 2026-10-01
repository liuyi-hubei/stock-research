/* 时效只提示复核优先级，不证明最新披露已查全，也不改变研究或排名。 */
(function () {
  const DAY = 86400000;
  const policy = Object.freeze({ priceDays:30, reviewDays:90, financialDays:240 });
  function today() {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const value = type => parts.find(p=>p.type===type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  }
  function day(value) {
    if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const t=Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(t) && new Date(t).toISOString().slice(0,10)===value ? t/DAY : null;
  }
  function age(value,asOf) {
    const d=day(value), now=day(asOf);
    return d===null || now===null ? null : now-d;
  }
  function financialEnd(period) {
    if(typeof period!=='string')return null;
    // 优先明确日期，支持非自然财年；不从FY名称猜测截止日。
    const dates=(period.match(/\d{4}-\d{2}-\d{2}/g)||[]).filter(d=>day(d)!==null).sort();
    if(dates.length)return dates[dates.length-1];
    const m=period.match(/^(\d{4})(H1|H2|Q1|Q2|Q3|Q4|年报)$/);
    if(!m)return null;
    return `${m[1]}-${({H1:'06-30',H2:'12-31',Q1:'03-31',Q2:'06-30',Q3:'09-30',Q4:'12-31',年报:'12-31'})[m[2]]}`;
  }
  function assess(stock,asOf=today()) {
    const priceDate=stock.priceDate;
    // 方法审阅/排名审核不是重做盈利假设，不能用它们替换研究日期。
    const reviewDate=stock.researchDate || stock.model?.reviewedAt;
    const period=stock.model?.financialPeriod;
    const financialDate=financialEnd(period);
    const priceAge=age(priceDate,asOf),reviewAge=age(reviewDate,asOf),financialAge=age(financialDate,asOf);
    const reasons=[];
    for(const [label,n,limit] of [['行情',priceAge,policy.priceDays],['研究/模型记录',reviewAge,policy.reviewDays],['财报截止',financialAge,policy.financialDays]]) {
      if(n===null)reasons.push(`${label}日期待核`);
      else if(n<0)reasons.push(`${label}日期晚于今日，需核对`);
      else if(n>limit)reasons.push(`${label}已超过${limit}个日历天，建议复核`);
    }
    const future=[priceAge,reviewAge,financialAge].some(n=>n!==null && n<0);
    const missing=[priceAge,reviewAge,financialAge].some(n=>n===null);
    const overdue=(priceAge>policy.priceDays || reviewAge>policy.reviewDays || financialAge>policy.financialDays);
    return {asOf,priceDate,reviewDate,period,financialDate,priceAge,reviewAge,financialAge,
      reviewLabel:stock.researchDate?'研究更新':'模型记录',
      state:future || missing?'unknown':overdue?'review':'recent',
      label:future?'日期需核对':missing?'日期待补核':overdue?'建议复核':'日期较近',reasons};
  }
  window.ResearchFreshness={policy,today,age,financialEnd,assess};
})();
