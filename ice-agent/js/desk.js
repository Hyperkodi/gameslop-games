// ========================================
// DESK SYSTEM
// ========================================
// Destructible desks with loot

class Desk {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 60;
        this.maxHealth = 50;
        this.health = this.maxHealth;
        this.opened = false;
        this.destroyed = false;

        // Loot
        this.lootCount = Math.floor(Math.random() * 3) + 2; // 2-4 items
        this.loot = [];
    }

    open(player) {
        if (this.opened || this.destroyed) return;

        this.opened = true;

        // Sound
        soundManager.playSound('deskOpen');

        // Generate loot
        this.generateLoot();

        // Spawn loot on top of desk
        const lootX = this.x + this.width / 2;
        const lootY = this.y - 30;

        this.loot.forEach((item, index) => {
            // Spread items out
            const offsetX = (index - this.loot.length / 2) * 40;
            item.x = lootX + offsetX;
            item.y = lootY;

            // Add to level collectibles
            if (window.currentLevel) {
                window.currentLevel.collectibles.push(item);
            }
        });

        // Break desk after opening
        this.destroyed = true;
        effects.createParticles(this.x + this.width / 2, this.y + this.height / 2, 'dust', 10);
    }

    generateLoot() {
        this.loot = [];

        for (let i = 0; i < this.lootCount; i++) {
            const item = CollectibleFactory.createRandom(0, 0);
            if (item) {
                this.loot.push(item);
            }
        }
    }

    takeDamage(damage) {
        if (this.destroyed) return;

        this.health -= damage;

        if (this.health <= 0) {
            this.destroy();
        }
    }

    destroy() {
        if (this.destroyed) return;

        this.destroyed = true;

        // Auto-open when destroyed
        if (!this.opened) {
            this.generateLoot();

            const lootX = this.x + this.width / 2;
            const lootY = this.y;

            this.loot.forEach((item, index) => {
                const offsetX = (index - this.loot.length / 2) * 40;
                item.x = lootX + offsetX;
                item.y = lootY;

                if (window.currentLevel) {
                    window.currentLevel.collectibles.push(item);
                }
            });

            this.opened = true;
        }

        effects.createParticles(this.x + this.width / 2, this.y + this.height / 2, 'dust', 15);
        soundManager.playSound('deskOpen');
    }

    update(player) {
        if (this.destroyed) return;

        // Auto-open on touch
        const touching = player.x < this.x + this.width &&
                        player.x + player.width > this.x &&
                        player.y < this.y + this.height &&
                        player.y + player.height > this.y;

        if (touching) {
            this.open(player);
        }
    }

    draw(ctx, cameraX) {
        if (this.destroyed) return;

        // Draw desk
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(
            this.x - cameraX,
            this.y,
            this.width,
            this.height
        );

        // Draw desk legs
        ctx.fillStyle = '#654321';
        ctx.fillRect(this.x - cameraX + 5, this.y + this.height, 10, 20);
        ctx.fillRect(this.x - cameraX + this.width - 15, this.y + this.height, 10, 20);

        // Draw health bar
        if (this.health < this.maxHealth) {
            this.drawHealthBar(ctx, cameraX);
        }

        // Draw "E to open" prompt if player nearby
        if (window.currentLevel && window.currentLevel.player) {
            const player = window.currentLevel.player;
            const distance = Math.abs(player.x - this.x);

            if (distance < 100 && !this.opened) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '14px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(
                    'E / TOUCH',
                    this.x - cameraX + this.width / 2,
                    this.y - 10
                );
            }
        }
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
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
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
