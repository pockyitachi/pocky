const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');

let win = null;
let tray = null;

// Linux 下透明窗口需要提前开启透明视觉效果
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals');
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const height = 260;

  win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y + workArea.height - height,
    width: workArea.width,
    height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // screen-saver 层级保证盖在全屏应用之上也可见
  win.setAlwaysOnTop(true, 'screen-saver');
  // 默认鼠标穿透，只有指到狗身上时由渲染进程请求接管
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// 用内存位图画一个 16x16 的小爪印当托盘图标，省去图片资源
function buildTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);
  const put = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = 255; // BGRA
  };
  const disc = (cx, cy, rad) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) put(x, y, 232, 160, 92);
  };
  disc(8, 10, 4);      // 掌心
  disc(4, 5, 1.8);     // 三个脚趾
  disc(8, 3.5, 1.8);
  disc(12, 5, 1.8);
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function createTray() {
  try {
    tray = new Tray(buildTrayIcon());
    tray.setToolTip('Pocky 在这里');
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: '显示 / 隐藏 Pocky',
        click: () => (win.isVisible() ? win.hide() : win.show()),
      },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]));
  } catch (err) {
    // 托盘创建失败不影响主体功能，右键狗狗也能退出
    console.error('tray failed:', err.message);
  }
}

ipcMain.on('set-ignore-mouse', (_e, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});
ipcMain.on('quit-app', () => app.quit());

app.whenReady().then(() => {
  // Linux 上等待合成器就绪，否则透明会失效
  const delay = process.platform === 'linux' ? 400 : 0;
  setTimeout(() => {
    createWindow();
    createTray();
  }, delay);
});

app.on('window-all-closed', () => app.quit());
