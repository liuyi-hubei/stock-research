# 行业报告

本目录用于集中保存行业研究报告的原始归档（PDF / Markdown）。

网页版报告在 `data/industries.js` 中结构化维护，由 `industry.html?id=<报告id>` 渲染成站点统一版式；本目录保留原始文件作为溯源与下载来源。

当前已归档：

- 白酒板块景气度分析报告（PDF）→ 网页版：`industry.html?id=baijiu`

后续新增行业报告时：原始文件放本目录，结构化内容加入 `data/industries.js`，`industry.html` 即自动出现在行业报告列表。统计图使用 `chart` 数据块维护数值、单位和来源，由页面渲染为可缩放的网页图表；避免把低分辨率截图放大展示。原始 PDF 保留供核对。
