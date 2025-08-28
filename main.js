const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  shell,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const log = require("electron-log");
require("dotenv").config();

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
// log.info("App starting...");

let mainWindow;
let currentMediaType = null;
let lastActiveView = null;

const apiCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;

const API_KEYS = {
  comicVine: process.env.COMIC_VINE_API_KEY,
  tmdb: process.env.TMDB_API_KEY,
  giantBomb: process.env.GIANT_BOMB_API_KEY,
};

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("minha-lista", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("minha-lista");
}

function broadcastDeepLink(url) {
  if (!url || !url.startsWith("minha-lista://")) return;
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("deep-link-received", url);
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    const deepLinkUrl = commandLine.find((arg) =>
      arg.startsWith("minha-lista://")
    );
    broadcastDeepLink(deepLinkUrl);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 950,
    minWidth: 880,
    minHeight: 500,
    frame: false,
    show: false,
    backgroundColor: "#121212",
    icon: path.join(__dirname, "src/assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  //mainWindow.webContents.openDevTools();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.loadFile(path.join(__dirname, "src/html/login.html"));

  const deepLinkOnStartup = process.argv.find((arg) =>
    arg.startsWith("minha-lista://")
  );
  if (deepLinkOnStartup) {
    mainWindow.webContents.once("dom-ready", () => {
      broadcastDeepLink(deepLinkOnStartup);
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdates();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

autoUpdater.on("update-downloaded", () => {
  log.info("Atualização baixada.");
  if (mainWindow) {
    mainWindow.webContents.send("update-ready");
  }
});

ipcMain.on("quit-and-install-update", () => autoUpdater.quitAndInstall());
ipcMain.on("ready-to-show", () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
});
ipcMain.on("open-external-link", (event, url) => shell.openExternal(url));

ipcMain.on("navigate-to-hub", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.loadFile(path.join(__dirname, "src/html/hub.html"));
});

ipcMain.on("navigate-to-dashboard", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.loadFile(path.join(__dirname, "src/html/painel.html"));
});

ipcMain.on("navigate-to-list", (event, mediaType) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    currentMediaType = mediaType;
    win.loadFile(path.join(__dirname, "src/html/list-view.html"));
  }
});
ipcMain.handle("get-list-type", () => {
  return currentMediaType;
});
ipcMain.on("navigate-to-settings", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    lastActiveView = win.webContents.getURL();
    win.loadFile(path.join(__dirname, "src/html/settings.html"));
  }
});
ipcMain.on("navigate-back", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && lastActiveView) {
    win.loadURL(lastActiveView);
  } else if (win) {
    win.loadFile(path.join(__dirname, "src/html/hub.html"));
  }
});
ipcMain.on("navigate-to-main", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.loadFile(path.join(__dirname, "src/html/login.html"));
});
ipcMain.on("navigate-to-confirm-register", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.loadFile(path.join(__dirname, "src/html/confirm-register.html"));
});

ipcMain.on("logout", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    session.defaultSession.clearStorageData().then(() => {
      win.loadFile(path.join(__dirname, "src/html/login.html"));
    });
  }
});

ipcMain.on("minimize-window", (event) =>
  BrowserWindow.fromWebContents(event.sender)?.minimize()
);
ipcMain.on("maximize-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on("close-window", () => app.quit());

ipcMain.handle("get-firebase-config", () => {
  return FIREBASE_CONFIG;
});

ipcMain.handle("carregar-settings", async () => {
  const settingsFilePath = path.join(app.getPath("userData"), "settings.json");
  const systemLang = app.getLocale().startsWith("pt") ? "pt" : "en";

  let defaultConfig = {
    theme: "theme-dark",
    accentColor: "blue",
    language: systemLang,
  };

  try {
    if (fs.existsSync(settingsFilePath)) {
      const fileData = fs.readFileSync(settingsFilePath, "utf8");
      const savedSettings = JSON.parse(fileData);
      if (savedSettings.language) {
        defaultConfig.language = savedSettings.language;
      }
      return { ...defaultConfig, ...savedSettings };
    } else {
      fs.writeFileSync(
        settingsFilePath,
        JSON.stringify(defaultConfig, null, 2)
      );
      return defaultConfig;
    }
  } catch (error) {
    log.error("Falha ao carregar ou criar configurações:", error);
    try {
      if (!fs.existsSync(settingsFilePath)) {
        fs.writeFileSync(
          settingsFilePath,
          JSON.stringify(defaultConfig, null, 2)
        );
      }
    } catch (saveError) {
      log.error("Não foi possível salvar a configuração padrão:", saveError);
    }
    return defaultConfig;
  }
});

ipcMain.on("salvar-settings", (event, settings) => {
  const settingsFilePath = path.join(app.getPath("userData"), "settings.json");
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
  } catch (error) {
    log.error("Falha ao salvar configurações:", error);
  }
});

