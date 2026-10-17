const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const isDev = !app.isPackaged;
let server;

function startStaticServer(rootDir) {
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );

    const filePath = path.resolve(rootDir, "." + pathname);

    if (
      !filePath.startsWith(path.resolve(rootDir) + path.sep) &&
      filePath !== path.resolve(rootDir)
    ) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".fbx": "application/octet-stream",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".webp": "image/webp",
      };

      res.writeHead(200, {
        "Content-Type": types[ext] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true);

  if (isDev) {
    await win.loadURL("http://localhost:5173");
  } else {
    const rootDir = path.join(app.getAppPath(), "dist");
    const port = await startStaticServer(rootDir);
    await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  }

  win.once("ready-to-show", () => win.show());
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (server) server.close();
  app.quit();
});
