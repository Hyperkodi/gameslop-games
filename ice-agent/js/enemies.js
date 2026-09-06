// ========================================
// ENEMY CLASSES
// ========================================
// All enemy types with AI behavior

// ========================================
// BASE ENEMY CLASS
// ========================================

class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 40;
        this.height = 70;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.dead = false;
        this.facingRight = false;

        // Get stats from config
        const stats = type === 'boss' ? { ...CONFIG.BOSS, health: CONFIG.BOSS.baseHealth } : CONFIG.ENEMIES[type];
        this.maxHealth = stats.health;
        this.health = this.maxHealth;
        this.speed = stats.speed;
        this.damage = stats.damage;
        this.scoreValue = stats.scoreValue;

        // Apply difficulty multiplier
        if (window.currentDifficulty) {
            const diff = CONFIG.DIFFICULTY[window.currentDifficulty];
            this.maxHealth *= diff.enemyHealthMultiplier;
            this.health = this.maxHealth;
            this.damage *= diff.enemyDamageMultiplier;
        }
    }

    update(player, level) {
        if (this.dead) return;

        // Apply gravity
        this.vy += 0.5;
        this.y += this.vy;

        // Check ground collision
        this.checkGroundCollision(level);

        // Update facing direction
        if (player.x > this.x) {
            this.facingRight = true;
        } else {
            this.facingRight = false;
        }
    }

    checkGroundCollision(level) {
        const groundY = level.groundY || 550;

        if (this.y + this.height >= groundY) {
            this.y = groundY - this.height;
            this.vy = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }
    }

    takeDamage(damage, player) {
        this.health -= damage;

        if (this.health <= 0) {
            this.die(player);
        }
    }

    die(player) {
        if (this.dead) return;

        this.dead = true;

        // Blood splatter
        effects.createBlood(this.x + this.width / 2, this.y + this.height / 2);

        // Sound
        soundManager.playSound('enemyDeath');

        // Score
        if (player) {
            player.addScore(this.scoreValue);
        }
    }

    draw(ctx, cameraX) {
        if (this.dead) return;

        // Draw simple rectangle placeholder (replace with sprite later)
        ctx.fillStyle = this.getColor();
        ctx.fillRect(
            this.x - cameraX,
            this.y,
            this.width,
            this.height
        );

        // Draw health bar
        this.drawHealthBar(ctx, cameraX);

        // Draw facing direction indicator
        ctx.fillStyle = '#000000';
        const eyeX = this.facingRight ? this.x + this.width - 10 : this.x + 10;
        ctx.fillRect(eyeX - cameraX, this.y + 10, 5, 5);
    }

    drawHealthBar(ctx, cameraX) {
        const barWidth = this.width;
        const barHeight = 4;
        const barX = this.x - cameraX;
        const barY = this.y - 10;

        // Background
        ctx.fillStyle = '#000000';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }

    getColor() {
        return '#999999'; // Override in subclasses
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// ========================================
// MACHETE PIRATE (Basic melee enemy)
// ========================================

class MachetePirate extends Enemy {
    constructor(x, y) {
        super(x, y, 'machete');
        this.attackCooldown = 0;
        this.attackRange = CONFIG.ENEMIES.machete.attackRange;
    }

    update(player, level) {
        super.update(player, level);

        if (this.dead) return;

        // Move towards player
        if (Math.abs(player.x - this.x) > this.attackRange) {
            if (player.x > this.x) {
                this.x += this.speed;
            } else {
                this.x -= this.speed;
            }
        } else {
            // Attack player
            if (this.attackCooldown <= 0) {
                this.attack(player);
                this.attackCooldown = CONFIG.ENEMIES.machete.attackCooldown;
            }
        }

        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }
    }

    attack(player) {
        // Check if in range
        const distance = Math.abs(player.x - this.x);
        if (distance <= this.attackRange) {
            player.takeDamage(this.damage);
        }
    }

    getColor() {
        return '#8B4513'; // Brown
    }
}

// ========================================
// KAREN (Screaming manager-caller)
// ========================================

class Karen extends Enemy {
    constructor(x, y) {
        super(x, y, 'karen');
        this.attackCooldown = 0;
        this.attackRange = CONFIG.ENEMIES.karen.attackRange;
        this.hasScreamed = false;
    }

