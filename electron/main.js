const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let nextServer = null;

// Next.js server'ı başlat (production standalone mode)
function startNextServer() {
  return new Promise((resolve, reject) => {
    const isDev = !app.isPackaged;
    let serverProcess;

    if (isDev) {
      // Development: next dev
      console.log("[Electron] Dev mode: starting next dev...");
      serverProcess = spawn("npx", ["next", "dev", "-p", "3000"], {
        cwd: app.getAppPath(),
        stdio: "pipe",
        shell: true,
        env: { ...process.env, NODE_ENV: "development" },
      });
    } else {
      // Production: standalone server
      console.log("[Electron] Production mode: starting standalone server...");
      const serverPath = path.join(
        process.resourcesPath,
        "app",
        ".next",
        "standalone",
        "server.js"
      );
      serverProcess = spawn("node", [serverPath], {
        cwd: path.join(process.resourcesPath, "app"),
        stdio: "pipe",
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: "3000",
          HOSTNAME: "127.0.0.1",
        },
      });
    }

    serverProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log("[Next.js]", output);
      if (output.includes("Ready") || output.includes("ready in")) {
        resolve();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error("[Next.js error]", data.toString());
    });

    serverProcess.on("error", (err) => {
      console.error("[Server error]", err);
      reject(err);
    });

    // Timeout - 30 saniye sonra resolve et (server yavaş başlarsa)
    setTimeout(() => resolve(), 30000);

    nextServer = serverProcess;
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "Kutadgubilgi Code",
    backgroundColor: "#0a0a0b",
    show: false,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Loading screen
  mainWindow.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(`
        <html>
          <body style="margin:0;padding:0;background:#0a0a0b;color:#fafafa;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:20px;">
            <div style="font-size:24px;font-weight:600;">Kutadgubilgi Code</div>
            <div style="font-size:14px;color:#888;">Yükleniyor...</div>
            <div style="width:200px;height:3px;background:#222;border-radius:2px;overflow:hidden;">
              <div style="width:100%;height:100%;background:#f59e0b;animation:load 1.5s ease-in-out infinite;"></div>
            </div>
            <style>
              @keyframes load { 0%,100% { transform: translateX(-100%); } 50% { transform: translateX(100%); } }
            </style>
          </body>
        </html>
      `)
  );

  // Server başlat
  await startNextServer();

  // Next.js app yükle
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL("http://127.0.0.1:3000");
      mainWindow.show();

      // Production'da DevTools'u kapat
      if (app.isPackaged) {
        // Menu'yi kaldır (production)
        Menu.setApplicationMenu(null);
      }
    }
  }, 1000);

  // External link'leri tarayıcıda aç
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes("kutadgubilgi.com") || url.startsWith("http")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// App ready
app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Tüm pencereler kapandı
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// App kapanırken server'ı kapat
app.on("before-quit", () => {
  if (nextServer) {
    try {
      nextServer.kill();
    } catch (e) {
      console.error("[Server kill error]", e);
    }
  }
});

// Security: navigation'ı kısıtla
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== "http://127.0.0.1:3000") {
      event.preventDefault();
    }
  });
});
