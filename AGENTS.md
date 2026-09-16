# AGENTS.md — 个股研究静态网站协作说明

## 项目定位

这是一个纯静态的长期个股研究网站，用于展示预期收益率排名、个股研究报告和投资框架内容。项目不依赖前端构建工具，浏览器直接加载 HTML、CSS、JavaScript 和数据文件。

## 目录分工

- `index.html`：首页结构与入口文案。
- `stock.html`：个股详情页结构与报告容器。
- `assets/app.js`：页面渲染、路由参数、排名逻辑和数据映射。
- `assets/site.css`：唯一的全站样式入口，按设计变量、基础、页面、研究组件、响应式组织；不再叠加历史覆盖样式文件。
- `assets/brand-mark.svg`：站点标识与浏览器图标共用的图形资源。
- `data/stocks.js`：基础股票清单、站点元数据和更新记录；必须保持为有效 JavaScript。
- `data/additional-stocks.js`：扩展股票研究数据；在三个 HTML 入口中必须位于 `stocks.js` 之后、`app.js` 之前加载。
- `data/industries.js`：行业报告的结构化正文、表格与图表数据；`industry.html` 为详情入口。
- `reports/stocks/`：个股研究报告 Markdown 归档，文件名使用 `股票名称-股票代码.md`。
- `reports/industries/`：行业研究报告 Markdown 原稿与归档。
- `docs/`：研究方法和项目说明。
- `.github/workflows/`：GitHub 与阿里云自动部署配置。代码推送到 GitHub 后由阿里云自动刷新；除非项目负责人明确要求，不手动触发部署或修改部署流程。

## 内容与数据规则

1. 新增股票默认写入 `data/additional-stocks.js`，原有基础股票仍在 `data/stocks.js`；更新时修改股票实际所在文件，并同步维护对应的 `reports/stocks/*.md`。
2. 首页“预期收益率排名”由数据中的 `baseReturn` 自动排序并最多展示十只，不要把排名或数值写死在 HTML 中。
3. 每只股票都应能通过现有详情页路由打开；更新数据后要检查首页、详情页和各投资者视角页面。
4. 报告应保留研究日期、数据口径和来源说明；后续更新默认覆盖当前报告内容，除非明确要求保留历史快照。
5. 不凭空补充行情、财务数据或投资者观点；结论应明确这是研究记录，不构成个人投资建议。

## 前端修改规则

- 页面视觉保持统一的深色金融研究风格、栅格、间距、圆角和文字层级。
- 优先复用现有组件和 CSS 变量，避免为单个页面堆叠一次性样式。
- 全局导航由 `assets/app.js` 的 `navigation` 配置生成，使用 `aria-current="page"` 标记当前栏目；报告分类只在顶部出现。
- 修改颜色与圆角优先更新 `assets/site.css` 顶部变量，组件规则在对应分区修改，不在文件末尾追加新版本覆盖。新增静态资源后同步检查三个 HTML 入口。
- 保证桌面端和移动端都可读，避免横向溢出、过长标题异常换行和不可见文字。
- 除非任务确有必要，不新增框架、依赖或构建步骤。
- 行业报告的统计图使用可缩放的 HTML 图表组件，数值和来源放在 `data/industries.js`；避免放大含文字的低分辨率截图。报告目录锚点保持唯一。

## 本地预览与校验

在本目录执行：

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080/`。提交前至少执行：

```bash
node --check assets/app.js
node --check data/stocks.js
node --check data/additional-stocks.js
node --check data/industries.js
git diff --check
```

并手动检查首页、至少一只股票详情页、移动端窄屏，以及浏览器控制台是否有错误。

## Git 协作流程

1. 开始工作前先读取或拉取 `main` 的最新版本，并确认当前文件状态。
2. 只修改任务涉及的文件，保留其他 agent 已完成的改动；发现冲突时先停止覆盖并说明冲突位置。
3. 研究报告采用“报告先入库、前端随后同步”的流程：
   - 个股报告先生成或更新到 `reports/stocks/股票名称-股票代码.md`；
   - 行业报告先生成或更新到 `reports/industries/` 对应文件；
   - 报告完成后直接推送到 GitHub 指定位置，无需等待项目负责人逐次确认；
   - 随后更新 `data/` 中的结构化内容及相关前端页面，完成校验后继续推送。
4. 每次提交保持主题单一、信息清楚；报告提交与前端同步可以拆成两个连续提交，便于追踪。
5. GitHub 更新后，阿里云会自动刷新并发布站点，不再单独登录服务器、手动运行部署工作流或请求部署确认。只有自动部署失败时才检查 Actions 和服务器配置。
6. 如果项目负责人明确要求“先审阅报告再更新前端”，则以该次任务的明确要求为准。
7. 不提交 Cookie、访问令牌、私钥、个人账号信息或其他敏感数据。

## 报告协作建议

负责个股研究内容的 agent 主要维护 `data/stocks.js`、`data/additional-stocks.js` 与 `reports/stocks/`；负责行业研究内容的 agent 主要维护 `data/industries.js` 与 `reports/industries/`；负责界面的 agent 主要维护 `index.html`、`stock.html`、`industry.html` 与 `assets/`。跨职责修改时，应在提交说明中写明影响的页面和数据字段，并确保更新后可以直接预览。