    update(player, level) {
        super.update(player, level);

        if (this.dead) return;

        // Scream on spawn
        if (!this.hasScreamed) {
            soundManager.playSound('karenSpawn');
            effects.showPopup("I'M GETTING THE MANAGER!", 'special');
            this.hasScreamed = true;
        }

        // Same behavior as machete
        if (Math.abs(player.x - this.x) > this.attackRange) {
            if (player.x > this.x) {
                this.x += this.speed;
            } else {
                this.x -= this.speed;
            }
        } else {
            if (this.attackCooldown <= 0) {
                this.attack(player);
                this.attackCooldown = CONFIG.ENEMIES.karen.attackCooldown;
            }
        }

        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }
    }

    attack(player) {
        const distance = Math.abs(player.x - this.x);
        if (distance <= this.attackRange) {
            player.takeDamage(this.damage);
        }
    }

    die(player) {
        if (this.dead) return;

        super.die(player);

        // Karen death sound
        soundManager.playSound('karenDeath');
        effects.showPopup("I'M CALLING CORPORATE!", 'special');

        // Drop gun (always)
        const gun = new WeaponDrop(this.x, this.y, 'pistol');
        if (window.currentLevel) {
            window.currentLevel.collectibles.push(gun);
        }

        // Update Karen kill stat
        achievementManager.updateStat('karenKills', 1);
    }

    getColor() {
        return '#FF69B4'; // Hot pink
    }
}

// ========================================
// GLUE HUFFER (Kamikaze explosion)
// ========================================

class GlueHuffer extends Enemy {
    constructor(x, y) {
        super(x, y, 'glueHuffer');
        this.explosionDamage = CONFIG.ENEMIES.glueHuffer.explosionDamage;
        this.explosionRadius = CONFIG.ENEMIES.glueHuffer.explosionRadius;
    }

    update(player, level) {
        super.update(player, level);

        if (this.dead) return;

        // Rush towards player
        if (player.x > this.x) {
            this.x += this.speed;
        } else {
            this.x -= this.speed;
        }

        // Explode if close to player
        const distance = Math.sqrt(
            Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2)
        );

        if (distance < 50) {
            this.explode(player);
        }
    }

    explode(player) {
        if (this.dead) return;

        this.dead = true;

        // Explosion effect
        effects.createExplosion(this.x + this.width / 2, this.y + this.height / 2, this.explosionRadius);
        soundManager.playSound('explosion');

        // Damage player if in range
        const distance = Math.sqrt(
            Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2)
        );

        if (distance < this.explosionRadius) {
            player.takeDamage(this.explosionDamage);
        }

        // Score
        if (player) {
            player.addScore(this.scoreValue);
        }
    }

    getColor() {
        return '#FFD700'; // Gold
    }
}

// ========================================
// SUICIDE BOMBER (Bigger explosion, shootable vest)
// ========================================

class SuicideBomber extends Enemy {
    constructor(x, y) {
        super(x, y, 'suicideBomber');
        this.explosionDamage = CONFIG.ENEMIES.suicideBomber.explosionDamage;
        this.explosionRadius = CONFIG.ENEMIES.suicideBomber.explosionRadius;
        this.vestHealth = 10; // Can shoot vest to detonate early
    }

    update(player, level) {
        super.update(player, level);

        if (this.dead) return;

        // Rush towards player (slower than glue huffer)
        if (player.x > this.x) {
            this.x += this.speed;
        } else {
            this.x -= this.speed;
        }

        // Explode if very close to player
        const distance = Math.sqrt(
            Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2)
        );

        if (distance < 40) {
            this.explode(player);
        }
    }

    takeDamage(damage, player) {
        this.vestHealth -= damage;

        // If vest is destroyed, explode immediately
        if (this.vestHealth <= 0) {
            this.explode(player);
        } else {
            super.takeDamage(damage, player);
        }
    }

    explode(player) {
        if (this.dead) return;

        this.dead = true;

        // Bigger explosion
        effects.createExplosion(this.x + this.width / 2, this.y + this.height / 2, this.explosionRadius);
        soundManager.playSound('explosion');
        effects.shake(3);

        // Damage player if in range
        const distance = Math.sqrt(
            Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2)
        );

        if (distance < this.explosionRadius) {
            player.takeDamage(this.explosionDamage);
        }

        // Score
        if (player) {
            player.addScore(this.scoreValue);
        }
    }

    getColor() {
        return '#FF4500'; // Orange red
    }
}

// ========================================
// GUN PIRATE (Long range, heavily nerfed)
// ========================================

class GunPirate extends Enemy {
    constructor(x, y) {
        super(x, y, 'gunPirate');
        this.shootCooldown = 0;
        this.preferredDistance = CONFIG.ENEMIES.gunPirate.preferredDistance;
        this.bulletDamage = CONFIG.ENEMIES.gunPirate.bulletDamage;
        this.bullets = [];
    }

