# 行业报告

本目录用于集中保存行业研究报告的原始归档（PDF / Markdown）。

待导入的Markdown、HTML或PDF可以直接发给Codex，或先放在总项目 `inputs/industry_reports/`。HTML原件不直接公开，整理后以Markdown归档；操作规范见 `docs/行业报告导入规范.md`。没有网站上传后台，文件复制到此处不会自动生成报告页。

网页版报告在 `data/industries.js` 中结构化维护，由 `industry.html?id=<报告id>` 渲染成站点统一版式；本目录保留原始文件作为溯源与下载来源。

当前已归档：

- 白酒板块景气度分析报告：历史PDF保留；2026-10-01新增需求链路与六家酒企份额三情景，完整归档为`白酒行业-需求与份额预测-20261001.md` → 网页版：`industry.html?id=baijiu`

后续新增行业报告时：原始文件放本目录，结构化内容加入 `data/industries.js`，`industry.html` 即自动出现在行业报告列表。统计图使用 `chart` 数据块维护数值、单位和来源，由页面渲染为可缩放的网页图表；避免把低分辨率截图放大展示。原始 PDF 保留供核对。
