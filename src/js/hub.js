import { carregarDadosUsuario } from "./firebase-service.js";
import { atualizarPerfilUsuario } from "./ui.js";

async function applyTranslations(lang) {
  const response = await fetch(`../locales/${lang}.json`);
  const translations = await response.json();

  function translate(key) {
    return (
      key.split(".").reduce((obj, i) => (obj ? obj[i] : null), translations) ||
      key
    );
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

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.firebaseInitializationPromise;
  if (!firebaseReady) return;

  const auth = window.firebaseAuth;
  const db = window.firebaseDb;

  const settings = await window.electronAPI.loadSettings();
  const lang = settings.language || "pt";
  await applyTranslations(lang);

  const listCards = document.querySelectorAll(".list-card");
  const minimizeBtn = document.getElementById("minimize-btn");
  const maximizeBtn = document.getElementById("maximize-btn");
  const closeBtn = document.getElementById("close-btn");
  const userProfileArea = document.getElementById("user-profile-area");
  const userProfileDropdown = document.getElementById("user-profile-dropdown");
  const btnSettings = document.getElementById("btn-settings");
  const btnLogout = document.getElementById("btn-logout");

  let currentUser = null;

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      const { userData } = await carregarDadosUsuario(
        db,
        currentUser.uid,
        null
      );
      if (userData) {
        atualizarPerfilUsuario(userData);
      }
    } else {
      window.electronAPI.navigateToMain();
    }
  });

  listCards.forEach((card) => {
    card.addEventListener("click", () => {
      const listType = card.dataset.listType;
      window.electronAPI.navigateToList(listType);
    });
  });

  function fecharDropdowns(e) {
    if (e && e.target && !userProfileArea.contains(e.target)) {
      userProfileDropdown.classList.add("hidden");
    } else if (!e) {
      userProfileDropdown.classList.add("hidden");
    }
  }

  function abrirDropdown(triggerElement, menu) {
    const isVisible = !menu.classList.contains("hidden");
    if (isVisible) {
      menu.classList.add("hidden");
      return;
    }

    const rect = triggerElement.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.classList.remove("hidden");
  }

  userProfileArea.addEventListener("click", (e) => {
    e.stopPropagation();
    abrirDropdown(e.currentTarget, userProfileDropdown);
  });

  btnSettings.addEventListener("click", () =>
    window.electronAPI.navigateToSettings()
  );
  btnLogout.addEventListener("click", () => window.electronAPI.logout());

  window.addEventListener("click", fecharDropdowns);

  minimizeBtn.addEventListener("click", () =>
    window.electronAPI.minimizeWindow()
  );
  maximizeBtn.addEventListener("click", () =>
    window.electronAPI.maximizeWindow()
  );
  closeBtn.addEventListener("click", () => window.electronAPI.closeWindow());

  window.electronAPI.readyToShow();
});
