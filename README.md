# wdfuare.com · 悬浮画布作品集

June 的 UI/UX 设计作品集。一张可以飞行浏览的 3D 设计画布：作品是浮在空中的界面卡片，点左侧导航，镜头飞到对应区块。

## 运行

需要 Node.js 22 或兼容版本。

```sh
npm ci
npm run dev       # 本地开发
npm run build     # 生成 dist/
npm run preview   # 预览构建结果
```

推送到 `main` 后，GitHub Actions 会自动构建并发布到 GitHub Pages（wdfuare.com）。

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面骨架和首页文字（真实 HTML，搜索引擎能读到） |
| `src/main.js` | 3D 场景：背景、星点、卡片、区块布局、镜头位置、动画 |
| `src/ui.js` | 导航、总览、面板、镜头飞行，以及键盘、滚轮、手机滑动 |
| `src/textures.js` | 用 canvas 画的卡片贴图 |
| `src/style.css` | 所有样式，含手机布局 |
| `public/quota/` | Quota Board 的 Mac 宣传网站，构建后通过 `/quota/` 访问 |

## 区块

| 编号 | 区块 | 内容 |
| --- | --- | --- |
| 01 | 首页 | 自我介绍 |
| 02 | 作品 | Case 02：Quota Board；Case 01、03 整理中 |
| 03 | 过程 | 过程记录（整理中） |
| 04 | 实验 | 会跟鼠标转的动效物件 |
| 05 | 关于 | 个人介绍 |
| 06 | 联系 | GitHub |

## 操作

Case 02 的功能演示地址为 [wdfuare.com/quota/](https://wdfuare.com/quota/)。项目卡片和作品区的按钮均可打开该页面。宣传网站的完整静态文件保存在 `public/quota/`，Vite 构建时会原样复制到 `dist/quota/`。

电脑：左侧导航、滚轮、`1`–`6`、方向键，`Tab` 总览，`Esc` 退出。手机：底部导航、上下滑动。系统开启"减少动态效果"时，镜头直接切换，不飞行。