ipcMain.handle("importar-json", async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (canceled || filePaths.length === 0) return null;
    const fileData = fs.readFileSync(filePaths[0], "utf8");
    const parsedData = JSON.parse(fileData);
    if (
      parsedData &&
      typeof parsedData === "object" &&
      Object.keys(parsedData).length > 0
    ) {
      return parsedData;
    }
    return null;
  } catch (error) {
    log.error("Falha ao importar JSON:", error);
    return null;
  }
});

ipcMain.handle("exportar-json", async (event, dados) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Salvar Backup da Lista",
      defaultPath: `backup_lista_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (canceled || !filePath)
      return { success: false, message: "Exportação cancelada." };
    fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    log.error("Falha ao exportar JSON:", error);
    return { success: false, message: "Falha ao exportar arquivo." };
  }
});

async function fetchData(url, options = {}) {
  const cacheKey = url;
  const cached = apiCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    // log.info(`[CACHE] Retornando dados para: ${url}`);
    return cached.data;
  }

  // log.info(`[API] Buscando dados de: ${url}`);
  try {
    const finalOptions = {
      ...options,
      headers: {
        ...options.headers,
        "User-Agent": "MyListDesktopApp/1.0",
      },
    };

    const response = await fetch(url, finalOptions);

    if (!response.ok) {
      const errorBody = await response.text();
      log.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error && data.error.toUpperCase() !== "OK") {
      log.error("API Error (não OK):", data.error);
      return {
        error: true,
        message: `Erro da API Externa: ${data.error}`,
      };
    }

    apiCache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    log.error("API Fetch Error:", url, error);
    return {
      error: true,
      message: error.message || "An unknown network error occurred",
    };
  }
}

ipcMain.handle("search-media", async (event, { mediaType, term }) => {
  let url;
  switch (mediaType) {
    case "anime":
      url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(
        term
      )}&type=tv&order_by=popularity`;
      break;
    case "manga":
      url = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(
        term
      )}&order_by=popularity`;
      break;
    case "movies":
      url = `https://api.themoviedb.org/3/search/multi?api_key=${
        API_KEYS.tmdb
      }&query=${encodeURIComponent(term)}&language=pt-BR`;
      break;
    case "series":
      url = `https://api.themoviedb.org/3/search/tv?api_key=${
        API_KEYS.tmdb
      }&query=${encodeURIComponent(term)}&language=pt-BR`;
      break;
    case "comics":
      url = `https://comicvine.gamespot.com/api/search/?api_key=${
        API_KEYS.comicVine
      }&format=json&resources=volume&query=${encodeURIComponent(
        term
      )}&field_list=id,name,image,publisher,start_year`;
      break;
    case "books":
      url = `https://openlibrary.org/search.json?q=${encodeURIComponent(term)}`;
      break;
    case "games":
      url = `https://www.giantbomb.com/api/search/?api_key=${
        API_KEYS.giantBomb
      }&format=json&query=${encodeURIComponent(
        term
      )}&resources=game&field_list=guid,name,image`;
      break;
    default:
      return { error: true, message: "Invalid media type" };
  }
  return fetchData(url);
});

ipcMain.handle("get-media-details", async (event, { mediaType, id }) => {
  // log.info(`[DETAILS] Recebido pedido para mediaType: ${mediaType}, ID: ${id}`);
  let url;
  switch (mediaType) {
    case "anime":
      url = `https://api.jikan.moe/v4/anime/${id}/full`;
      break;
    case "manga":
      url = `https://api.jikan.moe/v4/manga/${id}/full`;
      break;
    case "movies":
    case "movie":
      url = `https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      break;
    case "collection":
      url = `https://api.themoviedb.org/3/collection/${id}?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      break;
    case "series":
      url = `https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      break;
    case "comics":
      url = `https://comicvine.gamespot.com/api/volume/4050-${id}/?api_key=${API_KEYS.comicVine}&format=json&field_list=id,name,image,publisher,description,issues,start_year`;
      break;
    case "books":
      url = `https://openlibrary.org${id}.json`;
      break;
    case "games":
      url = `https://www.giantbomb.com/api/game/${id}/?api_key=${API_KEYS.giantBomb}&format=json&field_list=guid,name,image,platforms,deck,original_release_date,genres`;
      break;
    default:
      log.error(`[DETAILS] Tipo de mídia inválido: ${mediaType}`);
      return { error: true, message: "Invalid media type" };
  }
  return fetchData(url);
});

