/**
 * Plane: a paper dart flies a figure-eight over its own dashed track, one
 * continuous clock: the phase advances, the pose is read off it — heading
 * from the tangent, bank from the curvature, so the wings lean into every
 * turn and cross level over the crossing. The dart carries a keel: the rear
 * triangle folded down under the body, the paper's own thickness.
 *
 * Three hits. The airspace over the track springs the cruise to a fifth. The
 * crossing — the eight's own centre — springs the altitude down, so the dart
 * dives under its loop; leave and it climbs back. The right lobe, under the
 * dart's low pass, springs it up. The slider is the cruise rate.
 */
const {
  Cam, clamp, fit, hull, open, poly, proj, rad, seg, spring, stepS,
  disposer, mk, pointer, register, reducedMotion,
} = HL;

const A = 48, H = 32, L = 22, WING = 11, TH = 1.6, KEEL = 4;
const BASE = 0.9, BANK = rad(15), GAIN = 24, REST = 1;
const DIVE = 12, LOW = 6;
const lem = (u) => {
  const s = Math.sin(u), c = Math.cos(u), d = 1 + s * s;
  return [A * c / d, A * s * c / d];
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let rate = value, phase = 0, over = null;

  /** The dart's planform, and its keel folded down under the belly with a kink. */
  const DART = [[L, 0], [-0.55 * L, WING], [-0.2 * L, 0], [-0.55 * L, -WING]];
  const KEELF = [
    [0.25 * L, 0, -TH / 2],
    [-0.2 * L, 0, -TH / 2],
    [-0.3 * L, 0.8, -TH / 2 - KEEL * 0.45],
    [-0.1 * L, 0, -TH / 2 - KEEL],
  ];
  const pose = (u, z) => {
    const p = lem(u), q = lem(u + 0.01), r = lem(u + 0.02);
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    let turn = Math.atan2(r[1] - q[1], r[0] - q[0]) - a;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const bank = clamp(GAIN * turn, -BANK, BANK);
    const h = [Math.cos(a), Math.sin(a)], side = [-h[1], h[0]];
    const cw = Math.cos(bank), sw = Math.sin(bank);
    const rr = [side[0] * cw, side[1] * cw, sw];
    const up = [-side[0] * sw, -side[1] * sw, cw];
    const at = (x, y, zz) => [
      p[0] + h[0] * x + rr[0] * y + up[0] * zz,
      p[1] + h[1] * x + rr[1] * y + up[1] * zz,
      z + up[2] * zz,
    ];
    return {
      top: DART.map(([x, y]) => at(x, y, TH / 2)),
      bot: DART.map(([x, y]) => at(x, y, -TH / 2)),
      keel: KEELF.map(([x, y, zz]) => at(x, y, zz)),
      nose: at(L, 0, 0),
    };
  };

  const C = Cam(45, 0.5, 3.0);
  const fp = [];
  for (let i = 0; i < 64; i++) { const p = lem(i / 64 * Math.PI * 2); fp.push([p[0], p[1], 0], [p[0], p[1], H]); }
  for (let i = 0; i < 16; i++) { const t = pose(i / 16 * Math.PI * 2, H); fp.push(...t.top, t.nose, ...t.keel); }
  fit(C, fp, 200, 160);
  const P = proj(C);
  const g = mk("g", {}, svg);
  const trackP = mk("path", { class: "nf dash lo" }, g);
  const hullP = mk("path", { class: "sil" }, g);
  const faceP = mk("path", { class: "sil" }, g);
  const keelP = mk("path", { class: "sil" }, g);
  const foldP = mk("path", { class: "nf lo" }, g);

  const track = [];
  for (let i = 0; i <= 128; i++) { const p = lem(i / 128 * Math.PI * 2); track.push(P(p[0], p[1], 0)); }
  trackP.setAttribute("d", open(track));

  /** Three hits, all static: the crossing at mid-height, the right lobe low, the airspace. */
  const near = (c, p) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 < 24 ** 2;
  const C1 = P(0, 0, H * 0.5);
  const C2 = P(48, 0, H * 0.5);
  const air = [];
  for (let i = 0; i < 64; i++) {
    const p = lem(i / 64 * Math.PI * 2), t = pose(i / 64 * Math.PI * 2, H);
    for (const [x, y, z] of [[p[0], p[1], H], ...t.top, t.nose]) air.push(P(x, y, z));
  }
  const hit = hull(air);
  const inside = ([x, y]) => {
    let n = false;
    for (let i = 0, j = hit.length - 1; i < hit.length; j = i++) {
      const [xi, yi] = hit[i], [xj, yj] = hit[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) n = !n;
    }
    return n;
  };
  const state = (p) => (p ? (near(C1, p) ? 2 : near(C2, p) ? 1 : inside(p) ? 0 : null) : null);

  const rs = spring(rate), zs = spring(H);
  let said = "";
  register(stage, (dt) => {
    let moving = stepS(rs, dt);
    if (stepS(zs, dt)) moving = true;
    if (!reducedMotion()) phase = (phase + dt * BASE * rs.x) % (Math.PI * 2);
    const t = pose(phase, zs.x);
    const top = t.top.map((q) => P(q[0], q[1], q[2])), bot = t.bot.map((q) => P(q[0], q[1], q[2]));
    hullP.setAttribute("d", poly(hull(top.concat(bot))));
    faceP.setAttribute("d", poly(top));
    keelP.setAttribute("d", poly(t.keel.map((q) => P(q[0], q[1], q[2]))));
    foldP.setAttribute("d", seg(top[0], top[2]));
    const w = ["rest", "cruise", "dive", "loop"][over ?? 0];
    if (w !== said) { said = w; read.textContent = w; }
    return true;
  });

  const aim = (p) => {
    const w = state(p);
    if (w !== over) {
      over = w;
      rs.t = w === 0 ? rate * 0.2 : rate;
      zs.t = w === 2 ? DIVE : w === 1 ? LOW : H;
      trackP.classList.toggle("hi", w !== null);
      trackP.classList.toggle("lo", w === null);
      said = "";
    }
  };
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { rate = v; rs.t = over === 0 ? v * 0.2 : v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "plane",
  means: "A paper plane circles a dashed eight: the crossing dives it, the right lobe lifts it, the airspace slows it.",
  rules: [1, 5, 7, 8],
  range: [0.5, 1, 1.8],
  tour: [[203, 170], [305, 221], [152, 134], null],
  mount,
});
