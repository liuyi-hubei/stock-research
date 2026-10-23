# 2026-10-23 证据优先框架集成记录

## 范围与权限

- 仓库：`D:/code_files/stock_research/github_file/stock-research`。
- 基准HEAD：`86a138fe334614f7a6f76dcf666f76ad4e984ab9`；工作区已有多轮未提交改动，HEAD不是本轮完整输入。
- 授权：用户批准六章框架及多agent规范。authority为历史证据结构整理、页面/归档及规范实现；不刷新行情、不调模型、不改资格、不发布。
- 语义基线：网站外`outputs/framework-before.json`，包含本轮接入前全部54股对象、同引擎结果及15个行业对象，集成后逐项一致。
- 原主报告备份：网站外`outputs/framework-migration-backup-20261023/`，保留泸州、三七、牧原迁移前人工主报告；对应数据核验文件未覆盖。

## 已完成认领

| 负责人 | 精确写集合 | 状态与交接 |
| --- | --- | --- |
| Arendt（01a16803-401a-7cb1-9743-45dc2d0c917f） | docs/research-framework.md、docs/multi-agent-workflow.md | 规范已交接并停止写；集成人已按真实实现修订状态文案和schema |
| Noether（01a16803-4132-7e03-a675-60ec35b15fc6） | data/research/000568.js、data/research/002555.js、data/research/002714.js | 历史证据、反证、4项指标/股及台账已交接并停止写；没有共享金融参数写入 |
| 当前会话主agent（唯一集成人） | 根/项目AGENTS、README、研究方法；assets/app.js、assets/research-framework.js、assets/site.css；四HTML入口；docs下框架加载/校验/生成/浏览器回归、相关发布/路由/导出检查；三只主报告生成区 | 串行集成，未改data/stocks.js、data/additional-stocks.js、data/industries.js及收益引擎 |

此记录是写入边界说明，不是操作系统排他锁。后续agent须建新任务记录并重读当前文件，不能把已结束任务视为仍占用。

## 保持不变的财务基线SHA-256

以下文件本轮未写入；哈希在集成时取得，并与接入前语义快照比对一致，不冒充共享实现的修改前哈希。

| 文件 | SHA-256 |
| --- | --- |
| data/stocks.js | B9B251ED0B4A1A5A22516C6B81235EFDB84291BB37DEE5A1CE49AD9CF70941DA |
| data/additional-stocks.js | 52BBA9709D15956922F9F6BA6B32FA682C96DA6DF5816A23FD27C6B90F391F34 |
| assets/shareholder-model.js | 8FBC427BA3CBE1F843FE8C9C7C075103EAB9E5CDDAA43DD6417B0910345DBD04 |

## 证据与模型交接

三只实际财务仍2026H1；泸州行情10月21日，三七和牧原10月22日，牧原经营月报9月。来源按原股票sources零基索引关联，注明继承，未开展新取证；需要原公告定位和经营桥接的缺口没有用模板填平。泸州/三七conditional，牧原pending，无ready升级，原资格不变。其他51股尚未迁移。

## 验证与待办

- 本轮已运行：新schema/来源范围/安全转义/空值状态检查，六章归档只读同步检查，原正文数字、模型、价格试算、模型审阅区、模型说明、74路由与本地发布完整性检查，均通过。
- 浏览器：三股×1440/320/390/430，六章目录、证据与反证、旧试算输入/恢复、牧原无试算、页面及目录无横向溢出、控制台无错误；通过。截图在忽略目录output/playwright/framework-*。
- 这些检查只验证结构、计算和一致性，不是金融审计，不证明增长/分红预测可靠。原始研究缺口、未来产品/价差/现金验证与实际预测误差仍待后续获授权研究。
- 后续迁移按单股认领推进，不批量调参，不自动迁移其他51股；模型变更另交证据和最小patch，由唯一集成人应用。
- 仅本地，没有commit、push或部署。
