const d = {
  context: void 0,
  registry: void 0,
  effects: void 0,
  done: !1,
  getContextId() {
    return ye(this.context.count);
  },
  getNextContextId() {
    return ye(this.context.count++);
  }
};
function ye(e) {
  const t = String(e), n = t.length - 1;
  return d.context.id + (n ? String.fromCharCode(96 + n) : "") + t;
}
function j(e) {
  d.context = e;
}
function Ie() {
  return {
    ...d.context,
    id: d.getNextContextId(),
    count: 0
  };
}
const He = (e, t) => e === t, Y = Symbol("solid-proxy"), ke = typeof Proxy == "function", Ae = Symbol("solid-track"), X = {
  equals: He
};
let R = null, Ce = Pe;
const T = 1, W = 2, Ee = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var g = null;
let ne = null, De = null, b = null, k = null, N = null, ee = 0;
function $(e, t) {
  const n = b, s = g, r = e.length === 0, i = t === void 0 ? s : t, l = r ? Ee : {
    owned: null,
    cleanups: null,
    context: i ? i.context : null,
    owner: i
  }, o = r ? e : () => e(() => E(() => B(l)));
  g = l, b = null;
  try {
    return D(o, !0);
  } finally {
    b = n, g = s;
  }
}
function L(e, t) {
  t = t ? Object.assign({}, X, t) : X;
  const n = {
    value: e,
    observers: null,
    observerSlots: null,
    comparator: t.equals || void 0
  }, s = (r) => (typeof r == "function" && (r = r(n.value)), Oe(n, r));
  return [Te.bind(n), s];
}
function M(e, t, n) {
  const s = te(e, t, !1, T);
  G(s);
}
function _e(e, t, n) {
  Ce = Ke;
  const s = te(e, t, !1, T), r = Q && de(Q);
  r && (s.suspense = r), (!n || !n.render) && (s.user = !0), N ? N.push(s) : G(s);
}
function x(e, t, n) {
  n = n ? Object.assign({}, X, n) : X;
  const s = te(e, t, !0, 0);
  return s.observers = null, s.observerSlots = null, s.comparator = n.equals || void 0, G(s), Te.bind(s);
}
function E(e) {
  if (b === null) return e();
  const t = b;
  b = null;
  try {
    return e();
  } finally {
    b = t;
  }
}
function I(e) {
  return g === null || (g.cleanups === null ? g.cleanups = [e] : g.cleanups.push(e)), e;
}
function Re(e, t) {
  R || (R = Symbol("error")), g = te(void 0, void 0, !0), g.context = {
    ...g.context,
    [R]: [t]
  };
  try {
    return e();
  } catch (n) {
    U(n);
  } finally {
    g = g.owner;
  }
}
function re() {
  return g;
}
function qe(e, t) {
  const n = g, s = b;
  g = e, b = null;
  try {
    return D(t, !0);
  } catch (r) {
    U(r);
  } finally {
    g = n, b = s;
  }
}
function Be(e) {
  N.push.apply(N, e), e.length = 0;
}
function Ne(e, t) {
  const n = Symbol("context");
  return {
    id: n,
    Provider: Xe(n),
    defaultValue: e
  };
}
function de(e) {
  let t;
  return g && g.context && (t = g.context[e.id]) !== void 0 ? t : e.defaultValue;
}
function ve(e) {
  const t = x(e), n = x(() => ie(t()));
  return n.toArray = () => {
    const s = n();
    return Array.isArray(s) ? s : s != null ? [s] : [];
  }, n;
}
let Q;
function Ge() {
  return Q || (Q = Ne());
}
function Te() {
  if (this.sources && this.state)
    if (this.state === T) G(this);
    else {
      const e = k;
      k = null, D(() => Z(this), !1), k = e;
    }
  if (b) {
    const e = this.observers ? this.observers.length : 0;
    b.sources ? (b.sources.push(this), b.sourceSlots.push(e)) : (b.sources = [this], b.sourceSlots = [e]), this.observers ? (this.observers.push(b), this.observerSlots.push(b.sources.length - 1)) : (this.observers = [b], this.observerSlots = [b.sources.length - 1]);
  }
  return this.value;
}
function Oe(e, t, n) {
  let s = e.value;
  return (!e.comparator || !e.comparator(s, t)) && (e.value = t, e.observers && e.observers.length && D(() => {
    for (let r = 0; r < e.observers.length; r += 1) {
      const i = e.observers[r], l = ne && ne.running;
      l && ne.disposed.has(i), (l ? !i.tState : !i.state) && (i.pure ? k.push(i) : N.push(i), i.observers && $e(i)), l || (i.state = T);
    }
    if (k.length > 1e6)
      throw k = [], new Error();
  }, !1)), t;
}
function G(e) {
  if (!e.fn) return;
  B(e);
  const t = ee;
  Ue(
    e,
    e.value,
    t
  );
}
function Ue(e, t, n) {
  let s;
  const r = g, i = b;
  b = g = e;
  try {
    s = e.fn(t);
  } catch (l) {
    return e.pure && (e.state = T, e.owned && e.owned.forEach(B), e.owned = null), e.updatedAt = n + 1, U(l);
  } finally {
    b = i, g = r;
  }
  (!e.updatedAt || e.updatedAt <= n) && (e.updatedAt != null && "observers" in e ? Oe(e, s) : e.value = s, e.updatedAt = n);
}
function te(e, t, n, s = T, r) {
  const i = {
    fn: e,
    state: s,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: t,
    owner: g,
    context: g ? g.context : null,
    pure: n
  };
  return g === null || g !== Ee && (g.owned ? g.owned.push(i) : g.owned = [i]), i;
}
function J(e) {
  if (e.state === 0) return;
  if (e.state === W) return Z(e);
  if (e.suspense && E(e.suspense.inFallback)) return e.suspense.effects.push(e);
  const t = [e];
  for (; (e = e.owner) && (!e.updatedAt || e.updatedAt < ee); )
    e.state && t.push(e);
  for (let n = t.length - 1; n >= 0; n--)
    if (e = t[n], e.state === T)
      G(e);
    else if (e.state === W) {
      const s = k;
      k = null, D(() => Z(e, t[0]), !1), k = s;
    }
}
function D(e, t) {
  if (k) return e();
  let n = !1;
  t || (k = []), N ? n = !0 : N = [], ee++;
  try {
    const s = e();
    return Ve(n), s;
  } catch (s) {
    n || (N = null), k = null, U(s);
  }
}
function Ve(e) {
  if (k && (Pe(k), k = null), e) return;
  const t = N;
  N = null, t.length && D(() => Ce(t), !1);
}
function Pe(e) {
  for (let t = 0; t < e.length; t++) J(e[t]);
}
function Ke(e) {
  let t, n = 0;
  for (t = 0; t < e.length; t++) {
    const s = e[t];
    s.user ? e[n++] = s : J(s);
  }
  if (d.context) {
    if (d.count) {
      d.effects || (d.effects = []), d.effects.push(...e.slice(0, n));
      return;
    }
    j();
  }
  for (d.effects && (d.done || !d.count) && (e = [...d.effects, ...e], n += d.effects.length, delete d.effects), t = 0; t < n; t++) J(e[t]);
}
function Z(e, t) {
  e.state = 0;
  for (let n = 0; n < e.sources.length; n += 1) {
    const s = e.sources[n];
    if (s.sources) {
      const r = s.state;
      r === T ? s !== t && (!s.updatedAt || s.updatedAt < ee) && J(s) : r === W && Z(s, t);
    }
  }
}
function $e(e) {
  for (let t = 0; t < e.observers.length; t += 1) {
    const n = e.observers[t];
    n.state || (n.state = W, n.pure ? k.push(n) : N.push(n), n.observers && $e(n));
  }
}
function B(e) {
  let t;
  if (e.sources)
    for (; e.sources.length; ) {
      const n = e.sources.pop(), s = e.sourceSlots.pop(), r = n.observers;
      if (r && r.length) {
        const i = r.pop(), l = n.observerSlots.pop();
        s < r.length && (i.sourceSlots[l] = s, r[s] = i, n.observerSlots[s] = l);
      }
    }
  if (e.tOwned) {
    for (t = e.tOwned.length - 1; t >= 0; t--) B(e.tOwned[t]);
    delete e.tOwned;
  }
  if (e.owned) {
    for (t = e.owned.length - 1; t >= 0; t--) B(e.owned[t]);
    e.owned = null;
  }
  if (e.cleanups) {
    for (t = e.cleanups.length - 1; t >= 0; t--) e.cleanups[t]();
    e.cleanups = null;
  }
  e.state = 0;
}
function Ye(e) {
  return e instanceof Error ? e : new Error(typeof e == "string" ? e : "Unknown error", {
    cause: e
  });
}
function be(e, t, n) {
  try {
    for (const s of t) s(e);
  } catch (s) {
    U(s, n && n.owner || null);
  }
}
function U(e, t = g) {
  const n = R && t && t.context && t.context[R], s = Ye(e);
  if (!n) throw s;
  N ? N.push({
    fn() {
      be(s, n, t);
    },
    state: T
  }) : be(s, n, t);
}
function ie(e) {
  if (typeof e == "function" && !e.length) return ie(e());
  if (Array.isArray(e)) {
    const t = [];
    for (let n = 0; n < e.length; n++) {
      const s = ie(e[n]);
      Array.isArray(s) ? t.push.apply(t, s) : t.push(s);
    }
    return t;
  }
  return e;
}
function Xe(e, t) {
  return function(s) {
    let r;
    return M(
      () => r = E(() => (g.context = {
        ...g.context,
        [e]: s.value
      }, ve(() => s.children))),
      void 0
    ), r;
  };
}
const oe = Symbol("fallback");
function z(e) {
  for (let t = 0; t < e.length; t++) e[t]();
}
function We(e, t, n = {}) {
  let s = [], r = [], i = [], l = 0, o = t.length > 1 ? [] : null;
  return I(() => z(i)), () => {
    let f = e() || [], u = f.length, a, c;
    return f[Ae], E(() => {
      let y, p, w, v, A, m, S, C, P;
      if (u === 0)
        l !== 0 && (z(i), i = [], s = [], r = [], l = 0, o && (o = [])), n.fallback && (s = [oe], r[0] = $((_) => (i[0] = _, n.fallback())), l = 1);
      else if (l === 0) {
        for (r = new Array(u), c = 0; c < u; c++)
          s[c] = f[c], r[c] = $(h);
        l = u;
      } else {
        for (w = new Array(u), v = new Array(u), o && (A = new Array(u)), m = 0, S = Math.min(l, u); m < S && s[m] === f[m]; m++) ;
        for (S = l - 1, C = u - 1; S >= m && C >= m && s[S] === f[C]; S--, C--)
          w[C] = r[S], v[C] = i[S], o && (A[C] = o[S]);
        for (y = /* @__PURE__ */ new Map(), p = new Array(C + 1), c = C; c >= m; c--)
          P = f[c], a = y.get(P), p[c] = a === void 0 ? -1 : a, y.set(P, c);
        for (a = m; a <= S; a++)
          P = s[a], c = y.get(P), c !== void 0 && c !== -1 ? (w[c] = r[a], v[c] = i[a], o && (A[c] = o[a]), c = p[c], y.set(P, c)) : i[a]();
        for (c = m; c < u; c++)
          c in w ? (r[c] = w[c], i[c] = v[c], o && (o[c] = A[c], o[c](c))) : r[c] = $(h);
        r = r.slice(0, l = u), s = f.slice(0);
      }
      return r;
    });
    function h(y) {
      if (i[c] = y, o) {
        const [p, w] = L(c);
        return o[c] = w, t(f[c], p);
      }
      return t(f[c]);
    }
  };
}
function Qe(e, t, n = {}) {
  let s = [], r = [], i = [], l = [], o = 0, f;
  return I(() => z(i)), () => {
    const u = e() || [], a = u.length;
    return u[Ae], E(() => {
      if (a === 0)
        return o !== 0 && (z(i), i = [], s = [], r = [], o = 0, l = []), n.fallback && (s = [oe], r[0] = $((h) => (i[0] = h, n.fallback())), o = 1), r;
      for (s[0] === oe && (i[0](), i = [], s = [], r = [], o = 0), f = 0; f < a; f++)
        f < s.length && s[f] !== u[f] ? l[f](() => u[f]) : f >= s.length && (r[f] = $(c));
      for (; f < s.length; f++)
        i[f]();
      return o = l.length = i.length = a, s = u.slice(0), r = r.slice(0, o);
    });
    function c(h) {
      i[f] = h;
      const [y, p] = L(u[f]);
      return l[f] = p, t(y, f);
    }
  };
}
let Le = !1;
function Je() {
  Le = !0;
}
function je(e, t) {
  if (Le && d.context) {
    const n = d.context;
    j(Ie());
    const s = E(() => e(t || {}));
    return j(n), s;
  }
  return E(() => e(t || {}));
}
function V() {
  return !0;
}
const le = {
  get(e, t, n) {
    return t === Y ? n : e.get(t);
  },
  has(e, t) {
    return t === Y ? !0 : e.has(t);
  },
  set: V,
  deleteProperty: V,
  getOwnPropertyDescriptor(e, t) {
    return {
      configurable: !0,
      enumerable: !0,
      get() {
        return e.get(t);
      },
      set: V,
      deleteProperty: V
    };
  },
  ownKeys(e) {
    return e.keys();
  }
};
function se(e) {
  return (e = typeof e == "function" ? e() : e) ? e : {};
}
function Ze() {
  for (let e = 0, t = this.length; e < t; ++e) {
    const n = this[e]();
    if (n !== void 0) return n;
  }
}
function Ot(...e) {
  let t = !1;
  for (let l = 0; l < e.length; l++) {
    const o = e[l];
    t = t || !!o && Y in o, e[l] = typeof o == "function" ? (t = !0, x(o)) : o;
  }
  if (ke && t)
    return new Proxy(
      {
        get(l) {
          for (let o = e.length - 1; o >= 0; o--) {
            const f = se(e[o])[l];
            if (f !== void 0) return f;
          }
        },
        has(l) {
          for (let o = e.length - 1; o >= 0; o--)
            if (l in se(e[o])) return !0;
          return !1;
        },
        keys() {
          const l = [];
          for (let o = 0; o < e.length; o++)
            l.push(...Object.keys(se(e[o])));
          return [...new Set(l)];
        }
      },
      le
    );
  const n = {}, s = /* @__PURE__ */ Object.create(null);
  for (let l = e.length - 1; l >= 0; l--) {
    const o = e[l];
    if (!o) continue;
    const f = Object.getOwnPropertyNames(o);
    for (let u = f.length - 1; u >= 0; u--) {
      const a = f[u];
      if (a === "__proto__" || a === "constructor") continue;
      const c = Object.getOwnPropertyDescriptor(o, a);
      if (!s[a])
        s[a] = c.get ? {
          enumerable: !0,
          configurable: !0,
          get: Ze.bind(n[a] = [c.get.bind(o)])
        } : c.value !== void 0 ? c : void 0;
      else {
        const h = n[a];
        h && (c.get ? h.push(c.get.bind(o)) : c.value !== void 0 && h.push(() => c.value));
      }
    }
  }
  const r = {}, i = Object.keys(s);
  for (let l = i.length - 1; l >= 0; l--) {
    const o = i[l], f = s[o];
    f && f.get ? Object.defineProperty(r, o, f) : r[o] = f ? f.value : void 0;
  }
  return r;
}
function ze(e, ...t) {
  if (ke && Y in e) {
    const r = new Set(t.length > 1 ? t.flat() : t[0]), i = t.map((l) => new Proxy(
      {
        get(o) {
          return l.includes(o) ? e[o] : void 0;
        },
        has(o) {
          return l.includes(o) && o in e;
        },
        keys() {
          return l.filter((o) => o in e);
        }
      },
      le
    ));
    return i.push(
      new Proxy(
        {
          get(l) {
            return r.has(l) ? void 0 : e[l];
          },
          has(l) {
            return r.has(l) ? !1 : l in e;
          },
          keys() {
            return Object.keys(e).filter((l) => !r.has(l));
          }
        },
        le
      )
    ), i;
  }
  const n = {}, s = t.map(() => ({}));
  for (const r of Object.getOwnPropertyNames(e)) {
    const i = Object.getOwnPropertyDescriptor(e, r), l = !i.get && !i.set && i.enumerable && i.writable && i.configurable;
    let o = !1, f = 0;
    for (const u of t)
      u.includes(r) && (o = !0, l ? s[f][r] = i.value : Object.defineProperty(s[f], r, i)), ++f;
    o || (l ? n[r] = i.value : Object.defineProperty(n, r, i));
  }
  return [...s, n];
}
const Me = (e) => `Stale read from <${e}>.`;
function Pt(e) {
  const t = "fallback" in e && {
    fallback: () => e.fallback
  };
  return x(We(() => e.each, e.children, t || void 0));
}
function $t(e) {
  const t = "fallback" in e && {
    fallback: () => e.fallback
  };
  return x(Qe(() => e.each, e.children, t || void 0));
}
function Lt(e) {
  const t = e.keyed, n = x(() => e.when, void 0, {
    equals: (s, r) => t ? s === r : !s == !r
  });
  return x(
    () => {
      const s = n();
      if (s) {
        const r = e.children;
        return typeof r == "function" && r.length > 0 ? E(
          () => r(
            t ? s : () => {
              if (!E(n)) throw Me("Show");
              return e.when;
            }
          )
        ) : r;
      }
      return e.fallback;
    },
    void 0,
    void 0
  );
}
function jt(e) {
  let t = !1;
  const n = (i, l) => (t ? i[1] === l[1] : !i[1] == !l[1]) && i[2] === l[2], s = ve(() => e.children), r = x(
    () => {
      let i = s();
      Array.isArray(i) || (i = [i]);
      for (let l = 0; l < i.length; l++) {
        const o = i[l].when;
        if (o)
          return t = !!i[l].keyed, [l, o, i[l]];
      }
      return [-1];
    },
    void 0,
    {
      equals: n
    }
  );
  return x(
    () => {
      const [i, l, o] = r();
      if (i < 0) return e.fallback;
      const f = o.children;
      return typeof f == "function" && f.length > 0 ? E(
        () => f(
          t ? l : () => {
            if (E(r)[0] !== i) throw Me("Match");
            return o.when;
          }
        )
      ) : f;
    },
    void 0,
    void 0
  );
}
function Mt(e) {
  return e;
}
let K;
function Ft(e) {
  let t;
  d.context && d.load && (t = d.load(d.getContextId()));
  const [n, s] = L(t, void 0);
  return K || (K = /* @__PURE__ */ new Set()), K.add(s), I(() => K.delete(s)), x(
    () => {
      let r;
      if (r = n()) {
        const i = e.fallback;
        return typeof i == "function" && i.length ? E(() => i(r, () => s())) : i;
      }
      return Re(() => e.children, s);
    },
    void 0,
    void 0
  );
}
const et = (e, t) => e.showContent === t.showContent && e.showFallback === t.showFallback, fe = /* @__PURE__ */ Ne();
function It(e) {
  let [t, n] = L(() => ({
    inFallback: !1
  })), s;
  const r = de(fe), [i, l] = L([]);
  r && (s = r.register(x(() => t()().inFallback)));
  const o = x(
    (f) => {
      const u = e.revealOrder, a = e.tail, { showContent: c = !0, showFallback: h = !0 } = s ? s() : {}, y = i(), p = u === "backwards";
      if (u === "together") {
        const m = y.every((C) => !C()), S = y.map(() => ({
          showContent: m && c,
          showFallback: h
        }));
        return S.inFallback = !m, S;
      }
      let w = !1, v = f.inFallback;
      const A = [];
      for (let m = 0, S = y.length; m < S; m++) {
        const C = p ? S - m - 1 : m, P = y[C]();
        if (!w && !P)
          A[C] = {
            showContent: c,
            showFallback: h
          };
        else {
          const _ = !w;
          _ && (v = !0), A[C] = {
            showContent: _,
            showFallback: !a || _ && a === "collapsed" ? h : !1
          }, w = !0;
        }
      }
      return w || (v = !1), A.inFallback = v, A;
    },
    {
      inFallback: !1
    }
  );
  return n(() => o), je(fe.Provider, {
    value: {
      register: (f) => {
        let u;
        return l((a) => (u = a.length, [...a, f])), x(() => o()[u], void 0, {
          equals: et
        });
      }
    },
    get children() {
      return e.children;
    }
  });
}
function Ht(e) {
  let t = 0, n, s, r, i, l;
  const [o, f] = L(!1), u = Ge(), a = {
    increment: () => {
      ++t === 1 && f(!0);
    },
    decrement: () => {
      --t === 0 && f(!1);
    },
    inFallback: o,
    effects: [],
    resolved: !1
  }, c = re();
  if (d.context && d.load) {
    const p = d.getContextId();
    let w = d.load(p);
    if (w && (typeof w != "object" || w.status !== "success" ? r = w : d.gather(p)), r && r !== "$$f") {
      const [v, A] = L(void 0, {
        equals: !1
      });
      i = v, r.then(
        () => {
          if (d.done) return A();
          d.gather(p), j(s), A(), j();
        },
        (m) => {
          l = m, A();
        }
      );
    }
  }
  const h = de(fe);
  h && (n = h.register(a.inFallback));
  let y;
  return I(() => y && y()), je(u.Provider, {
    value: a,
    get children() {
      return x(() => {
        if (l) throw l;
        if (s = d.context, i)
          return i(), i = void 0;
        s && r === "$$f" && j();
        const p = x(() => e.children);
        return x((w) => {
          const v = a.inFallback(), { showContent: A = !0, showFallback: m = !0 } = n ? n() : {};
          if ((!v || r && r !== "$$f") && A)
            return a.resolved = !0, y && y(), y = s = r = void 0, Be(a.effects), p();
          if (m)
            return y ? w : $((S) => (y = S, s && (j({
              id: s.id + "F",
              count: 0
            }), s = void 0), e.fallback), c);
        });
      });
    }
  });
}
const tt = [
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "disabled",
  "formnovalidate",
  "hidden",
  "indeterminate",
  "inert",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "seamless",
  "selected"
], nt = /* @__PURE__ */ new Set([
  "className",
  "value",
  "readOnly",
  "formNoValidate",
  "isMap",
  "noModule",
  "playsInline",
  ...tt
]), st = /* @__PURE__ */ new Set([
  "innerHTML",
  "textContent",
  "innerText",
  "children"
]), rt = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(null), {
  className: "class",
  htmlFor: "for"
}), it = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(null), {
  class: "className",
  formnovalidate: {
    $: "formNoValidate",
    BUTTON: 1,
    INPUT: 1
  },
  ismap: {
    $: "isMap",
    IMG: 1
  },
  nomodule: {
    $: "noModule",
    SCRIPT: 1
  },
  playsinline: {
    $: "playsInline",
    VIDEO: 1
  },
  readonly: {
    $: "readOnly",
    INPUT: 1,
    TEXTAREA: 1
  }
});
function ot(e, t) {
  const n = it[e];
  return typeof n == "object" ? n[t] ? n.$ : void 0 : n;
}
const lt = /* @__PURE__ */ new Set([
  "beforeinput",
  "click",
  "dblclick",
  "contextmenu",
  "focusin",
  "focusout",
  "input",
  "keydown",
  "keyup",
  "mousedown",
  "mousemove",
  "mouseout",
  "mouseover",
  "mouseup",
  "pointerdown",
  "pointermove",
  "pointerout",
  "pointerover",
  "pointerup",
  "touchend",
  "touchmove",
  "touchstart"
]), ft = /* @__PURE__ */ new Set([
  "altGlyph",
  "altGlyphDef",
  "altGlyphItem",
  "animate",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "circle",
  "clipPath",
  "color-profile",
  "cursor",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "filter",
  "font",
  "font-face",
  "font-face-format",
  "font-face-name",
  "font-face-src",
  "font-face-uri",
  "foreignObject",
  "g",
  "glyph",
  "glyphRef",
  "hkern",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "metadata",
  "missing-glyph",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "set",
  "stop",
  "svg",
  "switch",
  "symbol",
  "text",
  "textPath",
  "tref",
  "tspan",
  "use",
  "view",
  "vkern"
]), ct = {
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace"
}, Dt = /* @__PURE__ */ new Set([
  "html",
  "base",
  "head",
  "link",
  "meta",
  "style",
  "title",
  "body",
  "address",
  "article",
  "aside",
  "footer",
  "header",
  "main",
  "nav",
  "section",
  "body",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "ul",
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
  "area",
  "audio",
  "img",
  "map",
  "track",
  "video",
  "embed",
  "iframe",
  "object",
  "param",
  "picture",
  "portal",
  "source",
  "svg",
  "math",
  "canvas",
  "noscript",
  "script",
  "del",
  "ins",
  "caption",
  "col",
  "colgroup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "button",
  "datalist",
  "fieldset",
  "form",
  "input",
  "label",
  "legend",
  "meter",
  "optgroup",
  "option",
  "output",
  "progress",
  "select",
  "textarea",
  "details",
  "dialog",
  "menu",
  "summary",
  "details",
  "slot",
  "template",
  "acronym",
  "applet",
  "basefont",
  "bgsound",
  "big",
  "blink",
  "center",
  "content",
  "dir",
  "font",
  "frame",
  "frameset",
  "hgroup",
  "image",
  "keygen",
  "marquee",
  "menuitem",
  "nobr",
  "noembed",
  "noframes",
  "plaintext",
  "rb",
  "rtc",
  "shadow",
  "spacer",
  "strike",
  "tt",
  "xmp",
  "a",
  "abbr",
  "acronym",
  "address",
  "applet",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "basefont",
  "bdi",
  "bdo",
  "bgsound",
  "big",
  "blink",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "content",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "font",
  "footer",
  "form",
  "frame",
  "frameset",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "image",
  "img",
  "input",
  "ins",
  "kbd",
  "keygen",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "marquee",
  "menu",
  "menuitem",
  "meta",
  "meter",
  "nav",
  "nobr",
  "noembed",
  "noframes",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "plaintext",
  "portal",
  "pre",
  "progress",
  "q",
  "rb",
  "rp",
  "rt",
  "rtc",
  "ruby",
  "s",
  "samp",
  "script",
  "section",
  "select",
  "shadow",
  "slot",
  "small",
  "source",
  "spacer",
  "span",
  "strike",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "tt",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
  "xmp",
  "input",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
]);
function ut(e, t, n) {
  let s = n.length, r = t.length, i = s, l = 0, o = 0, f = t[r - 1].nextSibling, u = null;
  for (; l < r || o < i; ) {
    if (t[l] === n[o]) {
      l++, o++;
      continue;
    }
    for (; t[r - 1] === n[i - 1]; )
      r--, i--;
    if (r === l) {
      const a = i < s ? o ? n[o - 1].nextSibling : n[i - o] : f;
      for (; o < i; ) e.insertBefore(n[o++], a);
    } else if (i === o)
      for (; l < r; )
        (!u || !u.has(t[l])) && t[l].remove(), l++;
    else if (t[l] === n[i - 1] && n[o] === t[r - 1]) {
      const a = t[--r].nextSibling;
      e.insertBefore(n[o++], t[l++].nextSibling), e.insertBefore(n[--i], a), t[r] = n[i];
    } else {
      if (!u) {
        u = /* @__PURE__ */ new Map();
        let c = o;
        for (; c < i; ) u.set(n[c], c++);
      }
      const a = u.get(t[l]);
      if (a != null)
        if (o < a && a < i) {
          let c = l, h = 1, y;
          for (; ++c < r && c < i && !((y = u.get(t[c])) == null || y !== a + h); )
            h++;
          if (h > a - o) {
            const p = t[l];
            for (; o < a; ) e.insertBefore(n[o++], p);
          } else e.replaceChild(n[o++], t[l++]);
        } else l++;
      else t[l++].remove();
    }
  }
}
const q = "_$DX_DELEGATE";
function me(e, t, n, s = {}) {
  let r;
  return $((i) => {
    r = i, t === document ? e() : ue(t, e(), t.firstChild ? null : void 0, n);
  }, s.owner), () => {
    r(), t.textContent = "";
  };
}
function _t(e, t, n) {
  let s;
  const r = () => {
    const l = document.createElement("template");
    return l.innerHTML = e, n ? l.content.firstChild.firstChild : l.content.firstChild;
  }, i = t ? () => E(() => document.importNode(s || (s = r()), !0)) : () => (s || (s = r())).cloneNode(!0);
  return i.cloneNode = i, i;
}
function at(e, t = window.document) {
  const n = t[q] || (t[q] = /* @__PURE__ */ new Set());
  for (let s = 0, r = e.length; s < r; s++) {
    const i = e[s];
    n.has(i) || (n.add(i), t.addEventListener(i, he));
  }
}
function Rt(e = window.document) {
  if (e[q]) {
    for (let t of e[q].keys()) e.removeEventListener(t, he);
    delete e[q];
  }
}
function qt(e, t, n) {
  O(e) || (e[t] = n);
}
function ce(e, t, n) {
  O(e) || (n == null ? e.removeAttribute(t) : e.setAttribute(t, n));
}
function dt(e, t, n, s) {
  O(e) || (s == null ? e.removeAttributeNS(t, n) : e.setAttributeNS(t, n, s));
}
function ht(e, t, n) {
  O(e) || (n ? e.setAttribute(t, "") : e.removeAttribute(t));
}
function gt(e, t) {
  O(e) || (t == null ? e.removeAttribute("class") : e.className = t);
}
function yt(e, t, n, s) {
  if (s)
    Array.isArray(n) ? (e[`$$${t}`] = n[0], e[`$$${t}Data`] = n[1]) : e[`$$${t}`] = n;
  else if (Array.isArray(n)) {
    const r = n[0];
    e.addEventListener(t, n[0] = (i) => r.call(e, n[1], i));
  } else e.addEventListener(t, n, typeof n != "function" && n);
}
function bt(e, t, n = {}) {
  const s = Object.keys(t || {}), r = Object.keys(n);
  let i, l;
  for (i = 0, l = r.length; i < l; i++) {
    const o = r[i];
    !o || o === "undefined" || t[o] || (pe(e, o, !1), delete n[o]);
  }
  for (i = 0, l = s.length; i < l; i++) {
    const o = s[i], f = !!t[o];
    !o || o === "undefined" || n[o] === f || !f || (pe(e, o, !0), n[o] = f);
  }
  return n;
}
function mt(e, t, n) {
  if (!t) return n ? ce(e, "style") : t;
  const s = e.style;
  if (typeof t == "string") return s.cssText = t;
  typeof n == "string" && (s.cssText = n = void 0), n || (n = {}), t || (t = {});
  let r, i;
  for (i in n)
    t[i] == null && s.removeProperty(i), delete n[i];
  for (i in t)
    r = t[i], r !== n[i] && (s.setProperty(i, r), n[i] = r);
  return n;
}
function pt(e, t = {}, n, s) {
  const r = {};
  return s || M(
    () => r.children = H(e, t.children, r.children)
  ), M(() => typeof t.ref == "function" && wt(t.ref, e)), M(() => xt(e, t, n, !0, r, !0)), r;
}
function Bt(e, t) {
  const n = e[t];
  return Object.defineProperty(e, t, {
    get() {
      return n();
    },
    enumerable: !0
  }), e;
}
function wt(e, t, n) {
  return E(() => e(t, n));
}
function ue(e, t, n, s) {
  if (n !== void 0 && !s && (s = []), typeof t != "function") return H(e, t, s, n);
  M((r) => H(e, t(), r, n), s);
}
function xt(e, t, n, s, r = {}, i = !1) {
  t || (t = {});
  for (const l in r)
    if (!(l in t)) {
      if (l === "children") continue;
      r[l] = we(e, l, null, r[l], n, i, t);
    }
  for (const l in t) {
    if (l === "children") {
      s || H(e, t.children);
      continue;
    }
    const o = t[l];
    r[l] = we(e, l, o, r[l], n, i, t);
  }
}
function St(e, t, n = {}) {
  if (globalThis._$HY.done) return me(e, t, [...t.childNodes], n);
  d.completed = globalThis._$HY.completed, d.events = globalThis._$HY.events, d.load = (s) => globalThis._$HY.r[s], d.has = (s) => s in globalThis._$HY.r, d.gather = (s) => Se(t, s), d.registry = /* @__PURE__ */ new Map(), d.context = {
    id: n.renderId || "",
    count: 0
  };
  try {
    return Se(t, n.renderId), me(e, t, [...t.childNodes], n);
  } finally {
    d.context = null;
  }
}
function kt(e) {
  let t, n;
  return !O() || !(t = d.registry.get(n = Ct())) ? e() : (d.completed && d.completed.add(t), d.registry.delete(n), t);
}
function Gt(e, t) {
  for (; e && e.localName !== t; ) e = e.nextSibling;
  return e;
}
function Ut(e) {
  let t = e, n = 0, s = [];
  if (O(e))
    for (; t; ) {
      if (t.nodeType === 8) {
        const r = t.nodeValue;
        if (r === "$") n++;
        else if (r === "/") {
          if (n === 0) return [t, s];
          n--;
        }
      }
      s.push(t), t = t.nextSibling;
    }
  return [t, s];
}
function Vt() {
  d.events && !d.events.queued && (queueMicrotask(() => {
    const { completed: e, events: t } = d;
    if (t) {
      for (t.queued = !1; t.length; ) {
        const [n, s] = t[0];
        if (!e.has(n)) return;
        t.shift(), he(s);
      }
      d.done && (d.events = _$HY.events = null, d.completed = _$HY.completed = null);
    }
  }), d.events.queued = !0);
}
function O(e) {
  return !!d.context && !d.done && (!e || e.isConnected);
}
function At(e) {
  return e.toLowerCase().replace(/-([a-z])/g, (t, n) => n.toUpperCase());
}
function pe(e, t, n) {
  const s = t.trim().split(/\s+/);
  for (let r = 0, i = s.length; r < i; r++)
    e.classList.toggle(s[r], n);
}
function we(e, t, n, s, r, i, l) {
  let o, f, u, a, c;
  if (t === "style") return mt(e, n, s);
  if (t === "classList") return bt(e, n, s);
  if (n === s) return s;
  if (t === "ref")
    i || n(e);
  else if (t.slice(0, 3) === "on:") {
    const h = t.slice(3);
    s && e.removeEventListener(h, s, typeof s != "function" && s), n && e.addEventListener(h, n, typeof n != "function" && n);
  } else if (t.slice(0, 10) === "oncapture:") {
    const h = t.slice(10);
    s && e.removeEventListener(h, s, !0), n && e.addEventListener(h, n, !0);
  } else if (t.slice(0, 2) === "on") {
    const h = t.slice(2).toLowerCase(), y = lt.has(h);
    if (!y && s) {
      const p = Array.isArray(s) ? s[0] : s;
      e.removeEventListener(h, p);
    }
    (y || n) && (yt(e, h, n, y), y && at([h]));
  } else if (t.slice(0, 5) === "attr:")
    ce(e, t.slice(5), n);
  else if (t.slice(0, 5) === "bool:")
    ht(e, t.slice(5), n);
  else if ((c = t.slice(0, 5) === "prop:") || (u = st.has(t)) || !r && ((a = ot(t, e.tagName)) || (f = nt.has(t))) || (o = e.nodeName.includes("-") || "is" in l)) {
    if (c)
      t = t.slice(5), f = !0;
    else if (O(e)) return n;
    t === "class" || t === "className" ? gt(e, n) : o && !f && !u ? e[At(t)] = n : e[a || t] = n;
  } else {
    const h = r && t.indexOf(":") > -1 && ct[t.split(":")[0]];
    h ? dt(e, h, t, n) : ce(e, rt[t] || t, n);
  }
  return n;
}
function he(e) {
  if (d.registry && d.events && d.events.find(([f, u]) => u === e))
    return;
  let t = e.target;
  const n = `$$${e.type}`, s = e.target, r = e.currentTarget, i = (f) => Object.defineProperty(e, "target", {
    configurable: !0,
    value: f
  }), l = () => {
    const f = t[n];
    if (f && !t.disabled) {
      const u = t[`${n}Data`];
      if (u !== void 0 ? f.call(t, u, e) : f.call(t, e), e.cancelBubble) return;
    }
    return t.host && typeof t.host != "string" && !t.host._$host && t.contains(e.target) && i(t.host), !0;
  }, o = () => {
    for (; l() && (t = t._$host || t.parentNode || t.host); ) ;
  };
  if (Object.defineProperty(e, "currentTarget", {
    configurable: !0,
    get() {
      return t || document;
    }
  }), d.registry && !d.done && (d.done = _$HY.done = !0), e.composedPath) {
    const f = e.composedPath();
    i(f[0]);
    for (let u = 0; u < f.length - 2 && (t = f[u], !!l()); u++) {
      if (t._$host) {
        t = t._$host, o();
        break;
      }
      if (t.parentNode === r)
        break;
    }
  } else o();
  i(s);
}
function H(e, t, n, s, r) {
  const i = O(e);
  if (i) {
    !n && (n = [...e.childNodes]);
    let f = [];
    for (let u = 0; u < n.length; u++) {
      const a = n[u];
      a.nodeType === 8 && a.data.slice(0, 2) === "!$" ? a.remove() : f.push(a);
    }
    n = f;
  }
  for (; typeof n == "function"; ) n = n();
  if (t === n) return n;
  const l = typeof t, o = s !== void 0;
  if (e = o && n[0] && n[0].parentNode || e, l === "string" || l === "number") {
    if (i || l === "number" && (t = t.toString(), t === n))
      return n;
    if (o) {
      let f = n[0];
      f && f.nodeType === 3 ? f.data !== t && (f.data = t) : f = document.createTextNode(t), n = F(e, n, s, f);
    } else
      n !== "" && typeof n == "string" ? n = e.firstChild.data = t : n = e.textContent = t;
  } else if (t == null || l === "boolean") {
    if (i) return n;
    n = F(e, n, s);
  } else {
    if (l === "function")
      return M(() => {
        let f = t();
        for (; typeof f == "function"; ) f = f();
        n = H(e, f, n, s);
      }), () => n;
    if (Array.isArray(t)) {
      const f = [], u = n && Array.isArray(n);
      if (ae(f, t, n, r))
        return M(() => n = H(e, f, n, s, !0)), () => n;
      if (i) {
        if (!f.length) return n;
        if (s === void 0) return n = [...e.childNodes];
        let a = f[0];
        if (a.parentNode !== e) return n;
        const c = [a];
        for (; (a = a.nextSibling) !== s; ) c.push(a);
        return n = c;
      }
      if (f.length === 0) {
        if (n = F(e, n, s), o) return n;
      } else u ? n.length === 0 ? xe(e, f, s) : ut(e, n, f) : (n && F(e), xe(e, f));
      n = f;
    } else if (t.nodeType) {
      if (i && t.parentNode) return n = o ? [t] : t;
      if (Array.isArray(n)) {
        if (o) return n = F(e, n, s, t);
        F(e, n, null, t);
      } else n == null || n === "" || !e.firstChild ? e.appendChild(t) : e.replaceChild(t, e.firstChild);
      n = t;
    }
  }
  return n;
}
function ae(e, t, n, s) {
  let r = !1;
  for (let i = 0, l = t.length; i < l; i++) {
    let o = t[i], f = n && n[e.length], u;
    if (!(o == null || o === !0 || o === !1)) if ((u = typeof o) == "object" && o.nodeType)
      e.push(o);
    else if (Array.isArray(o))
      r = ae(e, o, f) || r;
    else if (u === "function")
      if (s) {
        for (; typeof o == "function"; ) o = o();
        r = ae(
          e,
          Array.isArray(o) ? o : [o],
          Array.isArray(f) ? f : [f]
        ) || r;
      } else
        e.push(o), r = !0;
    else {
      const a = String(o);
      f && f.nodeType === 3 && f.data === a ? e.push(f) : e.push(document.createTextNode(a));
    }
  }
  return r;
}
function xe(e, t, n = null) {
  for (let s = 0, r = t.length; s < r; s++) e.insertBefore(t[s], n);
}
function F(e, t, n, s) {
  if (n === void 0) return e.textContent = "";
  const r = s || document.createTextNode("");
  if (t.length) {
    let i = !1;
    for (let l = t.length - 1; l >= 0; l--) {
      const o = t[l];
      if (r !== o) {
        const f = o.parentNode === e;
        !i && !l ? f ? e.replaceChild(r, o) : e.insertBefore(r, n) : f && o.remove();
      } else i = !0;
    }
  } else e.insertBefore(r, n);
  return [r];
}
function Se(e, t) {
  const n = e.querySelectorAll("*[data-hk]");
  for (let s = 0; s < n.length; s++) {
    const r = n[s], i = r.getAttribute("data-hk");
    (!t || i.startsWith(t)) && !d.registry.has(i) && d.registry.set(i, r);
  }
}
function Ct() {
  return d.getNextContextId();
}
function Kt(e) {
  return d.context ? void 0 : e.children;
}
function Yt(e) {
  return e.children;
}
const Xt = () => {
}, Wt = Symbol();
function Qt(e, t) {
  !d.context && (e.innerHTML = t);
}
function ge(e) {
  const t = new Error(`${e.name} is not supported in the browser, returning undefined`);
  console.error(t);
}
function Et(e, t) {
  ge(Et);
}
function Nt(e, t) {
  ge(Nt);
}
function vt(e, t) {
  ge(vt);
}
function Jt(e, ...t) {
}
function Zt(e, t, n, s) {
}
function zt(e) {
}
function en(e) {
}
function tn(e, t) {
}
function nn() {
}
function sn(e) {
}
function rn(e) {
}
function on(e, t, n) {
}
const ln = !1, fn = !1, Tt = "http://www.w3.org/2000/svg";
function Fe(e, t = !1) {
  return t ? document.createElementNS(Tt, e) : document.createElement(e);
}
const cn = (...e) => (Je(), St(...e));
function un(e) {
  const { useShadow: t } = e, n = document.createTextNode(""), s = () => e.mount || document.body, r = re();
  let i, l = !!d.context;
  return _e(
    () => {
      l && (re().user = l = !1), i || (i = qe(r, () => x(() => e.children)));
      const o = s();
      if (o instanceof HTMLHeadElement) {
        const [f, u] = L(!1), a = () => u(!0);
        $((c) => ue(o, () => f() ? c() : i(), null)), I(a);
      } else {
        const f = Fe(e.isSVG ? "g" : "div", e.isSVG), u = t && f.attachShadow ? f.attachShadow({
          mode: "open"
        }) : f;
        Object.defineProperty(f, "_$host", {
          get() {
            return n.parentNode;
          },
          configurable: !0
        }), ue(u, i), o.appendChild(f), e.ref && e.ref(f), I(() => o.removeChild(f));
      }
    },
    void 0,
    {
      render: !l
    }
  ), n;
}
function an(e) {
  const [t, n] = ze(e, ["component"]), s = x(() => t.component);
  return x(() => {
    const r = s();
    switch (typeof r) {
      case "function":
        return E(() => r(n));
      case "string":
        const i = ft.has(r), l = d.context ? kt() : Fe(r, i);
        return pt(l, n, i), l;
    }
  });
}
export {
  rt as Aliases,
  Xt as Assets,
  st as ChildProperties,
  Dt as DOMElements,
  lt as DelegatedEvents,
  an as Dynamic,
  Ft as ErrorBoundary,
  Pt as For,
  Yt as Hydration,
  Xt as HydrationScript,
  $t as Index,
  Mt as Match,
  Kt as NoHydration,
  un as Portal,
  nt as Properties,
  Wt as RequestContext,
  ft as SVGElements,
  ct as SVGNamespace,
  Lt as Show,
  Ht as Suspense,
  It as SuspenseList,
  jt as Switch,
  yt as addEventListener,
  xt as assign,
  bt as classList,
  gt as className,
  Rt as clearDelegatedEvents,
  je as createComponent,
  at as delegateEvents,
  Bt as dynamicProperty,
  M as effect,
  rn as escape,
  Xt as generateHydrationScript,
  Xt as getAssets,
  Ct as getHydrationKey,
  kt as getNextElement,
  Ut as getNextMarker,
  Gt as getNextMatch,
  re as getOwner,
  ot as getPropAlias,
  Xt as getRequestEvent,
  cn as hydrate,
  Qt as innerHTML,
  ue as insert,
  fn as isDev,
  ln as isServer,
  x as memo,
  Ot as mergeProps,
  me as render,
  vt as renderToStream,
  Et as renderToString,
  Nt as renderToStringAsync,
  sn as resolveSSRNode,
  Vt as runHydrationEvents,
  ce as setAttribute,
  dt as setAttributeNS,
  ht as setBoolAttribute,
  qt as setProperty,
  pt as spread,
  Jt as ssr,
  tn as ssrAttribute,
  zt as ssrClassList,
  Zt as ssrElement,
  nn as ssrHydrationKey,
  on as ssrSpread,
  en as ssrStyle,
  mt as style,
  _t as template,
  E as untrack,
  wt as use,
  Xt as useAssets
};
