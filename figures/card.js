/**
 * Card: a payment card taken apart into four layers — core, stripe, chip,
 * print — fanned slightly so each reads. The pointer's x pulls the layers
 * apart on one spring; its y picks the nearest layer in the rest pose, which
 * takes the bright stroke and lifts a little, staggered outwards from the
 * choice on the 700ms curve. The read-out names the layer. The slider is the
 * gap.
 *
 * The pattern: scrub and pick. A spring for the gap, tweens for the choice, a
 * hit test against the rest centres (never the pose on screen), and a rest
 * that is already a composition.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj, spring, stepS, rad, open, poly, rrect,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const W = 60, D = 40, GMIN = 1.5, HOP = 5, REST_A = 2, R = 6;
const LAY = [
  { n: "core", th: 3, off: 0 },
  { n: "stripe", th: 1.6, off: 3.5 },
  { n: "chip", th: 1.6, off: 7 },
  { n: "print", th: 1.6, off: 10.5 },
];
const N = LAY.length;

/** Height of layer k with the given gap. */
const zAt = (k, gap) => { let z = 0; for (let i = 0; i < k; i++) z += LAY[i].th + gap; return z; };

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let GMAX = value;

  const C = Cam(45, 0.5, 3);
  fit(C, [[-31, -21, -3], [31, 31, -3], [31, -21, -3], [-31, 31, -3], [-31, -21, 70], [31, 31, 70]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const restGap = () => GMIN + 0.35 * (GMAX - GMIN);
  const ringsOf = LAY.map((l) => rings(-W / 2, l.off - D / 2, W / 2, l.off + D / 2, R, 1.4));
  const sols = [], feats = [], drawn = LAY.map(() => NaN);
  for (let k = 0; k < N; k++) {
    const s = solid(g);
    sols.push(s);
    feats.push(mk("path", { class: "nf lo" }, s.g));
    s.sil.classList.toggle("hi", k === REST_A);
  }
  let restC = LAY.map((l, k) => P(0, l.off, zAt(k, restGap())));

  const gap = spring(restGap()), lifts = LAY.map(() => tween(0));

  function draw(k, gp, lift) {
    const l = LAY[k], z = zAt(k, gp) + lift, z1 = z + l.th;
    if (z === drawn[k]) return;
    drawn[k] = z;
    put(sols[k], prism(P, front, ringsOf[k][0], ringsOf[k][1], z, z1));
    const f = feats[k], at = (u, v) => P(u, v, z1);
    if (l.n === "stripe") f.setAttribute("d", poly(rrect(-26, l.off - 11, 26, l.off - 3, 1.6, 4).map((p) => at(p.u, p.v))));
    else if (l.n === "chip") f.setAttribute("d", poly(rrect(-21, l.off - 8, -7, l.off + 8, 2.4, 5).map((p) => at(p.u, p.v))));
    else if (l.n === "print") f.setAttribute("d", [6.5, 11].map((r) =>
      open(Array.from({ length: 9 }, (_, i) => at(8 + r * Math.cos(rad(-55 + i * 13.75)), l.off + r * Math.sin(rad(-55 + i * 13.75)))))).join(""));
  }

  const B = register(stage, (dt, now) => {
    let m = stepS(gap, dt);
    LAY.forEach((l, k) => {
      draw(k, gap.x, tval(lifts[k], now));
      if (!tdone(lifts[k], now)) m = true;
    });
    return m;
  });
  bag.add(B.unregister);

  let over = null;
  /** The layer whose rest centre is nearest the pointer — rest pose, never the pose on screen. */
  const hit = (p) => restC.reduce((a, b, k) => (Math.hypot(b[0] - p[0], b[1] - p[1]) < Math.hypot(restC[a][0] - p[0], restC[a][1] - p[1]) ? k : a), 0);

  function retarget() {
    const w = over ? unproj(C, over[0], over[1], 0) : null;
    gap.t = w ? GMIN + clamp((w[0] + W / 2) / W, 0, 1) * (GMAX - GMIN) : restGap();
    const a = over ? hit(over) : REST_A, now = performance.now();
    LAY.forEach((l, k) => {
      tset(lifts[k], over && k === a ? HOP : 0, now, Math.abs(k - a) * 40);
      sols[k].sil.classList.toggle("hi", k === a);
    });
    read.textContent = over ? LAY[a].n : "rest";
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => { over = p; retarget(); }, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { GMAX = v; restC = LAY.map((l, k) => P(0, l.off, zAt(k, restGap()))); retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "card",
  means: "A card in four layers: the pointer pulls them apart and picks one.",
  rules: [1, 2, 3, 8],
  range: [6, 12, 18],
  tour: [[148, 156], [252, 138], [200, 214], null],
  mount,
});
