"use client";

import { useEffect, useRef } from "react";

type Dot = { alpha: number; cluster: Cluster | null; color: "orange" | "white"; nextChange: number; startsAt: number; target: number; x: number; y: number };
type Cluster = { nextDestination: number; nextStep: number; radius: number; targetX: number; targetY: number; x: number; y: number };
type FeedingZone = { endsAt: number; nextAt: number; x: number; y: number };
type Frenzy = { dots: Dot[]; endsAt: number; nextAt: number };
type Defense = Frenzy;

const COLORS = { orange: "249, 115, 22", white: "255, 255, 255" } as const;
const CELL = 7;

export function LoginDotField() {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const staticCanvas = staticCanvasRef.current;
    const activeCanvas = activeCanvasRef.current;
    const borderCanvas = borderCanvasRef.current;
    if (!staticCanvas || !activeCanvas || !borderCanvas) return;
    const staticCanvasNode = staticCanvas;
    const activeCanvasNode = activeCanvas;
    const borderCanvasNode = borderCanvas;
    const canvasLayer = staticCanvasNode.parentElement;
    const hostElement = canvasLayer?.parentElement;
    if (!hostElement) return;
    const host = hostElement;
    const staticContextElement = staticCanvasNode.getContext("2d");
    const activeContextElement = activeCanvasNode.getContext("2d");
    const borderContextElement = borderCanvasNode.getContext("2d");
    if (!staticContextElement || !activeContextElement || !borderContextElement) return;
    const staticContext = staticContextElement;
    const activeContext = activeContextElement;
    const borderContext = borderContextElement;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dots: Dot[] = [];
    let frameId = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let clusters: Cluster[] = [];
    let feedingZone: FeedingZone = { x: 0, y: 0, endsAt: 0, nextAt: 0 };
    let frenzy: Frenzy = { dots: [], endsAt: 0, nextAt: 0 };
    let borderFrenzy: Frenzy = { dots: [], endsAt: 0, nextAt: 0 };
    let defense: Defense = { dots: [], endsAt: 0, nextAt: 0 };
    let lastActivity = performance.now();

    const snap = (value: number) => Math.round(value / CELL) * CELL;
    const constrain = (value: number, max: number) => Math.max(0, Math.min(max - 2, value));
    function isNearPanel(x: number, y: number, padding = 0) {
      const panel = host.querySelector<HTMLElement>("[data-login-panel]");
      if (!panel) return false;
      const panelBox = panel.getBoundingClientRect(); const hostBox = host.getBoundingClientRect();
      const left = panelBox.left - hostBox.left - padding; const top = panelBox.top - hostBox.top - padding;
      const right = panelBox.right - hostBox.left + padding; const bottom = panelBox.bottom - hostBox.top + padding;
      return x >= left && x <= right && y >= top && y <= bottom;
    }
    function resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
    function setup() {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      resizeCanvas(staticCanvasNode, staticContext);
      resizeCanvas(activeCanvasNode, activeContext);
      resizeCanvas(borderCanvasNode, borderContext);
      const columns = Math.ceil(width / CELL);
      const rows = Math.ceil(height / CELL);
      staticContext.clearRect(0, 0, width, height);
      for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
        if (Math.random() <= 0.14) {
          staticContext.fillStyle = `rgba(${COLORS.orange}, ${0.03 + Math.random() * 0.09})`;
          staticContext.fillRect(column * CELL, row * CELL, 1, 1);
        }
      }
      dots.length = 0;
      const activeCount = Math.min(1400, Math.max(280, Math.floor(columns * rows * 0.072)));
      const now = performance.now();
      clusters = Array.from({ length: Math.min(22, Math.max(11, Math.round((width * height) / 70000))) }, () => ({ x: 0, y: 0, radius: 22 + Math.random() * 58, targetX: 0, targetY: 0, nextDestination: 0, nextStep: 0 }));
      for (const cluster of clusters) {
        cluster.x = snap(Math.random() * width); cluster.y = snap(Math.random() * height);
        cluster.targetX = cluster.x; cluster.targetY = cluster.y;
        cluster.nextDestination = now + 1200 + Math.random() * 3200;
        cluster.nextStep = now + 80 + Math.random() * 180;
      }
      feedingZone = { x: width / 2, y: height / 2, endsAt: 0, nextAt: now + 5000 + Math.random() * 6000 };
      frenzy = { dots: [], endsAt: 0, nextAt: now + 4200 + Math.random() * 7800 };
      borderFrenzy = { dots: [], endsAt: 0, nextAt: 0 };
      defense = { dots: [], endsAt: 0, nextAt: now + 3800 + Math.random() * 4200 };
      for (let index = 0; index < activeCount; index += 1) {
        const cluster = clusters[Math.floor(Math.random() * clusters.length)];
        const inCluster = Math.random() < 0.88;
        const angle = Math.random() * Math.PI * 2;
        const distance = inCluster ? cluster.radius * Math.pow(Math.random(), 1.75) : Math.random() * Math.max(width, height);
        dots.push({ x: inCluster ? Math.max(-cluster.radius, Math.min(cluster.radius, snap(Math.cos(angle) * distance))) : constrain(snap(Math.random() * width), width), y: inCluster ? Math.max(-cluster.radius, Math.min(cluster.radius, snap(Math.sin(angle) * distance))) : constrain(snap(Math.random() * height), height), cluster: inCluster ? cluster : null, color: "orange", alpha: Math.random() * 0.24, startsAt: 0, target: Math.random() > 0.38 ? 0.24 + Math.random() * 0.62 : 0, nextChange: now + (inCluster ? 150 : 900) + Math.random() * (inCluster ? 2800 : 5000) });
      }
    }
    function moveClusters(now: number) {
      if (now >= feedingZone.nextAt) {
        const favorRight = Math.random() > 0.5;
        feedingZone = { x: snap(width * (favorRight ? 0.7 + Math.random() * 0.2 : 0.1 + Math.random() * 0.2)), y: snap(height * (0.18 + Math.random() * 0.64)), endsAt: now + 4200 + Math.random() * 5600, nextAt: now + 14500 + Math.random() * 10500 };
      }
      const feeding = now < feedingZone.endsAt;
      for (const cluster of clusters) {
        if (feeding) { cluster.targetX = feedingZone.x; cluster.targetY = feedingZone.y; }
        else if (now >= cluster.nextDestination) {
          cluster.targetX = snap(Math.max(0, Math.min(width, cluster.x + (Math.random() - 0.5) * 260)));
          cluster.targetY = snap(Math.max(0, Math.min(height, cluster.y + (Math.random() - 0.5) * 260)));
          cluster.nextDestination = now + 1600 + Math.random() * 4200;
        }
        if (now >= cluster.nextStep) {
          const dx = cluster.targetX - cluster.x; const dy = cluster.targetY - cluster.y;
          if (dx || dy) { if (Math.abs(dx) && (!Math.abs(dy) || Math.random() < 0.58)) cluster.x += Math.sign(dx) * CELL; else cluster.y += Math.sign(dy) * CELL; }
          cluster.x = Math.max(-cluster.radius, Math.min(width + cluster.radius, cluster.x));
          cluster.y = Math.max(-cluster.radius, Math.min(height + cluster.radius, cluster.y));
          cluster.nextStep = now + 90 + Math.random() * 160;
        }
      }
      return feeding;
    }
    function startFrenzy(now: number) {
      const isLarge = Math.random() < 0.18;
      const outsideClusters = clusters.filter((candidate) => !isNearPanel(candidate.x, candidate.y, 130));
      const cluster = (outsideClusters.length ? outsideClusters : clusters)[Math.floor(Math.random() * (outsideClusters.length || clusters.length))];
      const coverage = Math.random() < 0.34 ? 0.5 : 0.25;
      const multiplier = Math.random() > 0.7 ? 20 : 10;
      const count = isLarge ? (coverage === 0.5 ? 5000 : 2800) : multiplier === 20 ? 1800 : 800;
      const duration = isLarge ? 3000 + Math.random() * 2800 : multiplier === 20 ? 3200 + Math.random() * 1800 : 950 + Math.random() * 2200;
      const originX = cluster.x; const originY = cluster.y;
      const burstRadius = isLarge ? Math.min(width, height) * (coverage === 0.5 ? 0.46 : 0.3) : cluster.radius * 1.2;
      const spreadX = burstRadius; const spreadY = burstRadius;
      const endsAt = now + duration;
      const frenzyDots: Dot[] = [];
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const shell = Math.pow(Math.random(), 1.85);
        const x = snap(originX + Math.cos(angle) * spreadX * shell);
        const y = snap(originY + Math.sin(angle) * spreadY * shell);
        if (isLarge && (x < 0 || x >= width || y < 0 || y >= height || isNearPanel(x, y, 48))) continue;
        frenzyDots.push({ cluster: isLarge ? null : cluster, x: isLarge ? x : snap(Math.cos(angle) * spreadX * shell), y: isLarge ? y : snap(Math.sin(angle) * spreadY * shell), color: "orange", alpha: 0, startsAt: now + shell * duration * 0.58 + Math.random() * 90, target: 0.26 + Math.random() * 0.68, nextChange: endsAt });
      }
      frenzy = { dots: frenzyDots, endsAt, nextAt: endsAt + 5200 + Math.random() * 11800 };
    }
    function startChainReaction(now: number) {
      const outsideClusters = clusters.filter((candidate) => !isNearPanel(candidate.x, candidate.y, 130));
      const cluster = (outsideClusters.length ? outsideClusters : clusters)[Math.floor(Math.random() * (outsideClusters.length || clusters.length))];
      const endsAt = now + 1500 + Math.random() * 2200;
      const chainDots: Dot[] = [];
      const originX = cluster.x; const originY = cluster.y;
      for (let index = 0; index < 2400; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const shell = Math.pow(Math.random(), 1.48);
        const distance = (cluster.radius * 4.2 + Math.random() * 90) * shell;
        const x = snap(originX + Math.cos(angle) * distance); const y = snap(originY + Math.sin(angle) * distance);
        if (x < 0 || x >= width || y < 0 || y >= height || isNearPanel(x, y, 48)) continue;
        chainDots.push({ cluster: null, x, y, color: "orange", alpha: 0, startsAt: now + shell * 1180 + Math.random() * 110, target: 0.34 + Math.random() * 0.62, nextChange: endsAt });
      }
      frenzy = { dots: chainDots, endsAt, nextAt: endsAt + 3200 + Math.random() * 7600 };
    }
    function startDefense(now: number) {
      const panel = host.querySelector<HTMLElement>("[data-login-panel]");
      if (!panel || !clusters.length) return;
      const panelBox = panel.getBoundingClientRect(); const hostBox = host.getBoundingClientRect();
      const left = panelBox.left - hostBox.left; const top = panelBox.top - hostBox.top;
      const panelWidth = panelBox.width; const panelHeight = panelBox.height;
      const centerX = left + panelWidth / 2; const centerY = top + panelHeight / 2;
      const outwardClusters = clusters.filter((cluster) => Math.hypot(cluster.x - centerX, cluster.y - centerY) > Math.max(panelWidth, panelHeight) * 0.42);
      const targetCluster = (outwardClusters.length ? outwardClusters : clusters)[Math.floor(Math.random() * (outwardClusters.length || clusters.length))];
      let sourceX = centerX; let sourceY = centerY;
      if (Math.abs(targetCluster.x - centerX) > Math.abs(targetCluster.y - centerY)) {
        sourceX = targetCluster.x > centerX ? left + panelWidth - CELL * 2 : left + CELL * 2;
        sourceY = centerY + (Math.random() - 0.5) * panelHeight * 0.24;
      } else {
        sourceX = centerX + (Math.random() - 0.5) * panelWidth * 0.24;
        sourceY = targetCluster.y > centerY ? top + panelHeight - CELL * 2 : top + CELL * 2;
      }
      sourceX = snap(sourceX); sourceY = snap(sourceY);
      const outwardDuration = 1450 + Math.random() * 850;
      const retreatAt = now + outwardDuration + 750 + Math.random() * 500;
      const endsAt = retreatAt + 1650;
      const defenseDots: Dot[] = [];
      for (let path = 0; path < 6; path += 1) {
        const angle = Math.random() * Math.PI * 2;
        const reach = targetCluster.radius * (0.45 + Math.random() * 0.8);
        const targetX = targetCluster.x + Math.cos(angle) * reach;
        const targetY = targetCluster.y + Math.sin(angle) * reach;
        const segments = 6 + Math.floor(Math.random() * 5);
        for (let step = 0; step <= segments; step += 1) {
          const progress = step / segments;
          defenseDots.push({ cluster: null, x: constrain(snap(sourceX + (targetX - sourceX) * progress), width), y: constrain(snap(sourceY + (targetY - sourceY) * progress), height), color: "white", alpha: 0, startsAt: now + progress * outwardDuration + Math.random() * 80, target: 0.34 + Math.random() * 0.3, nextChange: retreatAt + (1 - progress) * 1450 + Math.random() * 70 });
        }
      }
      defense = { dots: defenseDots, endsAt, nextAt: endsAt + 2800 + Math.random() * 5200 };
    }
    function startBorderBattle(now: number) {
      const panel = host.querySelector<HTMLElement>("[data-login-panel]");
      if (!panel) return;
      const panelBox = panel.getBoundingClientRect(); const hostBox = host.getBoundingClientRect();
      const left = snap(panelBox.left - hostBox.left); const top = snap(panelBox.top - hostBox.top); const right = snap(panelBox.right - hostBox.left); const bottom = snap(panelBox.bottom - hostBox.top);
      const count = Math.min(1750, Math.max(760, Math.round(((right - left) + (bottom - top)) * 1.5)));
      const duration = 5200 + Math.random() * 2600;
      const battleDots: Dot[] = [];
      for (let index = 0; index < count; index += 1) {
        const along = Math.random(); const edge = Math.floor(Math.random() * 4); const depth = Math.floor(Math.pow(Math.random(), 1.7) * 7) * CELL;
        let x = left; let y = top;
        if (edge === 0) { x = snap(left + (right - left) * along); y = top - depth; }
        if (edge === 1) { x = right + depth; y = snap(top + (bottom - top) * along); }
        if (edge === 2) { x = snap(left + (right - left) * along); y = bottom + depth; }
        if (edge === 3) { x = left - depth; y = snap(top + (bottom - top) * along); }
        const wave = Math.min(1, Math.abs(x - (left + right) / 2) / Math.max(1, right - left) + Math.abs(y - (top + bottom) / 2) / Math.max(1, bottom - top));
        battleDots.push({ cluster: null, x: constrain(x, width), y: constrain(y, height), color: "orange", alpha: 0, startsAt: now + wave * 1200 + Math.random() * 450, target: 0.48 + Math.random() * 0.42, nextChange: now + duration });
      }
      borderFrenzy = { dots: battleDots, endsAt: now + duration, nextAt: now + duration + 4600 + Math.random() * 7000 };
    }
    function drawDot(context: CanvasRenderingContext2D, dot: Dot, alpha: number) {
      if (alpha < 0.015) return;
      const x = dot.cluster ? dot.cluster.x + dot.x : dot.x; const y = dot.cluster ? dot.cluster.y + dot.y : dot.y;
      context.fillStyle = `rgba(${COLORS[dot.color]}, ${Math.min(1, alpha)})`;
      context.fillRect(x, y, 1.25, 1.25);
    }
    function fadeDots(context: CanvasRenderingContext2D, effect: Frenzy, now: number) {
      const fading = now >= effect.endsAt;
      for (const dot of effect.dots) { if (now < dot.startsAt) continue; if (fading) dot.target = 0; dot.alpha += (dot.target - dot.alpha) * 0.075; drawDot(context, dot, dot.alpha); }
      if (fading && effect.dots.every((dot) => dot.alpha < 0.015)) effect.dots = [];
    }
    function drawDefense(now: number) {
      for (const dot of defense.dots) {
        if (now < dot.startsAt) continue;
        if (now >= dot.nextChange) dot.target = 0;
        dot.alpha += (dot.target - dot.alpha) * 0.085;
        drawDot(activeContext, dot, dot.alpha);
      }
      if (now >= defense.endsAt && defense.dots.every((dot) => dot.alpha < 0.015)) defense.dots = [];
    }
    function draw(now: number) {
      activeContext.clearRect(0, 0, width, height); borderContext.clearRect(0, 0, width, height);
      const feeding = moveClusters(now);
      for (const dot of dots) {
        if (now >= dot.nextChange) { dot.target = Math.random() > 0.48 ? 0.2 + Math.random() * 0.65 : 0; dot.nextChange = now + 280 + Math.random() * 4600; }
        dot.alpha += (dot.target - dot.alpha) * 0.045;
        drawDot(activeContext, dot, dot.cluster && feeding ? Math.min(1, dot.alpha * 1.24) : dot.alpha);
      }
      if (!frenzy.dots.length && now >= frenzy.nextAt) {
        if (Math.random() < 0.4) startChainReaction(now);
        else startFrenzy(now);
      }
      fadeDots(activeContext, frenzy, now);
      if (!defense.dots.length && now >= defense.nextAt) startDefense(now);
      drawDefense(now);
      if (now - lastActivity >= 30000 && !borderFrenzy.dots.length && now >= borderFrenzy.nextAt) startBorderBattle(now);
      fadeDots(borderContext, borderFrenzy, now);
      frameId = window.requestAnimationFrame(draw);
    }
    const resetIdle = () => { lastActivity = performance.now(); borderFrenzy.dots = []; borderFrenzy.nextAt = 0; };
    setup();
    if (!reduceMotion) frameId = window.requestAnimationFrame(draw);
    const observer = new ResizeObserver(setup); observer.observe(host);
    host.addEventListener("pointerdown", resetIdle); host.addEventListener("keydown", resetIdle); host.addEventListener("input", resetIdle); host.addEventListener("touchstart", resetIdle, { passive: true });
    return () => { observer.disconnect(); window.cancelAnimationFrame(frameId); host.removeEventListener("pointerdown", resetIdle); host.removeEventListener("keydown", resetIdle); host.removeEventListener("input", resetIdle); host.removeEventListener("touchstart", resetIdle); };
  }, []);

  return <><div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden"><canvas ref={staticCanvasRef} className="absolute inset-0 opacity-70"/><canvas ref={activeCanvasRef} className="absolute inset-0"/></div><canvas ref={borderCanvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0"/></>;
}
