/**
 * Multicoin: five coins lying in a row. The coin under the pointer bounces
 * up and a wave runs out along the row, each neighbour a beat behind and
 * lower; the middle coin's dot holds rest's bright and gives it up to the
 * pick. The hit test is the coins' rest centres, which never move. The
 * slider is how high a coin may bounce.
 *
 * The pattern: discrete items moved as pure translations. A parallel
 * projection turns a world lift into one screen vector, so every path is
 * drawn once at the rest pose and the animation is only a transform.
 */
const {
  Cam, fit, poly, proj, rad, r2,
  tdone, tset, tval, tween, disposer, mk, place, pointer, register,
} = HL;

const N = 5, R = 15, G = 34, LIFT = 14, STAG = 40, HIT = 60 * 60;
const RELIEF = [6, 40, 3, 4, 16];
const X0 = -R - 2, X1 = R + 2, Y0 = -(2 * G + R) - 2, Y1 = 2 * G + R + 2;

/** A ring of n points at radius rr, turned by off degrees. */
const ring = (n, rr, off = 0) => Array.from({ length: n }, (_, k) => {
  const a = rad(off + 360 * k / n);
  return [rr * Math.cos(a), rr * Math.sin(a)];
});
/** The relief on each coin: hexagon, round, triangle, square, rosette (16 points). */
const relief = (n, rr) => n === 16
  ? Array.from({ length: 16 }, (_, k) => { const a = rad(22.5 * k), r = k % 2 ? rr * 0.45 : rr; return [r * Math.cos(a), r * Math.sin(a)]; })
  : ring(n, rr, n === 3 ? -90 : n === 4 ? 45 : 0);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let lift = value;

  const C = Cam(45, 0.5, 2.4);
  fit(C, [[X0, Y0, 0], [X1, Y1, 0], [X1, Y0, 0], [X0, Y1, 0],
    [X0, Y0, LIFT], [X1, Y1, LIFT]], 200, 166);
  const P = proj(C);
  const g = mk("g", {}, svg);

  const face48 = ring(48, R), crease = ring(48, R - 1.8), coins = [];
  for (let i = 0; i < N; i++) {
    const y0 = (i - 2) * G;
    const at = ([u, v]) => P(u, y0 + v, 0.06);
    const grp = mk("g", {}, g);
    const fin = mk("path", { d: poly(face48.map(at)), class: "sil" }, grp);
    mk("path", { d: poly(crease.map(at)), class: "nf lo" }, grp);
    mk("path", { d: poly(relief(RELIEF[i], 7.5).map(at)), class: "nf lo" }, grp);
    const dot = i === 2 ? mk("circle", { r: 2.2, class: "dot m" }, grp) : null;
    if (dot) place(dot, P(0, y0, 0.1));
    coins.push({ g: grp, fin, dot, zf: tween(0), last: "" });
  }

  // One screen vector per world axis: a lift is a pure translate.
  const o = P(0, 0, 0), eZ = P(0, 0, 1);
  const vZ = [eZ[0] - o[0], eZ[1] - o[1]];
  const restC = coins.map((_, i) => P(0, (i - 2) * G, 0));

  const B = register(stage, (_dt, now) => {
    let moving = false;
    coins.forEach((c) => {
      const dz = tval(c.zf, now);
      if (!tdone(c.zf, now)) moving = true;
      const key = `${r2(dz * vZ[0])} ${r2(dz * vZ[1])}`;
      if (c.last !== key) { c.last = key; c.g.setAttribute("transform", `translate(${key})`); }
    });
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;
  /** The coin whose rest centre is nearest and within reach — the centres never move, so the choice never flickers. */
  function hit(p) {
    let a = -1, bd = HIT;
    restC.forEach(([x, y], i) => { const d = (x - p[0]) ** 2 + (y - p[1]) ** 2; if (d < bd) { bd = d; a = i; } });
    return a;
  }

  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    coins.forEach((c, i) => {
      const d = Math.abs(i - (a >= 0 ? a : from));
      const h = a < 0 ? 0 : i === a ? lift : Math.max(0, lift * (0.55 - 0.24 * d));
      tset(c.zf, h, now, d * STAG);
      c.fin.classList.toggle("hi", i === a);
      if (c.dot) { c.dot.classList.toggle("m", a < 0); c.dot.classList.toggle("off", a >= 0); }
    });
    read.textContent = a < 0 ? "rest" : String(a + 1).padStart(2, "0");
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => {
      lift = v;
      if (act >= 0) {
        const now = performance.now();
        coins.forEach((c, i) => {
          const d = Math.abs(i - act);
          tset(c.zf, i === act ? lift : Math.max(0, lift * (0.55 - 0.24 * d)), now, 0);
        });
        B.wake();
      }
    },
    destroy: bag.dispose,
  };
}

hairline({
  name: "multicoin",
  means: "Five coins in a row: the pick bounces up and a wave runs out along its neighbours.",
  rules: [1, 2, 5, 9],
  range: [8, 14, 20],
  tour: [[315, 123], [200, 181], [85, 238], null],
  mount,
});
