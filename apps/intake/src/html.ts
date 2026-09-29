/**
 * The intake pages, on the look of oneshotagent.com: flat near-black, one green, DM Sans
 * headlines, Geist Mono labels, and the landing's signal rail — a faint line in the left gutter
 * with a glowing head that travels down and lights each section marker as it passes.
 * The palette is the product site's, kept here on purpose; the film has its own.
 */
import { STATUS_NOTES, STATUS_STAGES, type Status, type Submission } from "./queue.ts";

export const TUNNEL_HINT = "cloudflared tunnel --url http://localhost:3000";

/** apps/web-landing globals.css --os-* */
const OS = {
  black: "#070a09",
  graphite: "#111713",
  white: "#eef4f0",
  muted: "#a1afa6",
  rule: "#26312b",
  green: "#20d487",
  lit: "#8ff7c8",
  core: "#d6ffec",
  amber: "#e6a64c",
  red: "#c35045",
  field: "#0d120f",
  fieldRule: "#344239",
} as const;

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

const css = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: ${OS.black}; color: ${OS.white}; font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  a { color: inherit; }
  .header { position: fixed; inset: 0 0 auto; z-index: 50; background: rgb(7 10 9 / .9); backdrop-filter: blur(16px); border-bottom: 1px solid rgb(38 49 43 / .6); }
  .bar { max-width: 80rem; margin: 0 auto; padding: 0 1.5rem; height: 4rem; display: flex; align-items: center; gap: 2.5rem; }
  .mark { font-weight: 700; font-size: 1.05rem; letter-spacing: -.02em; text-decoration: none; }
  .mark i { font-style: normal; color: ${OS.green}; }
  .mark span { font-weight: 400; color: ${OS.muted}; margin-left: .35rem; }
  .bar .right { margin-left: auto; }
  .text-link { display: inline-flex; align-items: center; gap: .45rem; color: ${OS.white}; font-size: .9rem; text-decoration: underline; text-decoration-color: #3f5248; text-underline-offset: 5px; }
  .text-link:hover { color: ${OS.green}; text-decoration-color: ${OS.green}; }
  main { position: relative; max-width: 76rem; margin: 0 auto; padding: 7.2rem max(1.5rem, 4.5rem) 6rem; min-height: 100vh; }
  .copy { max-width: 42rem; }
  .hero-context, .section-marker { margin: 0; color: ${OS.muted}; font-size: .84rem; letter-spacing: -.01em; }
  .hero-context::before, .section-marker::before { content: ""; display: inline-block; width: 1.8rem; height: 1px; margin-right: .7rem; background: ${OS.green}; vertical-align: middle; transition: background-color 400ms ease-out, box-shadow 400ms ease-out; }
  .is-lit::before { background: ${OS.lit}; box-shadow: 0 0 10px 1px rgb(32 212 135 / .7); }
  h1 { margin: 1.8rem 0 0; font-size: clamp(3rem, 5.2vw, 4.9rem); font-weight: 600; line-height: 1.04; letter-spacing: -.045em; color: ${OS.white}; }
  h1 em { font-style: normal; color: ${OS.green}; }
  .deck { max-width: 38rem; margin: 1.6rem 0 0; color: #b3bfb7; font-size: 1.1rem; line-height: 1.55; }
  form { margin-top: 2.4rem; max-width: 39rem; }
  label { display: block; margin: 1.4rem 0 .5rem; color: ${OS.muted}; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .72rem; letter-spacing: .04em; text-transform: uppercase; }
  .field { display: flex; align-items: center; gap: .65rem; min-height: 3.75rem; padding: .75rem 1.1rem; border: 1px solid ${OS.fieldRule}; border-radius: .65rem; background: ${OS.field}; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .88rem; transition: border-color 160ms, background 160ms; }
  .field:focus-within { border-color: #567062; background: #101813; }
  .field .prompt { color: ${OS.green}; }
  .field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: ${OS.white}; font: inherit; }
  .field input::placeholder { color: #68746d; }
  .hint { margin-top: .6rem; color: #68746d; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .74rem; line-height: 1.6; }
  .hint code { color: #c0e5d1; }
  .actions { margin-top: 2rem; display: flex; align-items: center; gap: .8rem; flex-wrap: wrap; }
  .primary-button, .secondary-button { display: inline-flex; align-items: center; justify-content: center; gap: .8rem; min-height: 3.1rem; padding: .8rem 1.25rem; border-radius: .45rem; font-size: .9rem; font-weight: 600; text-decoration: none; cursor: pointer; font-family: inherit; }
  .primary-button { color: #072417; background: ${OS.green}; border: 0; }
  .primary-button:hover { background: #62e6ac; }
  .secondary-button { color: ${OS.white}; background: transparent; border: 1px solid #3b4b41; }
  .secondary-button:hover { background: ${OS.graphite}; }
  .panel { margin-top: 1.6rem; padding: 1rem 1.2rem; border: 1px solid ${OS.rule}; border-radius: .65rem; background: ${OS.graphite}; color: #cbd5cf; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .8rem; line-height: 1.7; }
  .panel.bad { border-color: rgb(195 80 69 / .6); }
  .panel code { color: ${OS.core}; }
  .stages { margin-top: 2.6rem; max-width: 46rem; border-top: 1px solid ${OS.rule}; }
  .stage-row { position: relative; padding: 1.1rem 0; border-bottom: 1px solid ${OS.rule}; display: flex; flex-wrap: wrap; align-items: baseline; gap: 1.2rem; }
  .stage-row .section-marker { font-family: 'Geist Mono', ui-monospace, monospace; font-size: .8rem; letter-spacing: .02em; }
  .stage-row.is-passed .section-marker { color: #cbd5cf; }
  .stage-row.is-current .section-marker { color: ${OS.white}; }
  .stage-row.stage-failed .section-marker { color: ${OS.red}; }
  .stage-row.stage-failed .section-marker::before { background: ${OS.red}; box-shadow: 0 0 10px 1px rgb(195 80 69 / .6); }
  .stage-row .note { margin-left: auto; color: #68746d; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .72rem; }
  .stage-row.is-current .note { color: ${OS.green}; }
  .error { margin: 0 0 0 2.5rem; padding: .6rem 0 0; flex-basis: 100%; color: #d9a39d; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .76rem; line-height: 1.6; white-space: pre-wrap; }
  .card { margin-top: 2.2rem; max-width: 62rem; padding: 1.4rem; border: 1px solid ${OS.rule}; border-radius: .65rem; background: ${OS.graphite}; }
  video { width: 100%; display: block; border-radius: .5rem; border: 1px solid ${OS.rule}; background: #000; }
  .card .links { margin-top: 1rem; display: flex; gap: 1.4rem; align-items: center; flex-wrap: wrap; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .8rem; color: ${OS.muted}; }
  table { width: 100%; border-collapse: collapse; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .76rem; margin-top: 1.2rem; }
  th, td { text-align: left; padding: .6rem .5rem; border-bottom: 1px solid ${OS.rule}; vertical-align: top; }
  th { color: #68746d; font-weight: 400; letter-spacing: .06em; text-transform: uppercase; font-size: .64rem; }
  td a { color: ${OS.white}; }
  .ok { color: ${OS.green}; } .bad { color: ${OS.red}; }
  .meta { margin-top: 1.6rem; color: #68746d; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .74rem; }
  footer { margin-top: 5rem; color: #68746d; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .72rem; line-height: 1.9; }
  footer a { color: ${OS.muted}; }
  /* The signal rail. */
  .rail-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; mix-blend-mode: screen; }
  .rail-svg[hidden] { display: none; }
  .rail, .halo, .lit { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .rail { stroke: ${OS.green}; stroke-width: 1; opacity: .14; }
  .halo { stroke: ${OS.green}; stroke-width: 7; opacity: .14; }
  .lit { stroke: #5ff0b0; stroke-width: 1.6; }
  .head-glow { fill: ${OS.green}; opacity: .28; }
  .head-core { fill: ${OS.core}; }
  .sweep { position: absolute; height: 2px; overflow: hidden; pointer-events: none; animation: sweep-life 1.6s linear forwards; }
  .sweep span { position: absolute; top: 0; left: 0; width: 320px; height: 2px; background: linear-gradient(90deg, transparent, rgb(32 212 135 / .5) 55%, ${OS.core} 94%, transparent); box-shadow: 0 0 12px 1px rgb(32 212 135 / .55); transform: translateX(-320px); animation: sweep-run 1.4s cubic-bezier(.55,.05,.35,1) forwards; }
  @keyframes sweep-run { to { transform: translateX(calc(100vw + 320px)); } }
  @keyframes sweep-life { 0%, 90% { opacity: 1; } 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .sweep { display: none; } }
  @media (max-width: 720px) { main { padding: 6rem 1.25rem 4rem; } .rail-svg { display: none; } }
  .live { flex-basis: 100%; margin: .2rem 0 0 2.5rem; max-width: 62rem; }
  .live:empty { display: none; }
  @media (max-width: 640px) { .live { margin-left: 0; } }
  .detail { font-family: 'Geist Mono', ui-monospace, monospace; font-size: .8rem; color: ${OS.lit}; }
  .detail .elapsed { color: #68746d; margin-left: .8rem; }
  .agent { margin-top: 1rem; padding: 1rem 1.2rem; border: 1px solid ${OS.rule}; border-radius: .65rem; background: ${OS.graphite}; font-family: 'Geist Mono', ui-monospace, monospace; font-size: .76rem; color: #cbd5cf; }
  .agent .label { color: ${OS.muted}; text-transform: uppercase; letter-spacing: .08em; font-size: .68rem; }
  .turnbar { margin: .5rem 0 .8rem; height: 4px; border-radius: 2px; background: ${OS.rule}; overflow: hidden; }
  .turnbar i { display: block; height: 100%; background: ${OS.green}; box-shadow: 0 0 10px ${OS.green}; transition: width .6s ease; }
  .agent ul { margin: .4rem 0 0; padding-left: 1.1rem; line-height: 1.6; }
  .agent ol { margin: .4rem 0 0; padding-left: 1.3rem; line-height: 1.6; color: ${OS.white}; }
  .agent ol code { color: ${OS.green}; }
  .filmstrip { margin-top: 1rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: .6rem; }
  .filmstrip img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border: 1px solid ${OS.rule}; border-radius: .4rem; background: ${OS.field}; }
`;

/** The rail: measures the markers, draws the paths, walks the head down to its resting marker. */
const railScript = `
(function () {
  var main = document.querySelector('main'); var svg = document.getElementById('rail');
  if (!main || !svg) return;
  var markers = [].slice.call(main.querySelectorAll('.section-marker, .hero-context'));
  if (!markers.length) { svg.hidden = true; return; }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rail = svg.querySelector('.rail'), halo = svg.querySelector('.halo'), lit = svg.querySelector('.lit'), head = svg.querySelector('.head');
  var target = Math.min(parseInt(main.dataset.restAt || String(markers.length - 1), 10), markers.length - 1);
  var from = -1;
  var key = main.dataset.railKey;
  if (key) {
    try { var seen = sessionStorage.getItem(key); from = seen != null ? parseInt(seen, 10) : target - 1; sessionStorage.setItem(key, String(target)); } catch (e) { from = target - 1; }
    if (from > target) from = target - 1;
  }
  var L;
  function layout() {
    var mr = main.getBoundingClientRect();
    var x = Math.min.apply(null, markers.map(function (m) { return m.getBoundingClientRect().left; })) - 28 - mr.left;
    if (x < 8) { svg.hidden = true; return null; }
    svg.hidden = false;
    var ys = markers.map(function (m) { var r = m.getBoundingClientRect(); return r.top + r.height / 2 - mr.top; });
    var top = ys[0] - 48, bottom = Math.max(ys[ys.length - 1] + 48, mr.height - 40);
    var d = 'M' + x + ' ' + top + ' L' + x + ' ' + bottom;
    rail.setAttribute('d', d); halo.setAttribute('d', d); lit.setAttribute('d', d);
    return { x: x, ys: ys, top: top, bottom: bottom, total: bottom - top };
  }
  function sweep(i) {
    if (reduced) return;
    var sec = markers[i].closest('section, article') || markers[i];
    var mr = main.getBoundingClientRect();
    var top = sec.getBoundingClientRect().top - mr.top;
    var el = document.createElement('div'); el.className = 'sweep';
    el.style.cssText = 'left:' + L.x + 'px;top:' + top + 'px;width:' + (main.clientWidth - L.x) + 'px';
    el.appendChild(document.createElement('span'));
    el.addEventListener('animationend', function () { el.remove(); }, { once: true });
    main.appendChild(el);
  }
  function setHead(y) {
    var dist = Math.max(0, y - L.top);
    halo.setAttribute('stroke-dasharray', dist + ' ' + L.total); lit.setAttribute('stroke-dasharray', dist + ' ' + L.total);
    head.setAttribute('transform', 'translate(' + L.x + ' ' + y + ')');
    markers.forEach(function (m, i) {
      if (i <= target && y >= L.ys[i] - 1 && !m.classList.contains('is-lit')) { m.classList.add('is-lit'); sweep(i); }
    });
  }
  L = layout(); if (!L) return;
  var endY = L.ys[target];
  markers.forEach(function (m, i) { if (i <= from) m.classList.add('is-lit'); });
  if (reduced) { markers.forEach(function (m, i) { if (i <= target) m.classList.add('is-lit'); }); setHead(endY); return; }
  var startY = from >= 0 ? L.ys[from] : L.top;
  var t0 = null, dur = 1100;
  function step(now) {
    if (t0 === null) t0 = now;
    var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    setHead(startY + (endY - startY) * e);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  addEventListener('resize', function () { var N = layout(); if (N) { L = N; endY = L.ys[target]; setHead(endY); } });
})();
`;

const shell = (
  title: string,
  body: string,
  opts: { refresh?: number; restAt?: number; railKey?: string; script?: string } = {},
) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>${opts.refresh ? `<meta http-equiv="refresh" content="${opts.refresh}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<header class="header"><div class="bar"><a class="mark" href="/">OneShot<i>.</i><span>video</span></a><a class="text-link right" href="https://github.com/oneshot-agent/oneshot-video">github.com/oneshot-agent/oneshot-video</a></div></header>
<main${opts.restAt != null ? ` data-rest-at="${opts.restAt}"` : ""}${opts.railKey ? ` data-rail-key="${esc(opts.railKey)}"` : ""}>
<svg id="rail" class="rail-svg" aria-hidden="true"><path class="rail"/><path class="halo"/><path class="lit"/><g class="head"><circle r="11" class="head-glow"/><circle r="2.6" class="head-core"/></g></svg>
${body}
<footer>Built at The AI Conference Hack Day, 29 Sep 2026. MIT. The film is fixed on purpose.<br><a href="https://github.com/oneshot-agent/oneshot-video">github.com/oneshot-agent/oneshot-video</a> · <a href="https://oneshotagent.com">oneshotagent.com</a></footer>
</main>
<script>${railScript}</script>${opts.script ? `<script>${opts.script}</script>` : ""}
</body></html>`;

export function formPage(opts: { error?: "invalid" | "local"; url?: string } = {}): string {
  const warn =
    opts.error === "local"
      ? `<div class="panel bad">That URL is on your laptop, and this runs on ours. Open a tunnel and paste what it prints:<br><code>${TUNNEL_HINT}</code><br>A Vercel or Netlify preview URL works too.</div>`
      : opts.error === "invalid"
        ? `<div class="panel bad">That is not an http(s) URL.</div>`
        : "";
  return shell(
    "OneShot video",
    `<section class="copy">
<p class="hero-context">A URL in. A launch film out.</p>
<h1>Give your app<br>its <em>launch film.</em></h1>
<p class="deck">Thirty seconds, voiced and silent. The voice, the score, the palette and the cut are fixed, so every team gets the same film. Free during Hack Day.</p>
${warn}
<form method="post" action="/submit">
  <label for="url">app url or GitHub repo</label>
  <div class="field"><span class="prompt">$</span><input id="url" name="url" type="url" required placeholder="https://your.app or https://github.com/you/app" value="${esc(opts.url ?? "")}" autocomplete="off"></div>
  <p class="hint">A public GitHub repo is booted in a sandbox, seeded and filmed. An app URL must be public; localhost is not reachable from here: <code>${TUNNEL_HINT}</code>, or a preview deploy.</p>
  <label for="contact">where to find you</label>
  <div class="field"><input id="contact" name="contact" type="text" placeholder="email or discord handle"></div>
  <label for="hint">one line on what to show <span style="text-transform:none;letter-spacing:0">(optional)</span></label>
  <div class="field"><input id="hint" name="hint" type="text" placeholder="the dashboard after login, the checkout, the thing that came back"></div>
  <div class="actions"><button class="primary-button" type="submit">Queue the film</button><a class="secondary-button" href="/r/mun147fa-dqsx">See a finished one →</a></div>
</form>
</section>`,
    { restAt: 0 },
  );
}

const STAGES = STATUS_STAGES;

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

/** How long a stage took, or has taken so far. */
function stepTime(st: Status, stage: string, now: number): string {
  const step = st.steps?.findLast((x) => x.stage === stage);
  if (!step) return "";
  return clock((step.finished ? Date.parse(step.finished) : now) - Date.parse(step.started));
}

/**
 * The part of the status page that changes between stages: the latest line, the agent's turn
 * and notes, the plan once written, the stills as they land. Served inside the page and inside
 * /r/<id>.json, so the page's poll swaps it in without a second renderer.
 */
export function liveFragment(st: Status, now = Date.now()): string {
  if (st.stage === "done" || st.stage === "failed") return "";
  const since = st.started ? clock(now - Date.parse(st.started)) : "";
  const detail = st.detail
    ? `<p class="detail">${esc(st.detail)}${since ? `<span class="elapsed">${since} in</span>` : ""}</p>`
    : "";
  const h = st.harness;
  const agent = h
    ? `<div class="agent"><span class="label">agent in the sandbox · turn ${h.turn} of ${h.max}</span>
<div class="turnbar"><i style="width:${Math.min(100, Math.round((h.turn / h.max) * 100))}%"></i></div>
${h.plan ? `<span class="label">what it will show · ${esc(h.plan.app.name)}</span><ol>${h.plan.workflow.map((w) => `<li><code>${esc(w.path)}</code> ${esc(w.caption)}</li>`).join("")}</ol>` : ""}
${h.notes?.length ? `<span class="label">what it has found</span><ul>${h.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</div>`
    : "";
  const strip = st.stills?.length
    ? `<div class="filmstrip">${st.stills.map((_, i) => `<img loading="lazy" alt="still ${i + 1}" src="/r/${esc(st.id)}/stills/${i}.png">`).join("")}</div>`
    : "";
  return detail + agent + strip;
}

/** Polls the JSON twin: swaps the live block, reloads once when the stage moves (the rail animates on load). */
const pollScript = (id: string, stage: string) => `
(function () {
  var stage = ${JSON.stringify(stage)}, box = document.getElementById('live');
  function tick() {
    fetch('/r/${id}.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (s) {
      if (s.stage !== stage) { location.reload(); return; }
      if (box && typeof s.live_html === 'string' && box.innerHTML !== s.live_html) box.innerHTML = s.live_html;
      setTimeout(tick, 3000);
    }).catch(function () { setTimeout(tick, 6000); });
  }
  setTimeout(tick, 3000);
})();
`;

export function statusPage(sub: Submission | undefined, st: Status, now = Date.now()): string {
  const failed = st.stage === "failed";
  const failedAt = st.steps?.at(-1)?.stage ?? "script";
  const currentIdx = STAGES.indexOf((failed ? failedAt : st.stage) as (typeof STAGES)[number]);
  const rows = STAGES.map((s, i) => {
    const cls = [
      "stage-row",
      i < currentIdx ? "is-passed" : "",
      i === currentIdx ? "is-current" : "",
      i === currentIdx && failed ? "stage-failed" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const took = stepTime(st, s, now);
    const note =
      i === currentIdx
        ? failed
          ? "stopped here"
          : STATUS_NOTES[s]
        : i < currentIdx
          ? took
            ? `done in ${took}`
            : "done"
          : "";
    const err =
      i === currentIdx && failed ? `<pre class="error">${esc(st.error ?? "failed")}</pre>` : "";
    // The live block sits in the current stage's row, where the eye already is.
    const liveBox =
      i === currentIdx && !failed && st.stage !== "done"
        ? `<div id="live" class="live">${liveFragment(st, now)}</div>`
        : "";
    return `<section class="${cls}"><p class="section-marker">${s}</p><span class="note">${esc(note)}</span>${err}${liveBox}</section>`;
  }).join("");
  const done = st.stage === "done";
  const card = done
    ? `<div class="card"><video controls playsinline src="${esc(st.video ?? "")}"></video>
<div class="links"><a class="text-link" href="${esc(st.video ?? "")}" download>voiced cut</a><a class="text-link" href="${esc(st.silent ?? "")}" download>silent cut</a>${st.cost_usd != null ? `<span>cost $${st.cost_usd.toFixed(4)}</span>` : ""}</div>
${st.gates?.length ? `<table><tr><th>gate</th><th>result</th></tr>${st.gates.map((g) => `<tr><td>${esc(g.name)}</td><td class="${g.ok ? "ok" : "bad"}">${esc(g.reason)}</td></tr>`).join("")}</table>` : ""}</div>`
    : "";
  const live = !done && !failed;
  const host = sub
    ? sub.kind === "repo"
      ? new URL(sub.url).pathname.slice(1)
      : new URL(sub.url).hostname
    : st.id;
  const headline = !live
    ? done
      ? "Done."
      : "It did not ship."
    : st.stage === "queued"
      ? "In the queue."
      : st.stage === "booting"
        ? "Setting it up."
        : "On it.";
  return shell(
    `OneShot video · ${host} · ${st.stage}`,
    `<section class="copy">
<p class="hero-context">${esc(host)}</p>
<h1>${headline}</h1>
<p class="deck">${live ? "Keep this page open; it follows the run as it goes. A repo takes a few minutes before the camera starts." : done ? "Thirty seconds, voiced and silent, both below." : "The run stopped and said why. Fix the URL or the page, and queue it again."}</p>
</section>
<div class="stages">${rows}</div>
${card}
<p class="meta">run <code>${esc(st.id)}</code>${sub?.contact ? ` · ${esc(sub.contact)}` : ""}${sub?.hint ? ` · “${esc(sub.hint)}”` : ""} · <a class="text-link" href="/r/${esc(st.id)}.json">json</a></p>`,
    {
      restAt: 1 + Math.max(0, currentIdx),
      railKey: `rail:${st.id}`,
      script: live ? pollScript(st.id, st.stage) : undefined,
    },
  );
}

export function adminPage(rows: { sub: Submission; st: Status }[]): string {
  const tr = rows
    .map(
      ({ sub, st }) =>
        `<tr><td><a href="/r/${esc(sub.id)}">${esc(sub.id)}</a></td><td><a href="${esc(sub.url)}">${esc(new URL(sub.url).hostname)}</a></td><td>${esc(sub.contact)}</td><td>${esc(sub.hint)}</td><td class="${st.stage === "done" ? "ok" : st.stage === "failed" ? "bad" : ""}">${st.stage}</td><td>${esc(sub.ts.slice(11, 16))}</td></tr>`,
    )
    .join("");
  return shell(
    "OneShot video · queue",
    `<section class="copy"><p class="hero-context">The queue</p><h1>${rows.length} in the queue.</h1></section>
<div class="card"><table><tr><th>run</th><th>app</th><th>contact</th><th>show</th><th>stage</th><th>at</th></tr>${tr}</table></div>`,
    { refresh: 30, restAt: 0 },
  );
}
