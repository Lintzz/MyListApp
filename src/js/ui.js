export function getItemStatus(item) {
  let totalEpisodios = 0;
  let episodiosAssistidos = 0;
  let temTemporadaFutura = false;

  (item.temporadas || []).forEach((temp) => {
    const eps = temp.episodes || 0;
    totalEpisodios += eps;
    episodiosAssistidos += temp.watched_episodes || 0;
    if (eps === 0) {
      temTemporadaFutura = true;
    }
  });

  if (episodiosAssistidos === 0) return "nao-comecou";
  if (totalEpisodios > 0 && episodiosAssistidos === totalEpisodios) {
    return temTemporadaFutura ? "concluido" : "finished";
  }
  if (episodiosAssistidos > 0) return "assistindo";

  return "nao-comecou";
}

export function renderizarLista(
  listaItems,
  containerElement,
  t,
  mediaType,
  activeSort
) {
  containerElement.innerHTML = "";

  const cabecalhoEpisodios = document.querySelector(
    ".cabecalho-lista .col-episodios-pai"
  );
  if (cabecalhoEpisodios) {
    const headerKeyMap = {
      anime: "app.list_header_episodes",
      series: "app.list_header_episodes",
      manga: "app.list_header_chapters",
      comics: "app.list_header_chapters",
      books: "app.list_header_pages",
      movies: "app.list_header_watched",
      games: "app.list_header_played",
    };
    cabecalhoEpisodios.textContent = t(
      headerKeyMap[mediaType] || "app.list_header_episodes"
    );
  }

  if (listaItems.length === 0) {
    containerElement.innerHTML = `<p style="text-align: center; color: var(--secondary-text-color); padding: 20px;">${t(
      "app.empty_list"
    )}</p>`;
    return;
  }

  const dragDisabledClass = activeSort !== "personal" ? "drag-disabled" : "";

  const fragment = document.createDocumentFragment();
  listaItems.forEach((item) => {
    if (!item.title || !item.temporadas) return;

    const itemContainer = document.createElement("div");
    itemContainer.className = "anime-entry";
    itemContainer.dataset.id = item.id;

    let totalEpisodios = 0,
      episodiosAssistidos = 0;
    (item.temporadas || []).forEach((temp) => {
      totalEpisodios += temp.episodes || 0;
      episodiosAssistidos += temp.watched_episodes || 0;
    });

    const isSingleUnitType =
      mediaType === "books" || mediaType === "movies" || mediaType === "games";
    const displayTotal = isSingleUnitType ? 1 : totalEpisodios;
    const status = getItemStatus(item);
    const statusClass = `status-${status}`;

    let subtextHtml = "";
    if (mediaType === "books" && item.authors && item.authors.length > 0) {
      subtextHtml = `<small class="item-author">${item.authors.join(
        ", "
      )}</small>`;
    } else if (mediaType === "comics" && item.publisherName) {
      subtextHtml = `<small class="item-author">${item.publisherName}</small>`;
    }

    const paiDiv = document.createElement("div");
    paiDiv.className = "item-lista-pai";
    paiDiv.innerHTML = `
        <div class="col-drag"><i class="fas fa-grip-vertical drag-handle-pai ${dragDisabledClass}"></i></div>
        <div class="col-toggle"><i class="fas fa-chevron-right toggle-seasons-arrow"></i></div>
        <div class="col-status"><div class="status-bar ${statusClass}"></div></div>
        <div class="col-nome-pai">
            <span class="coluna-nome anime-title-link" data-id="${
              item.id
            }" title="${item.title}">${item.title}</span>
            ${subtextHtml}
        </div>
        <div class="col-episodios-pai">${episodiosAssistidos} / ${displayTotal}</div>
        <div class="col-favorito"><i class="fas fa-star favorite-btn ${
          item.isFavorite ? "favorited" : ""
        }" title="${t("app.favorite_tooltip", "Mark as favorite")}"></i></div>
        <div class="col-acoes-pai"><button class="options-btn" title="Opções"><i class="fas fa-ellipsis-v"></i></button></div>`;

    const seasonsWrapper = document.createElement("div");
    seasonsWrapper.className = "seasons-wrapper";
    (item.temporadas || []).forEach((temporada, index) => {
      const isSingleUnit = isSingleUnitType || mediaType === "comics";
      const maxVal = isSingleUnit ? 1 : temporada.episodes || 0;

      const filhoDiv = document.createElement("div");
      filhoDiv.className = "item-lista-filho";
      filhoDiv.dataset.seasonIndex = index;
      filhoDiv.innerHTML = `
            <span class="season-title">${temporada.title}</span>
            <div class="episode-controls">
                <button class="quick-edit-btn decrement-btn">-</button>
                <input type="number" class="episode-input" value="${
                  temporada.watched_episodes || 0
                }" min="0" max="${maxVal}">
                <span class="episode-total">/ ${
                  isSingleUnit ? 1 : temporada.episodes || "N/A"
                }</span>
                <button class="quick-edit-btn increment-btn">+</button>
            </div>`;
      seasonsWrapper.appendChild(filhoDiv);
    });
    itemContainer.appendChild(paiDiv);
    itemContainer.appendChild(seasonsWrapper);
    fragment.appendChild(itemContainer);
  });
  containerElement.appendChild(fragment);
}

