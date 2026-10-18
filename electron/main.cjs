const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  Notification,
} = require("electron");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { execFile } = require("node:child_process");

const isDev = !app.isPackaged;
let server;
let staticServerPromise;
let staticServerPort;
let companionWindow;
let dashboardWindow;
let tray;

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

async function loadWindowURL(win, pathname = "index.html") {
  if (isDev) {
    await win.loadURL(`http://localhost:5173/${pathname}`);
    return;
  }

  // All packaged windows must share one origin so localStorage is shared between
  // the dashboard and the companion. A new random port per window isolates storage.
  if (!staticServerPromise) {
    const rootDir = path.join(app.getAppPath(), "dist");
    staticServerPromise = startStaticServer(rootDir).then((port) => {
      staticServerPort = port;
      return port;
    });
  }
  const port = staticServerPort ?? (await staticServerPromise);
  await win.loadURL(`http://127.0.0.1:${port}/${pathname}`);
}

function createTray() {
  try {
    const image = nativeImage.createFromPath(
      path.join(app.getAppPath(), "dist", "favicon.svg"),
    );
    tray = new Tray(image.resize({ width: 18, height: 18 }));
    tray.setToolTip("Desktop Companion");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open Dashboard", click: () => dashboardWindow?.show() },
        {
          label: "Show/Hide Companion",
          click: () => {
            if (companionWindow && companionWindow.isVisible())
              companionWindow.hide();
            else companionWindow?.show();
          },
        },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
      ]),
    );
    tray.on("click", () => dashboardWindow?.show());
  } catch (error) {
    console.warn("Tray unavailable:", error);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeText(value, fallback = "", maxLength = 220) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function getCompanionBounds(position = "top-right") {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.workArea;
  const companionWidth = 460;
  const companionHeight = 500;
  const margin = 24;

  const normalizedPosition =
    position === "top-left" ||
    position === "top-right" ||
    position === "bottom-left" ||
    position === "bottom-right" ||
    position === "center"
      ? position
      : "top-right";

  const left = x + margin;
  const right = x + width - companionWidth - margin;
  const top = y + margin;
  const bottom = y + height - companionHeight - margin;
  const centerX = x + (width - companionWidth) / 2;
  const centerY = y + (height - companionHeight) / 2;

  const nextBounds = {
    "top-left": { x: left, y: top },
    "top-right": { x: right, y: top },
    "bottom-left": { x: left, y: bottom },
    "bottom-right": { x: right, y: bottom },
    center: { x: centerX, y: centerY },
  }[normalizedPosition];

  return {
    x: clamp(nextBounds.x, x, Math.max(x, x + width - companionWidth)),
    y: clamp(nextBounds.y, y, Math.max(y, y + height - companionHeight)),
    width: companionWidth,
    height: companionHeight,
  };
}

function applyCompanionAlwaysOnTop(win) {
  if (!win) return;
  try {
    win.setAlwaysOnTop(true, "floating");
  } catch (error) {
    console.warn("Companion always-on-top fallback failed:", error);
  }
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });
}

async function createCompanionWindow() {
  const defaultBounds = getCompanionBounds("top-right");
  companionWindow = new BrowserWindow({
    width: defaultBounds.width,
    height: defaultBounds.height,
    x: defaultBounds.x,
    y: defaultBounds.y,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    movable: true,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  companionWindow.setBackgroundColor("#00000000");
  companionWindow.setIgnoreMouseEvents(false);
  companionWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });
  applyCompanionAlwaysOnTop(companionWindow);
  companionWindow.on("show", () => applyCompanionAlwaysOnTop(companionWindow));
  companionWindow.on("focus", () => applyCompanionAlwaysOnTop(companionWindow));
  companionWindow.on("restore", () =>
    applyCompanionAlwaysOnTop(companionWindow),
  );
  companionWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      companionWindow.hide();
    }
  });

  await loadWindowURL(companionWindow, "index.html?mode=companion");
  companionWindow.once("ready-to-show", () => {
    applyCompanionAlwaysOnTop(companionWindow);
    companionWindow.show();
  });
}

async function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 720,
    frame: true,
    backgroundColor: "#0c1220",
    show: false,
    title: "Desktop Companion Dashboard",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  dashboardWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      dashboardWindow.hide();
    }
  });

  await loadWindowURL(dashboardWindow, "index.html?mode=dashboard");
}

ipcMain.handle("dialog:open-directory", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });
  return canceled ? [] : filePaths;
});

ipcMain.handle("git:validate-repo", async (_, folderPath) => {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", folderPath, "rev-parse", "--is-inside-work-tree"],
      (error, stdout, stderr) => {
        resolve(!error && stdout.trim() === "true");
      },
    );
  });
});

ipcMain.handle("git:get-branch", async (_, folderPath) => {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", folderPath, "branch", "--show-current"],
      (error, stdout) => {
        resolve(error ? "unknown" : stdout.trim() || "detached");
      },
    );
  });
});

