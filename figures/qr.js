/**
 * Qr: a code plate lying flat. The pointer's module sends a wave through the
 * code — tiles rise under it and their classes brighten as it passes, on one
 * spring that fades the whole field when the pointer leaves. The centre
 * module holds rest's bright and gives it up to the pointer. The slider is
 * the wave's radius.
 *
 * The pattern: a field of small parts. The hit test is the ground plane,
 * which never moves; a dot is rewritten only when its height or its level
 * actually changes, and the loop sleeps the moment the wave has settled.
 */
const {
  Cam, facing, fit, flatDot, poly, prism, proj, r2, rrect, rings, seg, unproj, spring, stepS,
  mk, place, pointer, put, register, disposer, solid,
} = HL;

const M = 15, HALF = 25.5, CELL = 51 / 15, Z = 2, DR = 1.05, LMAX = 14;
const finders = (i, j) => (i < 7 && j < 7) || (i > 7 && j < 7) || (i < 7 && j > 7);
/** The printed pattern: timing rows alternate, the rest is a fixed scatter. */
const bit = (i, j) => (i === 6 || j === 6) ? (i + j) % 2 === 0 : (i * 7 + j * 11 + (i * j) % 7) % 2 === 0;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let RAD = value;

  const C = Cam(45, 0.5, 3.2);
  fit(C, [[-30, -30, 0], [30, 30, 0], [30, -30, 0], [-30, 30, 0], [-30, -30, Z], [30, 30, Z]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const plate = solid(g);
  put(plate, prism(P, front, ...rings(-30, -30, 30, 30, 6, 2), 0, Z));

  // The three finders, as an outer ring and its core.
  const finder = (x0, y0) => {
    mk("path", { d: poly(rrect(x0, y0, x0 + 7 * CELL, y0 + 7 * CELL, 1.4, 4).map((q) => P(q.u, q.v, Z))), class: "nf" }, g);
    mk("path", { d: poly(rrect(x0 + 2 * CELL, y0 + 2 * CELL, x0 + 5 * CELL, y0 + 5 * CELL, 1.1, 4).map((q) => P(q.u, q.v, Z))), class: "nf lo" }, g);
  };
  finder(-HALF, -HALF);
  finder(HALF - 7 * CELL, -HALF);
  finder(-HALF, HALF - 7 * CELL);

  // The data modules: one dot each, placed once; only its class and its
  // height change, and the dim column under a raised tile shows how far.
  const cols = mk("g", {}, g), dots = [];
  for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
    if (finders(i, j) || (i === 7 && j === 7)) continue;
    const on = bit(i, j), cls = on ? "dot m" : "dot off";
    const el = flatDot(g, C, DR, cls);
    const wx = -HALF + (i + 0.5) * CELL, wy = -HALF + (j + 0.5) * CELL;
    place(el, P(wx, wy, Z));
    dots.push({ el, col: mk("path", { class: "nf lo" }, cols), wx, wy, on, cls, z: 0 });
  }
  const mark = flatDot(g, C, 1.6, "dot");
  place(mark, P(0, 0, Z));

  // The wave: one spring fades the whole field; the shape is frozen where the
  // pointer was, so leaving eases the tiles back down instead of dropping them.
  let over = null, pw = null, label = "", phase = 0;
  const E = spring(0);
  const B = register(stage, (dt) => {
    let moving = stepS(E, dt) || !!pw && E.x > 0.01;
    if (pw) phase += dt * 7;
    for (const d of dots) {
      let fall = 0, w = 0;
      if (pw && E.x > 0.01) {
        const dist = Math.hypot(d.wx - pw[0], d.wy - pw[1]);
        if (dist < RAD) { fall = E.x * (1 - dist / RAD); w = Math.sin(phase - dist * 0.5); }
      }
      const z = r2(fall * (0.85 + 0.15 * w) * LMAX);
      if (z !== d.z) {
        d.z = z;
        place(d.el, P(d.wx, d.wy, Z + z));
        d.col.setAttribute("d", z > 0.6 ? seg(P(d.wx, d.wy, Z), P(d.wx, d.wy, Z + z)) : "");
        moving = true;
      }
      const q = fall * (0.55 + 0.45 * w);
      const lvl = q > 0.66 ? 2 : q > 0.33 ? 1 : 0;
      const next = lvl === 0 ? (d.on ? "dot m" : "dot off") : lvl === 1 ? (d.on ? "dot" : "dot m") : "dot";
      if (next !== d.cls) { d.cls = next; d.el.setAttribute("class", next); moving = true; }
    }
    return moving;
  });
  bag.add(B.unregister);

  function retarget() {
    if (over) { pw = over; E.t = 1; } else if (pw) E.t = 0;
    mark.classList.toggle("dot", !over);
    mark.classList.toggle("off", !!over);
    read.textContent = over ? label : "rest";
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => {
      const w = unproj(C, p[0], p[1], Z);
      const i = Math.floor((w[0] + HALF) / CELL), j = Math.floor((w[1] + HALF) / CELL);
      over = i >= 0 && i < M && j >= 0 && j < M ? w : null;
      label = over ? `${i}·${j}` : "";
      retarget();
    },
    leave: () => { over = null; label = ""; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { RAD = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "qr",
  means: "A QR plate shimmers under the pointer; the slider sets the shimmer's radius.",
  rules: [1, 3, 5, 7],
  range: [14, 24, 34],
  tour: [[269, 159], [200, 163], [138, 163], [154, 186], null],
  mount,
});
