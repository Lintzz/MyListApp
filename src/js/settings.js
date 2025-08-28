import { applyAppearance } from "./appearance.js";

let auth, db;

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
      if (element.tagName === "OPTION") {
        element.textContent = translate(key);
      } else {
        element.innerHTML = translate(key);
      }
    }
  });

  return translate;
}

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.firebaseInitializationPromise;
  if (!firebaseReady) return;

  auth = window.firebaseAuth;
  db = window.firebaseDb;
  const GoogleAuthProvider = firebase.auth.GoogleAuthProvider;

  try {
    const settings = await window.electronAPI.loadSettings();
    const lang = settings.language || "pt";
    const t = await applyTranslations(lang);

    let currentUser = null;
    let currentSettings = {};
    let confirmCallback = null;
    let isReauthenticatingForDelete = false;

    const sidebarLinks = document.querySelectorAll(
      ".settings-sidebar .nav-link"
    );
    const tabContents = document.querySelectorAll(
      ".settings-content .tab-content"
    );
    const btnBack = document.getElementById("btn-back");
    const themeSelector = document.getElementById("theme-selector");
    const accentColorSelector = document.getElementById(
      "accent-color-selector"
    );
    const listDensitySelector = document.getElementById(
      "list-density-selector"
    );
    const languageSelector = document.getElementById("language-selector");
    const btnDeleteLists = document.getElementById("btn-delete-lists");
    const btnDeleteAccount = document.getElementById("btn-delete-account");
    const btnImport = document.getElementById("btn-import");
    const btnExport = document.getElementById("btn-export");
    const btnGithub = document.getElementById("btn-github");
    const modalOverlay = document.getElementById("modal-overlay");
    const modalTitle = document.getElementById("modal-title");
    const modalMessage = document.getElementById("modal-message");
    const modalBtnConfirm = document.getElementById("modal-btn-confirm");
    const modalBtnCancel = document.getElementById("modal-btn-cancel");
    const minimizeBtn = document.getElementById("minimize-btn");
    const maximizeBtn = document.getElementById("maximize-btn");
    const closeBtn = document.getElementById("close-btn");
    const profilePicPreview = document.getElementById("profile-pic-preview");
    const nicknameInput = document.getElementById("nickname-input");
    const profilePicUrlInput = document.getElementById("profile-pic-url-input");
    const btnSaveProfile = document.getElementById("btn-save-profile");
    const profileStatusMessage = document.getElementById(
      "profile-status-message"
    );

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        await loadAndApplySettings();
        setupEventListeners();

        const userDocRef = db.collection("users").doc(currentUser.uid);
        const docSnap = await userDocRef.get();
        if (docSnap.exists) {
          const userData = docSnap.data();
          nicknameInput.value = userData.displayName || "";
          profilePicUrlInput.value = userData.photoURL || "";
          profilePicPreview.src =
            userData.photoURL ||
            "https://placehold.co/100x100/2C2C2C/E0E0E0?text=Foto";
        }
      } else {
        window.electronAPI.navigateToMain();
      }
    });

    async function loadAndApplySettings() {
      try {
        if (window.electronAPI) {
          currentSettings = await window.electronAPI.loadSettings();
        }
      } catch (error) {
        console.error("Falha ao carregar as configurações:", error);
        currentSettings = {
          theme: "theme-dark",
          accentColor: "blue",
          language: "pt",
          listDensity: "default",
        };
      } finally {
        applyAppearance(currentSettings);
        themeSelector.value = currentSettings.theme || "theme-dark";
        accentColorSelector.value = currentSettings.accentColor || "blue";
        listDensitySelector.value = currentSettings.listDensity || "default";
        languageSelector.value = currentSettings.language || "pt";
        window.electronAPI?.readyToShow();
      }
    }

    function showModal(title, message, onConfirm = null) {
      modalTitle.textContent = title;
      modalMessage.innerHTML = message;
      confirmCallback = onConfirm;

      if (onConfirm) {
        modalBtnConfirm.style.display = "inline-block";
        modalBtnCancel.style.display = "inline-block";
        modalBtnConfirm.textContent = t("app.modal_confirm");
        modalBtnConfirm.classList.add("destructive");
      } else {
        modalBtnConfirm.style.display = "inline-block";
        modalBtnCancel.style.display = "none";
        modalBtnConfirm.textContent = "OK";
        modalBtnConfirm.classList.remove("destructive");
      }

      modalOverlay.classList.remove("hidden");
      setTimeout(() => modalOverlay.classList.add("visible"), 10);
    }

    function hideModal() {
      modalOverlay.classList.remove("visible");
      setTimeout(() => {
        modalOverlay.classList.add("hidden");
        if (typeof confirmCallback === "function") {
          confirmCallback();
        }
        confirmCallback = null;
      }, 200);
    }

    modalBtnConfirm.addEventListener("click", () => {
      if (typeof confirmCallback === "function") {
        confirmCallback();
      }
      hideModal();
    });

    function handleDeleteAllLists() {
      showModal(
        t("settings.modal_delete_list_title"),
        t("settings.modal_delete_list_message"),
        async () => {
          if (!currentUser) return;
          const userDocRef = db.collection("users").doc(currentUser.uid);
          await userDocRef.set({ lists: {} }, { merge: true });
          showModal(
            t("settings.modal_delete_list_success_title"),
            t("settings.modal_delete_list_success_message")
          );
        }
      );
    }

    async function handleExportJson() {
      if (!currentUser) return;
      const userDocRef = db.collection("users").doc(currentUser.uid);
      const docSnap = await userDocRef.get();
      if (docSnap.exists && docSnap.data().lists) {
        const allLists = docSnap.data().lists;
        const result = await window.electronAPI.exportarJson(allLists);
        if (result && result.success) {
          showModal(
            t("settings.modal_export_success_title"),
            t("settings.modal_export_success_message")
          );
        }
      }
    }

    async function handleImportJson() {
      if (!currentUser) return;
      const importedData = await window.electronAPI.importarJson();
      if (
        importedData &&
        typeof importedData === "object" &&
        Object.keys(importedData).length > 0
      ) {
        showModal(
          t("settings.modal_import_title"),
          t("settings.modal_import_message"),
          async () => {
            const userDocRef = db.collection("users").doc(currentUser.uid);
            await userDocRef.set({ lists: importedData }, { merge: true });
            showModal(
              t("settings.modal_import_success_title"),
              t("settings.modal_import_success_message")
            );
          }
        );
      }
    }

    async function handleProfileSave() {
      if (!currentUser) return;

      const newNickname = nicknameInput.value.trim();
      const newPhotoURL = profilePicUrlInput.value.trim();

      if (!newNickname) {
        profileStatusMessage.textContent = t("settings.status_profile_blank");
        return;
      }

      profileStatusMessage.textContent = t("settings.status_profile_saving");
      btnSaveProfile.disabled = true;

      try {
        await currentUser.updateProfile({
          displayName: newNickname,
          photoURL: newPhotoURL,
        });

        const userDocRef = db.collection("users").doc(currentUser.uid);
        await userDocRef.update({
          displayName: newNickname,
          photoURL: newPhotoURL,
        });

        profileStatusMessage.textContent = t("settings.status_profile_success");
        setTimeout(() => (profileStatusMessage.textContent = ""), 3000);
      } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        profileStatusMessage.textContent = t("settings.status_profile_error");
      } finally {
        btnSaveProfile.disabled = false;
      }
    }

    function handleDeleteAccount() {
      showModal(
        t("settings.modal_delete_account_title"),
        t("settings.modal_delete_account_message"),
        () => {
          if (!currentUser) return;

          showModal(
            t("settings.alert_reauth_title"),
            t("settings.alert_reauth_message"),
            () => {
              isReauthenticatingForDelete = true;
              window.electronAPI.openExternalLink(
                "https://minha-lista-ponte.vercel.app"
              );
            }
          );
        }
      );
    }

    function setupEventListeners() {
      sidebarLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const tab = link.dataset.tab;
          sidebarLinks.forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
          tabContents.forEach((content) => {
            content.classList.toggle("active", content.id === tab);
          });
        });
      });

      btnBack.addEventListener("click", () =>
        window.electronAPI?.navigateBack()
      );
      minimizeBtn.addEventListener("click", () =>
        window.electronAPI?.minimizeWindow()
      );
      maximizeBtn.addEventListener("click", () =>
        window.electronAPI?.maximizeWindow()
      );
      closeBtn.addEventListener("click", () =>
        window.electronAPI?.closeWindow()
      );

      themeSelector.addEventListener("change", async (e) => {
        currentSettings.theme = e.target.value;
        applyAppearance(currentSettings);
        await window.electronAPI?.saveSettings(currentSettings);
      });

      accentColorSelector.addEventListener("change", async (e) => {
        currentSettings.accentColor = e.target.value;
        applyAppearance(currentSettings);
        await window.electronAPI?.saveSettings(currentSettings);
      });

      listDensitySelector.addEventListener("change", async (e) => {
        currentSettings.listDensity = e.target.value;
        applyAppearance(currentSettings);
        await window.electronAPI?.saveSettings(currentSettings);
      });

      languageSelector.addEventListener("change", async (e) => {
        currentSettings.language = e.target.value;
        await window.electronAPI?.saveSettings(currentSettings);
        showModal(
          t("settings.alert_lang_change_title"),
          t("settings.alert_lang_change_message"),
          () => {
            location.reload();
          }
        );
      });

      btnDeleteLists.addEventListener("click", handleDeleteAllLists);
      btnDeleteAccount.addEventListener("click", handleDeleteAccount);
      btnImport.addEventListener("click", handleImportJson);
      btnExport.addEventListener("click", handleExportJson);
      btnGithub.addEventListener("click", () =>
        window.electronAPI.openExternalLink("https://github.com/Lintzz")
      );

      modalBtnCancel.addEventListener("click", hideModal);

      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
          hideModal();
        }
      });

      btnSaveProfile.addEventListener("click", handleProfileSave);
      profilePicUrlInput.addEventListener("input", () => {
        const newUrl = profilePicUrlInput.value.trim();
        profilePicPreview.src =
          newUrl || "https://placehold.co/100x100/2C2C2C/E0E0E0?text=Foto";
      });

      window.electronAPI.handleDeepLink(async (url) => {
        if (!isReauthenticatingForDelete || !currentUser) return;
        isReauthenticatingForDelete = false;

        try {
          const urlParams = new URLSearchParams(new URL(url).search);
          const idToken = urlParams.get("idToken");
          if (!idToken) throw new Error("Token não encontrado.");

          const credential = GoogleAuthProvider.credential(idToken);
          await currentUser.reauthenticateWithCredential(credential);

          const userDocRef = db.collection("users").doc(currentUser.uid);
          await userDocRef.delete();
          await currentUser.delete();
        } catch (error) {
          console.error("Erro ao reautenticar e apagar conta:", error);
        }
      });
    }
  } catch (error) {
    console.error(
      "Falha ao inicializar a aplicação na página de registo.",
      error
    );
  }
});
