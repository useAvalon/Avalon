class r {
  constructor() {
    this.hydratedIslands = /* @__PURE__ */ new Set(), this.pendingHydrations = /* @__PURE__ */ new Map();
  }
  async init() {
    document.readyState === "loading" ? await document.addEventListener("DOMContentLoaded", () => this.findAndHydrateIslands()) : await this.findAndHydrateIslands();
  }
  findAndHydrateIslands() {
    const e = document.querySelectorAll("[data-solid-hydrate]");
    for (const s of e) {
      const t = s.getAttribute("data-solid-hydrate"), i = s.getAttribute("data-solid-condition") || "on:load";
      !t || this.hydratedIslands.has(s) || this.scheduleHydration(s, t, i);
    }
  }
  scheduleHydration(e, s, t) {
    const i = () => {
      this.hydratedIslands.has(e) || this.hydrateContainer(e, s);
    };
    switch (t) {
      case "on:client":
      case "on:load":
        i();
        break;
      case "on:visible":
        this.setupVisibilityTrigger(e, i);
        break;
      case "on:interaction":
        this.setupInteractionTrigger(e, i);
        break;
      case "on:idle":
        this.setupIdleTrigger(i);
        break;
      default:
        t.startsWith("media:") ? this.setupMediaTrigger(t.slice(6), i) : i();
    }
  }
  async hydrateContainer(e, s) {
    if (!this.hydratedIslands.has(e))
      try {
        console.log(`🏝️ Hydrating Solid island: ${s}`), this.hydratedIslands.add(e);
        const t = e.getAttribute("data-solid-props"), i = t ? JSON.parse(t) : {}, a = await import(s), d = a.default || a;
        if (!d || typeof d != "function")
          throw new Error(`Invalid Solid component in ${s}`);
        const { hydrate: n } = await import("./web.CrCRaKXC.js");
        n(() => d(i), e), console.log(`✅ Solid island hydrated successfully: ${s}`);
      } catch (t) {
        console.error(`❌ Failed to hydrate Solid island ${s}:`, t), this.hydratedIslands.delete(e);
      }
  }
  setupVisibilityTrigger(e, s) {
    const t = new IntersectionObserver(
      (i) => {
        i[0].isIntersecting && (s(), t.disconnect());
      },
      { threshold: 0, rootMargin: "100px" }
    );
    t.observe(e);
  }
  setupInteractionTrigger(e, s) {
    const t = ["click", "touchstart", "mouseover"], i = () => {
      s(), t.forEach((a) => e.removeEventListener(a, i));
    };
    t.forEach((a) => e.addEventListener(a, i, { once: !0 }));
  }
  setupIdleTrigger(e) {
    globalThis.requestIdleCallback ? globalThis.requestIdleCallback(e) : setTimeout(e, 200);
  }
  setupMediaTrigger(e, s) {
    const t = globalThis.matchMedia(e);
    if (t.matches) {
      s();
      return;
    }
    const i = (a) => {
      a.matches && (s(), t.removeEventListener("change", i));
    };
    t.addEventListener("change", i);
  }
}
const o = new r();
o.init();
export {
  o as default
};
