# Pocky 桌宠 🐕 —— 住在电脑里的狗狗

一只常驻在你屏幕底部的小狗：会自己散步、坐下、打盹，夜里困了会睡觉；
可以摸它、喂它、拖着它走，双击它会叫两声。它记得你摸过它多少次、陪伴了你多少天，
关机再开还是同一只 Pocky。

当前形象是程序画的柴犬占位形象，之后可以换成用 Pocky 真实照片做的精灵图（见下文）。

## 运行（桌宠模式）

需要 [Node.js](https://nodejs.org/)（v18 以上）。

```bash
cd desktop-pet
npm install
npm start
```

国内网络下载 Electron 慢的话，先设置镜像再装：

```bash
npm config set registry https://registry.npmmirror.com
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install   # Windows 用 set ELECTRON_MIRROR=... 再 npm install
```

启动后 Pocky 会出现在主屏幕底部，鼠标不在它身上时窗口完全穿透，不影响正常操作。

## 快速预览（不装任何东西）

直接用浏览器打开 `renderer/index.html` 就能看到它活动（少了穿透和常驻，仅供预览）。
加参数可以调试：`index.html?scale=1.5` 变大，`?pose=sit` 锁定姿势。

## 互动方式

| 操作 | 反应 |
|------|------|
| 单击狗狗 | 摸摸头，冒爱心，亲密度 +1 |
| 双击 | 汪汪叫（放 `renderer/assets/bark.mp3` 可换成 Pocky 的真实叫声） |
| 按住拖动 | 抱着它换个地方 |
| 右键 | 菜单：摸摸头 / 喂零食 / 去睡觉 / 看看状态 / 退出 |
| 超过 8 小时没见 | 启动时它会跑过来说「想你了！」 |
| 深夜（23 点后） | 它基本都在睡觉 |

亲密度、陪伴天数等记忆保存在本地，退出不会丢。

## 系统托盘

托盘里有一个小爪印图标，可以显示/隐藏 Pocky 或退出。

## 开机自启（让它一直活着）

- **Windows**：`Win+R` 输入 `shell:startup`，放一个指向 `npm start`（或打包后 exe）的快捷方式
- **macOS**：系统设置 → 通用 → 登录项，添加应用
- 之后可以用 electron-builder 打包成独立应用，双击即用

## 换成真实的 Pocky（下一步）

形象绘制集中在 `renderer/dog.js` 的 `drawDog()` 一个函数里，行为引擎不用动。
用 Pocky 的照片/视频制作各姿势的透明底精灵图（站、走 2–4 帧、坐、趴睡），
替换 `drawDog` 为贴图绘制即可。详见仓库根目录 `PLAN.md` 的阶段 2。

## 已知限制

- Linux 下窗口透明依赖合成器（GNOME/KDE 默认没问题）
- 多显示器时默认出现在主屏幕
