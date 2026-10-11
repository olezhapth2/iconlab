/**
 * Basket: coins rain onto the stack nearest the pointer, one after another,
 * and each landing lets its stack spring up from the impact; the dot on the
 * middle stack holds rest's bright and gives it up to the rain. Leaving pours
 * every stack back to where it was. The slider caps how high a stack may grow.
 *
 * The pattern: a queue of discrete events on one clock. The hit test is the
 * mouth of the basket on its own plane, which never moves; a stack rewrites
 * only the coins its spring has moved; the falling coin is one transform down
 * the vertical, and the loop sleeps the moment the stacks are full.
 */
const {
  Cam, circ, facing, fit, hull, open, poly, proj, r2, rrect, run, ringAt,
  spring, stepS, tdone, tset, tval, tween, unproj,
  disposer, mk, place, pointer, reflect, register,
} = HL;

const X1 = 42, Y1 = 30, WH = 18, WR = 12, TP = 7, WT = 3, DEPTH = 8;
const R = 9, T = 3.2, SLOTS = 6, N = 3, SX = [-22, 0, 22], REST = [2, 1, 2];
const DROP = 34, FALL = 340, CIRC = circ(R, 48), CREASE = circ(R - 1.5, 48);

/** The basket tapers to its base: its outer and inner rings at height z. */
const oRing = (z) => { const s = TP * (1 - z / WH); return rrect(-X1 + s, -Y1 + s, X1 - s, Y1 - s, Math.max(1, WR - s), 6); };
const iRing = (z) => { const s = WT + TP * (1 - z / WH); return rrect(-X1 + s, -Y1 + s, X1 - s, Y1 - s, Math.max(1, WR - s), 6); };
/** A run of points ordered left to right on screen. */
const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let cap = value;

  const C = Cam(45, 0.5, 3.4);
  fit(C, [[-X1, -Y1, -DEPTH], [X1, Y1, -DEPTH], [X1, -Y1, 0], [-X1, Y1, 0],
    [-X1, -Y1, WH], [X1, Y1, WH], [-22, 0, DROP + T], [22, 0, DROP + T]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, oRing(0), 0, DEPTH);

  /** A coin's three paths at the bottom height z: hull, top face, crease. */
  const coinAt = (x0, z) => {
    const at = (ring, h) => ring.map((q) => P(x0 + q.u, q.v, h));
    const top = at(CIRC, z + T), bot = at(CIRC, z);
    return [poly(hull(top.concat(bot))), poly(top), poly(at(CREASE, z + T))];
  };

  // far: the body's silhouette, the floor, its crease along the back wall, the rim
  for (const [d, cls] of [
    [poly(hull(ringAt(P, oRing(WH), WH).concat(ringAt(P, oRing(0), 0)))), "sil"],
    [poly(ringAt(P, iRing(0), 0)), "nf"],
    [open(ringAt(P, run(iRing(2.5), (q) => !front(q)), 2.5)), "nf lo"],
    [open(ringAt(P, iRing(WH), WH)), "nf"],
  ]) mk("path", { d, class: cls }, g);

  // the stacks: every coin pre-drawn as its own paths, hidden until it exists
  const stacks = SX.map((x0, i) => ({
    x0, cnt: REST[i], sp: spring(REST[i]), drawn: NaN, zs: Array(SLOTS).fill(-1),
    coins: Array.from({ length: SLOTS }, () => [
      mk("path", { class: "sil" }, g), mk("path", { class: "sil" }, g), mk("path", { class: "nf lo" }, g),
    ]),
  }));

  /** Writes the coins of a stack whose spring has moved: slots below, the top one rising. */
  function draw(s) {
    const h = s.sp.x, full = Math.floor(h + 1e-6), frac = h - full;
    for (let k = 0; k < SLOTS; k++) {
      const z = k < full ? k * T : k === full && frac > 1e-6 ? Math.max(0, (k - 1 + frac) * T) : -1;
      if (z === s.zs[k]) continue;
      s.zs[k] = z;
      const d = z < 0 ? ["", "", ""] : coinAt(s.x0, z);
      s.coins[k].forEach((el, j) => el.setAttribute("d", d[j]));
    }
    s.drawn = h;
  }

  // the coin in the air, dropped from above the mouth and moved as one transform
  const fgrp = mk("g", {}, g);
  const fpart = [mk("path", { class: "sil" }, fgrp), mk("path", { class: "hi" }, fgrp), mk("path", { class: "nf lo" }, fgrp)];
  const o0 = P(0, 0, 0), o1 = P(0, 0, 1), vZ = [o1[0] - o0[0], o1[1] - o0[1]];
  const restC = SX.map((x0, i) => P(x0, 0, REST[i] * T));
  const dot = mk("circle", { r: 2.6, class: "dot" }, g);
  place(dot, P(0, 0, REST[1] * T));

  // near: the rim and the outer face over whatever fell behind them, two weave seams
  const iF = LR(ringAt(P, run(iRing(WH), front), WH));
  const oT = LR(ringAt(P, run(oRing(WH), front), WH));
  const oB = LR(ringAt(P, run(oRing(0), front), 0));
  for (const [d, cls] of [
    [poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), "fo"],
    [open(oT), "nf lo"],
    [open(iF), "nf"],
    [open([oT[0], ...oB, oT[oT.length - 1]]), "nf sil"],
    [open(ringAt(P, run(oRing(WH * 0.36), front), WH * 0.36)), "nf lo"],
    [open(ringAt(P, run(oRing(WH * 0.7), front), WH * 0.7)), "nf lo"],
  ]) mk("path", { d, class: cls }, g);

  const added = () => stacks.reduce((a, s, i) => a + s.cnt - REST[i], 0);
  let over = null, fall = null;

  /** The next drop goes to the unfull stack whose rest centre x is nearest the pointer. */
  function spawn(now) {
    let bi = -1, bd = 1e9;
    stacks.forEach((s, i) => {
      if (s.cnt < cap) { const d = Math.abs(restC[i][0] - over); if (d < bd) { bd = d; bi = i; } }
    });
    if (bi < 0) return;
    const s = stacks[bi];
    coinAt(s.x0, DROP).forEach((d, k) => fpart[k].setAttribute("d", d));
    fall = { i: bi, z0: s.cnt * T, tf: tween(0, FALL) };
    tset(fall.tf, 1, now, 0);
    fgrp.setAttribute("transform", "");
  }

  /** The coin joins its stack, which sinks and springs back up from the weight. */
  function land(now) {
    const f = fall;
    fall = null;
    fpart.forEach((el) => el.setAttribute("d", ""));
    fgrp.setAttribute("transform", "");
    if (over != null) {
      const s = stacks[f.i];
      if (s.cnt < cap) { s.cnt++; s.sp.t = s.cnt; read.textContent = `in ${added()}`; }
    }
  }

  const B = register(stage, (dt, now) => {
    let moving = false;
    if (fall) {
      const dz = tval(fall.tf, now) * (fall.z0 - DROP);
      fgrp.setAttribute("transform", `translate(${r2(dz * vZ[0])} ${r2(dz * vZ[1])})`);
      moving = true;
      if (tdone(fall.tf, now)) land(now);
    }
    for (const s of stacks) if (stepS(s.sp, dt)) moving = true;
    if (over != null && !fall && stacks.some((s) => s.cnt < cap)) { spawn(now); moving = true; }
    for (const s of stacks) if (s.sp.x !== s.drawn) draw(s);
    return moving;
  });
  bag.add(B.unregister);

  function retarget() {
    if (over == null) stacks.forEach((s, i) => { s.cnt = REST[i]; s.sp.t = s.cnt; });
    dot.classList.toggle("off", over != null);
    read.textContent = over == null ? "rest" : `in ${added()}`;
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => {
      const w = unproj(C, p[0], p[1], WH);
      over = Math.abs(w[0]) <= X1 - WT && Math.abs(w[1]) <= Y1 - WT ? p[0] : null;
      retarget();
    },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => {
      cap = v;
      stacks.forEach((s) => { if (s.cnt > cap) { s.cnt = cap; s.sp.t = cap; } });
      if (over != null) read.textContent = `in ${added()}`;
      B.wake();
    },
    destroy: bag.dispose,
  };
}

hairline({
  name: "basket",
  means: "Coins rain into a basket; the slider caps how high a stack may grow.",
  rules: [1, 3, 5, 7],
  range: [3, 4, 5],
  tour: [[200, 128], [132, 150], [268, 150], [200, 176], null],
  mount,
});
