// Video "editing layer", injected into every page before load: a presenter cursor with click ripples and a camera
// (smooth zoom/pan of the app). It renders in the page, so it is captured pixel-sharp. On-screen text (lower-thirds)
// is not recorded here — edit.py composites it from scenes.html.
(() => {
  if (window.__v) return;
  const css = `
  #__v-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483646;font-family:var(--font-jakarta),"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif}
  #__v-cursor{position:absolute;left:0;top:0;width:30px;height:30px;transform:translate(-100px,-100px);transition:transform var(--dur,700ms) cubic-bezier(.22,.8,.24,1);filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))}
  #__v-cursor.press svg{transform:scale(.86)} #__v-cursor svg{transition:transform .12s;transform-origin:4px 3px}
  .__v-ripple{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:3px solid #7c6cff;background:rgba(124,108,255,.22);animation:__v-rip .6s cubic-bezier(.2,.7,.3,1) forwards}
  @keyframes __v-rip{from{transform:scale(.4);opacity:1}to{transform:scale(3.6);opacity:0}}
  `;
  const cursorSvg = `<svg width="30" height="30" viewBox="0 0 30 30"><path d="M4 3 L4 24 L9.6 18.8 L13.4 27 L17.2 25.3 L13.5 17.3 L21 17.1 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  let layer, cursor, pos = [-100, -100];
  const mount = () => {
    if (document.getElementById("__v-layer")) return;
    const st = document.createElement("style");
    st.textContent = css;
    document.documentElement.appendChild(st);
    layer = document.createElement("div");
    layer.id = "__v-layer";
    layer.innerHTML = `<div id="__v-cursor">${cursorSvg}</div>`;
    // Child of <html>, not <body>: the camera transforms <body> and must not move the overlay.
    document.documentElement.appendChild(layer);
    cursor = layer.querySelector("#__v-cursor");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__v = {
    async move(x, y, ms = 750) {
      mount();
      cursor.style.setProperty("--dur", `${ms}ms`);
      cursor.style.transform = `translate(${x - 4}px, ${y - 3}px)`;
      pos = [x, y];
      await sleep(ms);
    },
    park(x, y) {
      mount();
      cursor.style.setProperty("--dur", "0ms");
      cursor.style.transform = `translate(${x - 4}px, ${y - 3}px)`;
      pos = [x, y];
    },
    async press() {
      mount();
      cursor.classList.add("press");
      const r = document.createElement("div");
      r.className = "__v-ripple";
      r.style.left = `${pos[0]}px`;
      r.style.top = `${pos[1]}px`;
      layer.appendChild(r);
      setTimeout(() => r.remove(), 700);
      await sleep(110);
      cursor.classList.remove("press");
    },
    hide() {
      mount();
      cursor.style.opacity = "0";
    },
    show() {
      mount();
      cursor.style.opacity = "1";
    },
    // Camera: zoom into (x, y) in viewport px. scale 1 = reset.
    zoom(scale, x = innerWidth / 2, y = innerHeight / 2, ms = 1400) {
      const b = document.body;
      b.style.transformOrigin = `${x}px ${y}px`;
      b.style.transition = `transform ${ms}ms cubic-bezier(.45,.05,.25,1)`;
      b.style.transform = scale === 1 ? "none" : `scale(${scale})`;
      document.documentElement.style.overflow = "hidden";
      return sleep(ms);
    },
  };
})();
