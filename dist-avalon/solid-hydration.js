class l {
  constructor() {
    this.hydratedIslands = /* @__PURE__ */ new Set(), this.pendingHydrations = /* @__PURE__ */ new Map();
  }
  async init() {
    document.readyState === "loading" ? await document.addEventListener("DOMContentLoaded", () => this.findAndHydrateIslands()) : await this.findAndHydrateIslands();
  }
  findAndHydrateIslands() {
    const e = document.querySelectorAll("[data-solid-hydrate]");
    for (const o of e) {
      const t = o.getAttribute("data-solid-hydrate"), s = o.getAttribute("data-solid-condition") || "on:client";
      !t || this.hydratedIslands.has(o) || this.scheduleHydration(o, t, s);
    }
  }
  scheduleHydration(e, o, t) {
    const s = () => {
      this.hydratedIslands.has(e) || this.hydrateContainer(e, o);
    };
    if (t === "on:load") {
      console.warn(
        "⚠️ on:load directive is not implemented and has been ignored. Use on:client for immediate hydration instead."
      );
      return;
    }
    switch (t) {
      case "on:client":
        s();
        break;
      case "on:visible":
        this.setupVisibilityTrigger(e, s);
        break;
      case "on:interaction":
        this.setupInteractionTrigger(e, s);
        break;
      case "on:idle":
        this.setupIdleTrigger(s);
        break;
      default:
        t.startsWith("media:") ? this.setupMediaTrigger(t.slice(6), s) : s();
    }
  }
  async hydrateContainer(e, o) {
    if (!this.hydratedIslands.has(e))
      try {
        console.log(`🏝️ Hydrating Solid island: ${o}`), this.hydratedIslands.add(e);
        const t = e.getAttribute("data-solid-props"), s = t ? JSON.parse(t) : {};
        console.log(`🔄 Importing Solid module: ${o}`);
        const n = await import(o);
        console.log("🔍 Module imported:", {
          hasDefault: !!n.default,
          moduleKeys: Object.keys(n),
          defaultType: typeof n.default
        });
        const i = n.default || n;
        if (!i || typeof i != "function")
          throw new Error(`Invalid Solid component in ${o}. Got: ${typeof i}`);
        console.log("🔄 Importing solid-js/web...");
        const r = await import("./web.rlVVEkr3.js");
        console.log("🔍 solid-js/web imported:", {
          hasRender: !!r.render,
          hasHydrate: !!r.hydrate,
          keys: Object.keys(r)
        });
        const { render: d } = r;
        if (!d || typeof d != "function")
          throw new Error("render function not found in solid-js/web");
        console.log("🔄 Clearing container and rendering component..."), e.innerHTML = "", console.log("🔄 Testing component call...");
        const a = i(s);
        console.log("🔍 Component result:", { type: typeof a, result: a }), d(() => i(s), e), console.log(`✅ Solid island hydrated successfully: ${o}`);
      } catch (t) {
        console.error(`❌ Failed to hydrate Solid island ${o}:`, t), console.error("❌ Error stack:", t.stack), this.hydratedIslands.delete(e);
      }
  }
  setupVisibilityTrigger(e, o) {
    const t = new IntersectionObserver(
      (s) => {
        s[0].isIntersecting && (o(), t.disconnect());
      },
      { threshold: 0, rootMargin: "100px" }
    );
    t.observe(e);
  }
  setupInteractionTrigger(e, o) {
    const t = ["click", "touchstart", "mouseover"], s = () => {
      o(), t.forEach((n) => e.removeEventListener(n, s));
    };
    t.forEach((n) => e.addEventListener(n, s, { once: !0 }));
  }
  setupIdleTrigger(e) {
    globalThis.requestIdleCallback ? globalThis.requestIdleCallback(e) : setTimeout(e, 200);
  }
  setupMediaTrigger(e, o) {
    const t = globalThis.matchMedia(e);
    if (t.matches) {
      o();
      return;
    }
    const s = (n) => {
      n.matches && (o(), t.removeEventListener("change", s));
    };
    t.addEventListener("change", s);
  }
}
const c = new l();
c.init();
export {
  c as default
};
