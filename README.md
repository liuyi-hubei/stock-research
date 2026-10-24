# 长期主义研究室

协作入口：[个股研究报告规范建议](docs/个股研究报告规范建议.md)。写作主版本为Skill内中文规范（2026-10-24-r2），本地与Work读取同一文件；未来利润与增速不是事实，历史只作参考，无可信现金量级不强给估值或买点。泸州老窖无依据的生命周期估值已撤回，旧十年模型仅作条件对照。历史实施记录已从AGENTS移至docs/历史实施记录.md，不能当现行待办。

2026-10-24：泸州老窖已按用户确认的六章重写：投资结论、商业模式、企业文化、安全边际与估值、其他思维观点、关键风险与后续验证。使用company-study-v2，目录与标题一致；10月23日69.99元收盘、实际2026H1，年报现金冲突回原表纠正。原情景及唯一IRR引擎不变，其他股票未刷新；下方旧结构说明继续适用于未迁移标的。最新写作要求见[个股研究报告规范建议](docs/个股研究报告规范建议.md)。

报告以[大师思维统一框架](docs/master-thinking.md)为分析主线，结合公司披露、研报、行业与行情证据形成独立判断；保留六章阅读顺序与当前结论结构，不按人物口吻或更新流水账堆叠。泸州老窖已整合正文、去掉重复旧段；财务与模型仍沿用各自注明的原取证日，并非全库数据刷新。

新增/重做个股先读[个股研究报告规范建议](docs/个股研究报告规范建议.md)：段永平主线、巴菲特与芒格检验、其余三位辅助；分别评价模式、文化、安全边际与估值可知程度；不把个人能力圈或闯关标签放进报告。泸州老窖已按此重写，保留原结论结构和条件模型，不代表刷新数据或已获买入验证。

新个股报告采用[当前六章规范](.agents/skills/master-thinking/references/个股研究规范.md)：投资结论、商业模式、企业文化、安全边际与估值、其他思维观点、关键风险与后续验证；旧evidence-first-v1章节继续兼容。泸州老窖/三七互娱/牧原股份为结构试点，未刷新事实或盈利参数。每股内容在 `data/research/CODE.js`，多agent请先读[协作规范](docs/multi-agent-workflow.md)；公共文件单写集成，不并发改共享数据。新检查：`node docs/check-research-framework.mjs`、`node docs/sync-research-framework.mjs --check`。

牧原股份与长鑫科技的旧收益估算已撤回，当前显示“待重新评估”，参考买入价暂不提供；两页不开放试算或展示旧情景，但保留经营事实与来源。`model.status = 'pending'` 明确区分研究尚未完成和计算错误，不影响其他股票的计算与排名。

个股页支持买入价即时试算：输入价格即可重算三情景IRR与回报差额，不修改报告或排名，支持恢复基准价。功能纯静态，发布后网页也可使用。全站股价由用户低频发起、Codex优先用妙想在本地核验更新，确认后发布；不部署自动行情服务。操作与数据边界见 [股价更新与估值试算](docs/股价更新与估值试算.md)。

模型支持逐年EPS增速与分红率、可配置分段和逐步收敛路径。详情页提供参数证据缺口、远期出售价值依赖和单项敏感性分析；关键假设未明的公司保留报告并暂停排名。旧参数不会在缺少证据时自动改写。协作规范见 `AGENTS.md` 的“参数研究与一致性规范”。更新后运行 `node docs/gen-model-explained.mjs` 和 `node docs/sync-model-review.mjs` 同步说明与归档审阅区。

无需数据库或构建工具的个股与行业研究静态网站。首页按个股报告的「基准十年股东现金流 IRR − 研究回报要求」差额排序，个股和行业报告分别有独立页面。收益率是带假设的研究情景，不是收益承诺。

全池已统一采用 `shareholder-irr-v1`（十年股东现金流 IRR）：买入 1 股后逐年领取现金分红、第十年末卖出，按年度现金流求税费前年化 IRR，分红不假设复投。首页按该口径的「基准 IRR − 回报要求」差额排序，并可切换按基准 IRR 排序。参数（起始 EPS、两阶段增速、分红率、退出 PE、回报要求）与价格／财报／假设日期见各股报告，计算逻辑见 `assets/shareholder-model.js`。

## 本地预览

行业报告采用统一阅读模板，接收Markdown/HTML/PDF。把文件发给Codex或放总项目`inputs/industry_reports/`，按[行业报告导入规范](docs/行业报告导入规范.md)整理并先本地确认；网站没有上传后台，文件复制不会自动生成页面。

个股报告页支持名称/代码/行业搜索与市场、行业、时效、证据状态的组合筛选；结果数量动态计算，条件保存在网址，刷新或分享链接可恢复，不影响原始研究与排名。筛选测试：`node docs/check-report-query.mjs`。

个股列表、排名与详情显示独立数据时效：行情日、实际财报期间、研究更新日（旧数据缺少时明确标模型记录）。按北京时间日历日，行情超过30天、研究/模型记录超过90天、财报截止超过240天建议复核；此为提醒规则，非数据正确或最新公告已查全的认证，不改排名。日期边界测试：`node docs/check-research-freshness.mjs`。

```bash
python3 -m http.server 8080
```