ipcMain.handle("get-trending-media", async (event, { mediaType }) => {
  let url;
  const today = new Date();
  const lastYear = new Date(
    today.getFullYear() - 1,
    today.getMonth(),
    today.getDate()
  )
    .toISOString()
    .split("T")[0];

  switch (mediaType) {
    case "anime":
      url = `https://api.jikan.moe/v4/top/anime`;
      return fetchData(url);
    case "manga":
      url = `https://api.jikan.moe/v4/top/manga`;
      return fetchData(url);
    case "movies": {
      url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      const data = await fetchData(url);
      if (data && data.results) {
        data.results.forEach((item) => (item.type = "movie"));
      }
      return data;
    }
    case "series": {
      url = `https://api.themoviedb.org/3/trending/tv/week?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      const data = await fetchData(url);
      if (data && data.results) {
        data.results.forEach((item) => (item.type = "series"));
      }
      return data;
    }
    case "comics":
      url = `https://comicvine.gamespot.com/api/volumes/?api_key=${API_KEYS.comicVine}&format=json&sort=date_added:desc&limit=20&field_list=id,name,image,publisher,start_year`;
      return fetchData(url);
    case "books":
      url = `https://openlibrary.org/subjects/fiction.json?limit=20`;
      return fetchData(url);
    case "games":
      url = `https://www.giantbomb.com/api/games/?api_key=${
        API_KEYS.giantBomb
      }&format=json&filter=original_release_date:${lastYear}|${
        today.toISOString().split("T")[0]
      }&sort=number_of_user_reviews:desc&limit=20&field_list=guid,name,image`;
      return fetchData(url);
    default:
      return {
        error: true,
        message: "Trending not available for this media type",
      };
  }
});

ipcMain.handle("get-random-media", async (event, { mediaType }) => {
  let url;
  const randomPage = Math.floor(Math.random() * 100) + 1;
  switch (mediaType) {
    case "anime":
      url = `https://api.jikan.moe/v4/random/anime`;
      return fetchData(url);
    case "manga":
      url = `https://api.jikan.moe/v4/random/manga`;
      return fetchData(url);
    case "movies":
      url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEYS.tmdb}&language=pt-BR&sort_by=popularity.desc&page=${randomPage}`;
      return fetchData(url);
    case "series":
      url = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEYS.tmdb}&language=pt-BR&sort_by=popularity.desc&page=${randomPage}`;
      return fetchData(url);
    case "comics":
      try {
        const initialUrl = `https://comicvine.gamespot.com/api/volumes/?api_key=${API_KEYS.comicVine}&format=json&limit=1`;
        const initialData = await fetchData(initialUrl);
        const totalResults = initialData.number_of_total_results;
        if (!totalResults) {
          throw new Error("Não foi possível obter o total de Volumes de HQs.");
        }
        const randomOffset = Math.floor(Math.random() * totalResults);
        const randomUrl = `https://comicvine.gamespot.com/api/volumes/?api_key=${API_KEYS.comicVine}&format=json&limit=1&offset=${randomOffset}&field_list=id,name,image,publisher,start_year`;
        const randomData = await fetchData(randomUrl);
        if (randomData && randomData.results) {
          return { data: randomData.results };
        }
        return randomData;
      } catch (error) {
        return { error: true, message: error.message };
      }
    case "books":
      const randomOffsetBooks = Math.floor(Math.random() * 1000);
      url = `https://openlibrary.org/subjects/love.json?limit=50&offset=${randomOffsetBooks}`;
      return fetchData(url);
    case "games":
      // log.info("[RANDOM GAME] Iniciando busca por jogo aleatório.");
      try {
        const countUrl = `https://www.giantbomb.com/api/games/?api_key=${API_KEYS.giantBomb}&format=json&limit=1&field_list=id`;
        const countData = await fetchData(countUrl);

        if (
          (countData.error && countData.error.toUpperCase() !== "OK") ||
          !countData.number_of_total_results
        ) {
          log.error(
            "[RANDOM GAME] Falha ao obter contagem total de jogos.",
            countData
          );
          throw new Error("Não foi possível obter a contagem total de jogos.");
        }

        const totalGames = countData.number_of_total_results;
        // log.info(`[RANDOM GAME] Total de jogos encontrados: ${totalGames}`);

        for (let i = 0; i < 5; i++) {
          const randomOffset = Math.floor(Math.random() * totalGames);
          // log.info(
          //   `[RANDOM GAME] Tentativa ${
          //     i + 1
          //   }: Buscando com offset ${randomOffset}`
          // );

          const randomGameUrl = `https://www.giantbomb.com/api/games/?api_key=${API_KEYS.giantBomb}&format=json&limit=1&offset=${randomOffset}&field_list=guid,name,image,deck,original_release_date,platforms,genres`;
          const randomGameData = await fetchData(randomGameUrl);

          if (
            (randomGameData.error &&
              randomGameData.error.toUpperCase() !== "OK") ||
            !randomGameData.results ||
            randomGameData.results.length === 0
          ) {
            log.warn(
              `[RANDOM GAME] Tentativa ${
                i + 1
              } falhou ao buscar jogo da lista. Continuando...`
            );
            continue;
          }

          const randomGame = randomGameData.results[0];
          if (randomGame.guid && randomGame.name && randomGame.image) {
            // log.info(
            //   `[RANDOM GAME] Sucesso! Jogo encontrado: ${randomGame.name} (GUID: ${randomGame.guid})`
            // );
            return { results: [randomGame] };
          }
        }

        log.error(
          "[RANDOM GAME] Não foi possível encontrar um jogo aleatório válido após 5 tentativas."
        );
        throw new Error("Não foi possível encontrar um jogo aleatório válido.");
      } catch (error) {
        log.error("[RANDOM GAME] Erro final no processo de busca:", error);
        return { error: true, message: error.message };
      }
    default:
      return {
        error: true,
        message: "Random not available for this media type",
      };
  }
});
