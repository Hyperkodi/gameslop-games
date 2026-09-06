// ========================================
// VISUAL EFFECTS SYSTEM
// ========================================
// Particle system, screen shake, popups, drug effects

class EffectsManager {
    constructor() {
        this.particles = [];
        this.popups = [];
        this.shakeAmount = 0;
        this.shakeDecay = 0.9;
        this.canvas = null;
        this.ctx = null;

        // Drug effect overlays
        this.psychedelicTime = 0;
        this.discoTime = 0;
        this.blurAmount = 0;
        this.redVignetteAmount = 0;
    }

    setCanvas(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    // ========================================
    // PARTICLE SYSTEM
    // ========================================

    createParticles(x, y, type, count = 10) {
        if (!CONFIG.EFFECTS.particlesEnabled) return;

        const particleCount = Math.floor(count * CONFIG.EFFECTS.particleIntensity);

        for (let i = 0; i < particleCount; i++) {
            this.particles.push(new Particle(x, y, type));
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();

            if (this.particles[i].isDead()) {
                this.particles.splice(i, 1);
            }
        }
    }

    drawParticles(ctx, cameraX) {
        this.particles.forEach(particle => particle.draw(ctx, cameraX));
    }

    // ========================================
    // SCREEN SHAKE
    // ========================================

    shake(intensity = 1) {
        if (!CONFIG.EFFECTS.screenShakeEnabled) return;

        this.shakeAmount = Math.max(this.shakeAmount, intensity * CONFIG.EFFECTS.screenShakeIntensity * 10);
    }

    updateShake() {
        if (this.shakeAmount > 0) {
            this.shakeAmount *= this.shakeDecay;

            if (this.shakeAmount < 0.1) {
                this.shakeAmount = 0;
            }
        }
    }

    getShakeOffset() {
        if (this.shakeAmount === 0) return { x: 0, y: 0 };

        return {
            x: (Math.random() - 0.5) * this.shakeAmount,
            y: (Math.random() - 0.5) * this.shakeAmount
        };
    }

    // ========================================
    // POPUP MESSAGES
    // ========================================

    showPopup(message, type = 'normal') {
        this.popups.push(new Popup(message, type));
    }

    updatePopups() {
        for (let i = this.popups.length - 1; i >= 0; i--) {
            this.popups[i].update();

            if (this.popups[i].isDead()) {
                this.popups.splice(i, 1);
            }
        }
    }

    drawPopups(ctx) {
        this.popups.forEach(popup => popup.draw(ctx));
    }

    // ========================================
    // DRUG EFFECTS
    // ========================================

    applyPsychedelicEffect(duration) {
        this.psychedelicTime = duration;
    }

    applyDiscoEffect(duration) {
        this.discoTime = duration;
    }

    applyBlurEffect(amount) {
        this.blurAmount = amount;
    }

    applyRedVignette(amount) {
        this.redVignetteAmount = amount;
    }

    updateDrugEffects() {
        // Decay psychedelic effect
        if (this.psychedelicTime > 0) {
            this.psychedelicTime -= 16; // 60fps
        }

        // Decay disco effect
        if (this.discoTime > 0) {
            this.discoTime -= 16;
        }
    }

    drawDrugEffects(ctx, canvas) {
        // Psychedelic effect (rainbow wave overlay)
        if (this.psychedelicTime > 0) {
            const alpha = Math.min(0.3, this.psychedelicTime / 1000);
            const hue = (Date.now() / 10) % 360;

            ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Wavy lines
            for (let i = 0; i < 5; i++) {
                const y = (Date.now() / 20 + i * 100) % canvas.height;
                const gradient = ctx.createLinearGradient(0, y, canvas.width, y);
                gradient.addColorStop(0, `hsla(${(hue + i * 72) % 360}, 100%, 50%, 0)`);
                gradient.addColorStop(0.5, `hsla(${(hue + i * 72) % 360}, 100%, 50%, 0.2)`);
                gradient.addColorStop(1, `hsla(${(hue + i * 72) % 360}, 100%, 50%, 0)`);

                ctx.fillStyle = gradient;
                ctx.fillRect(0, y - 20, canvas.width, 40);
            }
        }

        // Disco effect (flashing colors)
        if (this.discoTime > 0) {
            const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ff0000', '#00ff00'];
            const colorIndex = Math.floor(Date.now() / 100) % colors.length;

            ctx.fillStyle = colors[colorIndex] + '20';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Blur effect (alcohol)
        if (this.blurAmount > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.blurAmount * 0.1})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Red vignette (fentanyl)
        if (this.redVignetteAmount > 0) {
            const gradient = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 0,
                canvas.width / 2, canvas.height / 2, canvas.width / 2
            );
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
            gradient.addColorStop(1, `rgba(255, 0, 0, ${this.redVignetteAmount * 0.5})`);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // ========================================
    // BLOOD SPLATTER
    // ========================================

    createBlood(x, y, count = 15) {
        if (!CONFIG.EFFECTS.bloodEnabled) return;

        this.createParticles(x, y, 'blood', count);
    }

    // ========================================
    // EXPLOSION
    // ========================================

    createExplosion(x, y, radius) {
        const particleCount = Math.floor(radius / 3);
        this.createParticles(x, y, 'explosion', particleCount);
        this.shake(radius / 50);
    }

    // ========================================
    // MUZZLE FLASH
    // ========================================

    createMuzzleFlash(x, y, direction) {
        this.createParticles(x, y, 'muzzle', 3);
    }

    // ========================================
    // MONEY FLOAT
    // ========================================

    createMoneyFloat(x, y, amount) {
        const popup = new FloatingText(x, y, `$${amount}`, '#ffd700');
        this.popups.push(popup);
    }
}

// ========================================
// PARTICLE CLASS
// ========================================

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 60; // Frames
        this.maxLife = 60;

        // Different particle types
        switch(type) {
            case 'blood':
                this.vx = (Math.random() - 0.5) * 8;
                this.vy = (Math.random() - 0.5) * 8 - 2;
                this.size = Math.random() * 4 + 2;
                this.color = '#8B0000';
                this.gravity = 0.3;
                break;

            case 'explosion':
                this.vx = (Math.random() - 0.5) * 12;
                this.vy = (Math.random() - 0.5) * 12;
                this.size = Math.random() * 8 + 4;
                this.color = ['#ff6600', '#ff9900', '#ffcc00'][Math.floor(Math.random() * 3)];
                this.gravity = 0;
                this.life = 30;
                this.maxLife = 30;
                break;

            case 'muzzle':
                this.vx = (Math.random() - 0.5) * 4;
                this.vy = (Math.random() - 0.5) * 4;
                this.size = Math.random() * 6 + 3;
                this.color = '#ffff00';
                this.gravity = 0;
                this.life = 10;
                this.maxLife = 10;
                break;

            case 'dust':
                this.vx = (Math.random() - 0.5) * 2;
                this.vy = Math.random() * -2;
                this.size = Math.random() * 3 + 1;
                this.color = '#666666';
                this.gravity = 0.05;
                break;
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.gravity) {
            this.vy += this.gravity;
        }

        this.life--;

        // Slow down over time
        this.vx *= 0.98;
        this.vy *= 0.98;
    }

