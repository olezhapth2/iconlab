/**
 * Rig: a miner's case with a fan turning in a cylindrical housing on its near
 * side, one ambient clock that never stops. The housing is drawn as two rims —
 * a front one proud of the face, a back one at the wall — joined by their
 * silhouette walls, so the vent reads as a bore, not a decal; the blades sit
 * in the recess behind the front rim.
 *
 * Three hits. The vent triples the pace and pulls the fan proud on a spring.
 * The slots on the lid take the bright and tick, as though hashing. The body
 * itself lifts the whole case a touch, as though you nudged it. The slider is
 * the base rate.
 */
const {
  Cam, facing, fit, open, poly, proj, prism, r2, rings, seg, spring, stepS, reducedMotion,
  disposer, mk, place, pointer, put, register, solid,
} = HL;

const X1 = 30, Y1 = 18, H = 26, RAD = 6;
const FCX = 6, FCZ = 13, RING = 10.2, RHUB = 2.4, NB = 5, TWIST = 1.35, DEPTH = 7, BLADE = 0.42;
const BASE = 2.4, TAU = Math.PI * 2, SPIN = 7, VENTS = [-11, -4, 3, 10], LIFT = 12;
const TILT = 3;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let rate = value, ph = 0, over = null;

  const C = Cam(45, 0.5, 3.6);
  fit(C, [[-X1, -Y1, 0], [X1, Y1, 0], [X1, -Y1, 0], [-X1, Y1, 0],
    [-X1, -Y1, H], [X1, Y1, H]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const caseG = mk("g", {}, g);
  put(solid(caseG), prism(P, front, ...rings(-X1, -Y1, X1, Y1, RAD, 2), 0, H));

  // slots cut in the lid, toward the far edge
  const slots = VENTS.map((y) =>
    mk("path", { d: open([P(-22, y, H + 0.05), P(22, y, H + 0.05)]), class: "nf lo" }, caseG));

  // the bore: a front rim proud of the face, a back rim at the wall, the walls between
  const at = (x, r, a) => P(x, Y1 + r * Math.cos(a), FCZ + r * Math.sin(a));
  const circle = (x, r) => {
    const pts = [];
    for (let i = 0; i < 48; i++) pts.push(at(x, r, i / 48 * TAU));
    return pts;
  };
  const back = circle(FCX, RING), rim = circle(FCX + DEPTH, RING);
  // the whole bore rides the springs — housing proud, and following a nudge
  const bore = mk("g", {}, g);
  // the bore's silhouette: only the two generators tangent to the view, like a prism's edges
  const ax = (() => { const a = P(FCX, 0, 0), b = P(FCX + 1, 0, 0); return [b[0] - a[0], b[1] - a[1]]; })();
  const px = (() => { const l = Math.hypot(ax[0], ax[1]) || 1; return [-ax[1] / l, ax[0] / l]; })();
  let iMax = 0, iMin = 0, sMax = -1e9, sMin = 1e9;
  for (let i = 0; i < 48; i++) {
    const s = (back[i][0] + rim[i][0]) * px[0] + (back[i][1] + rim[i][1]) * px[1];
    if (s > sMax) { sMax = s; iMax = i; }
    if (s < sMin) { sMin = s; iMin = i; }
  }
  mk("path", { d: seg(back[iMax], rim[iMax]), class: "nf" }, bore);
  mk("path", { d: seg(back[iMin], rim[iMin]), class: "nf" }, bore);
  mk("path", { d: poly(back), class: "nf lo" }, bore);
  const rimP = mk("path", { d: poly(rim), class: "nf" }, bore);
  const fan = mk("g", {}, bore);
  const blades = Array.from({ length: NB }, () => mk("path", { class: "nf lo" }, fan));
  const hub = mk("circle", { r: RHUB, class: "dot" }, fan);
  place(hub, at(FCX + DEPTH * BLADE, 0, 0));

  // proud of the face is one screen vector: world +y under this camera
  const o0 = P(0, 0, 0), o1 = P(0, 1, 0);
  const vOut = [o1[0] - o0[0], o1[1] - o0[1]];
  const vUp = (() => { const a = P(0, 0, 0), b = P(0, 0, 1); return [b[0] - a[0], b[1] - a[1]]; })();

  /** The spines at phase q, each swept from hub to tip, drawn in the recess. */
  function spin(q) {
    blades.forEach((el, k) => {
      const pts = [];
      for (let i = 0; i <= SPIN; i++) {
        const t = i / SPIN, a = q + k * TAU / NB + TWIST * t;
        pts.push(at(FCX + DEPTH * BLADE, RHUB + t * (RING * 0.92 - RHUB), a));
      }
      el.setAttribute("d", open(pts));
    });
  }

  // hits, all static: the vent bore, the lid slots, the near body
  const inRing = (p) => {
    let n = false;
    for (let i = 0, j = rim.length - 1; i < rim.length; j = i++) {
      const [xi, yi] = rim[i], [xj, yj] = rim[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) n = !n;
    }
    return n;
  };
  const slotBox = (() => {
    const c = [P(0, (VENTS[0] + VENTS[3]) / 2, H)];
    return (p) => Math.abs(p[0] - c[0][0]) < 58 && Math.abs(p[1] - c[0][1]) < 26;
  })();
  const bodyHit = (p) => {
    const c = P(0, Y1 * 0.4, H * 0.45);
    return Math.abs(p[0] - c[0]) < 92 && Math.abs(p[1] - c[1]) < 60 && !inRing(p) && !slotBox(p);
  };
  const state = (p) => (p ? (inRing(p) ? 0 : slotBox(p) ? 1 : bodyHit(p) ? 2 : null) : null);

  const rs = spring(rate), lp = spring(0), tp = spring(0);
  let drawn = NaN, lifted = NaN, tilted = NaN;
  const B = register(stage, (dt) => {
    let moving = stepS(rs, dt);
    if (stepS(lp, dt)) moving = true;
    if (stepS(tp, dt)) moving = true;
    if (!reducedMotion()) ph = (ph + dt * BASE * rs.x) % TAU;
    if (ph !== drawn) { drawn = ph; spin(ph); moving = true; }
    if (lp.x !== lifted || tp.x !== tilted) {
      lifted = lp.x; tilted = tp.x;
      const dx = lifted * LIFT * vOut[0] - tilted * TILT * vUp[0];
      const dy = lifted * LIFT * vOut[1] - tilted * TILT * vUp[1];
      bore.setAttribute("transform", `translate(${r2(dx)} ${r2(dy)})`);
      caseG.setAttribute("transform", `translate(${r2(tilted * TILT * vUp[0] * -0.4)} ${r2(tilted * TILT * vUp[1] * -0.4)})`);
    }
    return moving;
  });
  bag.add(B.unregister);

  const apply = (w) => {
    rs.t = w === 0 ? rate * 3 : rate;
    lp.t = w === 0 ? 1 : 0;
    tp.t = w === 2 ? 1 : 0;
    for (const el of blades) { el.classList.toggle("hi", w === 0); el.classList.toggle("lo", w !== 0); }
    rimP.classList.toggle("hi", w === 0);
    rimP.classList.toggle("nf", w !== 0);
    hub.classList.toggle("dot", w !== 0);
    hub.classList.toggle("off", w === 0);
    for (const s of slots) { s.classList.toggle("hi", w === 1); s.classList.toggle("lo", w !== 1); }
    read.textContent = ["×3", "hash", "nudge", "rest"][w ?? 3];
    B.wake();
  };

  const aim = (p) => {
    const w = state(p);
    if (w !== over) { over = w; apply(w); }
  };
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { rate = v; rs.t = over === 0 ? v * 3 : v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "rig",
  means: "A mining rig hums: hover the vent to triple the fan, the lid to hash, the case to nudge it.",
  rules: [1, 5, 7, 8],
  range: [0.6, 1.2, 2],
  tour: [[185, 204], [200, 125], [154, 189], null],
  mount,
});
