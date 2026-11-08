(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const safe = (fn) => { try { return fn(); } catch { return null; } };

  // Theme (pull cord)
  const root = document.documentElement;
  root.dataset.theme = "dark"; // every visit starts in dark mode; the cord switches it for that visit only
  const toggleTheme = () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
  };

  // Pull cord: a verlet rope (linked segments + gravity). Grab the bead, pull, let go: it whips and settles.
  const cord = $("#cord"), cv = $("#cordCanvas"), ctx = cv.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const CW = 200, CH = 420, AX = 100, N = 16;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = CW * dpr; cv.height = CH * dpr; ctx.scale(dpr, dpr);
  const ropeLen = () => (innerWidth < 700 ? 110 : 150);
  let L = ropeLen();
  const pts = Array.from({ length: N + 1 }, (_, i) => ({ x: AX, y: (i * L) / N, px: AX, py: (i * L) / N }));
  const invMass = pts.map((_, i) => (i === 0 ? 0 : i === N ? 0.35 : 1)); // anchored top, heavy bead
  let ext = 1, drag = null, acc = 0, last = performance.now(), swayT = 0;
  addEventListener("resize", () => { L = ropeLen(); });

  const physics = (dt) => {
    swayT += dt;
    const g = 2600, wind = still ? 0 : Math.sin(swayT * 1.2) * Math.cos(swayT * 0.41) * 0.012;
    for (let i = 1; i <= N; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * 0.994, vy = (p.y - p.py) * 0.994;
      p.px = p.x; p.py = p.y;
      p.x += vx + wind * (i / N);
      p.y += vy + g * dt * dt * (i === N ? 1.5 : 1);
    }
    if (drag) {
      const e = pts[N]; e.x = drag.tx; e.y = drag.ty; e.px = e.x; e.py = e.y;
    } else {
      ext = 1 + (ext - 1) * 0.975;                // the rope retracts, which gives the whip
    }
    for (let i = 1; i <= N; i++) if (pts[i].y < 6) { pts[i].y = 6; if (pts[i].py < 6) pts[i].py = 6; }   // housing at the top
    const rest = (L / N) * ext;
    for (let it = 0; it < 16; it++) {
      for (let i = 1; i <= N; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.0001;
        if (d <= rest) continue;                  // a rope resists stretching, never compression: it goes slack
        const ia = invMass[i - 1], ib = drag && i === N ? 0 : invMass[i];
        const w = ia + ib; if (!w) continue;
        const k = (d - rest) / d / w;
        a.x += dx * k * ia; a.y += dy * k * ia;
        b.x -= dx * k * ib; b.y -= dy * k * ib;
      }
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, CW, CH);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const path = () => {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < N; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[N].x, pts[N].y);
    };
    path(); ctx.strokeStyle = "#6e5f4c"; ctx.lineWidth = 3.6; ctx.stroke();
    path(); ctx.strokeStyle = "#cdbb9f"; ctx.lineWidth = 1.5; ctx.setLineDash([2.5, 3.5]); ctx.stroke(); ctx.setLineDash([]);
    // bead, aligned with the last rope segment
    const e = pts[N], p = pts[N - 1];
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(ang - Math.PI / 2);
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    const gr = ctx.createRadialGradient(-4, 8, 2, 0, 14, 20);
    gr.addColorStop(0, "#d99a64"); gr.addColorStop(.55, "#8a4d27"); gr.addColorStop(1, "#3d200e");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 16, 10.5, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // keep the invisible hit-button on top of the bead (also makes the cord keyboard/touch accessible)
    const r = cv.getBoundingClientRect();
    const bx = r.left + e.x + Math.cos(ang) * 16, by = r.top + e.y + Math.sin(ang) * 16;
    cord.style.transform = `translate(${(bx - 24).toFixed(1)}px, ${(by - 32).toFixed(1)}px)`;
  };

  const loop = (now) => {
    acc += Math.min(0.05, (now - last) / 1000); last = now;
    while (acc >= 1 / 120) { physics(1 / 120); acc -= 1 / 120; }
    draw(); requestAnimationFrame(loop);
  };
  requestAnimationFrame((t) => { last = t; loop(t); });
  if (!still) setTimeout(() => { pts[N].x += 16; pts[N - 3].x += 7; }, 2300);   // a small nudge so it visibly swings

  const toLocal = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cord.addEventListener("pointerdown", (e) => {
    cord.setPointerCapture(e.pointerId);
    const m = toLocal(e), b = pts[N];
    drag = { gx: b.x - m.x, gy: b.y - m.y, tx: b.x, ty: b.y, x0: e.clientX, y0: e.clientY, moved: 0 };
  });
  cord.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const m = toLocal(e);
    let tx = m.x + drag.gx, ty = m.y + drag.gy;
    const dx = tx - AX, dy = ty, d = Math.hypot(dx, dy), max = L * 1.55;
    if (d > max) { tx = AX + (dx / d) * max; ty = (dy / d) * max; }
    drag.tx = tx; drag.ty = Math.max(ty, 20);
    ext = Math.max(1, Math.min(1.55, Math.hypot(drag.tx - AX, drag.ty) / L));
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
  });
  const release = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if ((ext - 1) * L > 20 || d.moved < 6) toggleTheme();   // pull it, or simply tap it
    if (d.moved < 6) { ext = 1.18; pts[N].px -= 2.5; }
  };
  cord.addEventListener("pointerup", release);
  cord.addEventListener("pointercancel", release);
  cord.addEventListener("click", (e) => { if (e.detail === 0) { toggleTheme(); ext = 1.25; pts[N].px -= 3; } });  // keyboard

  // Loader counter 000 -> 100
  const count = $("#loaderCount"), bar = $("#loaderBar"), loader = $("#loader");
  const start = performance.now(), dur = 1600;
  (function tick(t) {
    const p = Math.min(1, (t - start) / dur);
    const n = Math.round(p * 100);
    count.textContent = String(n).padStart(3, "0");
    bar.style.width = n + "%";
    if (p < 1) return requestAnimationFrame(tick);
    setTimeout(() => {
      loader.classList.add("done");
      document.body.classList.remove("is-loading");
      $$(".reveal").forEach((el) => el.classList.add("in"));
    }, 250);
  })(start);

  // Clock (IST)
  const clock = $("#clock");
  const setClock = () => {
    clock.textContent = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata", hour12: true,
    }).toLowerCase();
  };
  setClock(); setInterval(setClock, 15000);

  // Menu
  const menuBtn = $("#menuBtn"), panel = $("#menuPanel");
  const setMenu = (open) => {
    panel.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
    panel.setAttribute("aria-hidden", !open);
  };
  menuBtn.addEventListener("click", () => setMenu(!panel.classList.contains("open")));
  panel.addEventListener("click", (e) => { if (e.target.tagName === "A") setMenu(false); });

  // Flip-card word rotator
  const words = ["Software Engineer", "Competitive Programmer", "Codeforces Expert", "CodeChef 5★ Coder", "DSA Mentor"];
  const word = $("#flipWord"), page = $(".flip__page");
  let i = 0;
  $("#flipTotal").textContent = String(words.length).padStart(2, "0");
  setInterval(() => {
    i = (i + 1) % words.length;
    page.classList.remove("go"); void page.offsetWidth; page.classList.add("go");
    setTimeout(() => {
      word.textContent = words[i];
      $("#flipIdx").textContent = String(i + 1).padStart(2, "0");
    }, 270);
  }, 2400);

  // Timeline: year counter follows scroll
  const items = $$("#timeline li");
  const year = $("#year"), idx = $("#storyIdx"), sbar = $("#storyBar");
  $("#storyTotal").textContent = String(items.length).padStart(2, "0");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      items.forEach((li) => li.classList.remove("active"));
      e.target.classList.add("active");
      const n = items.indexOf(e.target);
      year.style.opacity = 0;
      setTimeout(() => { year.textContent = e.target.dataset.year; year.style.opacity = 1; }, 150);
      idx.textContent = String(n + 1).padStart(2, "0");
      sbar.style.width = ((n + 1) / items.length) * 100 + "%";
    });
  }, { rootMargin: "-45% 0px -45% 0px" });
  items.forEach((li) => io.observe(li));

  // Doors carousel
  const doorsEl = $("#doors"), doorList = $$(".door"), dots = $("#doorDots");
  const dTitle = $("#doorTitle"), dSub = $("#doorSub");
  let active = 0;
  doorList.forEach((d, n) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-label", "Go to " + d.dataset.title);
    b.addEventListener("click", () => d.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }));
    dots.appendChild(b);
  });
  const setActive = (n) => {
    if (n === active && doorList[n].classList.contains("is-active")) return;
    active = n;
    doorList.forEach((d, i) => d.classList.toggle("is-active", i === n));
    [...dots.children].forEach((b, i) => b.classList.toggle("on", i === n));
    dTitle.style.opacity = dSub.style.opacity = 0;
    setTimeout(() => {
      dTitle.textContent = doorList[n].dataset.title;
      dSub.textContent = doorList[n].dataset.sub;
      dTitle.style.opacity = dSub.style.opacity = 1;
    }, 180);
  };
  const pickCenter = () => {
    const mid = doorsEl.getBoundingClientRect().left + doorsEl.clientWidth / 2;
    let best = 0, bd = Infinity;
    doorList.forEach((d, i) => {
      const r = d.getBoundingClientRect(), dist = Math.abs(r.left + r.width / 2 - mid);
      if (dist < bd) { bd = dist; best = i; }
    });
    setActive(best);
  };
  let raf;
  doorsEl.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(pickCenter); }, { passive: true });
  window.addEventListener("resize", pickCenter);
  pickCenter();

  // "Click to enter" cursor hint
  const hint = $("#enterHint");
  doorList.forEach((d) => {
    d.addEventListener("mousemove", (e) => {
      hint.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 16}px)`;
      hint.classList.toggle("show", d.classList.contains("is-active"));
    });
    d.addEventListener("mouseleave", () => hint.classList.remove("show"));
  });

  // Door detail pages
  const rooms = {
    web: { title: "Web Development", lead: "Websites and web apps built end to end on the MERN stack, from the first sketch to a live, deployed product.", items: [
      { t: "CampusSeekers", d: "India's college discovery and student mentorship platform.", href: "https://campusseekers.vercel.app" },
      { t: "Naya Savera Parivar", d: "Internship, Dec 2023 – Jan 2024. Built their website with React, Node, Express and MongoDB, front end and back end." },
      { t: "This portfolio", d: "Hand-built with plain HTML, CSS and JavaScript." },
    ] },
    dsa: { title: "DSA Platform", lead: "A learning and competitive-programming platform I'm building so developers can practise, compete and get better.", items: [
      { t: "DSA by Adarsh", d: "Learn, practise and compete in one place.", href: "https://dsa-by-adarsh.vercel.app" },
    ] },
    cp: { title: "Competitive Programming", lead: "Solving hard problems fast, and ranking among the best in the world while doing it.", items: [
      { t: "Codeforces", d: "Expert, with 2500+ problems solved." },
      { t: "CodeChef", d: "5★ coder. Global rank 36 of 30,000, and Div 2 global rank 27." },
      { t: "TCS CodeVita", d: "Global rank 316 of 450,000." },
      { t: "Hackathon", d: "Winner, with the Ledger Book App." },
    ] },
    edu: { title: "Education", lead: "Teaching data structures, algorithms and problem solving, and making developers better.", items: [
      { t: "Newton School of Technology", d: "SDE 1 since Jul 2025. Mentoring students in DSA, from arrays and recursion to trees, and reviewing their code for time and space complexity." },
      { t: "Quantum University, Roorkee", d: "B.Tech in Computer Science, 2021 – 2025, CGPA 8.7." },
    ] },
  };
  const room = $("#room"), rTitle = $("#roomTitle"), rLead = $("#roomLead"), rList = $("#roomList");
  let openDoor = null;
  const fill = (r) => {
    rTitle.textContent = r.title; rLead.textContent = r.lead; rList.textContent = "";
    r.items.forEach((it) => {
      const el = document.createElement(it.href ? "a" : "div");
      el.className = "room__item";
      if (it.href) { el.href = it.href; el.target = "_blank"; el.rel = "noopener"; }
      const b = document.createElement("b"); b.textContent = it.t;
      const s = document.createElement("span"); s.textContent = it.d;
      el.append(b, s);
      if (it.href) { const e = document.createElement("em"); e.textContent = "Visit ↗"; el.append(e); }
      rList.appendChild(el);
    });
  };
  let portal = null, portalTimers = [];
  const clearTimers = () => { portalTimers.forEach(clearTimeout); portalTimers = []; };
  const closeRoom = () => {
    clearTimers();
    room.classList.remove("open"); room.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    const d = openDoor, p = portal; openDoor = null; portal = null;
    if (p) { p.classList.add("gone"); setTimeout(() => p.remove(), 600); }
    if (d) { d.style.visibility = ""; d.focus({ preventScroll: true }); }
  };
  doorList.forEach((d) => d.addEventListener("click", () => {
    if (openDoor) return;
    if (!d.classList.contains("is-active")) return d.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    openDoor = d; hint.classList.remove("show");
    fill(rooms[d.dataset.id]);

    // Clone the door into a fixed layer so the carousel can't clip the zoom
    const frame = d.querySelector(".door__frame"), r = frame.getBoundingClientRect();
    portal = frame.cloneNode(true);
    portal.classList.add("portal");
    portal.style.setProperty("--c", d.style.getPropertyValue("--c"));
    portal.style.setProperty("--c2", d.style.getPropertyValue("--c2"));
    Object.assign(portal.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    document.body.appendChild(portal);
    d.style.visibility = "hidden";

    // Travel through the doorway: centre the lower part of the door on screen and scale up past the viewport
    const s = Math.max(innerWidth / r.width, innerHeight / r.height) * 2.2;
    portal.style.transformOrigin = "50% 65%";
    portal.style.setProperty("--s", s.toFixed(2));
    portal.style.setProperty("--dx", innerWidth / 2 - (r.left + r.width / 2) + "px");
    portal.style.setProperty("--dy", innerHeight / 2 - (r.top + r.height * 0.65) + "px");

    const fast = matchMedia("(prefers-reduced-motion:reduce)").matches;
    requestAnimationFrame(() => requestAnimationFrame(() => portal && portal.classList.add("swing")));
    portalTimers.push(setTimeout(() => portal && portal.classList.add("zoom"), fast ? 0 : 850));
    portalTimers.push(setTimeout(() => {
      room.classList.add("open"); room.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden"; room.scrollTop = 0; $("#roomBack").focus({ preventScroll: true });
    }, fast ? 0 : 1650));
  }));
  $("#roomBack").addEventListener("click", closeRoom);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && room.classList.contains("open")) closeRoom(); });

  // Portrait parallax + ability card button
  const portrait = $("#portrait");
  if (portrait && matchMedia("(hover:hover)").matches) {
    window.addEventListener("mousemove", (e) => {
      portrait.style.setProperty("--mx", (e.clientX / innerWidth - 0.5).toFixed(3));
      portrait.style.setProperty("--my", (e.clientY / innerHeight - 0.5).toFixed(3));
    });
  }
  $("#abilityBtn")?.addEventListener("click", () => $("#work").scrollIntoView({ behavior: "smooth" }));

  $("#yr").textContent = new Date().getFullYear();
})();
