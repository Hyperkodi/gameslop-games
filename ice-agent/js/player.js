// ========================================
// PLAYER CLASS
// ========================================
// Player character with weapons and power-ups

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.PLAYER.WIDTH;
        this.height = CONFIG.PLAYER.HEIGHT;
        this.vx = 0;
        this.vy = 0;
        this.speed = CONFIG.PLAYER.SPEED;
        this.jumpPower = CONFIG.PLAYER.JUMP_POWER;
        this.onGround = false;
        this.facingRight = true;

        // Health
        this.maxHealth = CONFIG.PLAYER.MAX_HEALTH;
        this.health = this.maxHealth;

        // Weapons
        this.currentWeapon = 'pistol';
        this.weapons = {
            pistol: { ammo: CONFIG.WEAPONS.pistol.maxAmmo },
            smg: { ammo: 0 },
            shotgun: { ammo: 0 },
            rifle: { ammo: 0 },
            knife: { ammo: Infinity }
        };
        this.fireTimer = 0;

        // Power-ups
        this.powerups = {
            mushroom: { active: false, timer: 0 },
            cocaine: { active: false, timer: 0, comedown: false, comedownTimer: 0 },
            steroids: { active: false, timer: 0 },
            alcohol: { active: false, timer: 0 },
            fentanyl: { active: false, timer: 0 }
        };

        // Stats
        this.score = 0;
        this.money = 0;
        this.documents = 0;
        this.kids = 0;
        this.damageTaken = 0; // For no-damage achievements

        // Input
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;

        // Invulnerability frames after taking damage
        this.invulnerable = false;
        this.invulnerableTimer = 0;

        this.setupControls();
    }

    setupControls() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;

            // Weapon switching
            if (e.key >= '1' && e.key <= '5') {
                const weapons = ['pistol', 'smg', 'shotgun', 'rifle', 'knife'];
                this.currentWeapon = weapons[parseInt(e.key) - 1];
            }

            // Interact with desks
            if (e.key.toLowerCase() === 'e' || e.key === ' ') {
                this.interact();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Mouse
        window.addEventListener('mousemove', (e) => {
            const canvas = document.getElementById('gameCanvas');
            const rect = canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * canvas.width / rect.width;
            this.mouseY = (e.clientY - rect.top) * canvas.height / rect.height;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                this.keys.shoot = true;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.keys.shoot = false;
            }
        });

        // Mouse wheel for weapon switching
        window.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
        });
    }

    cycleWeapon(direction) {
        const weapons = ['pistol', 'smg', 'shotgun', 'rifle', 'knife'];
        const currentIndex = weapons.indexOf(this.currentWeapon);
        let newIndex = (currentIndex + direction + weapons.length) % weapons.length;

        this.currentWeapon = weapons[newIndex];
    }

    update(level) {
        // Handle input
        this.handleMovement();

        // Apply gravity
        this.vy += 0.5;

        // Update velocity
        this.x += this.vx;
        this.y += this.vy;

        // Check collisions
        this.checkGroundCollision(level);

        // Shooting
        if (this.keys.shoot) {
            this.shoot(level);
        }

        // Update fire timer
        if (this.fireTimer > 0) {
            this.fireTimer--;
        }

        // Update power-ups
        this.updatePowerups();

        // Update invulnerability
        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer--;
            if (this.invulnerableTimer === 0) {
                this.invulnerable = false;
            }
        }

        // Friction
        this.vx *= 0.8;
    }

    handleMovement() {
        let moveSpeed = this.speed;

        // Apply power-up modifiers
        if (this.powerups.cocaine.active && !this.powerups.cocaine.comedown) {
            moveSpeed *= CONFIG.POWERUPS.cocaine.speedMultiplier;
        }
        if (this.powerups.cocaine.comedown) {
            moveSpeed *= 0.5; // Slow during comedown
        }
        if (this.powerups.steroids.active) {
            moveSpeed *= CONFIG.POWERUPS.steroids.speedMultiplier;
        }
        if (this.powerups.alcohol.active) {
            moveSpeed *= CONFIG.POWERUPS.alcohol.speedMultiplier;
        }
        if (this.powerups.fentanyl.active) {
            moveSpeed *= CONFIG.POWERUPS.fentanyl.speedMultiplier;
        }

        // Left/Right movement
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.vx = -moveSpeed;
            this.facingRight = false;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.vx = moveSpeed;
            this.facingRight = true;
        }

        // Jump
        if ((this.keys['w'] || this.keys['arrowup'] || this.keys[' ']) && this.onGround) {
            let jumpPower = this.jumpPower;

            if (this.powerups.steroids.active) {
                jumpPower *= CONFIG.POWERUPS.steroids.jumpMultiplier;
            }

            this.vy = -jumpPower;
            this.onGround = false;
            soundManager.playSound('jump');
        }

        // Crouch (not implemented fully, placeholder)
        if (this.keys['s'] || this.keys['arrowdown']) {
            // Could add crouch mechanics later
        }
    }

    checkGroundCollision(level) {
        const groundY = level.groundY || 550;

        const wasOnGround = this.onGround;

        if (this.y + this.height >= groundY) {
            this.y = groundY - this.height;
            this.vy = 0;
            this.onGround = true;

            // Landing sound
            if (!wasOnGround) {
                soundManager.playSound('land');
            }
        } else {
            this.onGround = false;
        }

        // Flying with mushroom
        if (this.powerups.mushroom.active) {
            this.onGround = true; // Can "jump" in air
            this.vy = 0; // Float
        }
    }

    shoot(level) {
        // Check fire rate
        const weaponConfig = CONFIG.WEAPONS[this.currentWeapon];

        if (!weaponConfig) return;

        // Knife is special (melee)
        if (this.currentWeapon === 'knife') {
            if (this.fireTimer === 0) {
                this.meleeAttack(level);
                this.fireTimer = weaponConfig.attackRate / 16; // Convert ms to frames
            }
            return;
        }

        // Check ammo
        if (this.weapons[this.currentWeapon].ammo <= 0) {
            if (this.fireTimer === 0) {
                soundManager.playSound('emptyClick');
                this.fireTimer = 30; // Prevent spam
            }
            return;
        }

        // Check fire rate
        let fireRate = weaponConfig.fireRate / 16; // Convert ms to frames

        // Cocaine increases fire rate
        if (this.powerups.cocaine.active && !this.powerups.cocaine.comedown) {
            fireRate /= CONFIG.POWERUPS.cocaine.fireRateMultiplier;
        }

        if (this.fireTimer === 0) {
            // Calculate bullet direction
            const cameraX = level.camera ? level.camera.x : 0;
            const screenPlayerX = this.x - cameraX + this.width / 2;
            const dx = this.mouseX - screenPlayerX;
            const dy = this.mouseY - (this.y + this.height / 2);
            const angle = Math.atan2(dy, dx);

            // Spawn bullets
            for (let i = 0; i < weaponConfig.bulletsPerShot; i++) {
                let bulletAngle = angle;

                // Add spread
                if (weaponConfig.spread > 0) {
                    bulletAngle += (Math.random() - 0.5) * weaponConfig.spread;
                }

                const bullet = {
                    x: this.x + this.width / 2,
                    y: this.y + this.height / 2,
                    vx: Math.cos(bulletAngle) * weaponConfig.bulletSpeed,
                    vy: Math.sin(bulletAngle) * weaponConfig.bulletSpeed,
                    damage: weaponConfig.damage,
                    size: weaponConfig.bulletSize,
                    color: weaponConfig.color,
                    life: 120
                };

                // Apply steroid damage multiplier
                if (this.powerups.steroids.active) {
                    bullet.damage *= CONFIG.POWERUPS.steroids.damageMultiplier;
                }

                level.bullets.push(bullet);
            }

            // Consume ammo
            this.weapons[this.currentWeapon].ammo--;

            // Effects
            soundManager.playWeaponSound(this.currentWeapon);
            effects.createMuzzleFlash(this.x + this.width / 2, this.y + this.height / 2, this.facingRight ? 1 : -1);
            effects.shake(0.5);

            this.fireTimer = fireRate;
        }
    }

    meleeAttack(level) {
        soundManager.playSound('knifeSwing');

        const range = CONFIG.WEAPONS.knife.range;
        const attackX = this.facingRight ? this.x + this.width : this.x - range;

        // Check for enemies in range
        level.enemies.forEach(enemy => {
            if (enemy.dead) return;

            const inRange = this.facingRight ?
                enemy.x < attackX + range && enemy.x > this.x :
                enemy.x + enemy.width > attackX && enemy.x < this.x;

            const inHeight = Math.abs(enemy.y - this.y) < this.height;

            if (inRange && inHeight) {
                let damage = CONFIG.WEAPONS.knife.damage;

                // Apply steroid bonus
                if (this.powerups.steroids.active) {
                    damage *= CONFIG.POWERUPS.steroids.damageMultiplier;
                }

                enemy.takeDamage(damage, this);
                soundManager.playSound('knifeHit');
                effects.createBlood(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 10);
            }
        });
    }

    interact() {
        // Check for nearby desks
        if (window.currentLevel && window.currentLevel.desks) {
            window.currentLevel.desks.forEach(desk => {
                if (desk.opened) return;

                const distance = Math.abs(this.x - desk.x);
                if (distance < 100) {
                    desk.open(this);
                }
            });
        }
    }

    takeDamage(damage) {
        // Check invulnerability
        if (this.invulnerable) return;

        // Fentanyl makes you invulnerable
        if (this.powerups.fentanyl.active) return;

        // Alcohol reduces damage
        if (this.powerups.alcohol.active) {
            damage *= CONFIG.POWERUPS.alcohol.damageReduction;
        }

        this.health -= damage;
        this.damageTaken += damage;

        // Invulnerability frames
        this.invulnerable = true;
        this.invulnerableTimer = 60; // 1 second

        soundManager.playSound('damage');
        effects.shake(2);

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        soundManager.playSound('death');
        effects.shake(8);

        // Game over handled by game controller
        if (window.game) {
            window.game.playerDied();
        }
    }

    addScore(points) {
        this.score += points;
    }

    addMoney(amount) {
        this.money += amount;
        achievementManager.updateStat('moneyCollected', amount);
        effects.createMoneyFloat(this.x + this.width / 2, this.y, amount);
    }

    addDocument() {
        this.documents++;
    }

    saveKid() {
        this.kids++;
        achievementManager.updateStat('kidsSaved', 1);
    }

    addWeapon(weaponType) {
        const weaponConfig = CONFIG.WEAPONS[weaponType];
        if (!weaponConfig) return;

        this.weapons[weaponType].ammo = weaponConfig.maxAmmo;
        this.currentWeapon = weaponType;

        // Track for achievements
        if (!achievementManager.stats.weaponsCollected.includes(weaponType)) {
            achievementManager.updateStat('weaponsCollected', weaponType);
        }
    }

    addAmmo(weaponType, amount) {
        if (!this.weapons[weaponType]) return;

        const maxAmmo = CONFIG.WEAPONS[weaponType].maxAmmo;
        this.weapons[weaponType].ammo = Math.min(this.weapons[weaponType].ammo + amount, maxAmmo);
    }

    activatePowerup(type) {
        const powerup = this.powerups[type];
        if (!powerup) return;

        const config = CONFIG.POWERUPS[type];

        // Show message
        effects.showPopup(config.message, 'special');

        // Activate power-up
        powerup.active = true;
        powerup.timer = config.duration;

        // Special handling for each type
        switch(type) {
            case 'mushroom':
                effects.applyPsychedelicEffect(config.duration);
                soundManager.playPowerupMusic('mushroom');
                achievementManager.updateStat('totalFlyTime', config.duration / 1000);
                break;

            case 'cocaine':
                effects.applyDiscoEffect(config.duration);
                soundManager.playPowerupMusic('cocaine');
                achievementManager.updateStat('cocaineUses', 1);
                break;

            case 'steroids':
                soundManager.playPowerupMusic('steroids');
                break;

            case 'alcohol':
                effects.applyBlurEffect(1);
                soundManager.playPowerupMusic('alcohol');
                break;

            case 'fentanyl':
                effects.applyRedVignette(1);
                soundManager.playPowerupMusic('fentanyl');
                break;
        }

        soundManager.playSound('powerupCollect');
    }

    updatePowerups() {
        for (let [type, powerup] of Object.entries(this.powerups)) {
            if (!powerup.active) continue;

            powerup.timer -= 16; // 60fps

            // Check if expired
            if (powerup.timer <= 0) {
                powerup.active = false;

                // Special handling
                if (type === 'cocaine') {
                    // Start comedown
                    powerup.comedown = true;
                    powerup.comedownTimer = CONFIG.POWERUPS.cocaine.comedownDuration;
                    effects.showPopup(CONFIG.POWERUPS.cocaine.comedownMessage, 'special');
                } else if (type === 'alcohol') {
                    effects.applyBlurEffect(0);
                } else if (type === 'fentanyl') {
                    effects.applyRedVignette(0);
                }

                // Return to gameplay music
                soundManager.returnToSavedMusic();
            }

            // Update cocaine comedown
            if (type === 'cocaine' && powerup.comedown) {
                powerup.comedownTimer -= 16;

                if (powerup.comedownTimer <= 0) {
                    powerup.comedown = false;
                }
            }
        }
    }

    heal(amount) {
        this.health = Math.min(this.health + amount, this.maxHealth);
    }

    draw(ctx, cameraX) {
        // Flicker if invulnerable
        if (this.invulnerable && Math.floor(this.invulnerableTimer / 5) % 2 === 0) {
            return;
        }

        // Size modifier for steroids
        let width = this.width;
        let height = this.height;

        if (this.powerups.steroids.active) {
            width *= CONFIG.POWERUPS.steroids.sizeMultiplier;
            height *= CONFIG.POWERUPS.steroids.sizeMultiplier;
        }

        // Draw player (simple rectangle placeholder)
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(
            this.x - cameraX,
            this.y,
            width,
            height
        );

        // Draw weapon indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText(this.currentWeapon.toUpperCase(), this.x - cameraX, this.y - 10);

        // Draw aim line
        this.drawAimLine(ctx, cameraX);
    }

    drawAimLine(ctx, cameraX) {
        const screenPlayerX = this.x - cameraX + this.width / 2;
        const playerCenterY = this.y + this.height / 2;

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenPlayerX, playerCenterY);
        ctx.lineTo(this.mouseX, this.mouseY);
        ctx.stroke();
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
