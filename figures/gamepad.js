/**
 * Gamepad: an Xbox-style pad in one solid — deck, bumpers, stick well, d-pad
 * cross, face buttons, guide. The left stick leans with the pointer's x,y
 * (rest inside its well); the d-pad and face buttons press down when the
 * pointer is near their rest centres. The slider is stick sensitivity.
 *
 * The pattern: scrub and pick. Springs for the stick, tweens for the press,
 * hit test against rest centres projected at the control's own z-level.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, ringAt, rrect, unproj, hull,
  mk, place, pointer, put, register, disposer, solid, spring, stepS,
  tdone, tset, tval, tween, open, poly, rad,
} = HL;

const W = 42, D = 26, R = 12, TH = 3.5;
const STX = -18, STY = 8, STD = 14, STR = 11, STL = 18, STW = 5;
const DPX = 6, DPY = -8, DPB = 5.2, DPL = 13;
const FACE = [[26, 12], [32, 5], [20, 5], [26, -2]], BR = 3.2;
const PRESS = 5;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let SENS = value;

  const C = Cam(45, 0.5, 2.85);
  fit(C, [
    [-W - 4, -D - 6, -2], [W + 4, D + 2, -2], [W + 4, -D - 6, -2], [-W - 4, D + 2, -2],
    [-W - 4, -D - 6, STD + STL + 2], [W + 4, D + 2, STD + STL + 2],
  ], 200, 180);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const pad = solid(g);
  const base = rings(-W, -D, W, D, R, 2.2);
  put(pad, prism(P, front, base[0], base[1], 0, TH));

  const bumpL = mk("path", { class: "sil" }, g);
  const bumpR = mk("path", { class: "sil" }, g);
  bumpL.setAttribute("d", poly(hull([
    P(-W + 2, -D - 3, TH - 0.4), P(-W + 14, -D - 3, TH - 0.4),
    P(-W + 14, -D + 1, TH - 0.4), P(-W + 2, -D + 1, TH - 0.4),
    P(-W + 2, -D - 3, TH + 1.6), P(-W + 14, -D - 3, TH + 1.6),
    P(-W + 14, -D + 1, TH + 1.6), P(-W + 2, -D + 1, TH + 1.6),
  ])));
  bumpR.setAttribute("d", poly(hull([
    P(W - 14, -D - 3, TH - 0.4), P(W - 2, -D - 3, TH - 0.4),
    P(W - 2, -D + 1, TH - 0.4), P(W - 14, -D + 1, TH - 0.4),
    P(W - 14, -D - 3, TH + 1.6), P(W - 2, -D - 3, TH + 1.6),
    P(W - 2, -D + 1, TH + 1.6), P(W - 14, -D + 1, TH + 1.6),
  ])));

  const wellR = mk("path", { class: "nf lo" }, g);
  wellR.setAttribute("d", open(ringAt(P, rings(STX - STR - 1, STY - STR - 1, STX + STR + 1, STY + STR + 1, STR + 1, 0)[0], TH)));

  const stem = mk("path", { class: "sil" }, g);
  const sface = mk("path", { class: "sil" }, g);
  const srelief = mk("path", { class: "nf lo" }, g);

  const dpadSil = mk("path", { class: "sil" }, g);
  const dpadFace = mk("path", { class: "sil" }, g);
  const dcen = mk("circle", { r: 2.4, class: "nf lo", cx: 0, cy: 0 }, g);

  const btnSil = FACE.map(() => mk("path", { class: "sil" }, g));
  const btnFace = FACE.map(() => mk("path", { class: "sil" }, g));

  const guide = mk("circle", { r: 4.2, class: "nf lo", cx: 0, cy: 0 }, g);
  place(guide, P(2, -2, TH));

  const crossPts = (cx, cy, z) => {
    const b = DPB, l = DPL;
    return [
      [cx - b, cy - l], [cx + b, cy - l], [cx + b, cy - b], [cx + l, cy - b],
      [cx + l, cy + b], [cx + b, cy + b], [cx + b, cy + l], [cx - b, cy + l],
      [cx - b, cy + b], [cx - l, cy + b], [cx - l, cy - b], [cx - b, cy - b],
    ].map(([x, y]) => P(x, y, z));
  };
  const discPts = (x, y, z, rr) => ringAt(P, rings(x - rr, y - rr, x + rr, y + rr, rr, 0)[0], z);

  function drawStick(ux, uz) {
    const tx = STX + STL * ux, ty = STY + STL * uz;
    stem.setAttribute("d", poly(hull([
      P(STX - STW, STY - STW, TH), P(STX + STW, STY - STW, TH),
      P(STX + STW, STY + STW, TH), P(STX - STW, STY + STW, TH),
      P(tx - STW, ty - STW, STD), P(tx + STW, ty - STW, STD),
      P(tx + STW, ty + STW, STD), P(tx - STW, ty + STW, STD),
    ])));
    sface.setAttribute("d", poly(discPts(tx, ty, STD, STR)));
    srelief.setAttribute("d", open(ringAt(P, rings(tx - STR + 1.8, ty - STR + 1.8, tx + STR - 1.8, ty + STR - 1.8, STR - 1.8, 0)[0], STD)));
  }
  drawStick(0, 0);

  const twD = tween(0), twF = FACE.map(() => tween(0));
  let over = "", said = "";

  function drawButtons(now) {
    const dz = TH - tval(twD, now) * PRESS;
    dpadSil.setAttribute("d", poly(hull(crossPts(DPX, DPY, dz))));
    dpadFace.setAttribute("d", poly(crossPts(DPX, DPY, dz)));
    place(dcen, P(DPX, DPY, dz));
    for (let i = 0; i < FACE.length; i++) {
      const [x, y] = FACE[i];
      const bz = TH - tval(twF[i], now) * PRESS;
      btnSil[i].setAttribute("d", poly(hull(discPts(x, y, bz, BR))));
      btnFace[i].setAttribute("d", poly(discPts(x, y, bz, BR)));
    }
  }
  drawButtons(0);

  const sX = spring(0), sZ = spring(0);
  const B = register(stage, (dt, now) => {
    let mv = stepS(sX, dt) || stepS(sZ, dt);
    drawStick(sX.x, sZ.x);
    const anyTween = !tdone(twD, now) || twF.some((t) => !tdone(t, now));
    if (anyTween || !now) drawButtons(now);
    if (anyTween) mv = true;
    if (!over) {
      const w = sZ.x < -0.3 ? "up" : sZ.x > 0.3 ? "down" : sX.x < -0.3 ? "left" : sX.x > 0.3 ? "right" : "rest";
      if (w !== said) { said = w; read.textContent = w; }
    }
    return mv;
  });
  bag.add(B.unregister);

  const restStick = P(STX, STY, TH);
  const restDpad = P(DPX, DPY, TH);
  const restFace = FACE.map(([x, y]) => P(x, y, TH));

  function aim(p) {
    let n = "";
    if (p) {
      const near = (q, r) => Math.hypot(q[0] - p[0], q[1] - p[1]) < r;
      if (near(restStick, STR + 8)) n = "stick";
      else if (near(restDpad, DPL + 4)) n = "dpad";
      else if (restFace.some((q) => near(q, BR + 4))) n = "face";
    }
    const now = performance.now();
    over = n;
    if (n === "stick") {
      const w = unproj(C, p[0], p[1], STD);
      sX.t = clamp((w[0] - STX) / (STL * 0.5), -1, 1) * SENS;
      sZ.t = clamp((w[1] - STY) / (STL * 0.5), -1, 1) * SENS;
    } else { sX.t = 0; sZ.t = 0; }
    tset(twD, n === "dpad" ? 1 : 0, now, 0);
    for (let i = 0; i < twF.length; i++) tset(twF[i], n === "face" ? 1 : 0, now, 0);
    dpadSil.classList.toggle("hi", n === "dpad");
    dpadFace.classList.toggle("hi", n === "dpad");
    for (let i = 0; i < btnSil.length; i++) {
      btnSil[i].classList.toggle("hi", n === "face");
      btnFace[i].classList.toggle("hi", n === "face");
    }
    sface.classList.toggle("hi", n === "stick");
    if (n !== said) { said = n || "rest"; read.textContent = said; }
    B.wake();
  }
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { SENS = v; B.wake(); }, destroy: bag.dispose };
}

hairline({
  name: "gamepad",
  means: "An Xbox-style pad: the left stick leans with the pointer, the d-pad cross and face buttons press down.",
  rules: [1, 3, 4, 5, 8],
  range: [0.35, 0.62, 0.95],
  tour: [[224, 211], [144, 191], [224, 251], [204, 213], null],
  mount,
});
