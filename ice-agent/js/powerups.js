// ========================================
// POWER-UPS AND COLLECTIBLES
// ========================================
// All pickups, power-ups, and collectible items

// ========================================
// BASE COLLECTIBLE CLASS
// ========================================

class Collectible {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 30;
        this.height = 30;
        this.vy = 0;
        this.onGround = false;
        this.collected = false;

        // Stay on desk for 2 seconds before falling
        this.stayTimer = 120; // 2 seconds at 60fps
        this.canFall = false;

        // Bobbing animation
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(level) {
        if (this.collected) return;

        // Stay timer
        if (this.stayTimer > 0) {
            this.stayTimer--;
            if (this.stayTimer === 0) {
                this.canFall = true;
            }
        }

        // Gravity (after timer)
        if (this.canFall) {
            this.vy += 0.5;
            this.y += this.vy;

            // Ground collision
            const groundY = level.groundY || 550;
            if (this.y + this.height >= groundY) {
                this.y = groundY - this.height;
                this.vy = 0;
                this.onGround = true;
            }
        }
    }

    checkCollision(player) {
        if (this.collected) return false;

        const collision = player.x < this.x + this.width &&
                         player.x + player.width > this.x &&
                         player.y < this.y + this.height &&
                         player.y + player.height > this.y;

        if (collision) {
            this.collect(player);
            return true;
        }

        return false;
    }

    collect(player) {
        this.collected = true;
        // Override in subclasses
    }

    draw(ctx, cameraX) {
        if (this.collected) return;

        // Bobbing animation
        const bob = Math.sin(Date.now() / 200 + this.bobOffset) * 5;

        // Draw collectible (simple colored square placeholder)
        ctx.fillStyle = this.getColor();
        ctx.fillRect(
            this.x - cameraX,
            this.y + bob,
            this.width,
            this.height
        );

        // Draw icon/text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
            this.getIcon(),
            this.x - cameraX + this.width / 2,
            this.y + bob + this.height / 2 + 7
        );
    }

    getColor() {
        return '#ffffff'; // Override in subclasses
    }

    getIcon() {
        return '?'; // Override in subclasses
    }
}

// ========================================
// POWER-UP CLASSES
// ========================================

class MushroomPowerup extends Collectible {
    constructor(x, y) {
        super(x, y, 'mushroom');
    }

    collect(player) {
        super.collect(player);
        player.activatePowerup('mushroom');
    }

    getColor() {
        return '#FF6B6B';
    }

    getIcon() {
        return '🍄';
    }
}

class CocainePowerup extends Collectible {
    constructor(x, y) {
        super(x, y, 'cocaine');
    }

    collect(player) {
        super.collect(player);
        player.activatePowerup('cocaine');
    }

    getColor() {
        return '#FFFFFF';
    }

    getIcon() {
        return '❄️';
    }
}

class SteroidsPowerup extends Collectible {
    constructor(x, y) {
        super(x, y, 'steroids');
    }

    collect(player) {
        super.collect(player);
        player.activatePowerup('steroids');
    }

    getColor() {
        return '#4ECDC4';
    }

    getIcon() {
        return '💪';
    }
}

class AlcoholPowerup extends Collectible {
    constructor(x, y) {
        super(x, y, 'alcohol');
    }

    collect(player) {
        super.collect(player);
        player.activatePowerup('alcohol');
    }

    getColor() {
        return '#F4A460';
    }

    getIcon() {
        return '🍺';
    }
}

class FentanylPowerup extends Collectible {
    constructor(x, y) {
        super(x, y, 'fentanyl');
    }

    collect(player) {
        super.collect(player);
        player.activatePowerup('fentanyl');
    }

    getColor() {
        return '#8B0000';
    }

    getIcon() {
        return '💉';
    }
}

// ========================================
// HEALTH PICKUP
// ========================================

class HealthPickup extends Collectible {
    constructor(x, y) {
        super(x, y, 'health');
        this.healAmount = CONFIG.POWERUPS.health.healAmount;
    }

    collect(player) {
        super.collect(player);
        player.heal(this.healAmount);
        soundManager.playSound('powerupCollect');
        effects.showPopup(`+${this.healAmount} HEALTH`, 'normal');
    }

    getColor() {
        return '#00ff00';
    }

    getIcon() {
        return '❤️';
    }
}

// ========================================
// EXTRA LIFE
// ========================================

class ExtraLife extends Collectible {
    constructor(x, y) {
        super(x, y, 'extraLife');
    }

    collect(player) {
        super.collect(player);
        soundManager.playSound('extraLife');
        effects.showPopup('EXTRA LIFE!', 'achievement');

        if (window.game) {
            window.game.addLife();
        }
    }

    getColor() {
        return '#FFD700';
    }

    getIcon() {
        return '🎮';
    }
}

// ========================================
// WEAPON DROPS
// ========================================

class WeaponDrop extends Collectible {
    constructor(x, y, weaponType) {
        super(x, y, 'weapon');
        this.weaponType = weaponType;
    }