export function renderizarSelecaoTemporadas(
  temporadas,
  containerElement,
  mediaType,
  t
) {
  const headerKeyMap = {
    anime: "app.list_header_episodes",
    series: "app.list_header_episodes",
    manga: "app.list_header_chapters",
    comics: "app.list_header_chapters",
    books: "app.list_header_pages",
    movies: "app.list_header_watched",
    games: "app.list_header_played",
  };
  const isSingleUnit =
    mediaType === "movies" ||
    mediaType === "books" ||
    mediaType === "comics" ||
    mediaType === "games";
  const titleHeader = isSingleUnit
    ? t("app.title_singular", "Título")
    : t("app.title_plural", "Temporada/Volume");
  const watchedHeader = t(headerKeyMap[mediaType]);

  containerElement.innerHTML = `<div class="season-selection-header"><span>${titleHeader}</span><span>${watchedHeader}</span></div>`;
  const list = document.createElement("ul");
  list.className = "season-list-sortable";
  temporadas.forEach((temp, index) => {
    const maxVal = isSingleUnit ? 1 : temp.episodes || 0;
    const li = document.createElement("li");
    li.className = "season-selection-item";
    li.dataset.originalIndex = index;
    li.innerHTML = `
        <i class="fas fa-grip-vertical drag-handle"></i>
        <div class="season-info-add"><strong title="${temp.title}">${
      temp.title
    }</strong></div>
        <div class="episode-controls">
            <button class="quick-edit-btn decrement-btn-add">-</button>
            <input type="number" class="episode-input-add" value="0" min="0" max="${maxVal}">
            <span class="episode-total">/ ${
              isSingleUnit ? 1 : temp.episodes || "N/A"
            }</span>
            <button class="quick-edit-btn increment-btn-add">+</button>
        </div>
        <button class="delete-season-btn-add" title="Remover"><i class="fas fa-times"></i></button>`;
    list.appendChild(li);
  });
  containerElement.appendChild(list);
}

export function renderizarListaEdicao(
  item,
  containerElement,
  sortableInstance,
  mediaType,
  t
) {
  if (sortableInstance) {
    sortableInstance.destroy();
  }

  const headerKeyMap = {
    anime: "app.list_header_episodes",
    series: "app.list_header_episodes",
    manga: "app.list_header_chapters",
    comics: "app.list_header_chapters",
    books: "app.list_header_pages",
    movies: "app.list_header_watched",
    games: "app.list_header_played",
  };
  const isSingleUnit =
    mediaType === "movies" ||
    mediaType === "books" ||
    mediaType === "comics" ||
    mediaType === "games";
  const titleHeader = isSingleUnit
    ? t("app.title_singular", "Título")
    : t("app.title_plural", "Temporada/Volume");
  const episodesHeader = t(headerKeyMap[mediaType]);

  containerElement.innerHTML = `<div class="edit-season-header"><span>${titleHeader}</span><span>${episodesHeader}</span></div>`;
  const list = document.createElement("ul");
  list.className = "edit-list-sortable";
  item.temporadas.forEach((temporada) => {
    const maxVal = isSingleUnit ? 1 : temporada.episodes || 0;
    const li = document.createElement("li");
    li.className = "edit-season-item";
    li.dataset.originalTitle = temporada.title;
    li.innerHTML = `
            <i class="fas fa-grip-vertical drag-handle"></i>
            <div class="edit-season-info"><strong title="${temporada.title}">${
      temporada.title
    }</strong></div>
            <div class="episode-controls">
                <button class="quick-edit-btn decrement-btn-edit">-</button>
                <input type="number" class="episode-input" value="${
                  temporada.watched_episodes || 0
                }" min="0" max="${maxVal}">
                <span class="episode-total">/ ${
                  isSingleUnit ? 1 : temporada.episodes || "N/A"
                }</span>
                <button class="quick-edit-btn increment-btn-edit">+</button>
            </div>
            <button class="delete-season-btn" title="Apagar"><i class="fas fa-times"></i></button>`;
    list.appendChild(li);
  });
  containerElement.appendChild(list);

  return new Sortable(list, {
    animation: 150,
    handle: ".drag-handle",
  });
}

