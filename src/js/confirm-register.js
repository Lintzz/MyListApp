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

  try {
    const settings = await window.electronAPI.loadSettings();
    const lang = settings.language || "pt";
    const t = await applyTranslations(lang);

    const profilePicPreview = document.getElementById("profile-pic-preview");
    const profilePicUrlInput = document.getElementById("profile-pic-url-input");
    const nicknameInput = document.getElementById("nickname-input");
    const saveProfileBtn = document.getElementById("save-profile-btn");
    const statusMessage = document.getElementById("status-message");
    const defaultAvatar =
      "https://placehold.co/100x100/2C2C2C/E0E0E0?text=Foto";

    let currentUser = null;

    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        profilePicPreview.src = user.photoURL || defaultAvatar;
        profilePicUrlInput.value = user.photoURL || "";
        nicknameInput.value = user.displayName || "";
        window.electronAPI?.readyToShow();
      } else {
        window.electronAPI?.navigateToMain();
      }
    });

    profilePicUrlInput.addEventListener("input", () => {
      const newUrl = profilePicUrlInput.value.trim();
      profilePicPreview.src = newUrl || defaultAvatar;
    });

    profilePicPreview.onerror = () => {
      profilePicPreview.src = defaultAvatar;
    };

    saveProfileBtn.addEventListener("click", async () => {
      if (!currentUser) return;

      const newNickname = nicknameInput.value.trim();
      if (!newNickname) {
        statusMessage.textContent = t("confirm_register.status_empty_nickname");
        statusMessage.classList.remove("hidden");
        return;
      }

      saveProfileBtn.disabled = true;
      statusMessage.textContent = t("confirm_register.status_saving");
      statusMessage.classList.remove("hidden");

      try {
        const photoURL =
          profilePicUrlInput.value.trim() || currentUser.photoURL;

        const userDocRef = db.collection("users").doc(currentUser.uid);
        await userDocRef.update({
          displayName: newNickname,
          photoURL: photoURL,
          profileComplete: true,
        });

        window.electronAPI?.navigateToHub();
      } catch (error) {
        console.error("Erro ao guardar o perfil:", error);
        statusMessage.textContent = t("confirm_register.status_error");
        saveProfileBtn.disabled = false;
      }
    });
  } catch (error) {
    console.error(
      "Falha ao inicializar a aplicação na página de registo.",
      error
    );
  }
});
