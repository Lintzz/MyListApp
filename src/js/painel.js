let t;
let allListsData = {};

async function applyTranslations(lang) {
  const response = await fetch(`../locales/${lang}.json`);
  const translations = await response.json();

  function translate(key, options = {}) {
    let text =
      key.split(".").reduce((obj, i) => (obj ? obj[i] : null), translations) ||
      key;
    for (const option in options) {
      text = text.replace(`{{${option}}}`, options[option]);
    }
    return text;
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key.startsWith("[") && key.includes("]")) {
      const match = key.match(/\[(.*?)\](.*)/);
      if (match) {
        const attr = match[1];
        const actualKey = match[2];
        element.setAttribute(attr, translate(actualKey));
      }
    } else {
      element.innerHTML = translate(key);
    }
  });
  return translate;
}

function calculateAndRenderOverview(lists) {
  let totalItems = 0;
  let totalCompleted = 0;
  let totalFavorites = 0;
  let totalMinutes = 0;

  const timeEstimates = {
    anime: 24,
    series: 45,
    movies: 110,
  };

  for (const mediaType in lists) {
    const list = lists[mediaType] || [];
    totalItems += list.length;
    list.forEach((item) => {
      if (item.isFavorite) {
        totalFavorites++;
      }

      let isFinished = true;
      let watchedEpisodes = 0;
      if (!item.temporadas || item.temporadas.length === 0) {
        isFinished = false;
      } else {
        item.temporadas.forEach((season) => {
          watchedEpisodes += season.watched_episodes || 0;
          if (
            (season.episodes || 0) > 0 &&
            (season.watched_episodes || 0) < season.episodes
          ) {
            isFinished = false;
          }
        });
      }
      if (isFinished) totalCompleted++;

      if (timeEstimates[mediaType]) {
        totalMinutes += watchedEpisodes * timeEstimates[mediaType];
      }
    });
  }

  document.getElementById("total-items").textContent = totalItems;
  document.getElementById("total-completed").textContent = totalCompleted;
  document.getElementById("total-favorites").textContent = totalFavorites;

  const totalHours = Math.floor(totalMinutes / 60);
  document.getElementById("total-time").textContent = `${totalHours}h`;
}

function renderFavoritesCarousel(lists) {
  const carouselContainer = document.getElementById("favorites-carousel");
  const allFavorites = [];

  for (const mediaType in lists) {
    const list = lists[mediaType] || [];
    list.forEach((item) => {
      if (item.isFavorite) {
        allFavorites.push(item);
      }
    });
  }

  if (allFavorites.length === 0) {
    carouselContainer.innerHTML = `<p class="placeholder-text" data-i18n="dashboard.no_favorites">${t(
      "dashboard.no_favorites"
    )}</p>`;
    return;
  }

  carouselContainer.innerHTML = "";
  allFavorites.forEach((item) => {
    const card = document.createElement("div");
    card.className = "favorite-item-card";
    card.innerHTML = `
            <img src="${
              item.image_url ||
              "https://placehold.co/140x200/1f1f1f/ffffff?text=Capa"
            }" alt="${item.title}">
            <span>${item.title}</span>
        `;
    carouselContainer.appendChild(card);
  });
}

function renderStatsByList(lists) {
  const container = document.getElementById("stats-by-list-container");
  container.innerHTML = "";

  const listOrder = [
    "anime",
    "manga",
    "series",
    "movies",
    "comics",
    "books",
    "games",
  ];
  const listIcons = {
    anime: "fa-tv",
    manga: "fa-book-open",
    series: "fa-video",
    movies: "fa-film",
    comics: "fa-book-dead",
    books: "fa-book",
    games: "fa-gamepad",
  };

  listOrder.forEach((mediaType) => {
    const list = lists[mediaType] || [];
    if (list.length === 0) return;

    const card = document.createElement("div");
    card.className = "list-stat-card";

    let statsHtml = "";
    const totalCount = list.length;
    let watchedCount = 0;
    list.forEach((item) => {
      item.temporadas.forEach((s) => (watchedCount += s.watched_episodes || 0));
    });

    const headerKey = `hub.card_${mediaType}`;
    const unitKey = `dashboard.unit_${mediaType}`;

    statsHtml = `
            <h3><i class="fas ${listIcons[mediaType]}"></i> ${t(headerKey)}</h3>
            <ul>
                <li><span>${t(
                  "dashboard.total_in_list"
                )}</span><span>${totalCount}</span></li>
                <li><span>${t(unitKey)}</span><span>${watchedCount}</span></li>
            </ul>
        `;

    card.innerHTML = statsHtml;
    container.appendChild(card);
  });
}

window.addEventListener("message", async (event) => {
  const { type, payload } = event.data;

  if (type === "init-dashboard") {
    const lang = payload.settings.language || "pt";
    t = await applyTranslations(lang);

    allListsData = payload.lists;
    calculateAndRenderOverview(allListsData);
    renderFavoritesCarousel(allListsData);
    renderStatsByList(allListsData);
  }
});