    collect(player) {
        super.collect(player);
        player.addWeapon(this.weaponType);
        soundManager.playSound('ammoPickup');
        effects.showPopup(`${this.weaponType.toUpperCase()} ACQUIRED!`, 'normal');
    }

    getColor() {
        const colors = {
            pistol: '#f39c12',
            smg: '#3498db',
            shotgun: '#e74c3c',
            rifle: '#9b59b6'
        };
        return colors[this.weaponType] || '#ffffff';
    }

    getIcon() {
        const icons = {
            pistol: '🔫',
            smg: '🔫',
            shotgun: '🔫',
            rifle: '🔫'
        };
        return icons[this.weaponType] || '🔫';
    }
}

// ========================================
// AMMO PICKUPS
// ========================================

class AmmoDrop extends Collectible {
    constructor(x, y, weaponType, amount) {
        super(x, y, 'ammo');
        this.weaponType = weaponType;
        this.amount = amount || 30;
    }

    collect(player) {
        super.collect(player);
        player.addAmmo(this.weaponType, this.amount);
        soundManager.playSound('ammoPickup');
        effects.showPopup(`+${this.amount} ${this.weaponType.toUpperCase()} AMMO`, 'normal');
    }

    getColor() {
        return '#FFD700';
    }

    getIcon() {
        return '📦';
    }
}

// ========================================
// MONEY
// ========================================

class Money extends Collectible {
    constructor(x, y, amount) {
        super(x, y, 'money');
        this.amount = amount || 100;
    }

    collect(player) {
        super.collect(player);
        player.addMoney(this.amount);
        soundManager.playSound('moneyCollect');
    }

    getColor() {
        return '#00ff00';
    }

    getIcon() {
        return '💵';
    }
}

// ========================================
// DOCUMENTS
// ========================================

class Document extends Collectible {
    constructor(x, y) {
        super(x, y, 'document');
    }

    collect(player) {
        super.collect(player);
        player.addDocument();
        soundManager.playSound('documentCollect');
        effects.showPopup('DOCUMENT COLLECTED!', 'normal');
    }

    getColor() {
        return '#ffffff';
    }

    getIcon() {
        return '📄';
    }
}

// ========================================
// KIDS (white children crying)
// ========================================

class Kid extends Collectible {
    constructor(x, y) {
        super(x, y, 'kid');
    }

    collect(player) {
        super.collect(player);
        player.saveKid();
        soundManager.playSound('kidSaved');
        effects.showPopup('KID SAVED!', 'achievement');
    }

    getColor() {
        return '#FFE4E1';
    }

    getIcon() {
        return '👶';
    }
}

// ========================================
// COLLECTIBLE FACTORY
// ========================================

class CollectibleFactory {
    static create(type, x, y, options = {}) {
        switch(type) {
            case 'mushroom':
                return new MushroomPowerup(x, y);
            case 'cocaine':
                return new CocainePowerup(x, y);
            case 'steroids':
                return new SteroidsPowerup(x, y);
            case 'alcohol':
                return new AlcoholPowerup(x, y);
            case 'fentanyl':
                return new FentanylPowerup(x, y);
            case 'health':
                return new HealthPickup(x, y);
            case 'extraLife':
                return new ExtraLife(x, y);
            case 'weapon':
                return new WeaponDrop(x, y, options.weaponType || 'pistol');
            case 'ammo':
                return new AmmoDrop(x, y, options.weaponType || 'pistol', options.amount || 30);
            case 'money':
                return new Money(x, y, options.amount || 100);
            case 'document':
                return new Document(x, y);
            case 'kid':
                return new Kid(x, y);
            default:
                return null;
        }
    }

    static createRandom(x, y, rarity = 'common') {
        const powerups = ['mushroom', 'cocaine', 'steroids', 'alcohol', 'fentanyl'];
        const weapons = ['pistol', 'smg', 'shotgun', 'rifle'];
        const collectibles = ['money', 'document', 'kid'];

        let pool = [];

        // Common drops
        pool.push('money', 'money', 'money');
        pool.push('health', 'health');
        pool.push('ammo', 'ammo');

        // Rare drops
        if (Math.random() < 0.3) {
            pool.push(...powerups);
        }

        if (Math.random() < 0.2) {
            pool.push('weapon');
        }

        if (Math.random() < CONFIG.POWERUPS.extraLife.rarity) {
            pool.push('extraLife');
        }

        pool.push(...collectibles);

        // Pick random
        const type = pool[Math.floor(Math.random() * pool.length)];

        // Create with options
        const options = {};

        if (type === 'weapon') {
            options.weaponType = weapons[Math.floor(Math.random() * weapons.length)];
        }

        if (type === 'ammo') {
            options.weaponType = weapons[Math.floor(Math.random() * weapons.length)];
            options.amount = 30;
        }

        if (type === 'money') {
            options.amount = Math.floor(Math.random() * 200) + 50;
        }

        return CollectibleFactory.create(type, x, y, options);
    }
}
