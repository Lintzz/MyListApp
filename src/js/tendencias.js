import {
  applyTranslations,
  renderResults,
  renderDetailsModalContent,
} from "./views/view-helper.js";

let t, lang, mediaType;

const resultsContainer = document.getElementById("explore-results-container");
const detailsModalOverlay = document.getElementById("details-modal-overlay");
const detailsModalCloseBtn = document.getElementById("details-modal-close-btn");
const detailsModalContent = document.getElementById("details-modal-content");
const pageTitle = document.querySelector(".content-container h1");

window.addEventListener("message", async (event) => {
  const { type, payload } = event.data;

  if (type === "init") {
    mediaType = payload.mediaType;
    lang = payload.settings.language || "pt";

    t = await applyTranslations(lang);

    const titleKey = `app.trends_title_${mediaType}`;
    pageTitle.textContent = t(titleKey, "Em Alta");
    fetchTrending();
    return;
  }

  if (type === "trending-data") {
    if (payload.error && payload.error !== "OK") {
      handleApiError(payload.message);
      return;
    }

    let results =
      payload.data || payload.results || payload.items || payload.works;

    if (results && !Array.isArray(results)) {
      results = [results];
    }

    renderResults(results, resultsContainer, t, mediaType);
  }

  if (type === "details-data") {
    if (payload.error && payload.error !== "OK") {
      detailsModalContent.innerHTML = `<p>${t(
        "app.load_error",
        "Erro ao carregar."
      )}</p>`;
      return;
    }
    await renderDetailsModalContent(
      payload,
      lang,
      t,
      payload.results?.parts ? "collection" : mediaType,
      detailsModalContent
    );
  }
});

function fetchTrending() {
  resultsContainer.innerHTML =
    '<div class="spinner" style="margin: 20px auto; grid-column: 1 / -1;"></div>';
  window.parent.postMessage(
    { type: "fetch-trending", payload: { mediaType } },
    "*"
  );
}

function handleApiError(message) {
  pageTitle.textContent = t("app.trends_title_anime", "Em Alta");
  resultsContainer.innerHTML = `<p class="placeholder-text">${t(
    "app.add_modal_search_error",
    "Erro ao buscar."
  )}</p>`;
}

function openDetailsModal(id, type) {
  detailsModalOverlay.classList.remove("hidden");
  setTimeout(() => detailsModalOverlay.classList.add("visible"), 10);
  detailsModalContent.innerHTML = `<div class="spinner" style="margin: 20px auto;"></div><p>${t(
    "app.details_modal_loading",
    "A carregar..."
  )}</p>`;
  window.parent.postMessage(
    { type: "fetch-details", payload: { mediaType: type, id } },
    "*"
  );
}

function closeDetailsModal() {
  detailsModalOverlay.classList.remove("visible");
  setTimeout(() => detailsModalOverlay.classList.add("hidden"), 200);
}

detailsModalCloseBtn.addEventListener("click", closeDetailsModal);
detailsModalOverlay.addEventListener("click", (e) => {
  if (e.target === detailsModalOverlay) closeDetailsModal();
});

resultsContainer.addEventListener("click", (event) => {
  const addButton = event.target.closest(".anime-card-add-btn");
  const detailsLink = event.target.closest(".anime-card-image-link");

  if (addButton) {
    const { id, title, type, authors } = addButton.dataset;
    window.parent.postMessage(
      {
        type: "open-add-anime-flow",
        malId: id,
        title,
        itemType: type,
        authors: authors ? JSON.parse(authors) : [],
      },
      "*"
    );
  } else if (detailsLink) {
    const { id, type } = detailsLink.dataset;
    openDetailsModal(id, type);
  }
});
