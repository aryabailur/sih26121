/** Norwegian-shelf lithostratigraphic groups (Sodir names), young → old, in legible geological hues. */
export const NCS_GROUP_COLORS: Record<string, string> = {
  "NORDLAND GP": "#8e9bb3",
  "HORDALAND GP": "#c8a24a",
  "ROGALAND GP": "#d9793a",
  "SHETLAND GP": "#7fb069",
  "CROMER KNOLL GP": "#8d68d6",
  "VIKING GP": "#3d7ea6",
  "FLADEN GP": "#4e8fb8",
  "TYNE GP": "#5a86a8",
  "BOKNFJORD GP": "#4a6fa0",
  "VESTLAND GP": "#e2b04a",
  "BRENT GP": "#e2b04a",
  "DUNLIN GP": "#5c9ead",
  "STATFJORD GP": "#caa36b",
  "HEGRE GP": "#c46a5a",
  "ZECHSTEIN GP": "#d985c8",
  "ROTLIEGEND GP": "#a8524d",
  BASEMENT: "#6b6f7b",
};

export const groupColor = (name: string) => NCS_GROUP_COLORS[name] ?? "#9aa1ae";

/** "HORDALAND GP" → "Hordaland Gp" */
export const unitLabel = (name: string) =>
  name
    .toLowerCase()
    .replace(/(^|\s|-)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(/ Gp$/, " Gp")
    .replace(/ Fm$/, " Fm");