ipcMain.handle("git:get-latest-commit", async (_, folderPath) => {
  return new Promise((resolve) => {
    execFile(
      "git",
      [
        "-C",
        folderPath,
        "log",
        "-1",
        "--pretty=format:%h|%an|%ad|%s",
        "--date=iso-strict",
      ],
      (error, stdout) => {
        if (error) resolve(null);
        else {
          const [hash, author, date, ...messageParts] = stdout.split("|");
          resolve({
            hash,
            author,
            date,
            message: messageParts.join("|") || "",
          });
        }
      },
    );
  });
});

ipcMain.handle("window:move-companion", async (_, bounds) => {
  if (!companionWindow)
    return { ok: false, message: "Companion window not ready" };

  const safeBounds = {
    x: Number.isFinite(bounds?.x) ? Number(bounds.x) : 0,
    y: Number.isFinite(bounds?.y) ? Number(bounds.y) : 0,
    width: Number.isFinite(bounds?.width) ? Number(bounds.width) : 460,
    height: Number.isFinite(bounds?.height) ? Number(bounds.height) : 500,
  };

  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  safeBounds.x = clamp(
    safeBounds.x,
    workArea.x,
    workArea.x + workArea.width - safeBounds.width,
  );
  safeBounds.y = clamp(
    safeBounds.y,
    workArea.y,
    workArea.y + workArea.height - safeBounds.height,
  );

  companionWindow.setBounds(safeBounds);
  applyCompanionAlwaysOnTop(companionWindow);
  return { ok: true, ...safeBounds };
});

ipcMain.handle(
  "window:reposition-companion",
  async (_, position = "top-right") => {
    const nextBounds = getCompanionBounds(position);
    if (!companionWindow) return { ok: false, ...nextBounds, position };

    companionWindow.setBounds(nextBounds);
    applyCompanionAlwaysOnTop(companionWindow);
    return { ok: true, ...nextBounds, position };
  },
);

ipcMain.handle("window:restore-companion", async (_, payload = {}) => {
  if (!companionWindow) {
    await createCompanionWindow();
  }

  const position = payload?.position || "top-right";
  const nextBounds = getCompanionBounds(position);
  companionWindow.setBounds(nextBounds);
  companionWindow.show();
  companionWindow.focus();
  applyCompanionAlwaysOnTop(companionWindow);

  if (payload?.message) {
    const sanitized = {
      title: sanitizeText(payload.message.title, "Hey there!", 60),
      text: sanitizeText(payload.message.text, "Ready when you are.", 180),
      meta: sanitizeText(payload.message.meta, "Developer status", 60),
      source: payload.message.source || "custom",
      priority: Number.isFinite(payload.message.priority)
        ? Math.max(0, Math.min(Number(payload.message.priority), 100))
        : 80,
    };
    companionWindow.webContents.send("companion:message", sanitized);
  }

  return { ok: true, ...nextBounds, position };
});

ipcMain.handle("companion:update-message", async (_, payload = {}) => {
  const sanitized = {
    title: sanitizeText(payload?.title, "Hey there!", 60),
    text: sanitizeText(payload?.text, "Ready when you are.", 180),
    meta: sanitizeText(payload?.meta, "Developer status", 60),
    source: sanitizeText(payload?.source, "custom", 24),
    priority: Number.isFinite(payload?.priority)
      ? Math.max(0, Math.min(Number(payload.priority), 100))
      : 80,
  };

  if (companionWindow) {
    companionWindow.webContents.send("companion:message", sanitized);
    return { ok: true, message: sanitized.text };
  }

  return { ok: false, message: "Companion not available" };
});

ipcMain.handle("window:toggle-dashboard", () => {
  if (!dashboardWindow) return false;
  if (dashboardWindow.isVisible()) dashboardWindow.hide();
  else dashboardWindow.show();
  return dashboardWindow.isVisible();
});

ipcMain.handle("window:show-dashboard", () => {
  dashboardWindow?.show();
  dashboardWindow?.focus();
});

ipcMain.handle("window:toggle-companion", () => {
  if (!companionWindow) return false;
  if (companionWindow.isVisible()) companionWindow.hide();
  else {
    companionWindow.show();
    companionWindow.focus();
    applyCompanionAlwaysOnTop(companionWindow);
  }
  return companionWindow.isVisible();
});

ipcMain.handle("window:show-companion", async (_, payload = {}) => {
  if (!companionWindow) await createCompanionWindow();
  const position = payload?.position || "top-right";
  const bounds = getCompanionBounds(position);
  companionWindow.setBounds(bounds);
  companionWindow.show();
  applyCompanionAlwaysOnTop(companionWindow);
  if (payload?.message) companionWindow.webContents.send("companion:message", payload.message);
  return { ok: true, ...bounds, position };
});

ipcMain.handle("app:notify", async (_, message) => {
  const text = sanitizeText(message, "Desktop Companion reminder", 240);
  if (Notification.isSupported()) {
    new Notification({ title: "Desktop Companion", body: text, silent: false }).show();
  }
  if (tray) tray.setToolTip(text);
});

app.whenReady().then(async () => {
  createTray();
  await createCompanionWindow();
  await createDashboardWindow();
  if (dashboardWindow) dashboardWindow.show();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createCompanionWindow();
    await createDashboardWindow();
  }
});

app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
});
