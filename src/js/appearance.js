export function applyAppearance(settings) {
  const theme = settings.theme || "theme-dark";
  const accentColor = settings.accentColor || "blue";
  const listDensity = settings.listDensity || "default";

  // Altera o tema
  document.body.dataset.theme = theme;

  // Altera a lista
  document.body.dataset.listDensity = listDensity;

  // Altera a cor de destaque
  const root = document.documentElement;
  root.style.setProperty(
    "--accent-color",
    `var(--accent-color-${accentColor})`
  );
}
