// render.js — everything the eye sees: the night glade, the lantern, the
// keeper and her echoes, the gloom, the HUD, and every screen.
// One small job: turn world state into pixels, loudly and readably.

import { UPGRADES, priceOf, derivedStats } from './upgrades.js';
import { TITLE_LAYOUT, SHOP_LAYOUT, END_LAYOUT, victorySummary, defeatSummary } from './screens.js';
import { DIFFICULTIES } from './world.js';

const W = 1280, H = 720;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  function text(str, x, y, size, color, align = 'center', bold = true) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px Georgia, serif';
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function bar(x, y, w, h, frac, back, fill) {
    ctx.fillStyle = back; rr(x, y, w, h, h / 2); ctx.fill();
    if (frac > 0) { ctx.fillStyle = fill; rr(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2); ctx.fill(); }
  }

  function drawGlade(w) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1128'); g.addColorStop(0.55, '#0d1a2e'); g.addColorStop(1, '#08130f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // three parallax star layers, twinkling off the world tick
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 42; i++) {
        const sx = ((i * 197 + layer * 331) % 1280), sy = ((i * 89 + layer * 57) % 400);
        const tw = 0.35 + 0.3 * Math.sin(w.tick * 0.03 + i * 1.7 + layer);
        ctx.globalAlpha = Math.max(0.08, tw) * (0.5 + layer * 0.25);
        ctx.fillStyle = '#cfe8ff';
        ctx.fillRect(sx, sy, layer + 1, layer + 1);
      }
    }
    ctx.globalAlpha = 1;
    // grass tufts and stones, fixed by a simple hash so the glade is one place
    ctx.strokeStyle = 'rgba(70,140,90,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      const gx = (i * 211) % 1260 + 10, gy = 420 + ((i * 137) % 280);
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 3, gy - 9); ctx.moveTo(gx, gy); ctx.lineTo(gx + 3, gy - 11); ctx.stroke();
    }
    // fireflies drifting on slow sine paths
    for (let i = 0; i < 14; i++) {
      const fx = 640 + Math.sin(w.tick * 0.008 + i * 2.4) * (240 + i * 31);
      const fy = 360 + Math.cos(w.tick * 0.011 + i * 1.9) * (150 + i * 12);
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(w.tick * 0.09 + i);
      ctx.fillStyle = '#ffe98a';
      ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // the lantern's light pool, shrinking as the lantern fades
    const frac = w.lantern.hp / w.lantern.maxHp;
    const rad = 150 + frac * 190 + Math.sin(w.tick * 0.05) * 6;
    const lg = ctx.createRadialGradient(640, 360, 10, 640, 360, rad);
    lg.addColorStop(0, 'rgba(255,214,110,0.34)'); lg.addColorStop(0.6, 'rgba(255,180,80,0.12)'); lg.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  }

  function drawLantern(w) {
    const L = w.lantern, frac = L.hp / L.maxHp;
    ctx.fillStyle = '#3a2c1c'; ctx.fillRect(L.x - 5, L.y + 6, 10, 54); // post
    ctx.fillStyle = '#59452a'; rr(L.x - 20, L.y - 30, 40, 42, 7); ctx.fill();
    const flick = 0.85 + 0.15 * Math.sin(w.tick * 0.3) * Math.sin(w.tick * 0.13);
    const fg = ctx.createRadialGradient(L.x, L.y - 8, 2, L.x, L.y - 8, 26);
    fg.addColorStop(0, `rgba(255,246,200,${0.95 * flick})`); fg.addColorStop(0.5, `rgba(255,196,80,${0.8 * frac * flick})`); fg.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(L.x, L.y - 8, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(L.x, L.y - 8, 6 + 2 * flick, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a6d3f'; ctx.lineWidth = 3; rr(L.x - 20, L.y - 30, 40, 42, 7); ctx.stroke();
  }

  function drawKeeperFigure(x, y, aim, face, invuln, tick, ghostHue) {
    const ghost = ghostHue !== undefined;
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.55;
    if (invuln && Math.floor(tick / 3) % 2 === 0) ctx.globalAlpha = 0.45;
    const body = ghost ? `hsl(${ghostHue} 80% 62%)` : '#3fd0c9';
    ctx.fillStyle = ghost ? `hsl(${ghostHue} 70% 45%)` : '#1d7a74';
    ctx.beginPath(); ctx.moveTo(x, y - 16);
    ctx.quadraticCurveTo(x + 15, y + 4, x + 11, y + 16);
    ctx.lineTo(x - 11, y + 16);
    ctx.quadraticCurveTo(x - 15, y + 4, x, y - 16);
    ctx.fill();
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y - 8, 9, 0, 7); ctx.fill(); // hood
    ctx.fillStyle = '#0b1526'; ctx.beginPath(); ctx.arc(x + face * 2.5, y - 7, 5.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(x + face * 4.4, y - 8, 1.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + face * 1.2, y - 8, 1.5, 0, 7); ctx.fill();
    // staff points the aim
    ctx.strokeStyle = ghost ? `hsl(${ghostHue} 85% 70%)` : '#ffd75c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y + 2);
    ctx.lineTo(x + Math.cos(aim) * 24, y + Math.sin(aim) * 24); ctx.stroke();
    ctx.fillStyle = ghost ? `hsl(${ghostHue} 90% 75%)` : '#ffe98a';
    ctx.beginPath(); ctx.arc(x + Math.cos(aim) * 26, y + Math.sin(aim) * 26, 3.6, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawEcho(w, e) {
    // a faint dotted loop trail so the choreography is visible at a glance
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = `hsl(${e.hue} 85% 65%)`;
    for (let i = 0; i < e.frames.length; i += 24) {
      const f = e.frames[i];
      ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, 7); ctx.fill();
    }
    ctx.restore();
    drawKeeperFigure(e.x, e.y, e.aim, Math.cos(e.aim) >= 0 ? 1 : -1, false, w.tick, e.hue);
  }

  function drawEnemy(w, e) {
    ctx.save();
    if (e.flash > 0) ctx.globalAlpha = 0.95;
    const body = e.flash > 0 ? '#ffffff' : e.color;
    ctx.translate(e.x, e.y);
    if (e.kind === 'moth' || e.kind === 'boss') {
      const flap = Math.sin(w.tick * 0.4 + e.id) * 0.5;
      ctx.fillStyle = body; ctx.globalAlpha *= 0.85;
      ctx.beginPath(); ctx.ellipse(-e.radius * 0.9, -4, e.radius * 0.75, e.radius * 0.36, -0.5 - flap * 0.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(e.radius * 0.9, -4, e.radius * 0.75, e.radius * 0.36, 0.5 + flap * 0.3, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(6,8,18,0.85)';
    if (e.kind === 'shade' && e.state === 'windup') { ctx.fillStyle = '#ff5470'; }
    ctx.beginPath(); ctx.arc(-e.radius * 0.34, -e.radius * 0.16, e.radius * 0.16, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(e.radius * 0.34, -e.radius * 0.16, e.radius * 0.16, 0, 7); ctx.fill();
    if (e.kind === 'spitter') { ctx.fillStyle = '#7a2d12'; ctx.beginPath(); ctx.arc(0, e.radius * 0.4, e.radius * 0.34, 0, 7); ctx.fill(); }
    if (e.kind === 'splitter') { ctx.strokeStyle = 'rgba(6,20,8,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-e.radius, 0); ctx.lineTo(e.radius, 0); ctx.stroke(); }
    if (e.kind === 'darter') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -e.radius - 6); ctx.lineTo(5, -e.radius + 3); ctx.lineTo(-5, -e.radius + 3); ctx.fill(); }
    if (e.boss) { // crown of horns for the great ones
      ctx.strokeStyle = '#2c1a10'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-e.radius * 0.6, -e.radius * 0.7); ctx.quadraticCurveTo(-e.radius, -e.radius * 1.5, -e.radius * 0.3, -e.radius * 1.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.radius * 0.6, -e.radius * 0.7); ctx.quadraticCurveTo(e.radius, -e.radius * 1.5, e.radius * 0.3, -e.radius * 1.25); ctx.stroke();
      ctx.fillStyle = '#ffdf6b'; ctx.beginPath(); ctx.arc(0, 2, e.radius * 0.3 + Math.sin(w.tick * 0.1) * 2, 0, 7); ctx.fill();
    }
    ctx.restore();
    if (e.shield > 0) { // the veil's golden shell
      ctx.strokeStyle = 'rgba(255,215,92,0.75)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 5, 0, 7); ctx.stroke();
    }
    if (e.hp < e.maxHp && !e.boss) bar(e.x - 16, e.y - e.radius - 12, 32, 5, e.hp / e.maxHp, 'rgba(0,0,0,0.55)', '#ff7d6b');
  }

  function drawWorld(w) {
    drawGlade(w);
    drawLantern(w);
    for (const o of w.orbs) {
      ctx.fillStyle = '#8be9ff';
      ctx.beginPath(); ctx.moveTo(o.x, o.y - 6); ctx.quadraticCurveTo(o.x + 5, o.y + 2, o.x, o.y + 6); ctx.quadraticCurveTo(o.x - 5, o.y + 2, o.x, o.y - 6); ctx.fill();
    }
    for (const e of w.echoes) drawEcho(w, e);
    for (const e of w.enemies) drawEnemy(w, e);
    for (const b of w.bolts) {
      ctx.fillStyle = b.echo ? `hsl(${b.hue} 90% 72%)` : '#ffdf7a';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.strokeStyle = b.echo ? `hsla(${b.hue} 90% 72% 0.4)` : 'rgba(255,200,80,0.4)';
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const b of w.ebolts) {
      ctx.fillStyle = '#c77dff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    }
    drawKeeperFigure(w.player.x, w.player.y, w.player.aim, w.player.face, w.player.invulnT > 0.05, w.tick);
    if (w.player.dashT > 0) { ctx.strokeStyle = 'rgba(127,255,212,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w.player.x, w.player.y, 24, 0, 7); ctx.stroke(); }
    for (const p of w.particles) {
      ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of w.texts) {
      ctx.globalAlpha = 1 - t.t / t.life;
      text(t.text, t.x, t.y, 17, t.color);
    }
    ctx.globalAlpha = 1;
    // vignette closes in as the lantern fades
    const frac = w.lantern.hp / w.lantern.maxHp;
    if (frac < 0.55) {
      const vg = ctx.createRadialGradient(640, 360, 240, 640, 360, 720);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(10,0,0,${(0.55 - frac) * 0.9})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
  }

  function drawHud(w, muted) {
    ctx.fillStyle = 'rgba(5,8,18,0.72)'; rr(14, 12, 1252, 56, 12); ctx.fill();
    const st = derivedStats(w.levels);
    text('WAVE ' + Math.max(1, w.wave) + ' / 12', 96, 40, 21, '#ffe9a8');
    text('SCORE ' + w.score, 268, 40, 21, '#ffffff');
    text('DEW ' + w.dew, 442, 40, 21, '#8be9ff');
    ctx.fillStyle = '#8be9ff'; ctx.beginPath(); ctx.arc(392, 40, 5, 0, 7); ctx.fill();
    text('LANTERN', 596, 30, 13, '#ffca7a');
    bar(520, 44, 152, 10, w.lantern.hp / w.lantern.maxHp, 'rgba(255,255,255,0.14)', '#ffb84d');
    text('KEEPER', 772, 30, 13, '#7dffd4');
    bar(716, 44, 112, 10, w.player.hp / w.player.maxHp, 'rgba(255,255,255,0.14)', '#3fd0c9');
    // echo chorus: pips + how full the memory is (the E prompt made visible)
    text('ECHOES ' + w.echoes.length + '/' + st.echoCap, 928, 30, 13, '#a8ffd8');
    bar(862, 44, 132, 10, Math.min(1, w.memory.length / 360), 'rgba(255,255,255,0.14)', w.memory.length >= 360 ? '#7dffd4' : '#4d7a6a');
    if (w.memory.length >= 360 && w.echoes.length < st.echoCap) text('E — CAST ECHO!', 928, 40 + 26, 13, '#7dffd4');
    text('DASH', 1076, 30, 13, '#ffd75c');
    bar(1024, 44, 104, 10, 1 - w.player.dashCd / st.dashCooldown, 'rgba(255,255,255,0.14)', '#ffd75c');
    text((w.speed === 2 ? '2x' : '1x') + (muted ? '  MUTED' : ''), 1204, 40, 15, '#9fb6d8');
    if (w.streak >= 3) text('STREAK x' + w.streak, 1180, 96, 24, '#ffe27a', 'right');
    if (w.bossRef) {
      const b = w.bossRef;
      text(b.name + ' — PHASE ' + b.phase, 640, 92, 19, '#ffb08a');
      bar(390, 108, 500, 12, b.hp / b.maxHp, 'rgba(0,0,0,0.6)', '#ff8a5c');
      if (b.shield > 0) bar(390, 124, 500, 6, b.shield / b.shieldMax, 'rgba(0,0,0,0.6)', '#ffd75c');
    }
    if (w.banner.t > 0) {
      ctx.globalAlpha = Math.min(1, w.banner.t);
      text(w.banner.text, 640, 190, 44, '#ffe9a8');
      if (w.banner.sub) text(w.banner.sub, 640, 228, 19, '#cfe8ff');
      ctx.globalAlpha = 1;
    }
    text('WASD move · mouse aim · hold click fire · E cast echo · SHIFT dash · P pause', 640, 700, 14, 'rgba(207,232,255,0.55)');
  }

  function drawTitle(w) {
    drawWorld(w);
    ctx.fillStyle = 'rgba(4,6,14,0.45)'; ctx.fillRect(0, 0, W, H);
    text('ECHOKEEPER', 640, 148, 84, '#ffe9a8');
    text('the lantern remembers how you fought', 640, 204, 25, '#a8ffd8');
    text('Fight for six seconds. Press E. Your past self fights beside you — forever.', 640, 252, 20, '#ffffff');
    text('Defend the Great Lantern through 12 waves to dawn. Spend dew. Choreograph your echoes.', 640, 282, 18, '#cfe8ff');
    const diffs = Object.values(DIFFICULTIES);
    TITLE_LAYOUT.difficultyCards.forEach((r, i) => {
      const d = diffs[i], sel = w.selectedDiff === d.id;
      ctx.fillStyle = sel ? '#1d3a4a' : 'rgba(13,22,38,0.96)';
      rr(r.x, r.y, r.w, r.h, 12); ctx.fill();
      ctx.strokeStyle = sel ? '#7dffd4' : '#3a5a74'; ctx.lineWidth = sel ? 3 : 1.5; rr(r.x, r.y, r.w, r.h, 12); ctx.stroke();
      text(d.name, r.x + r.w / 2, r.y + 30, 24, sel ? '#7dffd4' : '#ffffff');
      text('score x' + d.mult.toFixed(1), r.x + r.w / 2, r.y + 58, 17, '#ffe9a8');
      text(d.note, r.x + r.w / 2, r.y + 82, 14, '#9fb6d8');
    });
    const b = TITLE_LAYOUT.beginButton;
    ctx.fillStyle = '#b8862d'; rr(b.x, b.y, b.w, b.h, 14); ctx.fill();
    text('BEGIN THE NIGHT', b.x + b.w / 2, b.y + b.h / 2, 23, '#14100a');
    text('WASD / arrows move · mouse aim · hold click to fire · E or right-click casts an echo · SHIFT / SPACE dash', 640, 622, 16, '#cfe8ff');
    const best = Number(localStorageSafe('echokeeper-best') || 0);
    text(best > 0 ? 'BEST SCORE ' + best : 'No dawn yet — yours could be the first', 640, 656, 16, '#ffe9a8');
    text('P pause · 1/2 speed · M mute', 640, 684, 14, 'rgba(207,232,255,0.6)');
  }

  function localStorageSafe(k) {
    try { return localStorage.getItem(k); } catch { return null; }
  }

  function drawShop(w) {
    drawWorld(w);
    ctx.fillStyle = 'rgba(4,6,14,0.78)'; ctx.fillRect(0, 0, W, H);
    text('THE DEW SHOP', 640, 66, 44, '#ffe9a8');
    text('Wave ' + w.wave + ' held. You carry ' + w.dew + ' dew. Next: wave ' + (w.wave + 1) + ' of 12.', 640, 108, 20, '#cfe8ff');
    text('Echoes are permanent — every upgrade empowers the whole chorus.', 640, 138, 16, '#a8ffd8');
    for (const card of SHOP_LAYOUT.cards) {
      const up = UPGRADES.find((u) => u.id === card.id);
      const lvl = w.levels[card.id], maxed = lvl >= up.max, price = maxed ? 0 : priceOf(up, lvl);
      const afford = !maxed && w.dew >= price;
      ctx.fillStyle = 'rgba(15,26,44,0.97)'; rr(card.x, card.y, card.w, card.h, 12); ctx.fill();
      ctx.strokeStyle = afford ? '#7dffd4' : '#33506b'; ctx.lineWidth = afford ? 2 : 1.2; rr(card.x, card.y, card.w, card.h, 12); ctx.stroke();
      ctx.fillStyle = '#23405c'; rr(card.x + 14, card.y + 12, 52, 40, 8); ctx.fill();
      text(up.icon, card.x + 40, card.y + 33, 17, '#ffe9a8');
      text(up.name, card.x + 76, card.y + 32, 19, '#ffffff', 'left');
      for (let i = 0; i < up.max; i++) {
        ctx.fillStyle = i < lvl ? '#7dffd4' : 'rgba(255,255,255,0.16)';
        ctx.beginPath(); ctx.arc(card.x + 24 + i * 20, card.y + 76, 6, 0, 7); ctx.fill();
      }
      text('Lv ' + lvl + ' / ' + up.max, card.x + 150, card.y + 76, 15, '#9fb6d8', 'left');
      ctx.font = '15px Georgia, serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#cfe8ff';
      ctx.fillText(maxed ? 'fully kindled' : up.blurb(lvl), card.x + 16, card.y + 108);
      text(maxed ? 'MAXED' : price + ' dew' + (afford ? ' — click to buy' : ' — not enough'), card.x + card.w / 2, card.y + 146, 17, maxed ? '#9fb6d8' : afford ? '#8be9ff' : '#ff9d8a');
    }
    const b = SHOP_LAYOUT.nextButton;
    ctx.fillStyle = '#b8862d'; rr(b.x, b.y, b.w, b.h, 14); ctx.fill();
    text('FACE WAVE ' + (w.wave + 1), b.x + b.w / 2, b.y + b.h / 2, 23, '#14100a');
  }

  function drawEnd(w, victory) {
    drawWorld(w);
    ctx.fillStyle = victory ? 'rgba(30,24,6,0.92)' : 'rgba(10,4,8,0.92)';
    rr(240, 92, 800, 540, 18); ctx.fill();
    ctx.strokeStyle = victory ? '#ffd75c' : '#8a4a5c'; ctx.lineWidth = 2; rr(240, 92, 800, 540, 18); ctx.stroke();
    if (victory) {
      const s = victorySummary(w);
      text('DAWN BREAKS', 640, 152, 52, '#ffe9a8');
      text('the lantern outlived the night', 640, 192, 19, '#a8ffd8');
      for (let i = 0; i < 3; i++) {
        text(i < s.stars ? '★' : '☆', 590 + i * 50, 232, 40, '#ffd75c');
      }
      text('RANK ' + s.rank, 640, 276, 30, '#ffffff');
      s.lines.forEach((ln, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 330 + col * 330, y = 330 + row * 52;
        text(ln[0], x, y, 14, '#9fb6d8', 'left');
        text(ln[1], x + 158, y, 22, '#ffffff', 'left');
      });
    } else {
      const s = defeatSummary(w);
      text(w.lantern.hp <= 0 ? 'THE LANTERN DIES' : 'THE KEEPER FALLS', 640, 168, 46, '#ff9d8a');
      text('the glade goes dark — but dawn remembers the attempt', 640, 210, 18, '#cfe8ff');
      s.lines.forEach((ln, i) => {
        text(ln[0], 470, 300 + i * 56, 16, '#9fb6d8', 'right');
        text(ln[1], 520, 300 + i * 56, 26, '#ffffff', 'left');
      });
    }
    const b = END_LAYOUT.againButton;
    ctx.fillStyle = '#b8862d'; rr(b.x, b.y, b.w, b.h, 14); ctx.fill();
    text(victory ? 'PLAY AGAIN' : 'TRY AGAIN', b.x + b.w / 2, b.y + b.h / 2, 22, '#14100a');
  }

  function draw(w, muted) {
    ctx.save();
    if (w.trauma > 0.02) {
      const s = w.trauma * 9;
      ctx.translate((Math.sin(w.tick * 1.7) * s), (Math.cos(w.tick * 2.3) * s));
    }
    if (w.screen === 'title') drawTitle(w);
    else if (w.screen === 'shop') drawShop(w);
    else if (w.screen === 'victory') drawEnd(w, true);
    else if (w.screen === 'defeat') drawEnd(w, false);
    else { drawWorld(w); drawHud(w, muted); }
    if (w.paused && w.screen === 'play') {
      ctx.fillStyle = 'rgba(3,5,10,0.6)'; ctx.fillRect(0, 0, W, H);
      text('PAUSED', 640, 330, 54, '#ffe9a8');
      text('P to resume · the echoes wait with you', 640, 380, 19, '#cfe8ff');
    }
    ctx.restore();
  }

  return { draw };
}
