/**
 * Ox sphere: O and X as two standing solids on a shared sphere, turning
 * together about the same vertical axis. The O is a ring with a hole; the X
 * is two crossed bars. Both turn through almost a full revolution — the
 * spring sweeps -PI*0.92..PI*0.92 — so the mark reads from the side, the
 * back, and the front. The pointer's x scrubs the turn; leave eases back to
 * the rest angle. The slider is how far they may turn. The hit test is each
 * letter's rest silhouette projected to screen. The letters never overlap:
 * they sit on opposite sides of the sphere and turn in lockstep, so the
 * silhouette stays clean at every angle.
 *
 * The pattern: one continuous number. A spring on the turn; both letters
 * rewritten only while the angle moves; rest already a slight turn with one
 * bright mark on the O's crown.
 */
const {
  Cam, clamp, fit, hull, poly, proj, rad, rrect, spring, stepS,
  disposer, mk, place, pointer, register,
} = HL;

const TAU = Math.PI * 2, NS = 48;
const RO = 14, RI = 7, T = 5;
const OX0 = -17, XX0 = 17, OZ = RO;
const BARL = 2 * RO + 4, BARW = 4.4, BANG = rad(47);
const XL = 24, XW = 7, XANG = rad(40);
const REST_PH = rad(-32);
const SWEEP = rad(value => value);

const circleXZ = (cx, cz, r, y) => Array.from({ length: NS }, (_, k) => {
  const a = k / NS * TAU;
  return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
});
const barXZ = (cx, cz, ang, len, wid, y) => {
  const d = rrect(-len / 2, -wid / 2, len / 2, wid / 2, wid / 2, 4);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return d.map((p) => [cx + p.u * ca - p.v * sa, y, cz + p.u * sa + p.v * ca]);
};
const rotY = (p, cx, a) => {
  const s = Math.sin(a), c = Math.cos(a), dx = p[0] - cx, dz = p[2] - OZ;
  return [cx + dx * c + dz * s, p[1], OZ + dz * c - dx * s];
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let AMP = rad(value);

  const C = Cam(45, 0.5, 4.6);
  const fp = [];
  for (const a of [-rad(80), 0, rad(80)]) {
    fp.push(...circleXZ(OX0, OZ, RO + 2, T).map((p) => rotY(p, OX0, a)),
      ...barXZ(XX0, OZ, XANG, XL, XW, T).map((p) => rotY(p, XX0, a)),
      ...barXZ(XX0, OZ, -XANG, XL, XW, T).map((p) => rotY(p, XX0, a)));
  }
  fit(C, fp.concat([[-36, -T, 0], [36, T, 0], [-36, -T, 2 * RO], [36, T, 2 * RO]]), 200, 160);
  const P = proj(C);
  const g = mk("g", {}, svg);

  const oSil = mk("path", { class: "sil" }, g);
  const oFace = mk("path", { class: "sil" }, g);
  const oHole = mk("path", { class: "nf lo" }, g);
  const stSil = mk("path", { class: "sil" }, g);
  const stFace = mk("path", { class: "sil" }, g);
  const x1Sil = mk("path", { class: "sil" }, g);
  const x1Face = mk("path", { class: "sil" }, g);
  const x2Sil = mk("path", { class: "sil" }, g);
  const x2Face = mk("path", { class: "sil" }, g);
  const mark = mk("circle", { r: 2.3, class: "dot", cx: 0, cy: 0 }, g);

  const projRing = (pts, a, cx) => pts.map((p) => P(...rotY(p, cx, a)));
  const slab = (sil, face, pts0, pts1) => {
    sil.setAttribute("d", poly(hull(pts0.concat(pts1))));
    face.setAttribute("d", poly(pts0));
  };

  const restPose = (a) => {
    const oF = projRing(circleXZ(OX0, OZ, RO, T / 2), a, OX0);
    const oB = projRing(circleXZ(OX0, OZ, RO, -T / 2), a, OX0);
    const b1 = projRing(barXZ(XX0, OZ, XANG, XL, XW, T / 2), a, XX0);
    const b1b = projRing(barXZ(XX0, OZ, XANG, XL, XW, -T / 2), a, XX0);
    const b2 = projRing(barXZ(XX0, OZ, -XANG, XL, XW, T / 2), a, XX0);
    const b2b = projRing(barXZ(XX0, OZ, -XANG, XL, XW, -T / 2), a, XX0);
    return { o: hull(oF.concat(oB)), x1: hull(b1.concat(b1b)), x2: hull(b2.concat(b2b)) };
  };
  const hit = restPose(REST_PH);

  const sp = spring(REST_PH);
  let drawn = NaN;
  function draw(a) {
    const key = Math.round(a * 400);
    if (key === drawn) return;
    drawn = key;
    slab(oSil, oFace, projRing(circleXZ(OX0, OZ, RO, T / 2), a, OX0),
      projRing(circleXZ(OX0, OZ, RO, -T / 2), a, OX0));
    oHole.setAttribute("d", poly(projRing(circleXZ(OX0, OZ, RI, T / 2 + 0.02), a, OX0)));
    slab(stSil, stFace, projRing(barXZ(OX0, OZ, BANG, BARL, BARW, T * 0.62), a, OX0),
      projRing(barXZ(OX0, OZ, BANG, BARL, BARW, -T * 0.62), a, OX0));
    slab(x1Sil, x1Face, projRing(barXZ(XX0, OZ, XANG, XL, XW, T / 2), a, XX0),
      projRing(barXZ(XX0, OZ, XANG, XL, XW, -T / 2), a, XX0));
    slab(x2Sil, x2Face, projRing(barXZ(XX0, OZ, -XANG, XL, XW, T / 2), a, XX0),
      projRing(barXZ(XX0, OZ, -XANG, XL, XW, -T / 2), a, XX0));
    place(mark, P(...rotY([OX0, T * 0.62 + 0.4, OZ], OX0, a)));
  }

  const B = register(stage, (dt) => {
    const m = stepS(sp, dt);
    draw(sp.x);
    return m;
  });
  bag.add(B.unregister);

  let over = null;
  function retarget() {
    if (over) {
      const ang = rad(-AMP * 2 + 0.5 * AMP * 4);
      sp.t = over === "o" ? ang * 0.55 : ang;
    } else sp.t = REST_PH;
    for (const [els, on] of [[[oSil, oFace, stSil, stFace], over === "o"], [[x1Sil, x1Face, x2Sil, x2Face], over === "x"]])
      for (const el of els) el.classList.toggle("hi", on);
    mark.classList.toggle("off", !!over);
    mark.classList.toggle("dot", !over);
    read.textContent = over ? over : "rest";
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => {
      let best = null, bestD = Infinity;
      const check = (poly, name) => {
        for (const q of poly) {
          const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
          if (d < bestD) { bestD = d; best = name; }
        }
      };
      check(hit.o, "o"); check(hit.x1, "x"); check(hit.x2, "x");
      const near = (poly) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      };
      const next = near(hit.o) ? "o" : near(hit.x1) || near(hit.x2) ? "x" : null;
      over = next;
      retarget();
    },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { AMP = rad(v); retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "oxsphere",
  means: "The OX mark on a sphere: O and X turn together through almost a full revolution.",
  rules: [1, 3, 5, 8],
  range: [12, 22, 40],
  tour: [[165, 133], [274, 187], [131, 146], [296, 191]],
  mount,
});
