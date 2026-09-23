# 长期主义研究室

无需数据库或构建工具的个股与行业研究静态网站。首页按个股报告中的基准十年年化收益率展示 Top 10，个股和行业报告分别有独立页面。收益率是带假设的研究情景，不是收益承诺。

## 本地预览

```bash
python3 -m http.server 8080
```

打开 `http://localhost:8080/`。个股结构化数据位于 `data/stocks.js` 和 `data/additional-stocks.js`，Markdown 报告归档位于 `reports/stocks/`，行业报告位于 `data/industries.js` 与 `reports/industries/`。修改后先检查本地页面，再提交到 `main`。

## 本地完整性检查

```bash
node docs/validate.mjs
node docs/render-archive.mjs --check
git diff --check
```

检查覆盖全部个股/行业路由、站内文件与目录锚点、脚本加载顺序、负收益率图，以及补充报告原文与阅读页是否同步。另需用浏览器检查桌面和手机布局。

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
