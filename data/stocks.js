window.STOCK_RESEARCH = {
  meta: {
    siteName: "长期主义研究室",
    updatedAt: "2026-09-13",
    dataMode: "初版模型假设，非实时行情"
  },
  stocks: [
    {
      code: "000568",
      slug: "luzhou-laojiao",
      name: "泸州老窖",
      market: "深交所",
      industry: "高端白酒",
      status: "重点跟踪",
      thesis: "品牌势能和国窖1573的高端定位仍是价值核心，未来回报更依赖真实动销、渠道库存消化与分红兑现，而不是估值扩张。",
      questions: ["国窖1573批价能否企稳", "渠道库存是否回到健康区间", "现金回款是否匹配报表收入", "分红率能否持续提升"],
      risks: ["行业需求恢复慢于预期", "价格倒挂挤压渠道利润", "费用投入上升但动销未改善", "高端份额被头部品牌进一步集中"],
      model: { cost: 100, eps: 9.2, growth1: 5, growth2: 3, payout: 70, exitPE: 15 },
      modelNote: "演示参数，用于验证模型和页面交互；首次正式更新时以最新财报、公告、批价和渠道库存重估。",
      valuation: "待首次正式更新",
      confidence: "观察中",
      accent: "#d7a447"
    },
    {
      code: "600519",
      slug: "kweichow-moutai",
      name: "贵州茅台",
      market: "上交所",
      industry: "高端白酒",
      status: "核心对照",
      thesis: "稀缺品牌、强定价权和高现金转化构成长期质量基准；估值重点是增长中枢、分红能力与买入价格之间的关系。",
      questions: ["飞天批价与终端成交价趋势", "直销与经销结构变化", "系列酒增长质量", "资本回报与股东回报政策"],
      risks: ["社会库存与价格预期反转", "消费场景变化", "渠道政策扰动", "过高买入估值压低长期回报"],
      model: { cost: 1500, eps: 73, growth1: 7, growth2: 5, payout: 75, exitPE: 22 },
      modelNote: "演示参数，不代表当前股价或正式盈利预测；正式发布前需要按最新披露数据校准。",
      valuation: "待首次正式更新",
      confidence: "质量基准",
      accent: "#cf4f45"
    }
  ],
  updates: [
    { date: "2026-09-13", title: "网站初版", detail: "建立可扩展个股数据结构、研究页面与十年分红复投模型。", type: "系统" },
    { date: "待触发", title: "泸州老窖首次正式更新", detail: "核验最新财报、公告、批价、渠道库存和估值假设。", type: "研究" }
  ]
};
