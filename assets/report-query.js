/* 纯筛选：不修改研究数据、资格或排序。 */
(function () {
  const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
  const market=stock=>stock.market?.includes('港股')?'港股':stock.market?.includes('美股')?'美股':stock.market?.includes('A股')?'A股':'其他';
  const evidence=stock=>stock.model?.rankingDecision?.evidenceStatus || '未标注';
  function filter(stocks,query={},asOf) {
    const tokens=normalize(query.q).split(/\s+/).filter(Boolean);
    return stocks.filter(stock=>{
      const haystack=normalize(`${stock.name} ${stock.code} ${stock.industry} ${stock.market}`);
      return tokens.every(t=>haystack.includes(t)) &&
        (!query.industry || stock.industry===query.industry) &&
        (!query.market || market(stock)===query.market) &&
        (!query.evidence || evidence(stock)===query.evidence) &&
        (!query.freshness || window.ResearchFreshness.assess(stock,asOf).state===query.freshness);
    });
  }
  window.ReportQuery={normalize,market,evidence,filter};
})();