    draw(ctx, cameraX) {
        const alpha = this.life / this.maxLife;

        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(
            this.x - cameraX - this.size / 2,
            this.y - this.size / 2,
            this.size,
            this.size
        );
        ctx.globalAlpha = 1;
    }

    isDead() {
        return this.life <= 0;
    }
}

// ========================================
// POPUP CLASS
// ========================================

class Popup {
    constructor(message, type) {
        this.message = message;
        this.type = type;
        this.y = 150;
        this.life = 180; // 3 seconds at 60fps
        this.maxLife = 180;

        // Position based on type
        if (type === 'achievement') {
            this.y = 100;
            this.life = 240; // Achievements stay longer
            this.maxLife = 240;
        }
    }

    update() {
        this.life--;
        this.y -= 0.5; // Float upwards
    }

    draw(ctx) {
        const alpha = Math.min(1, this.life / 60);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Use arcade font style
        ctx.font = 'bold 24px "Courier New", monospace';
        ctx.textAlign = 'center';

        // Black shadow (no background box)
        ctx.fillStyle = '#000000';
        ctx.fillText(this.message, ctx.canvas.width / 2 + 2, this.y + 2);

        // Yellow text for normal, gold for achievements
        if (this.type === 'achievement') {
            ctx.fillStyle = '#ffd700';
        } else if (this.type === 'special') {
            ctx.fillStyle = '#ff00ff';
        } else {
            ctx.fillStyle = '#ffff00';
        }

        ctx.fillText(this.message, ctx.canvas.width / 2, this.y);

        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// ========================================
// FLOATING TEXT CLASS (for money, etc.)
// ========================================

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.vy = -2;
        this.life = 60;
        this.maxLife = 60;
    }

    update() {
        this.y += this.vy;
        this.life--;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.textAlign = 'center';

        // Black shadow
        ctx.fillStyle = '#000000';
        ctx.fillText(this.text, this.x + 1, this.y + 1);

        // Colored text
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);

        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// Create global effects manager
const effects = new EffectsManager();
