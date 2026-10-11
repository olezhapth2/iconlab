/**
 * Candles: eleven candles on a rounded slab. Their rest heights make a skyline
 * with two rises. The pointer is projected onto the ground, and every candle
 * near it grows on its own spring, falling off with distance and clamped at the
 * top; a dot rides the lid of the candle under the pointer, or the tallest at
 * rest, and that candle takes the bright stroke. The slider is the radius, in
 * candles.
 *
 * The pattern: a continuous field. Springs, a falloff by distance, a hit test
 * on the ground plane (which never moves), and a rest that is a composition.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj, spring, stepS, seg,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const N = 11, CELL = 17, FOOT = 13, HMAX = 56, WICK = 9, PB = 5, BASE = 2;
const EXT = (N - 1) * CELL;

/** The share of full lift at u radii from the pointer: 1 → .31 at 42% → .09 beyond. */
const falloff = (u) =>
  u <= 0 ? 1 : u <= 0.417 ? 1 - (u / 0.417) * 0.6875 : u <= 1 ? 0.3125 - ((u - 0.417) / 0.583) * 0.2185 : 0.094;

/** Rest height: a skyline of two humps with a small unevenness, never flat. */
const rest = (i) => {
  const u = i / (N - 1);
  return clamp(13 + 24 * Math.exp(-((u - 0.26) ** 2) / 0.04) + 15 * Math.exp(-((u - 0.74) ** 2) / 0.028) + 4 * Math.sin(i * 1.9), 9, 46);
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.64);
  fit(C, [[-8, -11, -PB], [EXT + 8, 11, -PB], [EXT + 8, -11, -PB], [-8, 11, -PB], [EXT / 2, 0, HMAX + WICK], [0, 0, HMAX + WICK]], 200, 166);
  const P = proj(C), front = facing(C);
  let R = value * CELL, over = null;

  const g = mk("g", {}, svg), cols = [];
  const [pr, pi] = rings(-8, -11, EXT + 8, 11, 8, 2.2);
  put(solid(g), prism(P, front, pr, pi, -PB, 0));
  // Left to right: with equal y, the smaller x is farther, so appending paints back to front.
  for (let i = 0; i < N; i++) {
    const h0 = rest(i), x0 = i * CELL - FOOT / 2;
    const [ring, inner] = rings(x0, -FOOT / 2, x0 + FOOT, FOOT / 2, 4.4, 1.4);
    const el = solid(g);
    const wLo = mk("path", { class: "sil" }, el.g), wHi = mk("path", { class: "sil" }, el.g);
    cols.push({ i, cx: i * CELL, h0, ring, inner, sp: spring(h0, { eps: 0.04 }), el, wLo, wHi, drawn: NaN });
  }

  // The mark: one dot riding the lid of the candle in play, moved in the paint
  // order to just after it, so the candles in front still cover it.
  const mark = mk("g", {}, g), dot = flatDot(mark, C, 0.9, "dot");
  const peak = cols.reduce((a, b) => (b.h0 > a.h0 ? b : a));
  let act = null;

  /** A candle whose spring hasn't moved keeps its paths; the wicks move with it. */
  function drawCol(c) {
    const h = clamp(c.sp.x, 6, HMAX);
    if (h === c.drawn) return;
    c.drawn = h;
    put(c.el, prism(P, front, c.ring, c.inner, BASE, h));
    c.wLo.setAttribute("d", seg(P(c.cx, 0, 0), P(c.cx, 0, BASE)));
    c.wHi.setAttribute("d", seg(P(c.cx, 0, h), P(c.cx, 0, h + WICK)));
  }

  function setActive(a) {
    const changed = a !== act;
    act = a;
    cols.forEach((c) => {
      const on = c === act;
      c.el.sil.classList.toggle("hi", on);
      c.wLo.classList.toggle("hi", on);
      c.wHi.classList.toggle("hi", on);
    });
    if (changed) act.el.g.after(mark);
    place(dot, P(act.cx, 0, clamp(act.sp.x, 6, HMAX)));
  }
  setActive(peak);

  const B = register(stage, (dt) => {
    let m = false;
    for (const c of cols) { if (stepS(c.sp, dt)) m = true; drawCol(c); }
    place(dot, P(act.cx, 0, clamp(act.sp.x, 6, HMAX)));
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    for (const c of cols) {
      c.sp.t = over ? clamp(c.h0 + 30 * falloff(Math.abs(c.cx - over[0]) / R), 6, HMAX) : c.h0;
    }
    if (over) {
      setActive(cols.reduce((a, b) => (Math.abs(b.cx - over[0]) < Math.abs(a.cx - over[0]) ? b : a)));
      read.textContent = `bar ${act.i + 1}`;
    } else { setActive(peak); read.textContent = "rest"; }
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], 0); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v * CELL; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "candles",
  means: "A skyline of candles: the ones near the pointer rise and fall off with distance.",
  rules: [1, 3, 5, 9],
  range: [1.5, 3, 5],
  tour: [[64, 158], [206, 132], [338, 166], null],
  mount,
});
