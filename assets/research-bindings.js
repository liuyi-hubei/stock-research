/* 只读文本绑定：事实来自发布投影，测算来自共同引擎；不改变参数或排名。 */
(function(root){
  'use strict';
  const cache=new WeakMap();
  function context(stock){
    const key=JSON.stringify([stock.price,stock.priceDate,stock.model.requiredReturn,stock.model.status,stock.model.assumptions]);
    const previous=cache.get(stock);if(previous?.key===key)return previous;
    const next={key,result:root.ShareholderModel.evaluate(stock)};cache.set(stock,next);return next;
  }
  function value(stock,key){
    const facts=root.RESEARCH_FACTS?.[stock.code];
    if(key.startsWith('quote.')){
      if(!facts||facts.quote.asOf!==stock.priceDate)throw Error(stock.code+': quote binding date mismatch');
      return Number(facts.quote.values[key.slice(6)]);
    }
    if(key.startsWith('fact.')){
      const record=facts?.records[key.slice(5)];
      if(!record||record.value===null)throw Error(stock.code+': missing numeric fact '+key);
      return Number(record.value);
    }
    const memo=context(stock),result=memo.result;
    if(!result)throw Error(stock.code+': pending model cannot bind '+key);
    const base=result.base;
    if(key.startsWith('fairTrial.')){
      const precision=Number(key.slice(10));if(!Number.isInteger(precision)||precision<0||precision>6)throw Error('Invalid fair-price precision');
      return root.ShareholderModel.scenario(Number(base.fairPrice.toFixed(precision)),stock.model.requiredReturn,{...stock.model.assumptions[1],priceDate:stock.priceDate}).irr;
    }
    if(key==='base.terminalShare')return memo.terminalShare??=(root.ShareholderModel.sensitivity(stock).terminalShare);
    if(key==='base.higherFairPrice')return memo.higherFairPrice??=root.ShareholderModel.scenario(stock.price,stock.model.requiredReturn+.01,{...stock.model.assumptions[1],priceDate:stock.priceDate}).fairPrice;
    if(key.startsWith('trial.')){
      const price=Number(key.slice(6).replace('_','.'));
      if(!(price>0))throw Error('Invalid trial binding');
      return root.ShareholderModel.scenario(price,stock.model.requiredReturn,{...stock.model.assumptions[1],priceDate:stock.priceDate}).irr;
    }
    const known={
      'base.irr':base.irr,'bear.irr':result.scenarios[0].irr,'bull.irr':result.scenarios[2].irr,
      'base.fairPrice':base.fairPrice,'base.eps':base.eps,'base.pe':stock.price/base.eps,
      'base.sumDividends':base.rows.reduce((n,r)=>n+r.dividend,0),
      'base.sale':base.rows[9].sale,'base.firstDividend':base.rows[0].dividend,
      'base.dividendYield':base.rows[0].dividend/stock.price,
      'hurdlePlus':stock.model.requiredReturn+.01,
      'hurdle':stock.model.requiredReturn
    };
    if(!Object.hasOwn(known,key))throw Error('Unknown report binding '+key);
    return known[key];
  }
  function text(input,stock){
    const dated=String(input).replace(/\{\{quote.date\|date\}\}/g,()=>{const facts=root.RESEARCH_FACTS?.[stock.code];if(!facts||facts.quote.asOf!==stock.priceDate)throw Error('Quote date mismatch');return facts.quote.asOf;});
    return dated.replace(/\{\{([a-zA-Z0-9_.]+)\|([np]\d{1,2}(?:e-?\d+)?c?)\}\}/g,(_,key,format)=>{
      const match=format.match(/^([np])(\d{1,2})(?:e(-?\d+))?(c?)$/),decimals=Number(match[2]),scale=Number(match[3]||0);
      if(decimals>15)throw Error('Unsupported report precision');
      let n=value(stock,key);if(!Number.isFinite(n))throw Error(stock.code+': nonfinite binding '+key);
      n=n/10**scale*(match[1]==='p'?100:1);
      return match[4]?new Intl.NumberFormat('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(n):n.toFixed(decimals);
    });
  }
  function resolvePlan(plan,stock){
    const walk=x=>typeof x==='string'?text(x,stock):Array.isArray(x)?x.map(walk):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,walk(v)])):x;
    const resolved=walk(plan);
    if(JSON.stringify(resolved).includes('{{'))throw Error(stock.code+': unresolved report binding');
    return resolved;
  }
  root.ResearchBindings={text,value,resolvePlan};
})(typeof window!=='undefined'?window:globalThis);