    update(player, level) {
        super.update(player, level);

        if (this.dead) return;

        const distance = Math.abs(player.x - this.x);

        // Maintain preferred distance (close range only)
        if (distance > this.preferredDistance + 20) {
            // Move closer
            if (player.x > this.x) {
                this.x += this.speed;
            } else {
                this.x -= this.speed;
            }
        } else if (distance < this.preferredDistance - 20) {
            // Move away
            if (player.x > this.x) {
                this.x -= this.speed;
            } else {
                this.x += this.speed;
            }
        }

        // Shoot at player
        if (this.shootCooldown <= 0 && distance < this.preferredDistance + 50) {
            this.shoot(player);
            this.shootCooldown = CONFIG.ENEMIES.gunPirate.shootCooldown;
        }

        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }

        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].x += this.bullets[i].vx;
            this.bullets[i].life--;

            // Check collision with player
            if (this.checkBulletCollision(this.bullets[i], player)) {
                player.takeDamage(this.bulletDamage);
                this.bullets.splice(i, 1);
            } else if (this.bullets[i].life <= 0) {
                this.bullets.splice(i, 1);
            }
        }
    }

    shoot(player) {
        const bulletSpeed = 6;
        const direction = player.x > this.x ? 1 : -1;

        this.bullets.push({
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            vx: bulletSpeed * direction,
            life: 120,
            size: 4
        });

        // Muzzle flash
        effects.createMuzzleFlash(this.x + this.width / 2, this.y + this.height / 2, direction);
    }

    checkBulletCollision(bullet, player) {
        return bullet.x > player.x &&
               bullet.x < player.x + player.width &&
               bullet.y > player.y &&
               bullet.y < player.y + player.height;
    }

    draw(ctx, cameraX) {
        super.draw(ctx, cameraX);

        // Draw bullets
        ctx.fillStyle = '#ffff00';
        this.bullets.forEach(bullet => {
            ctx.fillRect(
                bullet.x - cameraX - bullet.size / 2,
                bullet.y - bullet.size / 2,
                bullet.size,
                bullet.size
            );
        });
    }

    getColor() {
        return '#4169E1'; // Royal blue
    }
}

// ========================================
// RPG PIRATE (Slow rockets, level 3+)
// ========================================

class RPGPirate extends Enemy {
    constructor(x, y) {
        super(x, y, 'rpgPirate');
        this.shootCooldown = 0;
        this.rocketDamage = CONFIG.ENEMIES.rpgPirate.rocketDamage;
        this.rocketSpeed = CONFIG.ENEMIES.rpgPirate.rocketSpeed;
        this.explosionRadius = CONFIG.ENEMIES.rpgPirate.explosionRadius;
        this.rockets = [];
    }

    update(player, level) {
        super.update(player, level);

        if (this.dead) return;

        // Move slowly
        const distance = Math.abs(player.x - this.x);

        if (distance > 200) {
            if (player.x > this.x) {
                this.x += this.speed;
            } else {
                this.x -= this.speed;
            }
        }

        // Shoot rockets
        if (this.shootCooldown <= 0) {
            this.shootRocket(player);
            this.shootCooldown = CONFIG.ENEMIES.rpgPirate.shootCooldown;
        }

        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }

        // Update rockets
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const rocket = this.rockets[i];

            // Track player
            const dx = player.x - rocket.x;
            const dy = player.y - rocket.y;
            const angle = Math.atan2(dy, dx);

            rocket.vx += Math.cos(angle) * 0.2;
            rocket.vy += Math.sin(angle) * 0.2;

            // Limit speed
            const speed = Math.sqrt(rocket.vx * rocket.vx + rocket.vy * rocket.vy);
            if (speed > this.rocketSpeed) {
                rocket.vx = (rocket.vx / speed) * this.rocketSpeed;
                rocket.vy = (rocket.vy / speed) * this.rocketSpeed;
            }

            rocket.x += rocket.vx;
            rocket.y += rocket.vy;
            rocket.life--;

            // Check collision
            const distToPlayer = Math.sqrt(
                Math.pow(player.x - rocket.x, 2) + Math.pow(player.y - rocket.y, 2)
            );

            if (distToPlayer < 30 || rocket.life <= 0) {
                this.explodeRocket(rocket, player);
                this.rockets.splice(i, 1);
            }
        }
    }

    shootRocket(player) {
        const direction = player.x > this.x ? 1 : -1;

        this.rockets.push({
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            vx: this.rocketSpeed * direction,
            vy: 0,
            life: 180,
            size: 8
        });

        soundManager.playSound('rocketLaunch');
    }

    explodeRocket(rocket, player) {
        effects.createExplosion(rocket.x, rocket.y, this.explosionRadius);
        soundManager.playSound('rocketExplode');
        effects.shake(2);

        // Damage player if in range
        const distance = Math.sqrt(
            Math.pow(player.x - rocket.x, 2) + Math.pow(player.y - rocket.y, 2)
        );

        if (distance < this.explosionRadius) {
            player.takeDamage(this.rocketDamage);
        }
    }

    draw(ctx, cameraX) {
        super.draw(ctx, cameraX);

        // Draw rockets
        ctx.fillStyle = '#ff0000';
        this.rockets.forEach(rocket => {
            ctx.fillRect(
                rocket.x - cameraX - rocket.size / 2,
                rocket.y - rocket.size / 2,
                rocket.size,
                rocket.size
            );

            // Smoke trail
            effects.createParticles(rocket.x, rocket.y, 'dust', 2);
        });
    }

    getColor() {
        return '#8B008B'; // Dark magenta
    }
}

