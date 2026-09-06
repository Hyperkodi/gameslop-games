// ========================================
// LEVEL MANAGEMENT SYSTEM
// ========================================
// Level generation, progression, and camera

class Level {
    constructor(levelNumber, player) {
        this.levelNumber = levelNumber;
        this.player = player;

        // Level configuration
        this.config = CONFIG.LEVELS[levelNumber];
        this.groundY = 550;
        this.width = 3000; // Side-scrolling level width

        // Entities
        this.enemies = [];
        this.bullets = [];
        this.collectibles = [];
        this.desks = [];

        // Boss
        this.boss = null;
        this.bossSpawned = false;
        this.bossDefeated = false;

        // Kill counter
        this.killCount = 0;
        this.killRequirement = this.config.killRequirement;

        // Camera
        this.camera = {
            x: 0,
            y: 0,
            width: 1280,
            height: 720
        };

        // Background
        this.backgroundImage = null;
        this.loadBackground();

        // Generate level
        this.generate();
    }

    loadBackground() {
        // Try to load background image
        this.backgroundImage = new Image();
        this.backgroundImage.src = `assets/backgrounds/level-${this.levelNumber}-bg.webp`;

        this.backgroundImage.onerror = () => {
            this.backgroundImage = null; // Use solid color if image not found
        };
    }

    generate() {
        // Generate desks
        this.generateDesks();

        // Generate initial enemies
        this.generateEnemies();

        // Generate collectibles
        this.generateCollectibles();
    }

    generateDesks() {
        const deskCount = this.config.deskCount;

        for (let i = 0; i < deskCount; i++) {
            const x = 200 + i * 250 + Math.random() * 100;
            const y = this.groundY - 80; // On ground

            this.desks.push(new Desk(x, y));
        }
    }

    generateEnemies() {
        const enemies = [];
        const startX = 500; // Spawn enemies ahead of player

        // Machete Pirates
        for (let i = 0; i < this.config.macheteCount; i++) {
            const x = startX + i * 200 + Math.random() * 100;
            const y = this.groundY - 70;
            enemies.push(new MachetePirate(x, y));
        }

        // Karens (1 in 7 spawn rate)
        for (let i = 0; i < this.config.karenCount; i++) {
            const x = startX + Math.random() * 2000;
            const y = this.groundY - 70;
            enemies.push(new Karen(x, y));
        }

        // Glue Huffers
        for (let i = 0; i < this.config.glueCount; i++) {
            const x = startX + 300 + i * 300 + Math.random() * 100;
            const y = this.groundY - 70;
            enemies.push(new GlueHuffer(x, y));
        }

        // Gun Pirates
        for (let i = 0; i < this.config.gunCount; i++) {
            const x = startX + 400 + i * 500 + Math.random() * 200;
            const y = this.groundY - 70;
            enemies.push(new GunPirate(x, y));
        }

        // Suicide Bombers
        for (let i = 0; i < this.config.bomberCount; i++) {
            const x = startX + 200 + i * 350 + Math.random() * 100;
            const y = this.groundY - 70;
            enemies.push(new SuicideBomber(x, y));
        }

        // RPG Pirates (level 3+)
        if (this.levelNumber >= 3) {
            for (let i = 0; i < this.config.rpgCount; i++) {
                const x = startX + 600 + i * 600 + Math.random() * 200;
                const y = this.groundY - 70;
                enemies.push(new RPGPirate(x, y));
            }
        }

        this.enemies = enemies;
    }

    generateCollectibles() {
        const collectibleCount = this.config.collectibleCount;

        for (let i = 0; i < collectibleCount; i++) {
            const x = 300 + i * 200 + Math.random() * 150;
            const y = this.groundY - 30;

            const item = CollectibleFactory.createRandom(x, y);
            if (item) {
                this.collectibles.push(item);
            }
        }
    }

    spawnBoss() {
        if (this.bossSpawned) return;

        this.bossSpawned = true;

        // Spawn boss at far right
        const bossX = this.width - 300;
        const bossY = this.groundY - 120;

        this.boss = new Boss(bossX, bossY, this.levelNumber);

        soundManager.playSound('bossSpawn');
        soundManager.playMusic('boss', true);

        effects.showPopup('⚠️ BOSS INCOMING! ⚠️', 'achievement');
        effects.shake(5);
    }