export function renderizarDetalhesAnime(item, t, mediaType) {
  const content = document.getElementById("details-modal-content");
  if (!item) {
    content.innerHTML = `<div class="spinner" style="margin: 20px auto;"></div><p>${t(
      "app.details_modal_loading"
    )}</p>`;
    return;
  }

  const unitKeyMap = {
    anime: "app.details_episodes",
    series: "app.details_episodes",
    manga: "app.details_chapters",
    comics: "app.details_chapters",
    books: "app.details_pages",
    movies: "app.details_parts",
    games: "app.details_parts",
  };
  const unitText = t(unitKeyMap[mediaType] || "app.details_parts");
  const genres =
    item.genres?.map((g) => `<span>${g.name}</span>`).join("") || "";

  let authorHtml = "";
  if (item.authors && item.authors.length > 0) {
    authorHtml = `<p><strong>${t(
      "app.list_header_author",
      "Autor"
    )}:</strong> ${item.authors.join(", ")}</p>`;
  }

  content.innerHTML = `
    <img id="details-modal-img" src="${
      item.images?.jpg?.large_image_url ||
      "https://placehold.co/150x210/1f1f1f/ffffff?text=Capa"
    }" alt="Poster de ${item.title}" />
    <div id="details-modal-info">
      <h2 id="details-modal-title">${item.title || "Título não disponível"}</h2>
      ${authorHtml}
      <div class="details-pills">
        <span>⭐ ${item.score || "N/A"}</span>
        <span>${item.type || "N/A"}</span>
        <span>${item.status || "N/A"}</span>
        <span>${item.episodes || "?"} ${unitText}</span>
      </div>
      <p id="details-modal-synopsis">${
        item.synopsis || "Sinopse não disponível."
      }</p>
      <div class="details-pills">${genres}</div>
    </div>`;
}

export function atualizarUIEpisodio(
  itemId,
  seasonIndex,
  novoValorAssistido,
  totalAssistido,
  totalGeral,
  status,
  mediaType
) {
  const itemContainer = document.querySelector(
    `.anime-entry[data-id="${itemId}"]`
  );
  if (!itemContainer) return;

  const isSingleUnitType =
    mediaType === "books" || mediaType === "movies" || mediaType === "games";
  const displayTotal = isSingleUnitType ? 1 : totalGeral;

  const contadorPai = itemContainer.querySelector(".col-episodios-pai");
  if (contadorPai)
    contadorPai.textContent = `${totalAssistido} / ${displayTotal}`;
  const statusBar = itemContainer.querySelector(".status-bar");
  if (statusBar) {
    statusBar.className = "status-bar";
    if (status) statusBar.classList.add(`status-${status}`);
  }
  const seasonDiv = itemContainer.querySelector(
    `.item-lista-filho[data-season-index="${seasonIndex}"]`
  );
  if (seasonDiv) {
    const input = seasonDiv.querySelector(".episode-input");
    if (input && parseInt(input.value, 10) !== novoValorAssistido)
      input.value = novoValorAssistido;
  }
}

export function renderizarResultadosBusca(resultados, containerElement, t) {
  containerElement.innerHTML = "";
  if (!resultados || resultados.length === 0) {
    containerElement.innerHTML = `<p style="text-align: center; padding: 20px;">${t(
      "app.add_modal_no_results"
    )}</p>`;
    return;
  }
  resultados.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "search-result-item";
    itemDiv.dataset.malId = item.mal_id;
    itemDiv.dataset.title = item.title;

    let subText = "";
    if (item.type === "HQ (Volume)") {
      subText = item.volumeName || item.type;
    } else if (item.authors && item.authors.length > 0) {
      subText = item.authors.map((a) => a.name).join(", ");
    } else {
      subText = item.type || "";
    }

    itemDiv.innerHTML = `
        <img src="${
          item.images.jpg.image_url ||
          "https://placehold.co/50x70/1f1f1f/ffffff?text=N/A"
        }" alt="Poster de ${item.title}">
        <div class="search-result-item-info">
            <strong title="${item.title}">${item.title}</strong>
            <small>${subText}</small>
        </div>`;
    containerElement.appendChild(itemDiv);
  });
}

export function atualizarPerfilUsuario(userData) {
  const userProfileArea = document.getElementById("user-profile-area");
  const userNickname = document.getElementById("user-nickname");
  const userAvatar = document.getElementById("user-avatar");

  if (userProfileArea && userData) {
    userNickname.textContent = userData.displayName;
    userAvatar.src = userData.photoURL;
    userAvatar.onerror = () => {
      userAvatar.src = "https://placehold.co/40x40/1f1f1f/ffffff?text=U";
    };
    userProfileArea.classList.remove("loading-skeleton");
  }
}