// ========================================
// BOSS
// ========================================

class Boss extends Enemy {
    constructor(x, y, level) {
        super(x, y, 'boss');

        // Scale health with level
        this.maxHealth = CONFIG.BOSS.baseHealth + (level - 1) * CONFIG.BOSS.healthPerLevel;
        this.health = this.maxHealth;

        this.width = 80;
        this.height = 120;
        this.level = level;
        this.phase = 1;

        this.summonCooldown = 0;
        this.specialAttackCooldown = 0;
        this.minions = [];
    }

    update(player, currentLevel) {
        super.update(player, currentLevel);

        if (this.dead) return;

        // Check phase transitions
        const healthPercent = this.health / this.maxHealth;

        if (healthPercent <= CONFIG.BOSS.phase3Threshold && this.phase < 3) {
            this.phase = 3;
            effects.showPopup('BOSS PHASE 3!', 'special');
            effects.shake(5);
        } else if (healthPercent <= CONFIG.BOSS.phase2Threshold && this.phase < 2) {
            this.phase = 2;
            effects.showPopup('BOSS PHASE 2!', 'special');
            effects.shake(3);
        }

        // Movement
        const distance = Math.abs(player.x - this.x);

        if (distance > 150) {
            if (player.x > this.x) {
                this.x += CONFIG.BOSS.speed;
            } else {
                this.x -= CONFIG.BOSS.speed;
            }
        }

        // Summon minions
        if (this.summonCooldown <= 0) {
            this.summonMinion(currentLevel);
            this.summonCooldown = CONFIG.BOSS.summonCooldown;
        }

        // Special attack
        if (this.specialAttackCooldown <= 0) {
            this.specialAttack(player);
            this.specialAttackCooldown = CONFIG.BOSS.specialAttackCooldown;
        }

        this.summonCooldown--;
        this.specialAttackCooldown--;

        // Update minions
        for (let i = this.minions.length - 1; i >= 0; i--) {
            this.minions[i].update(player, currentLevel);

            if (this.minions[i].dead) {
                this.minions.splice(i, 1);
            }
        }
    }

    summonMinion(currentLevel) {
        const minionTypes = [MachetePirate, GlueHuffer];
        const MinionClass = minionTypes[Math.floor(Math.random() * minionTypes.length)];

        const minion = new MinionClass(this.x, this.y);
        this.minions.push(minion);

        if (currentLevel) {
            currentLevel.enemies.push(minion);
        }

        effects.showPopup('BOSS SUMMONED BACKUP!', 'normal');
        soundManager.playSound('bossAttack');
    }

    specialAttack(player) {
        // Attack changes based on phase
        switch(this.phase) {
            case 1:
                // Melee rush
                if (Math.abs(player.x - this.x) < 100) {
                    player.takeDamage(CONFIG.BOSS.damage);
                    soundManager.playSound('bossAttack');
                }
                break;

            case 2:
                // Summon 2 minions
                this.summonMinion(window.currentLevel);
                this.summonMinion(window.currentLevel);
                break;

            case 3:
                // Screen shake attack
                effects.shake(8);
                player.takeDamage(CONFIG.BOSS.damage * 1.5);
                soundManager.playSound('bossAttack');
                break;
        }
    }

    die(player) {
        if (this.dead) return;

        super.die(player);

        soundManager.playSound('bossDeath');
        effects.createExplosion(this.x + this.width / 2, this.y + this.height / 2, 200);
        effects.shake(10);
        effects.showPopup('💀 BOSS DEFEATED! 💀', 'achievement');

        // Update boss kill stat
        achievementManager.updateStat('bossKills', 1);
    }

    draw(ctx, cameraX) {
        super.draw(ctx, cameraX);

        // Draw minions
        this.minions.forEach(minion => minion.draw(ctx, cameraX));

        // Draw boss name
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`LEVEL ${this.level} BOSS`, this.x + this.width / 2 - cameraX, this.y - 30);
        ctx.fillText(`PHASE ${this.phase}`, this.x + this.width / 2 - cameraX, this.y - 15);
    }

    getColor() {
        // More bling each level (brighter colors)
        const colors = ['#ff0000', '#ff4500', '#ffd700', '#ff00ff', '#00ffff', '#00ff00', '#ffffff'];
        return colors[Math.min(this.level - 1, colors.length - 1)];
    }
}
