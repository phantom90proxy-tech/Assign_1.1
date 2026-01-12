document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audio-player");
  const imageBox = document.querySelector(".image-box");
  const coverWrap = document.querySelector(".cover-wrap");
  const cover = document.querySelector(".cover-wrap img");
  const titleEl = document.querySelector(".song-title");
  const artistEl = document.querySelector(".track-info .artist");
  const playlistItems = document.querySelectorAll(".playlist-item");
  const landingWrapper = document.querySelector(".landing-wrapper");

  let bgContainer = null;
  let bgCircles = [];

  if (!audio) return;

  function updatePlayUI(isPlaying) {
    if (coverWrap)
      coverWrap.style.animationPlayState = isPlaying ? "running" : "paused";
  }

  audio.addEventListener("play", () => {
    if (imageBox) imageBox.classList.add("visible");
    if (!audioCtx) {
      initAudioAnalysis();
    } else if (!rafId) {
      drawLoop();
    }
    updatePlayUI(true);
  });
  audio.addEventListener("pause", () => updatePlayUI(false));
  audio.addEventListener("ended", () => {
    if (imageBox) imageBox.classList.remove("visible");
    updatePlayUI(false);
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  playlistItems.forEach((li) => {
    const btn = li.querySelector(".play-track");
    const src = li.dataset.src;
    const colorAttr = (li.dataset.color || "").trim();
    btn &&
      btn.addEventListener("click", () => {
        if (!src) return console.warn("No data-src on playlist item");
        const currentlySame = audio.src && audio.src.endsWith(src);
        if (!currentlySame) {
          audio.src = src;
          audio.load();
          const t = li.querySelector(".title")?.textContent;
          const a = li.querySelector(".artist")?.textContent;
          const img = li.querySelector("img")?.src;
          if (titleEl && t) titleEl.textContent = t;
          if (artistEl && a) artistEl.textContent = a;
          if (cover && img) cover.src = img;
        }

        let accentColors = ["#bca8e2"];
        if (colorAttr) {
          accentColors = colorAttr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }

        const accent1 = accentColors[0] || "#bca8e2";
        const accent2 = accentColors[1] || accent1;

        if (coverWrap) {
          coverWrap.style.setProperty("--accent", accent1);
          coverWrap.dataset._accent1 = accent1;
          coverWrap.dataset._accent2 = accent2;
        }

        if (imageBox) imageBox.classList.add("visible");
        audio.play();
      });
  });

  let audioCtx, analyser, sourceNode, freqData, timeData;
  let canvas, ctx, rafId;
  let lastBeat = 0;
  let beatIndex = 0;

  function createBeatCircles(count = 5) {
    if (!coverWrap) return;
    const existing = coverWrap.querySelectorAll(".beat-circle");
    if (existing.length >= count) return;

    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "beat-circle";
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const radiusPct = 42;
      const x = 50 + Math.cos(angle) * radiusPct;
      const y = 50 + Math.sin(angle) * radiusPct;
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
      coverWrap.appendChild(el);
    }
  }

  function animateBeatCircle() {
    if (!coverWrap) return;
    const circles = coverWrap.querySelectorAll(".beat-circle");
    if (!circles.length) return;
    const el = circles[beatIndex % circles.length];
    beatIndex++;
    const accent =
      coverWrap.dataset._accent1 ||
      getComputedStyle(coverWrap).getPropertyValue("--accent") ||
      "#bca8e2";
    el.style.background = accent;
    el.style.boxShadow = `0 10px 28px ${accent}55, 0 2px 6px ${accent}33`;
    el.classList.add("active");
    setTimeout(() => {
      el.classList.remove("active");
      el.style.boxShadow = "";
    }, 160);
  }

  function createCanvasOverlay() {
    if (!coverWrap) return;
    canvas =
      coverWrap.querySelector(".wave-canvas") ||
      document.createElement("canvas");
    canvas.className = "wave-canvas";
    if (!canvas.parentElement) coverWrap.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    createBeatCircles(5);
  }

  function resizeCanvas() {
    if (!canvas || !coverWrap) return;
    const rect = coverWrap.getBoundingClientRect();
    const coverSize = Math.max(rect.width, rect.height);

    const mobile = window.innerWidth <= 900;
    const multiplier = mobile ? 1.05 : 1.35;

    const maxAllowed = Math.min(
      window.innerWidth * 0.78,
      window.innerHeight * 0.68
    );

    const size = Math.min(coverSize * multiplier, maxAllowed);

    canvas.width = Math.round(size * devicePixelRatio);
    canvas.height = Math.round(size * devicePixelRatio);
    canvas.style.width = `${Math.round(size)}px`;
    canvas.style.height = `${Math.round(size)}px`;

    if (ctx) ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function initAudioAnalysis() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    const bufferLength = analyser.frequencyBinCount;
    freqData = new Uint8Array(bufferLength);
    timeData = new Uint8Array(bufferLength);
    createCanvasOverlay();
    if (audioCtx.state === "suspended") audioCtx.resume();
    drawLoop();
  }

  function drawLoop() {
    if (!analyser || !ctx || !canvas) return;
    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    ctx.clearRect(
      0,
      0,
      canvas.width / devicePixelRatio,
      canvas.height / devicePixelRatio
    );

    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    const cx = w / 2;
    const cy = h / 2;

    const accent1 =
      coverWrap && coverWrap.dataset._accent1
        ? coverWrap.dataset._accent1
        : getComputedStyle(coverWrap).getPropertyValue("--accent") || "#bca8e2";
    const accent2 =
      coverWrap && coverWrap.dataset._accent2
        ? coverWrap.dataset._accent2
        : accent1;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.5, accent1);
    grad.addColorStop(1, accent2);

    ctx.strokeStyle = grad;

    const coverRect = cover.getBoundingClientRect();
    const coverRadius = Math.max(coverRect.width, coverRect.height) / 2;
    const ringInner = coverRadius * 0.98;
    const ringMax = Math.min(cx, cy) - 8;
    const bars = 110;
    const step = Math.max(1, Math.floor(freqData.length / bars));
    ctx.lineCap = "round";

    for (let i = 0; i < bars; i++) {
      const dataIndex = i * step;
      const value = (freqData[dataIndex] || 0) / 255;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const innerR = ringInner;
      const outerR = innerR + (ringMax - innerR) * value;
      const ix = cx + Math.cos(angle) * innerR;
      const iy = cy + Math.sin(angle) * innerR;
      const ox = cx + Math.cos(angle) * outerR;
      const oy = cy + Math.sin(angle) * outerR;

      ctx.lineWidth = Math.max(1.2, 1.6 * value * devicePixelRatio);
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ox, oy);
      ctx.stroke();
    }

    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length);
    const now = performance.now();
    if (rms > 0.12 && now - lastBeat > 160) {
      lastBeat = now;

      if (coverWrap) {
        coverWrap.classList.add("pop");

        coverWrap.style.boxShadow = `0 18px 48px ${accent1}33`;
        setTimeout(() => {
          if (coverWrap) {
            coverWrap.classList.remove("pop");
            coverWrap.style.boxShadow = "";
          }
        }, 140);
      }

      animateBeatCircle();
      pulseBgOnBeat(4);
    }

    rafId = requestAnimationFrame(drawLoop);
  }

  audio.addEventListener("play", () => {
    if (!audioCtx) initAudioAnalysis();
  });

  audio.addEventListener("pause", () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });
  audio.addEventListener("ended", () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (cover) cover.style.transform = "";
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  function createBgCircles(count = 12) {
    if (!landingWrapper) return;
    if (!bgContainer) {
      bgContainer = document.createElement("div");
      bgContainer.className = "bg-circles";
      document.body.insertBefore(bgContainer, landingWrapper);
    }
    const needed = Math.max(0, count - bgCircles.length);
    for (let i = 0; i < needed; i++) {
      const el = document.createElement("div");
      el.className = "bg-circle";
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const sizeClass =
        Math.random() < 0.33
          ? "size-sm"
          : Math.random() < 0.6
          ? "size-md"
          : "size-lg";
      el.classList.add(sizeClass);
      el.style.left = `${left}%`;
      el.style.top = `${top}%`;
      bgContainer.appendChild(el);
      bgCircles.push(el);
    }
  }

  function setBgCirclesColor(color) {
    if (!bgCircles.length) return;
    bgCircles.forEach((el) => {
      el.style.setProperty("--color", color);
      el.style.borderColor = color;
      el.style.boxShadow = `0 0 22px ${color}55`;
    });
  }

  function pulseBgOnBeat(count = 3) {
    if (!bgCircles.length) return;

    const picked = new Set();
    while (picked.size < Math.min(count, bgCircles.length)) {
      picked.add(Math.floor(Math.random() * bgCircles.length));
    }
    picked.forEach((i) => {
      const el = bgCircles[i];
      el.classList.add("pulse");
      setTimeout(() => el.classList.remove("pulse"), 260 + Math.random() * 220);
    });
  }

  createBgCircles(12);

  playlistItems.forEach((li) => {
    const btn = li.querySelector(".play-track");
    const colorAttr = (li.dataset.color || "").trim();
    btn &&
      btn.addEventListener("click", () => {
        let accentColors = ["#bca8e2"];
        if (colorAttr)
          accentColors = colorAttr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const accent1 = accentColors[0] || "#bca8e2";
        const glowColor = accent1;
        setBgCirclesColor(glowColor);
      });
  });
});
