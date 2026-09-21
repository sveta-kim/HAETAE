const W = 960;
const H = 540;
const INK = '#080f1c';
const TALISMANS = ['#ff6b70', '#67e0eb', '#edf4ec', '#b5a7ec', '#f2d38b'];
const TALISMAN_IDS = ['red', 'blue', 'white', 'black', 'gold'];
const ENCHANT_LABELS = ['주작 · 공격 강화', '청룡 · 이동·공속 강화', '백호 · 은신·치명타', '현무 · 방어·반사'];
const PALETTES = {
  moat: { sky: '#07121f', low: '#183a43', far: '#12242f', mid: '#18313a', roof: '#31545c', light: '#73c8c7', accent: '#ed7973', warm: '#d4aa70' },
  archive: { sky: '#100f24', low: '#282443', far: '#1e2037', mid: '#2c3048', roof: '#55536a', light: '#a2b8e5', accent: '#d989af', warm: '#dac4a0' },
  kernel: { sky: '#151a29', low: '#5b5145', far: '#343c47', mid: '#4a4d4c', roof: '#8c8362', light: '#efd697', accent: '#f0bc7f', warm: '#f1d6a0' },
  escape: { sky: '#210e1c', low: '#4d293a', far: '#2e2433', mid: '#44313d', roof: '#76565e', light: '#db9295', accent: '#ff7774', warm: '#dbb590' },
};

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.reducedMotion = false;
    this.resize();
  }

  resize() {
    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;
    this.ctx.imageSmoothingEnabled = false;
  }

  setReducedMotion(value) { this.reducedMotion = Boolean(value); }

  rect(x, y, w, h, color, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
    c.globalAlpha = 1;
  }

  line(points, color, width = 1, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x) + .5, Math.round(y) + .5) : c.moveTo(Math.round(x) + .5, Math.round(y) + .5));
    c.stroke();
    c.globalAlpha = 1;
  }

  poly(points, color, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y)));
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
  }

  glow(x, y, size, color, opacity = .15) {
    const c = this.ctx;
    const g = c.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    c.globalAlpha = opacity;
    c.fillStyle = g;
    c.fillRect(x - size, y - size, size * 2, size * 2);
    c.globalAlpha = 1;
  }

  text(text, x, y, color, size = 10, align = 'center') {
    const c = this.ctx;
    c.font = `500 ${size}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(text, Math.round(x), Math.round(y));
  }

  render(game = {}) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = false;
    this.time = Number(game.time) || 0;
    this.anim = this.reducedMotion ? 0 : this.time;
    this.camera = Number(game.camera) || 0;
    this.theme = game.level?.theme || ['moat', 'archive', 'kernel', 'escape'][game.levelIndex || 0];
    this.palette = PALETTES[this.theme] || PALETTES.moat;
    if (this.theme === 'escape' && game.route === 'restore') this.palette = { ...PALETTES.moat, sky: '#13202b', low: '#39504f', accent: '#e3c484' };
    this.background(game);
    c.save();
    c.translate(-Math.floor(this.camera), 0);
    for (const platform of game.platforms || []) this.platform(platform, game);
    for (const object of game.objects || []) if (object.active !== false) this.object(object, game);
    for (const enemy of game.enemies || []) if (!enemy.dead && enemy.hp !== 0) this.enemy(enemy, game);
    for (const target of game.tutorialTargets || []) this.tutorialTarget(target, game);
    this.player(game.player || { x: 220, y: 410, w: 24, h: 44, facing: 1, selected: 0 }, game);
    for (const projectile of game.projectiles || []) this.projectile(projectile);
    for (const effect of game.effects || []) this.effect(effect);
    if (game.scanTime > 0) this.scan(game);
    if (game.escapeWall !== null && game.escapeWall !== undefined) this.escapeWall(game.escapeWall, game);
    c.restore();
    this.foreground(game);
    if (game.aim && game.mode === 'playing') {
      const x = game.aim.x - this.camera, y = game.aim.y;
      const color = game.player?.buff ? '#f3d590' : '#d5f8ec';
      this.line([[x - 10, y], [x - 4, y]], color, 2);
      this.line([[x + 4, y], [x + 10, y]], color, 2);
      this.line([[x, y - 10], [x, y - 4]], color, 2);
      this.line([[x, y + 4], [x, y + 10]], color, 2);
      this.rect(x - 1, y - 1, 2, 2, color);
    }
  }

  background(game) {
    const c = this.ctx, p = this.palette, t = this.anim;
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, p.sky);
    sky.addColorStop(1, p.low);
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // Sparse pixel stars and an eclipsed administrative moon.
    for (let i = 0; i < 42; i++) this.rect(hash(i + 10) * W, 24 + hash(i + 80) * 220, i % 9 === 0 ? 2 : 1, 1, '#bec8ca', .08 + hash(i + 60) * .2);
    const moonX = 730 - (this.camera * .025 % 120), moonY = 95;
    this.glow(moonX, moonY, 115, p.light, .13);
    const moonColor = this.theme === 'escape' && game.route === 'destroy' ? '#c88079' : '#d4d8c2';
    this.poly([[moonX - 26, moonY - 33], [moonX + 15, moonY - 33], [moonX + 34, moonY - 17], [moonX + 39, moonY + 13], [moonX + 19, moonY + 34], [moonX - 20, moonY + 37], [moonX - 40, moonY + 13], [moonX - 39, moonY - 13]], moonColor, .72);
    for (let i = 0; i < 5; i++) this.rect(moonX - 40, moonY - 20 + i * 11, 80, 2, p.sky, .14);
    this.line([[moonX - 59, moonY + 6], [moonX - 59, moonY - 43], [moonX - 37, moonY - 43]], p.light, 1, .2);
    this.line([[moonX + 57, moonY - 6], [moonX + 57, moonY + 48], [moonX + 32, moonY + 48]], p.light, 1, .2);

    // Distant vertical city: repeatable world generation keeps parallax seamless.
    const farCamera = this.camera * .1;
    const first = Math.floor(farCamera / 67) - 2;
    for (let i = first; i < first + 19; i++) {
      const x = i * 67 - farCamera, height = 65 + hash(i + 150) * 182, width = 34 + hash(i + 19) * 33;
      this.rect(x, 376 - height, width, height, p.far);
      this.rect(x + width / 2, 366 - height, 2, 12, p.roof, .35);
      this.roof(x - 7, 374 - height, width + 14, 10, p.far, p.roof, .45);
      for (let row = 0; row < height / 19 - 1; row++) {
        for (let col = 0; col < 3; col++) if (hash(i * 117 + row * 17 + col) > .63) this.rect(x + 6 + col * 11, 390 - height + row * 18, 3, 5, p.warm, .16 + hash(row + i) * .25);
      }
    }

    // Elevated transit traces and broken packet traffic.
    this.line([[0, 314], [193, 314], [205, 301], [427, 301], [437, 314], [960, 314]], p.roof, 2, .33);
    for (let i = 0; i < 7; i++) {
      const x = ((i * 147 + t * 11 - this.camera * .16) % 1070 + 1070) % 1070 - 50;
      this.rect(x, 301, 6 + i % 3 * 4, 1, p.light, .5);
    }

    const midCamera = this.camera * .24;
    const start = Math.floor(midCamera / 510) - 1;
    for (let i = start; i < start + 4; i++) {
      const x = i * 510 - midCamera;
      this.pagoda(x + 80, 396, 126, 3 + ((i % 2 + 2) % 2), i);
      this.pagoda(x + 330, 417, 175, 2, i + 4);
      this.rect(x + 185, 355, 128, 7, p.mid);
      this.line([[x + 188, 345], [x + 307, 345]], p.roof, 1, .7);
      for (let j = 0; j < 10; j++) this.rect(x + 188 + j * 13, 345, 2, 10, p.roof, .7);
    }

    if (this.theme === 'archive') this.archive();
    if (this.theme === 'kernel') this.kernel();

    // SODO's data moat reflects the changing city in hard horizontal pixels.
    this.rect(0, 438, W, H - 438, '#102730', .68);
    for (let i = 0; i < 75; i++) {
      const x = ((hash(i * 4 + 70) * W + t * (i % 2 ? 3 : -4) - this.camera * .38) % W + W) % W;
      const y = 444 + hash(i * 3 + 60) * 90;
      this.rect(x, y, 3 + hash(i + 8) * 35, 1, i % 7 === 0 ? p.warm : p.light, .06 + hash(i) * .14);
    }
    const fog = c.createLinearGradient(0, 325, 0, 490);
    fog.addColorStop(0, 'transparent');
    fog.addColorStop(.65, this.theme === 'kernel' ? '#ad9a6130' : '#72a8ad14');
    fog.addColorStop(1, 'transparent');
    c.fillStyle = fog;
    c.fillRect(0, 325, W, 165);

    // Circuit birds, the red-eyed sotdae overlooking the forbidden district.
    const poles = Math.floor(this.camera * .5 / 640);
    for (let i = poles; i < poles + 3; i++) {
      const x = i * 640 + 32 - this.camera * .5;
      this.rect(x, 260, 4, 195, '#14252d');
      this.rect(x - 5, 274, 14, 3, p.roof, .5);
      this.poly([[x - 17, 258], [x - 4, 252], [x + 15, 252], [x + 21, 244], [x + 25, 245], [x + 25, 256], [x + 32, 257], [x + 23, 261], [x - 3, 261]], '#233d43');
      this.rect(x + 21, 250, 3, 2, p.accent);
      this.glow(x + 21, 250, 15, p.accent, .45);
    }
  }

  roof(x, y, width, height, fill, edge, alpha = 1) {
    const center = x + width / 2;
    this.poly([[x - 7, y - 3], [x + 8, y], [center - width * .17, y - height], [center + width * .17, y - height], [x + width - 8, y], [x + width + 7, y - 3], [x + width + 3, y + 5], [x - 3, y + 5]], fill, alpha);
    this.line([[x - 7, y - 3], [x + 7, y], [center - width * .17, y - height], [center + width * .17, y - height], [x + width - 7, y], [x + width + 7, y - 3]], edge, 2, alpha);
    this.line([[x - 2, y + 4], [x + width + 2, y + 4]], edge, 1, alpha * .6);
    for (let i = 1; i < width / 9; i++) this.rect(x + i * 9, y + 1, 2, 3, edge, alpha * .5);
  }

  pagoda(x, base, width, tiers, seed) {
    const p = this.palette;
    this.rect(x + 9, base - 17, width - 18, 17, p.mid);
    for (let tier = 0; tier < tiers; tier++) {
      const y = base - 36 - tier * 54;
      const inset = tier * 15;
      const left = x + inset, w = width - inset * 2;
      this.rect(left + 10, y - 38, w - 20, 47, p.mid);
      this.rect(left + 15, y - 34, w - 30, 3, p.roof, .65);
      for (let j = 0; j < Math.floor((w - 20) / 21); j++) {
        const wx = left + 17 + j * 21;
        const lit = hash(seed * 33 + tier * 4 + j) > .25;
        this.rect(wx, y - 29, 10, 24, lit ? p.warm : p.far, lit ? .35 : 1);
        this.rect(wx + 4, y - 29, 2, 24, p.mid);
        this.rect(wx, y - 18, 10, 2, p.mid);
      }
      this.roof(left - 12, y - 37, w + 24, 18, p.mid, p.roof);
      this.rect(left + 7, y - 30, 4, 40, p.roof, .8);
      this.rect(left + w - 11, y - 30, 4, 40, p.roof, .8);
      this.rect(left - 5, y + 7, w + 10, 4, p.far);
      if (tier % 2 === 0) {
        this.rect(left + w - 3, y - 27, 1, 13, p.warm, .5);
        this.lantern(left + w - 3, y - 11, p.accent, .7, 6);
      }
    }
    if (tiers >= 3) {
      const signY = base - tiers * 54 - 13;
      this.rect(x + width / 2 - 15, signY, 30, 13, p.far);
      this.text(this.theme === 'kernel' ? '근정전' : this.theme === 'archive' ? '장서각' : '소도', x + width / 2, signY + 7, p.warm, 7);
    }
  }

  lantern(x, y, color, alpha = 1, size = 8) {
    this.glow(x, y, size * 4, color, .12 * alpha);
    this.rect(x - size / 2 - 1, y - size / 2 - 2, size + 2, 2, '#12232b', alpha);
    this.rect(x - size / 2, y - size / 2, size, size, color, alpha * .8);
    this.rect(x - 1, y - size / 2, 2, size, '#f5dda6', alpha * .9);
    this.rect(x - size / 2 - 1, y + size / 2, size + 2, 2, '#12232b', alpha);
    this.rect(x, y + size / 2 + 2, 1, 5, color, alpha * .6);
  }

  archive() {
    const offset = this.camera * .45;
    for (let i = Math.floor(offset / 115) - 1; i < Math.floor(offset / 115) + 10; i++) {
      const x = i * 115 - offset;
      this.rect(x, 178, 71, 258, '#151c2b', .82);
      this.rect(x, 177, 4, 260, '#575369', .5);
      this.rect(x + 68, 177, 3, 260, '#575369', .5);
      for (let r = 0; r < 7; r++) {
        this.rect(x + 4, 206 + r * 33, 64, 3, '#696379', .4);
        for (let b = 0; b < 7; b++) {
          this.rect(x + 8 + b * 8, 188 + r * 33, 5, 18, ['#747575', '#6a748e', '#a28b77'][Math.abs(i + b + r) % 3], .3);
          if (hash(i * 52 + r * 7 + b) > .84) this.rect(x + 8 + b * 8, 201 + r * 33, 5, 2, '#bdc8dc', .8);
        }
      }
    }
  }

  kernel() {
    const p = this.palette;
    const offset = this.camera * .35;
    for (let i = Math.floor(offset / 230) - 1; i < Math.floor(offset / 230) + 6; i++) {
      const x = i * 230 - offset;
      this.rect(x, 178, 17, 258, '#393d3e', .8);
      this.rect(x + 3, 178, 3, 258, p.warm, .4);
      this.rect(x - 5, 175, 27, 5, p.warm, .6);
      this.rect(x - 5, 428, 27, 8, p.warm, .4);
      this.line([[x + 17, 193], [x + 75, 193], [x + 75, 240], [x + 153, 240], [x + 153, 193], [x + 230, 193]], p.warm, 1, .22);
    }
    this.rect(0, 171, W, 3, p.warm, .35);
    for (let i = 0; i < 20; i++) {
      const x = (hash(i + 70) * 960 - offset * .3 + 1920) % W;
      const y = 90 + (hash(i + 800) * 300 + this.anim * 4) % 325;
      this.rect(x, y, 2, 2, p.warm, .45);
    }
  }

  platform(platform, game) {
    const { x, y, w, h = 25, hidden } = platform;
    if (x + w < this.camera - 30 || x > this.camera + W + 30) return;
    if (hidden && !(game.scanTime > 0)) {
      this.rect(x + 4, y, 5, 1, '#b2d9e1', .2);
      this.rect(x + w - 9, y, 5, 1, '#b2d9e1', .2);
      return;
    }
    const p = this.palette;
    if (hidden) {
      this.rect(x, y, w, h, '#6faebe', .13);
      this.line([[x, y + h], [x, y], [x + w, y], [x + w, y + h]], '#a2e3e4', 1, .8);
      for (let xx = x + 5; xx < x + w; xx += 10) this.rect(xx, y + 4, 5, 2, '#a2e3e4', .3);
      this.text('HIDDEN / 복원됨', x + w / 2, y + 14, '#b4e7e8', 8);
      return;
    }
    this.rect(x, y + 5, w, h - 5, '#111e28');
    this.rect(x, y, w, 4, '#6e8587');
    this.rect(x, y + 4, w, 2, '#2e4851');
    this.rect(x + 2, y + 7, w - 4, 3, '#22333d');
    this.rect(x + 4, y + 1, w - 8, 1, '#a3b5ad', .45);
    for (let xx = x + 13; xx < x + w - 6; xx += 38) {
      this.rect(xx, y + 9, 23, 1, '#35505a', .5);
      this.rect(xx + 29, y + 13, 1, Math.min(14, h - 13), '#31505b', .5);
      if (h > 40) {
        this.rect(xx + 7, y + 30, 26, 1, '#273b45', .7);
        this.rect(xx + 3, y + 31, 1, 20, '#243a46', .5);
      }
    }
    if (w < 250) {
      this.poly([[x + 5, y + h], [x + 15, y + h + 6], [x + w - 15, y + h + 6], [x + w - 5, y + h]], '#0c1721');
      this.rect(x + 10, y + 8, 8, 2, platform.moving ? '#eccb82' : p.light, .85);
      this.rect(x + w - 18, y + 8, 8, 2, platform.moving ? '#eccb82' : p.light, .85);
    } else {
      for (let xx = x + 29; xx < x + w - 20; xx += 124) {
        this.rect(xx, y + 4, 22, 1, p.light, .6);
        this.rect(xx + 4, y + 20, 14, 2, '#b69c76', .35);
      }
    }
  }

  player(player, game) {
    if (!player) return;
    const { x = 0, y = 0, w = 24, h = 44 } = player;
    const c = this.ctx, face = player.facing === -1 ? -1 : 1;
    const moving = Math.abs(player.vx || 0) > 5;
    const stride = moving && player.grounded ? Math.sin(this.anim * 17) * 3 : 0;
    const selected = Number.isInteger(player.selected) ? player.selected : 0;
    const buffIndex = typeof player.buff?.id === 'string' ? TALISMAN_IDS.indexOf(player.buff.id) : player.buff?.id;
    const buffColor = TALISMANS[buffIndex] || TALISMANS[selected] || TALISMANS[0];
    const alpha = buffIndex === 2 ? .6 : player.invulnerable > 0 && Math.floor(this.anim * 14) % 2 === 0 ? .65 : 1;
    if (player.dashTime > 0) {
      for (let i = 1; i < 5; i++) {
        this.poly([[x - face * i * 10, y + 8], [x + w - face * i * 10, y + 8], [x + w + 5 - face * i * 10, y + h - 2], [x - 5 - face * i * 10, y + h - 2]], '#63cbd6', .16 / i);
        this.rect(x - face * i * 13, y + 12 + i * 5, 26, 1, '#a1e9eb', .2);
      }
    }
    this.rect(x - 3, y + h - 1, w + 6, 3, '#000817', .4);
    if (player.buff) this.glow(x + w / 2, y + h / 2, 43, buffColor, .15);
    c.save();
    c.translate(Math.round(x + w / 2), Math.round(y));
    c.scale(face, 1);
    // Data bundle, cables, split cheollik coat and the concealed crimson lining.
    this.rect(-15, 15, 9, 19, '#283b46', alpha);
    this.rect(-14, 17, 6, 3, '#5f7980', alpha);
    this.rect(-12, 23, 2, 4, '#63b9bd', alpha);
    this.line([[-13, 31], [-13, 35], [-3, 35], [-3, 26]], '#547177', 1, alpha);
    this.poly([[-8, 15], [6, 14], [11, 27], [13 + (moving ? 3 : 0), h - 5], [3, h - 7], [-1, h - 12], [-6, h - 4], [-16 - (moving ? 5 : 0), h - 2], [-11, 27]], '#080f1c', alpha);
    this.poly([[-3, 25], [4, 24], [7, h - 8], [2, h - 5], [-1, h - 13], [-4, h - 7]], '#833753', alpha);
    this.line([[-9, 16], [-11, 28], [-15, h - 4]], '#718c92', 1, alpha);
    this.line([[1, 18], [-2, 26], [8, 24]], '#667478', 1, alpha);
    this.rect(-8, h - 7 + stride, 5, 7 - stride, '#253744', alpha);
    this.rect(3, h - 7 - stride, 5, 7 + stride, '#1d2d3c', alpha);
    this.rect(-10, h - 2, 8, 3, '#5c7379', alpha);
    this.rect(3, h - 2, 9, 3, '#48616b', alpha);
    this.rect(-7, 8, 14, 12, '#131b28', alpha);
    this.rect(-5, 10, 12, 4, '#947c78', alpha);
    this.rect(-4, 11, 3, 2, '#f5a1b8', alpha);
    this.rect(4, 11, 3, 2, '#ff749f', alpha);
    this.rect(-4, 14, 12, 5, '#121c28', alpha);
    if (Math.floor(this.anim * 1.5) % 2 === 0) this.rect(3, 17, 3, 1, '#7dcbd1', alpha);
    // Broad, stepped bamboo hat; one edge is missing digital pixels.
    this.poly([[-19, 9], [-14, 5], [-6, -1], [1, -4], [6, -1], [13, 4], [19, 7], [16, 11], [-16, 11]], '#776f61', alpha);
    this.poly([[-15, 7], [-5, 1], [1, -2], [7, 3], [14, 7]], '#a59a7b', alpha);
    this.line([[-17, 9], [15, 9]], '#c1b18b', 1, alpha);
    this.line([[-8, 7], [1, -2], [5, 7]], '#d1bd8e', 1, alpha * .6);
    this.rect(16, 5, 3, 2, '#77b9ba', alpha);
    this.rect(21, 8, 2, 2, '#88beb8', alpha * .6);
    this.rect(-8, 24, 17, 3, '#736356', alpha);
    (player.unlocked || [0, 1]).forEach((id, i) => this.rect(-7 + i * 3, 27, 2, 5, TALISMANS[id] || '#f2d38b', alpha));
    // The hand fan is deliberately visible even at the logical pixel size.
    const fan = player.buff ? buffColor : player.enchantCooldown > 0 ? '#727e88' : '#c5b990';
    const fy = player.attackTime > 0 ? 13 : 23;
    if (player.buff) {
      this.glow(22, fy - 1, 29, buffColor, .4);
      this.poly([[8, fy + 10], [9, fy - 9], [21, fy - 17], [34, fy - 10], [37, fy + 3], [25, fy + 10]], buffColor, .22);
      this.line([[10, fy - 10], [21, fy - 17], [34, fy - 10], [37, fy + 3]], buffColor, 2, .85);
      for (let i = 0; i < 3; i++) {
        const a = this.anim * 2.5 + i * Math.PI * 2 / 3;
        this.rect(22 + Math.cos(a) * 19, fy + Math.sin(a) * 15, 3, 3, buffColor, .85);
      }
    }
    this.rect(8, fy + 1, 6, 4, '#344c58', alpha);
    this.poly([[12, fy + 6], [14, fy - 6], [21, fy - 10], [29, fy - 6], [31, fy + 1], [24, fy + 5]], fan, alpha * .85);
    this.line([[12, fy + 6], [21, fy - 9]], '#1c3c47', 1, alpha);
    this.line([[12, fy + 6], [29, fy - 5]], '#1c3c47', 1, alpha);
    this.line([[12, fy + 6], [30, fy]], '#1c3c47', 1, alpha);
    this.rect(12, fy + 4, 3, 4, '#f0ccaa', alpha);
    if (player.attackTime > 0) {
      const combo = player.combo || 1;
      this.line([[17, 3], [36, 6], [49, 17], [50, 28], [39, 38], [24, 41]], fan, 3, .85);
      this.line([[25, 0], [44, 9], [54, 21], [48, 35]], '#edf4e3', 1, .8);
      for (let i = 0; i < 5; i++) this.rect(22 + hash(i + combo) * 38, 7 + hash(i + 44) * 29, 3, 2, fan, .7);
    }
    c.restore();
    if (player.buff) {
      const label = ENCHANT_LABELS[buffIndex] || '인챈트 활성';
      const labelY = Math.min(H - 31, Math.max(220, y + h + 17));
      this.rect(x + w / 2 - 65, labelY - 9, 130, 18, '#08151f', .9);
      this.rect(x + w / 2 - 65, labelY - 9, 2, 18, buffColor);
      this.text(label, x + w / 2, labelY, buffColor, 9);
    }
    if (game.shieldTime > 0) {
      const cx = x + w / 2, cy = y + h / 2;
      const points = Array.from({ length: 7 }, (_, i) => [cx + Math.cos(i * Math.PI / 3) * 34, cy + Math.sin(i * Math.PI / 3) * 34]);
      this.poly(points, '#c2afe9', .06);
      this.line(points, '#c2afe9', 2, .75);
      this.line(points.map(([xx, yy]) => [cx + (xx - cx) * .85, cy + (yy - cy) * .85]), '#c2afe9', 1, .25);
    }
  }

  tutorialTarget(target, game) {
    const { x = 0, y = 400, w = 34, h = 60, type = 'dummy' } = target;
    if (x + w < this.camera - 100 || x > this.camera + W + 100) return;
    if (target.active === false && type !== 'gate') return;
    const cx = x + w / 2, cy = y + h / 2;
    const color = target.color || '#89e9da';
    const revealed = type !== 'hidden' || game.scanTime > 0;
    const opened = type === 'gate' && target.active === false;
    const bob = Math.sin(this.anim * 3) * 3;
    const baseY = y + h;

    // Practice props have a jade plinth and reticle, unlike hostile silhouettes.
    this.rect(x - 9, baseY, w + 18, 5, '#173d42');
    this.line([[x - 12, baseY + 5], [x - 12, baseY - 2], [x + w + 12, baseY - 2], [x + w + 12, baseY + 5]], color, 1, .65);
    if (type === 'gate') {
      this.rect(x, y, 5, h, '#426069');
      this.rect(x + w - 5, y, 5, h, '#426069');
      this.rect(x - 6, y - 4, w + 12, 6, color, .7);
      if (!opened) {
        this.rect(x + 5, y + 4, Math.max(2, w - 10), h - 4, color, .08);
        for (let xx = x + 9; xx < x + w - 5; xx += 9) this.rect(xx, y + 7, 2, h - 7, color, .55);
      }
      const lockY = opened ? y + 16 : cy;
      this.rect(cx - 8, lockY - 3, 16, 14, '#10212f');
      this.line([[cx - 5, lockY - 3], [cx - 5, lockY - 10], [cx + 5, lockY - 10], [cx + 5, lockY - (opened ? 17 : 3)]], color, 2);
      this.line([[cx - 8, lockY - 3], [cx + 8, lockY - 3], [cx + 8, lockY + 11], [cx - 8, lockY + 11], [cx - 8, lockY - 3]], color, 1);
      this.text(opened ? '✓' : 'Q', cx, lockY + 5, color, 10);
      if (opened) this.text('통과 가능', cx, cy + 14, color, 9);
    } else if (type === 'hidden') {
      this.poly([[cx, y + 4], [x + w - 2, cy], [cx, baseY - 4], [x + 2, cy]], revealed ? '#24454e' : '#20353e', revealed ? 1 : .3);
      if (revealed) {
        this.glow(cx, cy, 38, color, .25);
        this.line([[cx, y + 4], [x + w - 2, cy], [cx, baseY - 4], [x + 2, cy], [cx, y + 4]], color, 2);
        this.text('真', cx, cy, color, 16);
        this.text('드러난 기록', cx, baseY + 17, color, 9);
      } else {
        for (let yy = y + 8; yy < baseY - 5; yy += 9) this.rect(x + 7, yy, Math.max(3, w - 14), 1, color, .18);
        this.text('?', cx, cy, '#8babad', 17);
      }
    } else if (type === 'projectile') {
      const safeColor = '#7dece7';
      this.glow(cx, cy, 30, safeColor, .23);
      this.line([[x - 14, cy], [x - 4, cy]], safeColor, 2, .4);
      this.poly([[cx, y], [x + w, cy], [cx, y + h], [x, cy]], safeColor, .9);
      this.rect(cx - 2, cy - 2, 4, 4, '#e7ffed');
    } else {
      this.rect(cx - 3, cy + 6, 6, h / 2 - 6, '#a18c65');
      this.rect(x - 4, y + h * .4, w + 8, 5, '#aa9571');
      this.poly([[cx, y + 1], [x + w - 2, y + 10], [x + w - 5, cy + 13], [x + 5, cy + 13], [x + 2, y + 10]], '#92775a');
      this.line([[x + 6, y + 15], [x + w - 6, y + 15]], '#d1ba88', 3);
      this.line([[x + 6, cy + 7], [x + w - 6, cy + 7]], '#d1ba88', 3);
      this.rect(cx - 11, cy - 11, 22, 22, '#102a35');
      this.line([[cx - 11, cy - 11], [cx + 11, cy - 11], [cx + 11, cy + 11], [cx - 11, cy + 11], [cx - 11, cy - 11]], color, 1);
      this.text(type === 'range' ? 'Q' : '＋', cx, cy, color, 15);
      if (Number.isFinite(target.hp) && target.maxHp > 0) {
        this.rect(x - 3, baseY + 10, w + 6, 4, '#091923');
        this.rect(x - 3, baseY + 10, (w + 6) * Math.max(0, Math.min(1, target.hp / target.maxHp)), 3, color);
      }
    }

    const key = type === 'dummy' ? game.tutorial?.step?.buff ? '우클릭 · 강화' : '좌클릭 · 조준' : type === 'range' ? 'Q · 발동' : type === 'hidden' ? revealed ? '탐색 성공' : 'Q · 탐색' : type === 'projectile' ? '안전한 연습탄' : opened ? '해제 완료' : 'Q · 권한 해제';
    const label = `수련 · ${target.label || key}`;
    const labelY = Math.max(210, y - 27);
    const labelWidth = Math.max(92, Math.min(220, label.length * 9 + 18));
    this.rect(cx - labelWidth / 2, labelY - 10, labelWidth, 20, '#071822', .95);
    this.text(label, cx, labelY, opened ? '#9ccbbd' : color, 10);
    if (!opened) this.poly([[cx - 5, labelY + 16 + bob], [cx + 5, labelY + 16 + bob], [cx, labelY + 22 + bob]], color, .85);
  }

  enemy(enemy, game) {
    const { x, y, w = 28, h = 42, type = 'sunra', boss } = enemy;
    if (x + w < this.camera - 80 || x > this.camera + W + 80) return;
    const c = this.ctx, face = enemy.facing === -1 ? -1 : 1;
    const attack = enemy.attackTime > 0 || enemy.windup > 0 || enemy.telegraph > 0;
    const color = type === 'jangsan' ? '#d9e8e7' : type === 'gumiho' ? '#e3b2db' : type === 'root' ? '#edcb85' : '#ec8a80';
    if (attack) {
      const reach = boss ? 105 : 48;
      const left = face > 0 ? x + w / 2 : x + w / 2 - reach;
      this.rect(left, y + h - 1, reach, 4, color, .4);
      for (let xx = left; xx < left + reach; xx += 12) this.poly([[xx, y + h], [xx + 5, y + h - 7], [xx + 10, y + h]], color, .45);
      this.text('!', x + w / 2, y - 18, color, 17);
    }
    this.rect(x - 4, y + h - 1, w + 8, 3, '#040b15', .45);
    c.save();
    c.translate(Math.round(x + (face === -1 ? w : 0)), Math.round(y));
    c.scale(face * w / 40, h / 60);
    if (type === 'bulgasari') {
      this.poly([[3, 11], [11, 3], [32, 6], [39, 21], [35, 49], [5, 51], [0, 31]], '#3b4d53');
      this.rect(8, 8, 22, 30, '#152b36');
      for (let r = 0; r < 5; r++) {
        this.rect(11, 12 + r * 5, 16, 3, '#68736e');
        this.rect(13, 13 + r * 5, 3, 1, r % 2 ? '#dc896c' : '#8fb6ad');
      }
      this.rect(2, 24, 10, 23, '#647575');
      this.rect(31, 23, 10, 22, '#65736f');
      this.rect(6, 44, 12, 15, '#40525b');
      this.rect(25, 45, 13, 14, '#344951');
      this.rect(25, 18, 15, 12, '#122a35');
      this.rect(28, 19, 10, 2, '#f79484');
      this.rect(28, 24, 13, 5, '#68dae0');
      this.rect(34, 29, 3, 10, '#68dae0', .6);
      this.line([[4, 12], [-3, 23], [2, 41]], '#8a8b77', 2);
    } else if (type === 'jangseung') {
      this.poly([[5, 6], [12, 0], [29, 2], [36, 9], [34, 58], [5, 58]], '#65655a');
      this.rect(8, 7, 25, 7, '#293b3d');
      this.poly([[7, 13], [17, 16], [16, 21], [8, 20]], '#f29b76');
      this.poly([[21, 17], [31, 13], [31, 20], [23, 22]], '#f29b76');
      this.rect(12, 26, 15, 7, '#142d36');
      this.rect(13, 26, 13, 2, '#d4c3a0');
      this.rect(18, 26, 2, 7, '#d4c3a0');
      this.rect(9, 37, 21, 18, '#24373d');
      this.text('天', 19, 46, '#cfa781', 13);
      this.rect(1, 43, 6, 15, '#404e4d');
      this.rect(32, 41, 7, 17, '#404e4d');
    } else if (type === 'jangsan') {
      this.poly([[2, 27], [9, 16], [27, 20], [34, 30], [38, 48], [30, 47], [24, 39], [11, 39], [8, 57], [1, 56]], '#cedbd8', game.scanTime > 0 ? .9 : .5);
      this.poly([[25, 12], [28, 4], [34, 11], [40, 12], [39, 30], [28, 34], [22, 22]], '#e5ece1', .8);
      this.rect(29, 18, 4, 3, '#de6c94');
      this.rect(36, 17, 4, 3, '#de6c94');
      for (let i = 0; i < 9; i++) this.line([[6 + i * 3, 25], [2 + i * 3, 36], [hash(i) * 5 + i * 3, 48]], '#edf4e9', 1, .65);
      this.line([[4, 31], [-5, 20], [-10, 22], [-9, 35]], '#c5e4e8', 2, .6);
    } else if (type === 'gumiho') {
      const tails = Math.max(0, Math.min(9, enemy.tails ?? 9));
      for (let i = 0; i < tails; i++) {
        const a = -2.65 + i * .27;
        const tx = 20 + Math.cos(a) * 30, ty = 41 + Math.sin(a) * 35;
        this.poly([[19, 43], [tx - 5, ty - 5], [tx, ty - 13], [tx + 7, ty - 4], [25, 43]], i % 2 ? '#cda8db' : '#96cbdc', .65);
        this.line([[21, 40], [tx, ty - 8]], '#f6dce8', 1, .8);
      }
      this.poly([[16, 23], [30, 19], [36, 34], [30, 49], [15, 49], [10, 34]], '#dfe3dc');
      this.poly([[19, 21], [16, 6], [25, 14], [32, 8], [36, 25], [28, 34]], '#e9eadd');
      this.rect(23, 22, 3, 2, '#e474ac');
      this.rect(31, 20, 3, 2, '#e474ac');
      this.rect(15, 47, 5, 12, '#cddbd7');
      this.rect(29, 44, 5, 15, '#cddbd7');
    } else if (type === 'root') {
      this.poly([[15, 13], [27, 13], [33, 24], [39, 57], [1, 57], [7, 23]], '#565059');
      this.poly([[17, 19], [25, 19], [28, 50], [19, 57], [12, 49]], '#b19c73');
      this.rect(13, 6, 15, 15, '#393c43');
      this.rect(14, 11, 4, 2, '#f8dc9b');
      this.rect(23, 11, 4, 2, '#f8dc9b');
      this.poly([[8, 7], [8, 0], [16, 4], [20, -3], [24, 4], [32, 0], [32, 7]], '#d3b679');
      this.line([[3, 55], [9, 29], [13, 24]], '#ead3a0', 2);
      this.line([[36, 55], [30, 29], [27, 24]], '#ead3a0', 2);
      this.rect(17, 28, 8, 10, '#f4d796');
      this.rect(19, 31, 4, 4, '#fff2c0');
    } else if (type === 'sagwan') {
      this.poly([[9, 17], [29, 18], [34, 58], [1, 58]], '#687d90');
      this.poly([[16, 18], [22, 18], [27, 51], [16, 55]], '#c7cbd0');
      this.rect(10, 6, 18, 15, '#7699a1');
      this.rect(7, 3, 25, 4, '#1e263d');
      this.rect(15, 0, 10, 5, '#29384b');
      this.rect(13, 11, 12, 2, '#d3c9aa');
      this.rect(34, 6, 3, 44, '#b4a081');
      this.poly([[31, 50], [40, 50], [35, 62]], '#dfd4b7');
      this.rect(27, 29, 9, 4, '#a8a797');
    } else {
      this.rect(9, 43, 7, 15, '#334754');
      this.rect(25, 43, 7, 15, '#304554');
      this.poly([[9, 22], [30, 22], [34, 48], [5, 48]], type === 'dokkaebi' ? '#4b6563' : '#3f5663');
      this.rect(11, 9, 18, 16, '#7d8878');
      this.rect(9, 6, 22, 6, '#30464f');
      this.rect(14, 14, 5, 3, '#ef887b');
      this.rect(24, 14, 4, 3, '#ef887b');
      this.rect(11, 31, 20, 3, '#977d67');
      if (type === 'pabal') {
        this.rect(-2, 16, 10, 23, '#b99972');
        this.rect(-4, 17, 14, 3, '#d3b78b');
        this.rect(-4, 33, 14, 3, '#d3b78b');
        this.rect(0, 21, 6, 7, '#69b9b5');
      } else if (type === 'dokkaebi') {
        this.rect(11, 1, 4, 8, '#8dddbe');
        this.rect(27, 1, 4, 8, '#8dddbe');
        this.rect(36, 18, 3, 37, '#9f8f77');
        this.rect(32, 15, 11, 17, '#557b79');
      } else if (type === 'shield') {
        this.rect(26, 17, 16, 36, '#724d49');
        this.rect(28, 19, 12, 32, '#223642');
        this.line([[26, 17], [41, 17], [41, 53], [26, 53], [26, 17]], '#e18c7c', 1);
        this.text('禁', 34, 34, '#f5a08c', 12);
      } else {
        this.rect(32, 24, 3, 25, '#8c8070');
        this.line([[33, 24], [43, 24], [43, 32]], '#8c8070', 1);
        this.lantern(43, 36, enemy.alert ? '#ef897b' : '#c3bf86', 1, 8);
      }
    }
    c.restore();
    if (enemy.hitFlash > 0) {
      this.rect(x, y, w, h, '#e5efe7', Math.min(.28, enemy.hitFlash * 1.7));
    }
    if (enemy.stun > 0) {
      this.text('과부하', x + w / 2, y - 13, '#a3e1e4', 9);
      for (let i = 0; i < 3; i++) this.rect(x + w / 2 + Math.cos(this.anim * 3 + i * 2) * w * .4, y - 7 + Math.sin(this.anim * 3 + i * 2) * 3, 3, 2, '#b0e9df', .8);
    }
    if (!boss && enemy.hp < enemy.maxHp) {
      this.rect(x, y - 8, w, 3, '#0b1420');
      this.rect(x, y - 8, w * Math.max(0, enemy.hp / enemy.maxHp), 2, '#e6a49c');
    }
    if (boss && game.boss?.id !== enemy.id) this.text(enemy.name || '', x + w / 2, y - 15, '#bfc2b5', 9);
    if ((game.scanTime > 0 || enemy.revealed > 0) && (type === 'jangsan' || type === 'gumiho')) {
      this.line([[x - 6, y + 6], [x - 6, y - 6], [x + 5, y - 6]], '#a6e1e3', 1);
      this.line([[x + w - 5, y + h + 5], [x + w + 6, y + h + 5], [x + w + 6, y + h - 5]], '#a6e1e3', 1);
      this.text('TRUE / 본체', x + w / 2, y - 17, '#a6e1e3', 8);
    }
  }

  object(object, game) {
    const { x, y, w = 24, h = 30, type } = object;
    if (x + w < this.camera - 60 || x > this.camera + W + 60) return;
    const cx = x + w / 2;
    const near = game.player && Math.abs(game.player.x - cx) < 140;
    const bob = Math.sin(this.anim * 2 + x * .05) * 2;
    const color = type === 'talisman' ? TALISMANS[object.value === 'evolve' ? 2 : object.value] || '#ddd5bb' : type === 'log' ? '#e89580' : type === 'core' ? '#edce88' : '#80d1d0';
    if (type === 'gate') {
      this.rect(x - 4, y, w + 8, h, '#102634');
      this.rect(x, y, 5, h, '#667574');
      this.rect(x + w - 5, y, 5, h, '#667574');
      this.roof(x - 14, y, w + 28, 18, '#273c45', '#82938b');
      for (let xx = x + 9; xx < x + w - 7; xx += 9) this.rect(xx, y + 9, 3, h - 9, '#db837a', .6);
      this.rect(cx - 12, y + h / 2 - 12, 24, 24, '#14242c');
      this.text('禁', cx, y + h / 2 + 1, '#f4a394', 17);
    } else if (type === 'exit') {
      this.rect(x, y, w, h, '#6ec6ca', .07);
      this.rect(x, y, 4, h, '#70888b');
      this.rect(x + w - 4, y, 4, h, '#70888b');
      this.rect(x + 4, y + 5, 2, h - 5, color, .85);
      this.rect(x + w - 6, y + 5, 2, h - 5, color, .85);
      this.roof(x - 10, y, w + 20, 16, '#2c434b', '#9cb7b3');
      this.text('→', cx, y + h / 2, '#bfe5dd', 21);
      this.text('NEXT SECTOR', cx, y - 26, '#9cb7b3', 7);
    } else if (type === 'npc') {
      this.rect(cx - 6, y + h - 10, 4, 10, '#899fa0');
      this.rect(cx + 2, y + h - 10, 4, 10, '#899fa0');
      this.poly([[cx - 7, y + 14], [cx + 7, y + 14], [cx + 10, y + h - 8], [cx - 11, y + h - 8]], '#59777b');
      this.rect(cx - 5, y + 5, 11, 11, '#b7b4a0');
      this.rect(cx - 7, y + 3, 15, 5, '#435665');
      this.rect(cx - 2, y + 9, 6, 2, '#354354');
      this.text('…', cx, y - 10 + bob, '#d1c8aa', 15);
    } else if (type === 'cooler') {
      this.rect(x, y, w, h, '#354e59');
      this.rect(x + 2, y + 2, w - 4, h - 4, '#102a38');
      this.rect(x + 5, y + 5, w - 10, 3, '#99d7ce');
      this.rect(x + 5, y + h - 8, w - 10, 3, '#99d7ce', .6);
      for (let i = 0; i < 4; i++) {
        const a = this.anim * 2 + Math.PI / 2 * i;
        this.line([[cx, y + h * .53], [cx + Math.cos(a) * w * .3, y + h * .53 + Math.sin(a) * w * .3]], '#8ab1b5', 3);
      }
    } else if (type === 'checkpoint') {
      this.rect(cx - 2, y + 7, 4, h - 7, '#6d8688');
      this.rect(cx - 11, y + h - 3, 22, 3, '#546f79');
      this.lantern(cx, y + 5, '#9bd9d4', 1, 13);
    } else if (type === 'core') {
      this.glow(cx, y + h / 2, 65, color, .35);
      for (let i = 0; i < 3; i++) {
        const d = 11 + i * 6;
        this.line([[cx, y + h / 2 - d + bob], [cx + d, y + h / 2 + bob], [cx, y + h / 2 + d + bob], [cx - d, y + h / 2 + bob], [cx, y + h / 2 - d + bob]], color, i ? 1 : 3, 1 - i * .25);
      }
      this.rect(cx - 3, y + h / 2 - 3 + bob, 6, 6, '#fff0bf');
    } else {
      this.glow(cx, y + h / 2 + bob, 30, color, .18);
      const width = type === 'talisman' ? 13 : 19, height = type === 'talisman' ? 25 : 23;
      const cy = y + h / 2 + bob;
      this.rect(cx - width / 2 - 1, cy - height / 2 - 1, width + 2, height + 2, color, .3);
      this.rect(cx - width / 2, cy - height / 2, width, height, '#182c39');
      this.rect(cx - width / 2, cy - height / 2, 2, height, color, .9);
      this.rect(cx - width / 2, cy - height / 2, width, 2, color, .9);
      if (type === 'talisman') {
        this.text(['朱', '靑', '白', '玄', '麟'][object.value === 'evolve' ? 2 : object.value] || '符', cx + 1, cy, color, 11);
      } else {
        for (let i = 0; i < 3; i++) this.rect(cx - 4, cy - 6 + i * 5, i === 2 ? 4 : 10, 1, color, .9);
        this.rect(cx - 3, cy + 9, 6, 1, color, .5);
      }
    }
    if (near && object.label) {
      const label = object.label.length > 20 ? `${object.label.slice(0, 19)}…` : object.label;
      const ty = y - (type === 'gate' || type === 'exit' ? 40 : 18) + bob;
      this.rect(cx - label.length * 4.4 - 5, ty - 8, label.length * 8.8 + 10, 17, '#071421', .85);
      this.text(label, cx, ty, color, 9);
    }
  }

  projectile(projectile) {
    const { x, y, w = 10, h = 6, hostile, vx = 1, vy = 0 } = projectile;
    const color = projectile.color || (hostile ? '#ed938d' : '#87dce0');
    const speed = Math.hypot(vx, vy) || 1;
    this.line([[x + w / 2 - vx / speed * 20, y + h / 2 - vy / speed * 20], [x + w / 2, y + h / 2]], color, 3, .5);
    this.rect(x, y, w, h, color);
    this.rect(x + w / 2 - 2, y + h / 2 - 1, 4, 2, '#fff0d0');
  }

  effect(effect) {
    const { x = 0, y = 0, type, color = '#a4d5d4', radius = 25 } = effect;
    const life = Math.max(0, Math.min(1, (effect.life ?? .5) / (effect.maxLife || 1)));
    const spread = 1 - life;
    if (type === 'trainingDamage') {
      const display = `${effect.label || '피해'}${Number.isFinite(effect.value) ? ` ${Math.round(effect.value)}` : ''}`;
      const ty = Math.max(210, y - spread * 27);
      const width = Math.max(64, display.length * 10 + 18);
      this.rect(x - width / 2, ty - 12, width, 24, '#071822', Math.min(1, life * 2));
      this.text(display, x, ty, color, 12);
    } else if (type === 'warning') {
      // Keep the full damaging footprint visible for the entire warning period.
      this.rect(x - radius, y - 2, radius * 2, 4, color, .85);
      this.rect(x - radius, y - 90, radius * 2, 90, color, .025 + spread * .065);
      this.line([[x - radius, y - 20], [x - radius, y], [x + radius, y], [x + radius, y - 20]], color, 1, .8);
      this.text('!', x, y - 38, color, 19);
      for (let px = x - radius + 5; px < x + radius - 4; px += 13) this.line([[px, y - 5], [px + 6, y - 11]], color, 2, .6);
    } else if (type === 'pillar') {
      this.rect(x - radius, y - 100, radius * 2, 100, color, life * .16);
      this.rect(x - radius * .5, y - 100, radius, 100, color, life * .45);
      this.rect(x - 3, y - 105, 6, 105, '#fff0c9', life * .8);
      for (let i = 0; i < 9; i++) this.rect(x + (hash(i + 76) - .5) * radius * 2, y - hash(i + 84) * 100, 3, 6, color, life);
    } else if (type === 'cast') {
      this.castEffect(effect, life, spread);
    } else if (type === 'slash' || type === 'enemySlash' || type === 'hit' || type === 'spark' || type === 'critical') {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + .3;
        const reach = 5 + spread * radius;
        const px = x + Math.cos(a) * reach, py = y + Math.sin(a) * reach;
        this.rect(px, py, 2 + life * 4, 2, color, life);
      }
      this.rect(x - 1, y - 7 * life, 2, 14 * life, '#fff0d5', life);
      this.rect(x - 7 * life, y - 1, 14 * life, 2, '#fff0d5', life);
    } else if (type === 'heal' || type === 'memory' || type === 'pickup' || type === 'collect') {
      for (let i = 0; i < 6; i++) {
        const px = x + (hash(i + 19) - .5) * 28, py = y - spread * (18 + hash(i) * 30);
        this.rect(px, py, 2, 4, color, life);
      }
    } else {
      const r = Math.max(3, radius * (.35 + spread * .65));
      const points = Array.from({ length: 9 }, (_, i) => [x + Math.cos(i * Math.PI / 4) * r, y + Math.sin(i * Math.PI / 4) * r * .65]);
      this.line(points, color, Math.max(1, life * 3), life * .8);
      for (let i = 0; i < 9; i++) this.rect(x + (hash(i + 1) - .5) * r * 2.5, y + (hash(i + 81) - .5) * r * 2, 2, 2, color, life * .8);
    }
  }

  castEffect(effect, life, spread) {
    const { x, y, color, radius = 100, facing = 1 } = effect;
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(facing, 1);
    if (color === '#ff5b70') {
      // The vermilion bird unfolds into two angular, calligraphic flame wings.
      const reach = 45 + spread * radius * .6;
      for (const dir of [-1, 1]) {
        this.poly([[0, 4], [reach * .25, dir * 15], [reach * .85, dir * 55], [reach * .7, dir * 22], [reach, dir * 35], [reach * .85, dir * 9], [reach * 1.1, dir * 15], [reach * .7, 0]], color, life * .65);
        this.line([[2, 3], [reach * .3, dir * 9], [reach * .8, dir * 32]], '#ffc1a0', 2, life * .8);
      }
      this.poly([[22, 0], [53, -10], [65, -5], [54, 0], [57, 5], [42, 7]], '#ffd6a8', life);
    } else if (color === '#52d8ff') {
      const points = Array.from({ length: 24 }, (_, i) => [i * 9 - 70, Math.sin(i * .4 + spread * 4) * (18 + spread * 12)]);
      this.line(points, color, 5, life * .3);
      this.line(points, '#b3eef0', 1, life * .9);
      const [hx, hy] = points[points.length - 1];
      this.poly([[hx - 5, hy - 8], [hx + 7, hy - 5], [hx + 18, hy + 1], [hx + 7, hy + 5], [hx - 4, hy + 8]], '#a4e1e5', life);
      this.line([[hx, hy - 7], [hx - 4, hy - 16], [hx + 1, hy - 14]], color, 2, life);
      this.rect(hx + 7, hy - 2, 3, 2, '#fff3bf', life);
    } else if (color === '#f0efff') {
      for (let i = 0; i < 3; i++) {
        const xx = 30 + i * 17 + spread * 35;
        this.poly([[xx - 8, -43], [xx + 2, -37], [xx - 4, 7], [xx - 21, 34], [xx - 13, -3]], '#f0efff', life * .75);
      }
      this.line([[-15, 25], [5, 39], [22, 36]], '#f0efff', 1, life * .8);
    } else if (color === '#8e8bf8') {
      const r = 38 + spread * 16;
      const points = Array.from({ length: 7 }, (_, i) => [Math.cos(i * Math.PI / 3) * r, Math.sin(i * Math.PI / 3) * r]);
      this.poly(points, color, life * .13);
      this.line(points, '#c2b1ee', 3, life * .8);
      for (let i = 0; i < 6; i++) this.line([[0, 0], points[i]], '#c2b1ee', 1, life * .5);
    } else {
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        this.line([[Math.cos(a) * 23, Math.sin(a) * 23], [Math.cos(a) * (40 + spread * 70), Math.sin(a) * (40 + spread * 70)]], color, 2, life);
      }
    }
    c.restore();
  }

  scan(game) {
    const player = game.player;
    if (!player) return;
    const x = player.x + player.w / 2, y = player.y + player.h / 2;
    const radius = 80 + (this.anim * 70) % 200;
    const c = this.ctx;
    c.strokeStyle = '#80dae0';
    c.lineWidth = 1;
    c.globalAlpha = .18;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
    for (let xx = this.camera - this.camera % 60; xx < this.camera + W; xx += 60) {
      for (let yy = 90; yy < H; yy += 60) {
        this.rect(xx, yy, 5, 1, '#b4e6e7', .1);
        this.rect(xx + 2, yy - 2, 1, 5, '#b4e6e7', .1);
      }
    }
  }

  escapeWall(wall, game) {
    if (wall < this.camera - 50 || wall > this.camera + W + 400) return;
    const color = game.route === 'restore' ? '#8bdbd2' : '#ed657b';
    this.rect(this.camera, 0, Math.max(0, wall - this.camera), H, '#090c16', .96);
    for (let i = 0; i < 35; i++) {
      const yy = i * 16, width = 3 + hash(i + Math.floor(this.anim * 6)) * 45;
      this.rect(wall - 4, yy, width, 7 + hash(i) * 10, color, .08 + hash(i + 20) * .3);
      this.rect(wall + width, yy, 2, 2, color, .65);
    }
    this.line([[wall, 0], [wall, H]], color, 2, .5);
    this.text('NULL', wall - 40, H / 2, color, 12);
  }

  foreground(game) {
    const p = this.palette;
    if (this.theme !== 'kernel') {
      const rainCount = this.reducedMotion ? 28 : 77;
      for (let i = 0; i < rainCount; i++) {
        const speed = 75 + hash(i) * 140;
        const x = ((hash(i + 600) * (W + 100) - this.anim * 24 - this.camera * .05) % (W + 100) + W + 100) % (W + 100) - 50;
        const y = (hash(i + 900) * H + this.anim * speed) % H;
        const length = 5 + hash(i + 90) * 12;
        this.line([[x, y], [x - 3, y + length]], p.light, 1, .05 + hash(i + 70) * .1);
        if (i % 17 === 0) this.rect(x - 2, y + length + 2, 2, 2, p.light, .2);
      }
    }
    // Delicate scan lines are a texture, kept light enough for combat readability.
    for (let y = 0; y < H; y += 4) this.rect(0, y, W, 1, '#07101a', .08);
    const c = this.ctx;
    const vignette = c.createRadialGradient(W * .5, H * .45, 210, W * .5, H * .45, 570);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, '#030b17a0');
    c.fillStyle = vignette;
    c.fillRect(0, 0, W, H);
    // Camera framing marks reinforce the clandestine terminal-camera atmosphere.
    this.line([[14, 34], [14, 15], [33, 15]], '#a5c4c1', 1, .28);
    this.line([[W - 34, 15], [W - 15, 15], [W - 15, 34]], '#a5c4c1', 1, .28);
    this.line([[14, H - 34], [14, H - 15], [33, H - 15]], '#a5c4c1', 1, .28);
    this.line([[W - 34, H - 15], [W - 15, H - 15], [W - 15, H - 34]], '#a5c4c1', 1, .28);
  }
}
