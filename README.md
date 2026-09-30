# 长期主义研究室

模型支持逐年EPS增速与分红率、可配置分段和逐步收敛路径。详情页提供参数证据缺口、远期出售价值依赖和单项敏感性分析；关键假设未明的公司保留报告并暂停排名。旧参数不会在缺少证据时自动改写。协作规范见 `AGENTS.md` 的“参数研究与一致性规范”。更新后运行 `node docs/gen-model-explained.mjs` 和 `node docs/sync-model-review.mjs` 同步说明与归档审阅区。

无需数据库或构建工具的个股与行业研究静态网站。首页按个股报告的「基准十年股东现金流 IRR − 研究回报要求」差额排序，个股和行业报告分别有独立页面。收益率是带假设的研究情景，不是收益承诺。

全池已统一采用 `shareholder-irr-v1`（十年股东现金流 IRR）：买入 1 股后逐年领取现金分红、第十年末卖出，按年度现金流求税费前年化 IRR，分红不假设复投。首页按该口径的「基准 IRR − 回报要求」差额排序，并可切换按基准 IRR 排序。参数（起始 EPS、两阶段增速、分红率、退出 PE、回报要求）与价格／财报／假设日期见各股报告，计算逻辑见 `assets/shareholder-model.js`。

## 本地预览

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
