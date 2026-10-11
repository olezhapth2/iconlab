/**
 * Slip: a payment terminal feeding a receipt out of its slot. The pointer's y
 * scrubs how far the paper has come: it leaves the mouth, droops over the edge
 * and lies on the desk, its printed rows appearing as it lengthens. Leaving
 * lets it spring back to the rest length, where the print button on the top
 * face holds the bright mark; while the pointer pulls, the sheet takes the
 * bright stroke and the button dims. The slider is the longest receipt.
 *
 * The pattern: one continuous number. A spring on a clamped scrub read off the
 * ground plane, a sheet rewritten only while its length moves, and a rest
 * that is already a receipt half out of the machine.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, rrect, seg, unproj, spring, stepS,
  mk, place, pointer, put, register, disposer, solid, poly,
} = HL;

const BW = 26, BD = 16, BH = 24, BR = 5;
const SW = 17, SL = 14.5, SHT = 17.5, SH = 16;
const PW = 12, SAG = 13, FLAT = 0.4, LMIN = 7, FITL = 66;
const ROWS = [3.5, 7, 10.5, 15, 20, 26, 32, 38, 44, 50, 56, 62];

/** Paper height at distance u from the mouth: out horizontal, then a droop, then flat. */
const zAt = (u) => (u >= SAG ? FLAT : Math.max(FLAT, SH * (0.5 + 0.5 * Math.cos(Math.PI * u / SAG))));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let LMAX = value;

  const C = Cam(45, 0.5, 3.3);
  fit(C, [[-BW, -BD, 0], [BW, BD, 0], [BW, -BD, 0], [-BW, BD, 0], [-BW, BD, BH],
    [BW, -BD, BH], [BW, BD, BH], [-PW, BD, SH], [PW, BD, SH],
    [-PW, BD + FITL, FLAT], [PW, BD + FITL, FLAT]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const box = solid(g);
  put(box, prism(P, front, ...rings(-BW, -BD, BW, BD, BR, 1.6), 0, BH));

  // The top face: a display and six keys, every inner line dim.
  const at = (u, v) => P(u, v, BH + 0.06);
  mk("path", { d: poly(rrect(-17, -11, 17, 1, 2.4, 4).map((p) => at(p.u, p.v))), class: "nf lo" }, g);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x0 = -13 + c * 9, y0 = 5 + r * 5;
    mk("path", { d: poly(rrect(x0, y0, x0 + 6, y0 + 3.2, 1, 3).map((p) => at(p.u, p.v))), class: "nf lo" }, g);
  }

  // The slot mouth on the near face, and the print button that holds rest's bright.
  mk("path", { d: seg(P(-SW, BD + 0.05, SL), P(SW, BD + 0.05, SL)), class: "nf lo" }, g);
  mk("path", { d: seg(P(-SW, BD + 0.05, SHT), P(SW, BD + 0.05, SHT)), class: "nf lo" }, g);
  const dot = mk("circle", { r: 3, class: "dot" }, g);
  place(dot, P(0, 9, BH + 0.1));

  const sheet = mk("path", {}, g);
  const rows = mk("path", { class: "nf lo" }, g);

  const restL = () => LMIN + 0.25 * (LMAX - LMIN);
  const sp = spring(restL());
  let drawn = NaN;

  /** The sheet as one closed polygon: down one edge of the paper, back the other. */
  const sheetPath = (L) => {
    const n = 16, pts = [];
    for (let i = 0; i <= n; i++) { const u = L * i / n; pts.push(P(-PW, BD + u, zAt(u))); }
    for (let i = n; i >= 0; i--) { const u = L * i / n; pts.push(P(PW, BD + u, zAt(u))); }
    return poly(pts);
  };
  /** Printed rows, ragged like text, only where paper already is. */
  const rowsPath = (L) => ROWS.filter((u) => u < L - 2.5).map((u, i) =>
    seg(P(-PW + 2.5, BD + u, zAt(u)), P(PW - (i % 2 ? 7 : 3.5), BD + u, zAt(u)))).join("");

  const R = register(stage, (dt) => {
    const m = stepS(sp, dt);
    if (sp.x !== drawn) {
      drawn = sp.x;
      sheet.setAttribute("d", sheetPath(sp.x));
      rows.setAttribute("d", rowsPath(sp.x));
    }
    return m;
  });
  bag.add(R.unregister);

  let over = null;
  function retarget() {
    const w = over ? unproj(C, over[0], over[1], 0) : null;
    sp.t = w ? LMIN + clamp((w[1] - 8) / 42, 0, 1) * (LMAX - LMIN) : restL();
    sheet.classList.toggle("hi", !!over);
    dot.classList.toggle("off", !!over);
    read.textContent = over ? `out ${Math.round(sp.t)}` : "rest";
    R.wake();
  }

  bag.add(pointer(stage, { move: (p) => { over = p; retarget(); }, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { LMAX = v; retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "slip",
  means: "A receipt feeds from a terminal; the pointer's y scrubs its length.",
  rules: [1, 3, 4, 5],
  range: [34, 50, 66],
  tour: [[241, 111], [224, 144], [177, 211], [74, 259], null],
  mount,
});
