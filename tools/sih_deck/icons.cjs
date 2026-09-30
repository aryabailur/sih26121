// Render react-icons (lucide / simple-icons) to transparent PNGs for the deck.
// usage: node icons.cjs spec.json   spec = [{ "file": "...png", "lib": "lu"|"si", "comp": "LuDatabase", "color": "0C0E14", "size": 256 }]
const path = require("path");
const fs = require("fs");
const TOOLS = path.resolve(__dirname, "..", "node_modules") + "/"; // tools/node_modules (npm install in tools/)
const React = require(TOOLS + "react");
const ReactDOMServer = require(TOOLS + "react-dom/server");
const sharp = require(TOOLS + "sharp");
const libs = { lu: require(TOOLS + "react-icons/lu"), si: require(TOOLS + "react-icons/si") };

(async () => {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  for (const it of spec) {
    if (fs.existsSync(it.file)) continue;
    const Comp = libs[it.lib][it.comp];
    if (!Comp) { console.error("missing icon", it.comp); process.exitCode = 1; continue; }
    const size = it.size || 256;
    const props = { color: "#" + it.color, size: String(size) };
    if (it.stroke) props.strokeWidth = it.stroke;
    const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, props));
    fs.mkdirSync(path.dirname(it.file), { recursive: true });
    await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toFile(it.file);
  }
  console.log("icons ok", spec.length);
})();
