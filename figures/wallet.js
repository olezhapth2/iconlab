/**
 * Wallet: a rounded billfold holding four cards. The card under the pointer
 * stands up out of the fold and lifts; the ones in front lean forward and the
 * ones behind lean back, staggered outwards from it on the 700ms lift curve.
 * Each card carries a chip and two contactless arcs, and a dot rides the chip
 * of the card in play, or the front card at rest. The slider is the stagger.
 *
 * The pattern: discrete items. Tweens, a stagger by distance, identity carried
 * by geometry, and a hit test on static bands along the resting top edges.
 */
const {
  Cam, clamp, facing, fillet, fit, hull, open, poly, proj, rad, ringAt, rrect, run, seg,
  tdone, tset, tval, tween, disposer, mk, place, pointer, reflect, register, flatDot,
} = HL;

const N = 4, W = 62, H = 48, G = 17;
const REST = -12, BACK = -24, FWD = 20, LIFT = 15, REST_I = N - 1;
const X0 = -5, X1 = W + 5, Y0 = -9, Y1 = (N - 1) * G + 10, WH = 16, WR = 8, WT = 2.6;

/** A run of points ordered left to right on screen. */
const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());

/** The billfold, which never moves: `far` paints before the cards, `near` after them. */
function fold(P, front, outer, inner) {
  const far = [
    [poly(hull(ringAt(P, outer, 0).concat(ringAt(P, outer, WH)))), "sil"],
    [poly(ringAt(P, inner, WH)), "nf"],
    [open(ringAt(P, run(inner, (q) => !front(q)), 2.5)), "nf lo"],
  ];
  const iF = LR(ringAt(P, run(inner, front), WH)), oT = LR(ringAt(P, run(outer, front), WH)), oB = LR(ringAt(P, run(outer, front), 0));
  const hx = (X0 + X1) / 2, face = (ring) => ring.map((q) => P(q.u, Y1, q.v));
  // a snap set into the front: a round socket and its button, what a fold has
  const near = [
    [poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), "fo"],
    [open(oT), "nf lo"],
    [open(iF), "nf"],
    [open([oT[0], ...oB, oT[oT.length - 1]]), "nf sil"],
    [poly(face(rrect(hx - 6, 5.5, hx + 6, 11.5, 3, 5))), "nf"],
    [poly(face(rrect(hx - 3, 7.2, hx + 3, 9.8, 1.4, 5))), "nf lo"],
  ];
  return { far, near };
}

/** Card i's outline, upright in its own plane, with its chip and its two arcs. */
function pose(P, i, th, lift) {
  const shape = fillet([[0, 0], [W, 0], [W, H], [0, H]], [4.5, 4.5, 4.5, 4.5]);
  const yb = i * G, s = Math.sin(rad(th)), c = Math.cos(rad(th));
  const w = (u, v) => P(u, yb + v * s, v * c + lift);
  const wb = (u, v) => P(u, yb + v * s - 1.7 * c, v * c + 1.7 * s + lift);
  const chip = rrect(7, 10, 27, 26, 3.2, 5).map((p) => w(p.u, p.v));
  const wave = [7, 11.5].map((r) =>
    open(Array.from({ length: 9 }, (_, k) => w(35 + r * Math.cos(rad(-55 + k * 13.75)), 18 + r * Math.sin(rad(-55 + k * 13.75))))));
  return { back: poly(shape.map((p) => wb(p[0], p[1]))), face: poly(shape.map((p) => w(p[0], p[1]))), chip: poly(chip), wave: wave.join(""), chipPt: w(17, 18) };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 2);
  fit(C, [[X0, Y0, 0], [X1, Y1, -7], [X1, Y0, 0], [X0, Y1, 0], [X0, Y0, H], [X1, Y0, H + LIFT]], 200, 166);
  const P = proj(C), front = facing(C);
  const outer = rrect(X0, Y0, X1, Y1, WR, 6), inner = rrect(X0 + WT, Y0 + WT, X1 - WT, Y1 - WT, WR - WT, 6);
  const paths = fold(P, front, outer, inner);

  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, outer, 0, 14);
  for (const [d, cls] of paths.far) mk("path", { d, class: cls }, g);

  const cards = [];
  for (let i = 0; i < N; i++) {
    const grp = mk("g", {}, g);
    const back = mk("path", { class: "lo" }, grp), face = mk("path", { class: "sil" }, grp);
    const chip = mk("path", { class: "nf lo" }, grp), wave = mk("path", { class: "nf lo" }, grp);
    cards.push({ grp, back, face, chip, wave, a: tween(REST), z: tween(0), chipPt: null });
  }

  for (const [d, cls] of paths.near) mk("path", { d, class: cls }, g);

  // The mark: a dot on the chip of the card in play, kept in that card's paint order.
  const mark = mk("g", {}, g), dot = flatDot(mark, C, 0.95, "dot");
  let mcard = REST_I;

  // hit bands: oblique strips along the resting top edges. They never move.
  const top = (i) => P(W / 2, i * G + H * Math.sin(rad(REST)), H * Math.cos(rad(REST)));
  const c0 = top(0), c1 = top(1), d = [c1[0] - c0[0], c1[1] - c0[1]];
  const px0 = P(0, 0, 0), px1 = P(1, 0, 0), ex = [px1[0] - px0[0], px1[1] - px0[1]];
  const HALF = W / 2 + 6, det = d[0] * ex[1] - d[1] * ex[0];

  /** The card whose band holds the point; -1 outside. */
  function hit([x, y]) {
    const qx = x - c0[0], qy = y - c0[1];
    const s = (qx * ex[1] - qy * ex[0]) / det, r = (d[0] * qy - d[1] * qx) / det;
    if (Math.abs(r) > HALF || s < -0.5 || s > N + 1) return -1;
    return clamp(Math.round(s), 0, N - 1);
  }

  function draw(i, th, lift) {
    const cd = cards[i], q = pose(P, i, th, lift);
    cd.back.setAttribute("d", q.back); cd.face.setAttribute("d", q.face);
    cd.chip.setAttribute("d", q.chip); cd.wave.setAttribute("d", q.wave);
    cd.chipPt = q.chipPt;
    if (i === mcard) place(dot, q.chipPt);
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    cards.forEach((cd, i) => {
      const th = tval(cd.a, now), lift = tval(cd.z, now);
      draw(i, th, lift);
      if (!tdone(cd.a, now) || !tdone(cd.z, now)) moving = true;
    });
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;
  /** Pulls card a (-1 puts them all back). The stagger spreads out from the card pulled. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    cards.forEach((cd, i) => {
      const delay = Math.abs(i - from) * stag;
      const th = a < 0 ? REST : i < a ? BACK : i > a ? FWD : 0;
      tset(cd.a, th, now, delay); tset(cd.z, a === i ? LIFT : 0, now, delay);
      cd.face.classList.toggle("hi", i === a); cd.chip.classList.toggle("hi", i === a); cd.wave.classList.toggle("hi", i === a);
    });
    const want = a < 0 ? REST_I : a;
    if (want !== mcard) { mcard = want; cards[mcard].grp.after(mark); place(dot, cards[mcard].chipPt); }
    read.textContent = a < 0 ? "rest" : String(N - a).padStart(2, "0");
    B.wake();
  }

  cards[REST_I].grp.after(mark);
  draw(REST_I, REST, 0);
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "wallet",
  means: "Four cards in a fold: the one under the pointer stands up, and its neighbours lean away.",
  rules: [1, 2, 5, 9],
  range: [0, 40, 90],
  tour: [[150, 176], [214, 132], [272, 158], null],
  mount,
});