    update() {
        // Update camera
        this.updateCamera();

        // Update desks
        this.desks.forEach(desk => desk.update(this.player));

        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            this.enemies[i].update(this.player, this);

            if (this.enemies[i].dead) {
                this.killCount++;
                this.enemies.splice(i, 1);
            }
        }

        // Update boss
        if (this.boss) {
            this.boss.update(this.player, this);

            if (this.boss.dead && !this.bossDefeated) {
                this.bossDefeated = true;
                this.levelComplete();
            }
        }

        // Update bullets
        this.updateBullets();

        // Update collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            this.collectibles[i].update(this);

            // Check collision with player
            if (this.collectibles[i].checkCollision(this.player)) {
                this.collectibles.splice(i, 1);
            }
        }

        // Check if boss should spawn
        if (!this.bossSpawned && this.killCount >= this.killRequirement) {
            this.spawnBoss();
        }
    }

    updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            // Update position
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            bullet.life--;

            // Check collision with enemies
            let hit = false;

            this.enemies.forEach(enemy => {
                if (enemy.dead) return;

                if (this.checkBulletCollision(bullet, enemy)) {
                    enemy.takeDamage(bullet.damage, this.player);
                    hit = true;
                }
            });

            // Check collision with boss
            if (this.boss && !this.boss.dead) {
                if (this.checkBulletCollision(bullet, this.boss)) {
                    this.boss.takeDamage(bullet.damage, this.player);
                    hit = true;
                }
            }

            // Check collision with desks
            this.desks.forEach(desk => {
                if (desk.destroyed) return;

                const bounds = desk.getBounds();
                if (bullet.x > bounds.x && bullet.x < bounds.x + bounds.width &&
                    bullet.y > bounds.y && bullet.y < bounds.y + bounds.height) {
                    desk.takeDamage(bullet.damage);
                    hit = true;
                }
            });

            // Remove bullet if hit or expired
            if (hit || bullet.life <= 0 || bullet.x < 0 || bullet.x > this.width) {
                this.bullets.splice(i, 1);
            }
        }
    }

    checkBulletCollision(bullet, entity) {
        const bounds = entity.getBounds();

        return bullet.x > bounds.x &&
               bullet.x < bounds.x + bounds.width &&
               bullet.y > bounds.y &&
               bullet.y < bounds.y + bounds.height;
    }

    updateCamera() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        // Follow player
        const targetX = this.player.x - canvas.width / 2;

        // Smooth camera
        this.camera.x += (targetX - this.camera.x) * 0.1;

        // Clamp camera to level bounds
        this.camera.x = Math.max(0, Math.min(this.camera.x, this.width - canvas.width));
        this.camera.y = 0;
    }

    levelComplete() {
        soundManager.playSound('levelComplete');
        soundManager.playMusic('gameplay', true);

        effects.showPopup('🎉 LEVEL COMPLETE! 🎉', 'achievement');

        // Update stats
        achievementManager.updateStat('levelsCompleted', this.levelNumber);

        // Check for no-damage achievement
        if (this.player.damageTaken === 0) {
            achievementManager.updateStat('noDamageLevels', this.levelNumber);
        }

        // Notify game controller
        if (window.game) {
            setTimeout(() => {
                window.game.levelComplete();
            }, 2000);
        }
    }

    draw(ctx) {
        // Draw background
        this.drawBackground(ctx);

        // Draw ground
        this.drawGround(ctx);

        // Draw collectibles
        this.collectibles.forEach(item => item.draw(ctx, this.camera.x));

        // Draw desks
        this.desks.forEach(desk => desk.draw(ctx, this.camera.x));

        // Draw player
        this.player.draw(ctx, this.camera.x);

        // Draw enemies
        this.enemies.forEach(enemy => enemy.draw(ctx, this.camera.x));

        // Draw boss
        if (this.boss) {
            this.boss.draw(ctx, this.camera.x);
        }

        // Draw bullets
        this.drawBullets(ctx);

        // Draw HUD
        this.drawHUD(ctx);
    }

    drawBackground(ctx) {
        if (this.backgroundImage && this.backgroundImage.complete) {
            // Draw background image (parallax could be added)
            ctx.drawImage(this.backgroundImage, 0, 0, ctx.canvas.width, ctx.canvas.height);
        } else {
            // Solid color background
            const colors = ['#87CEEB', '#87CEFA', '#B0E0E6', '#ADD8E6', '#E0F6FF', '#F0F8FF', '#FFFACD'];
            ctx.fillStyle = colors[this.levelNumber - 1] || '#87CEEB';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    }

    drawGround(ctx) {
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, this.groundY, ctx.canvas.width, ctx.canvas.height - this.groundY);

        // Ground line
        ctx.strokeStyle = '#006400';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, this.groundY);
        ctx.lineTo(ctx.canvas.width, this.groundY);
        ctx.stroke();
    }

    drawBullets(ctx) {
        this.bullets.forEach(bullet => {
            ctx.fillStyle = bullet.color;
            ctx.fillRect(
                bullet.x - this.camera.x - bullet.size / 2,
                bullet.y - bullet.size / 2,
                bullet.size,
                bullet.size
            );
        });
    }

    drawHUD(ctx) {
        const padding = 20;

        // Health bar
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('HEALTH:', padding, 30);

        const healthBarWidth = 200;
        const healthBarHeight = 20;
        const healthBarX = padding + 80;
        const healthBarY = 15;

        // Health bar background
        ctx.fillStyle = '#333333';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

        // Health bar fill
        const healthPercent = this.player.health / this.player.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);

        // Health text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(
            Math.max(0, Math.floor(this.player.health)),
            healthBarX + healthBarWidth / 2,
            healthBarY + 15
        );

        // Score
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE: ${this.player.score}`, padding, 60);

        // Level
        ctx.fillText(`LEVEL: ${this.levelNumber}/${CONFIG.TOTAL_LEVELS}`, padding, 90);

        // Kill count
        ctx.fillText(`KILLS: ${this.killCount}/${this.killRequirement}`, padding, 120);

        // Weapon & Ammo
        ctx.fillText(`WEAPON: ${this.player.currentWeapon.toUpperCase()}`, padding, 150);

        const ammo = this.player.weapons[this.player.currentWeapon].ammo;
        const ammoText = ammo === Infinity ? '∞' : ammo;
        ctx.fillText(`AMMO: ${ammoText}`, padding, 180);

        // Money, Documents, Kids
        ctx.fillText(`💵 $${this.player.money}`, padding, 210);
        ctx.fillText(`📄 ${this.player.documents}`, padding, 240);
        ctx.fillText(`👶 ${this.player.kids}`, padding, 270);

        // Active power-ups
        let powerupY = 300;
        for (let [type, powerup] of Object.entries(this.player.powerups)) {
            if (powerup.active || powerup.comedown) {
                const timeLeft = powerup.comedown ? powerup.comedownTimer : powerup.timer;
                const label = powerup.comedown ? `${type.toUpperCase()} COMEDOWN` : type.toUpperCase();

                ctx.fillStyle = powerup.comedown ? '#ff0000' : '#00ff00';
                ctx.fillText(`${label}: ${Math.ceil(timeLeft / 1000)}s`, padding, powerupY);
                powerupY += 30;
            }
        }

        // Boss health
        if (this.boss && !this.boss.dead) {
            const bossBarWidth = 400;
            const bossBarHeight = 30;
            const bossBarX = ctx.canvas.width / 2 - bossBarWidth / 2;
            const bossBarY = 50;

            // Boss name
            ctx.fillStyle = '#ff0000';
            ctx.textAlign = 'center';
            ctx.font = 'bold 20px "Courier New", monospace';
            ctx.fillText(`LEVEL ${this.levelNumber} BOSS - PHASE ${this.boss.phase}`, ctx.canvas.width / 2, bossBarY - 10);

            // Boss health bar
            ctx.fillStyle = '#000000';
            ctx.fillRect(bossBarX, bossBarY, bossBarWidth, bossBarHeight);

            const bossHealthPercent = this.boss.health / this.boss.maxHealth;
            ctx.fillStyle = bossHealthPercent > 0.5 ? '#ff0000' : bossHealthPercent > 0.25 ? '#ff6600' : '#ff00ff';
            ctx.fillRect(bossBarX, bossBarY, bossBarWidth * bossHealthPercent, bossBarHeight);

            // Boss health text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(
                `${Math.floor(this.boss.health)} / ${this.boss.maxHealth}`,
                ctx.canvas.width / 2,
                bossBarY + 20
            );
        }
    }
}
