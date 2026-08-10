// 用 Electron(Chromium) 渲染 public/favicon.svg 生成 build/icon.ico（256x256）
// 保留 SVG 的渐变、滤镜等全部视觉效果
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const svgPath = path.join(__dirname, '..', 'public', 'favicon.svg');
const outFile = path.join(__dirname, '..', 'build', 'icon.ico');

// SVG 以 base64 data URL 内嵌，避免 data: 页面加载 file:// 资源被拦截
const svgDataUrl =
  'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(svgPath, 'utf8')).toString('base64');

// 按 SVG 原始比例（48:46）计算绘制尺寸，避免拉伸变形
const drawW = SIZE;
const drawH = Math.round((SIZE * 46) / 48);
const drawY = Math.round((SIZE - drawH) / 2);

// ICO 封装（单条 256x256 PNG 条目，现代 Windows 支持）
function encodeIco(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256 -> 0
  entry[1] = 0; // height 256 -> 0
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12); // image offset
  return Buffer.concat([header, entry, pngBuf]);
}

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: SIZE,
      height: SIZE,
      show: false,
      frame: false,
      webPreferences: { sandbox: true },
    });
    const html = `<!DOCTYPE html>
<html>
<body style="margin:0;background:transparent">
<img id="logo" style="position:absolute;top:${drawY}px;left:0;width:${drawW}px;height:${drawH}px" src="${svgDataUrl}" />
</body>
</html>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    // 等待 SVG 加载并绘制，返回 PNG dataURL（空字符串表示失败）
    const dataUrl = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const img = document.getElementById('logo');
        const draw = () => {
          const c = document.createElement('canvas');
          c.width = ${SIZE};
          c.height = ${SIZE};
          const ctx = c.getContext('2d');
          ctx.clearRect(0, 0, ${SIZE}, ${SIZE});
          ctx.drawImage(img, 0, ${drawY}, ${drawW}, ${drawH});
          resolve(c.toDataURL('image/png'));
        };
        if (img.complete && img.naturalWidth > 0) {
          draw();
        } else {
          img.onload = draw;
          img.onerror = () => resolve('');
        }
      })
    `);

    if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
      throw new Error('SVG 渲染失败');
    }

    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, encodeIco(png));
    console.log('Generated:', outFile, `(${png.length} bytes png)`);
    win.destroy();
    app.quit();
  } catch (err) {
    console.error('Icon render failed:', err);
    app.exit(1);
  }
});
