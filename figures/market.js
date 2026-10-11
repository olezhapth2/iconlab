/**
 * Market: a coin stands on a QR plate and rolls across it toward a receipt
 * that prints out in front. The pointer's x scrubs the payment: the coin
 * travels from one edge of the plate to the other (rolling, its face
 * turning as it goes) and the receipt lengthens. The slider is the longest
 * receipt.
 *
 * The pattern: one continuous number. A spring on a clamped scrub; the coin
 * rewritten only while the payment moves, its silhouette the hull of both
 * faces; the receipt a growing sheet with printed rows. The plate still, its
 * finders and modules the printed code.
 */
const {
  Cam, clamp, facing, fit, hull, poly, prism, proj, rings, seg, spring, stepS,
  mk, place, pointer, put, register, disposer, solid, unproj,
} = HL;

const PX = 23, PY = 15, PZ = 2.5, PR = 4;
const CR = 8, CT = 5.5;
const RW = 11, RY0 = 23, RL0 = 6;
const X0 = 17, X1 = -15;
const TH = Array.from({ length: 48 }, (_, k) => k * Math.PI / 24);
const ROWS = [3, 6.5, 10, 15, 20, 26, 32, 38];
const CELL = 5.5;
const FINDER = [[-19, -12], [11, -12], [-19, 13]];
const MODS = [
  [-2, -12], [2, -12], [-2, -7], [2, -7], [-2, -2], [2, -2], [-2, 3], [2, 3],
  [-2, 8], [2, 8], [-2, 13], [2, 13],
  [7, 3], [12, 3], [7, 8], [12, 8], [7, 13],
  [-14, 3], [-9, 3], [-14, 8], [-14, 13],
];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let LMAX = value;

  const C = Cam(45, 0.5, 4.0);
  fit(C, [
    [-PX - 2, -PY - 2, -1], [PX + 2, PY + 2, -1],
    [-PX - 2, -PY - 2, CT + CR + 4], [PX + 2, PY + 2, CT + CR + 4],
    [-RW, RY0 + LMAX + 2, 0], [RW, RY0 + LMAX + 2, 0],
  ], 200, 140);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const plate = solid(g);
  put(plate, prism(P, front, ...rings(-PX, -PY, PX, PY, PR, 1.8), 0, PZ));

  const at = (u, v, z) => P(u, v, z);
  for (const [fx, fy] of FINDER) {
    mk("path", {
      d: poly(rings(fx, fy, fx + CELL * 3, fy + CELL * 3, 0.6, 1)[0].map((p) => at(p.u, p.v, PZ + 0.05))),
      class: "nf",
    }, g);
    mk("path", {
      d: poly(rings(fx + CELL * 0.9, fy + CELL * 0.9, fx + CELL * 2.1, fy + CELL * 2.1, 0.4, 1)[0].map((p) => at(p.u, p.v, PZ + 0.06))),
      class: "nf lo",
    }, g);
  }
  for (const [mx, my] of MODS) {
    const el = mk("circle", { r: 1.4, class: "dot m", cx: 0, cy: 0 }, g);
    place(el, at(mx, my, PZ + 0.05));
  }
  const mark = mk("circle", { r: 2, class: "dot", cx: 0, cy: 0 }, g);
  place(mark, at(0, 0, PZ + 0.1));

  const coinHull = mk("path", { class: "sil" }, g);
  const coinFace = mk("path", { class: "sil" }, g);
  const coinCrease = mk("path", { class: "nf lo" }, g);
  const coinRelief = mk("path", { class: "nf lo" }, g);

  const recSheet = mk("path", { class: "sil" }, g);
  const recRows = mk("path", { class: "nf lo" }, g);

  const restP = 0.33;
  const sp = spring(restP);
  let drawn = NaN;

  /** The coin at payment p: k-side face ring of radius r0, centre at (cx, CR, z). */
  const coinAt = (ph, k, cx, r0, th) => {
    const s = Math.sin(ph), c = Math.cos(ph), co = Math.cos(th);
    return P(cx - r0 * co * s + (CT / 2) * k * c, r0 * co * c + (CT / 2) * k * s, PZ + CR + r0 * Math.sin(th));
  };
  const coinFaces = (ph, cx) => [
    TH.map((th) => coinAt(ph, 1, cx, CR, th)),
    TH.map((th) => coinAt(ph, -1, cx, CR, th)),
  ];

  const draw = (p, L) => {
    const cx = X0 + p * (X1 - X0);
    const ph = p * Math.PI * 1.5;
    const [f, b] = coinFaces(ph, cx);
    const heads = Math.cos(ph) + Math.sin(ph) > 0, k = heads ? 1 : -1;
    coinHull.setAttribute("d", poly(hull(f.concat(b))));
    coinFace.setAttribute("d", poly(heads ? f : b));
    coinCrease.setAttribute("d", poly(TH.map((th) => coinAt(ph, k, cx, CR - 2.5, th))));
    coinRelief.setAttribute("d", poly(TH.map((th) => coinAt(ph, k, cx, CR * 0.45, th))));

    recSheet.setAttribute("d", poly([
      P(-RW, RY0, 0.15), P(RW, RY0, 0.15), P(RW, RY0 + L, 0.15), P(-RW, RY0 + L, 0.15),
    ]));
    recRows.setAttribute("d", ROWS.filter((u) => u < L - 2).map((u, i) =>
      seg(P(-RW + 2, RY0 + u, 0.16), P(RW - (i % 2 ? 5 : 2.5), RY0 + u, 0.16))).join(""));
  };

  const R = register(stage, (dt) => {
    const m = stepS(sp, dt);
    const p = clamp(sp.x, 0, 1), L = RL0 + p * (LMAX - RL0);
    const key = `${Math.round(p * 60)} ${LMAX}`;
    if (key !== drawn) { drawn = key; draw(p, L); }
    return m;
  });
  bag.add(R.unregister);

  let over = null;
  function retarget() {
    if (over) {
      const w = unproj(C, over[0], over[1], PZ);
      sp.t = w ? clamp(((X0 + 4) - w[0]) / ((X0 + 4) - (X1 - 4)), 0, 1) : restP;
    } else sp.t = restP;
    for (const el of [coinHull, coinFace, coinCrease, coinRelief]) el.classList.toggle("hi", !!over);
    mark.classList.toggle("off", !!over);
    mark.classList.toggle("dot", !over);
    read.textContent = over ? `pay ${Math.round(clamp(sp.t, 0, 1) * 100)}` : "rest";
    R.wake();
  }

  bag.add(pointer(stage, { move: (p) => { over = p; retarget(); }, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());

  draw(restP, RL0 + restP * (LMAX - RL0));

  return {
    set: (v) => { LMAX = v; drawn = NaN; retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "market",
  means: "A coin rolls across a QR plate and a receipt prints out; the pointer's x scrubs the payment.",
  rules: [1, 3, 5, 7],
  range: [22, 28, 34],
  tour: [[245, 147], [237, 143], [173, 184], [74, 233], null],
  mount,
});