打开 `http://localhost:8080/`。个股结构化数据位于 `data/stocks.js` 和 `data/additional-stocks.js`，Markdown 报告归档位于 `reports/stocks/`，行业报告位于 `data/industries.js` 与 `reports/industries/`。修改后先检查本地页面，再提交到 `main`。

`reports/stocks/` 下的归档与页面使用同一口径，只有一套 `shareholder-irr-v1` 模板：新增标的用 `node docs/export-stock-archive.mjs 股票代码` 生成归档初稿（未登记的标的仍为手写研究稿）；参数或口径变动后运行 `node docs/gen-model-explained.mjs` 重出 `docs/model-explained.md` 的参数表与排名表。

## 本地完整性检查

```bash
node docs/validate.mjs
node docs/check-shareholder-model.mjs
node docs/check-report-numbers.mjs
node docs/render-archive.mjs --check
node docs/gen-model-explained.mjs --check
node docs/sync-model-review.mjs --check
node docs/check-publication.mjs
git diff --check
```

检查覆盖全部个股/行业路由、站内文件与目录锚点、脚本加载顺序、负收益率图、归档不得残留复投口径表述，以及补充报告原文与阅读页是否同步。另需用浏览器检查桌面和手机布局。

排名由共同引擎读取逐股 `model.rankingDecision`，不是计算成功就自动入榜。部分核验的公司明确显示缺口，关键证据未齐者保留条件演算但不参与正式排名。新股默认不获排名资格。生成文件的`--check`只读且失步时非零退出；正文数字核对仅覆盖明确标注的模型结论，不代替原始财报核验。发布检查目前仅本地依赖/类型检查，服务器发布脚本尚未完成审查计划中的改造。

真实浏览器回归脚本为 `docs/browser-regression.js`（Playwright CLI函数，不是网站运行依赖）。启动8080预览和CLI浏览器会话后，执行 `npx --yes --package @playwright/cli playwright-cli --session research run-code --filename docs/browser-regression.js`。首次开会话用同一CLI的 `--session research open http://127.0.0.1:8080/`；截图输出到已忽略的 `output/playwright/`，运行前确保目录存在。测试覆盖两种排序、10/全部切换、新股和分红边界/暂停样本的目录折叠、1440/390宽度、列表及运行时异常；CLI可能以零进程码报告错误，必须检查输出没有`Error`且`failures`/`errors`为空。

华能蒙电新增全面体检报告从个股页顶部进入；原文放在 `reports/stocks/`，修改后运行 `node docs/render-archive.mjs`，并将生成的 `report-600863-20260921.html` 一并保存。该页没有运行时依赖，图表数据也可展开为表格。

## 阿里云自动部署

服务器的 Nginx 网站根目录为 `/var/www/stock-research`。部署由服务器上的 `stock-research-pull.timer` 完成：每天北京时间 18:00 以低权限 `stockdeploy` 用户读取公开仓库的 `main` 分支，有新提交才同步静态文件。服务器时区设置为 `Asia/Shanghai`。18:00 之后推送的变更通常到次日 18:00 才会发布；如需提前发布，可手动启动下述服务。GitHub Actions **不再 SSH 登录服务器**；仓库不需要 `ALIYUN_HOST`、`ALIYUN_USER` 或 `ALIYUN_SSH_PRIVATE_KEY` Secrets。

部署脚本及 systemd 单元位于 [`deploy/`](deploy/)。首次安装或迁移服务器时，以具有管理权限的账号在服务器上执行（先确认该账号及 `/var/www/stock-research` 目录均属于预期项目）：

```bash
sudo install -d -o stockdeploy -g stockdeploy -m 0755 /var/lib/stock-research
sudo install -d -o stockdeploy -g stockdeploy -m 0755 /var/www/stock-research
sudo install -m 0755 deploy/server-pull.sh /usr/local/bin/stock-research-pull
sudo install -m 0644 deploy/stock-research-pull.service /etc/systemd/system/
sudo install -m 0644 deploy/stock-research-pull.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stock-research-pull.timer
sudo systemctl start stock-research-pull.service
```

上面的相对路径以仓库根目录为当前目录。脚本会在 `/var/lib/stock-research/source` 建立独立 Git 检出，不会把 `.git`、工作流、部署脚本或项目说明发布到网站。拉取失败、远端异常或服务器检出出现本地改动时会报错并保留已部署版本；不要直接修改服务器检出和网站文件，应修改 GitHub 仓库。

检查与手动同步：

```bash
sudo systemctl status stock-research-pull.timer
sudo systemctl list-timers stock-research-pull.timer
sudo journalctl -u stock-research-pull.service -n 50 --no-pager
sudo systemctl start stock-research-pull.service
cat /var/lib/stock-research/deployed-commit
```

仓库当前为公开仓库，因此服务器可匿名通过 HTTPS 拉取；若将来改为私有仓库，需要先配置**只读**部署凭据。请勿把 Token、Cookie、私钥写入仓库。若修改了 `deploy/` 下的脚本或 systemd 单元，仅推送 GitHub 不会自动更新服务器已安装的副本，需重新执行相应的 `install` 和 `systemctl daemon-reload`。

为避免误报，请在阿里云云安全中心保留异常登录检测。此次切换后，正常的网站更新不会从 GitHub 临时 IP 登录 SSH；若仍收到异常登录短信，应核对告警 IP、账号和时间，不要直接忽略。
