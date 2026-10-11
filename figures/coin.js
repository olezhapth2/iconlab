/**
 * Coin: a coin standing on a plinth, spun about its own axis. The pointer's
 * x scrubs the turn, so the face under the pointer — heads with its round
 * relief, tails with its hexagon — takes the bright stroke and gives the
 * plinth's dot back when the pointer leaves. The slider is the coin's radius.
 *
 * The pattern: one continuous number. A spring on a scrub taken across the
 * rest pose, which never moves, so the hit test is its silhouette; the coin
 * rewritten only while the angle or the radius moves, its silhouette the
 * hull of the two faces, whichever way round they are. The plinth paints
 * after the coin: at any pixel they share the slab is nearer the camera.
 */
const {
  Cam, clamp, fit, hull, poly, proj, rad, rings, spring, stepS,
  disposer, mk, place, pointer, reflect, register, solid, put, prism, facing,
} = HL;

const PLH = 4, PW = 26, PD = 15, PR = 4, T = 6, MAXR = 68;
const REST_PH = 55, PHI0 = -35, PHI1 = 190, FLIP = 135;
const TH = Array.from({ length: 64 }, (_, k) => k * Math.PI / 32);
const HEX = [0, 1, 2, 3, 4, 5].map((k) => k * Math.PI / 3);
const PL = rings(-PW, -PD, PW, PD, PR, 2);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let R = value;

  // Fitted for the largest coin in every pose, so no slider leaves the frame.
  const C = Cam(45, 0.5, 2.0);
  const fp = [[-PW, -PD, -10], [PW, PD, -10], [PW, -PD, 0], [-PW, PD, 0]];
  for (const a of [-35, 45, 190]) for (const th of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (const k of [-1, 1]) {
    const s = Math.sin(rad(a)), c = Math.cos(rad(a)), co = Math.cos(th), si = Math.sin(th);
    fp.push([-MAXR * co * s + (T / 2) * k * c, MAXR * co * c + (T / 2) * k * s, PLH + MAXR + MAXR * si]);
  }
  fit(C, fp, 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, PL[0], 0, 10);

  const hullP = mk("path", { class: "sil" }, g);
  const faceP = mk("path", { class: "sil" }, g);
  const creaseP = mk("path", { class: "nf lo" }, g);
  const reliefP = mk("path", { class: "nf lo" }, g);
  const slab = solid(g);
  put(slab, prism(P, front, PL[0], PL[1], 0, PLH));
  const dot = mk("circle", { r: 2.4, class: "dot" }, g);
  place(dot, P(9, 8, PLH + 0.1));

  /** The coin at angle ph: its k-side face ring of radius r0, the coin's centre standing on the plinth. */
  const at = (ph, k, rr, r0, th) => {
    const s = Math.sin(ph), c = Math.cos(ph), co = Math.cos(th);
    return P(-r0 * co * s + (T / 2) * k * c, r0 * co * c + (T / 2) * k * s, PLH + rr + r0 * Math.sin(th));
  };
  const faces = (ph, rr) => [TH.map((th) => at(ph, 1, rr, rr, th)), TH.map((th) => at(ph, -1, rr, rr, th))];

  /** The rest silhouette: the pointer must be inside of it, and it maps the scrub. */
  let hit = [], hx0 = 0, hx1 = 1;
  const computeHit = () => {
    const [f, b] = faces(rad(REST_PH), R);
    hit = hull(f.concat(b));
    hx0 = Math.min(...hit.map((p) => p[0]));
    hx1 = Math.max(...hit.map((p) => p[0]));
  };
  const inside = ([x, y]) => {
    let n = false;
    for (let i = 0, j = hit.length - 1; i < hit.length; j = i++) {
      const [xi, yi] = hit[i], [xj, yj] = hit[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) n = !n;
    }
    return n;
  };

  /** The hull of both faces, the face the camera can see, its crease and relief. */
  function draw(ph, rr) {
    const [f, b] = faces(ph, rr), heads = Math.cos(ph) + Math.sin(ph) > 0, k = heads ? 1 : -1;
    hullP.setAttribute("d", poly(hull(f.concat(b))));
    faceP.setAttribute("d", poly(heads ? f : b));
    creaseP.setAttribute("d", poly(TH.map((th) => at(ph, k, rr, rr - 3, th))));
    reliefP.setAttribute("d", poly((heads ? TH : HEX).map((th) => at(ph, k, rr, rr * 0.45, th))));
  }

  const sp = spring(REST_PH);
  let over = false, said = "", drawn = "";
  const B = register(stage, (dt) => {
    const m = stepS(sp, dt);
    const key = `${Math.round(sp.x * 8)} ${R}`;
    if (key !== drawn) { drawn = key; draw(rad(sp.x), R); }
    faceP.classList.toggle("hi", over);
    const w = !over ? "rest" : sp.x < FLIP ? "heads" : "tails";
    if (w !== said) { said = w; read.textContent = w; }
    return m;
  });
  bag.add(B.unregister);

  const aim = (p) => {
    over = p ? inside(p) : false;
    sp.t = over ? PHI0 + clamp((p[0] - hx0) / (hx1 - hx0), 0, 1) * (PHI1 - PHI0) : REST_PH;
    dot.classList.toggle("off", over);
    B.wake();
  };
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  computeHit();
  return {
    set: (v) => { R = v; computeHit(); drawn = ""; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "coin",
  means: "A coin turns on its plinth; the pointer's x scrubs the face you see.",
  rules: [1, 3, 5, 8],
  range: [44, 56, 68],
  tour: [[130, 160], [200, 140], [270, 175], [200, 210], null],
  mount,
});
