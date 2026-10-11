/**
 * Swap: a rounded tray with two lanes. A stack of coins sits in each, at
 * opposite ends. The pointer runs the exchange: its x slides the far stack
 * along its lane while the near stack travels the other way, on one spring, so
 * the two always trade ends. The stack whose lane the pointer is in takes the
 * bright edge on its top coin, or the far one at rest. The slider is the
 * travel, in world units.
 *
 * The pattern: one continuous number. A spring on a clamped scrub, a hit test
 * on the ground plane (which never moves), and two stacks whose paint order
 * never changes because the overlap always hides the far lane.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj, spring, stepS, open, r2,
  mk, pointer, put, register, disposer, solid,
} = HL;

const SX = 70, SY = 23, PB = 6, LANE = 9, LANE_X = 58, COIN = 4, NC = 4, RAD = 5.5;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let T = value;

  const C = Cam(45, 0.5, 2);
  fit(C, [[-SX, -SY, -PB], [SX, SY, -PB], [SX, -SY, -PB], [-SX, SY, -PB], [-SX, -SY, NC * COIN], [SX, SY, NC * COIN], [0, 0, NC * COIN]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const [pr, pi] = rings(-SX, -SY, SX, SY, 11, 2.4);
  put(solid(g), prism(P, front, pr, pi, -PB, 0));
  // Two grooves cut in the tray's top: where the lanes are. Plain seams, not guides.
  mk("path", { d: open([P(-LANE_X, -LANE, 0.05), P(LANE_X, -LANE, 0.05)]), class: "nf lo" }, g);
  mk("path", { d: open([P(-LANE_X, LANE, 0.05), P(LANE_X, LANE, 0.05)]), class: "nf lo" }, g);

  // Each stack is built once at x 0 and slid along the lane by a screen-space
  // translate: parallel projection, so world +x is one screen vector.
  const o = P(0, 0, 0), v = P(1, 0, 0), dx = v[0] - o[0], dy = v[1] - o[1];
  const mkStack = (y) => {
    const grp = mk("g", {}, g), coins = [];
    for (let k = 0; k < NC; k++) {
      const [ring, inner] = rings(-RAD, y - RAD, RAD, y + RAD, RAD, 1.1);
      const s = solid(grp);
      put(s, prism(P, front, ring, inner, k * COIN, (k + 1) * COIN));
      coins.push(s);
    }
    return { grp, top: coins[NC - 1], x: NaN };
  };
  const far = mkStack(-LANE), near = mkStack(LANE);

  const sp = spring(0);
  const slide = (st, x) => { if (st.x === x) return; st.x = x; st.grp.setAttribute("transform", `translate(${r2(dx * x)} ${r2(dy * x)})`); };
  const place = () => { slide(far, -T / 2 + sp.x * T); slide(near, T / 2 - sp.x * T); };
  place();

  const R = register(stage, (dt) => { const m = stepS(sp, dt); place(); return m; });
  bag.add(R.unregister);

  let over = null, side = -1;
  far.top.sil.classList.add("hi");
  function retarget() {
    sp.t = over ? clamp((over[0] + T / 2) / T, 0, 1) : 0;
    const s = over ? (over[1] < 0 ? 0 : 1) : 0;
    if (s !== side) {
      side = s;
      far.top.sil.classList.toggle("hi", s === 0);
      near.top.sil.classList.toggle("hi", s === 1);
    }
    read.textContent = over ? (s === 0 ? "stack a" : "stack b") : "rest";
    R.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], 0); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { T = v; place(); if (over) sp.t = clamp((over[0] + T / 2) / T, 0, 1); R.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "swap",
  means: "Two coin stacks trade ends along their lanes; the pointer runs the exchange.",
  rules: [1, 3, 5, 8],
  range: [40, 75, 110],
  tour: [[104, 148], [300, 186], [204, 132], null],
  mount,
});
