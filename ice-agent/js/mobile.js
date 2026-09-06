// ========================================
// MOBILE CONTROLS
// ========================================
// Touch controls for mobile devices

class MobileControls {
    constructor() {
        this.enabled = false;
        this.joystick = null;
        this.shootArea = null;

        // Joystick state
        this.joystickActive = false;
        this.joystickStartX = 0;
        this.joystickStartY = 0;
        this.joystickCurrentX = 0;
        this.joystickCurrentY = 0;

        // Shoot state
        this.shooting = false;
        this.aimX = 0;
        this.aimY = 0;

        // Touch IDs
        this.joystickTouchId = null;
        this.shootTouchId = null;

        this.init();
    }

    init() {
        // Check if mobile
        this.enabled = this.isMobile();

        if (!this.enabled) {
            console.log('📱 Desktop detected - mobile controls disabled');
            return;
        }

        console.log('📱 Mobile detected - enabling touch controls');

        // Create mobile UI
        this.createMobileUI();

        // Setup touch handlers
        this.setupTouchHandlers();

        // Force landscape
        this.setupOrientationHandler();
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth < 768;
    }

    createMobileUI() {
        // Create joystick container
        this.joystick = document.createElement('div');
        this.joystick.id = 'mobileJoystick';
        this.joystick.className = 'mobile-control joystick';
        this.joystick.innerHTML = `
            <div class="joystick-base">
                <div class="joystick-stick"></div>
            </div>
        `;
        document.body.appendChild(this.joystick);

        // Create shoot area
        this.shootArea = document.createElement('div');
        this.shootArea.id = 'mobileShootArea';
        this.shootArea.className = 'mobile-control shoot-area';
        this.shootArea.innerHTML = `
            <div class="shoot-crosshair">+</div>
            <div class="shoot-label">TAP TO SHOOT</div>
        `;
        document.body.appendChild(this.shootArea);

        // Create weapon switch buttons
        this.createWeaponButtons();

        // Create action buttons
        this.createActionButtons();
    }

    createWeaponButtons() {
        const weaponPanel = document.createElement('div');
        weaponPanel.id = 'weaponPanel';
        weaponPanel.className = 'weapon-panel';

        const weapons = ['pistol', 'smg', 'shotgun', 'rifle', 'knife'];

        weapons.forEach((weapon, index) => {
            const btn = document.createElement('button');
            btn.className = 'weapon-btn';
            btn.textContent = weapon.toUpperCase()[0];
            btn.dataset.weapon = weapon;

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (window.game && window.game.player) {
                    window.game.player.currentWeapon = weapon;
                }
            });

            weaponPanel.appendChild(btn);
        });

        document.body.appendChild(weaponPanel);
    }

    createActionButtons() {
        const actionPanel = document.createElement('div');
        actionPanel.id = 'actionPanel';
        actionPanel.className = 'action-panel';

        // Jump button
        const jumpBtn = document.createElement('button');
        jumpBtn.className = 'action-btn jump-btn';
        jumpBtn.textContent = '⬆️';

        jumpBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.game && window.game.player) {
                window.game.player.keys['w'] = true;
            }
        });

        jumpBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (window.game && window.game.player) {
                window.game.player.keys['w'] = false;
            }
        });

        // Interact button
        const interactBtn = document.createElement('button');
        interactBtn.className = 'action-btn interact-btn';
        interactBtn.textContent = 'E';

        interactBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.game && window.game.player) {
                window.game.player.interact();
            }
        });

        actionPanel.appendChild(jumpBtn);
        actionPanel.appendChild(interactBtn);

        document.body.appendChild(actionPanel);
    }

    setupTouchHandlers() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            setTimeout(() => this.setupTouchHandlers(), 100);
            return;
        }

        // Joystick touch
        this.joystick.addEventListener('touchstart', (e) => this.handleJoystickStart(e));
        this.joystick.addEventListener('touchmove', (e) => this.handleJoystickMove(e));
        this.joystick.addEventListener('touchend', (e) => this.handleJoystickEnd(e));
        this.joystick.addEventListener('touchcancel', (e) => this.handleJoystickEnd(e));

        // Shoot area touch
        this.shootArea.addEventListener('touchstart', (e) => this.handleShootStart(e));
        this.shootArea.addEventListener('touchmove', (e) => this.handleShootMove(e));
        this.shootArea.addEventListener('touchend', (e) => this.handleShootEnd(e));
        this.shootArea.addEventListener('touchcancel', (e) => this.handleShootEnd(e));

        // Prevent default touch behaviors
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('.mobile-control, .weapon-panel, .action-panel')) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    handleJoystickStart(e) {
        e.preventDefault();

        const touch = e.changedTouches[0];
        this.joystickTouchId = touch.identifier;

        const rect = this.joystick.getBoundingClientRect();
        this.joystickStartX = rect.left + rect.width / 2;
        this.joystickStartY = rect.top + rect.height / 2;

        this.joystickActive = true;

        this.updateJoystick(touch.clientX, touch.clientY);
    }

    handleJoystickMove(e) {
        e.preventDefault();

        if (!this.joystickActive) return;

        const touch = Array.from(e.touches).find(t => t.identifier === this.joystickTouchId);
        if (!touch) return;

        this.updateJoystick(touch.clientX, touch.clientY);
    }

    handleJoystickEnd(e) {
        e.preventDefault();

        const touchStillActive = Array.from(e.touches).some(t => t.identifier === this.joystickTouchId);
        if (touchStillActive) return;

        this.joystickActive = false;
        this.joystickTouchId = null;

        // Reset joystick
        const stick = this.joystick.querySelector('.joystick-stick');
        stick.style.transform = 'translate(-50%, -50%)';

        // Clear player input
        if (window.game && window.game.player) {
            window.game.player.keys['a'] = false;
            window.game.player.keys['d'] = false;
        }
    }

    updateJoystick(clientX, clientY) {
        const dx = clientX - this.joystickStartX;
        const dy = clientY - this.joystickStartY;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 50;

        // Clamp to max distance
        let clampedDx = dx;
        let clampedDy = dy;

        if (distance > maxDistance) {
            clampedDx = (dx / distance) * maxDistance;
            clampedDy = (dy / distance) * maxDistance;
        }

        // Update stick visual
        const stick = this.joystick.querySelector('.joystick-stick');
        stick.style.transform = `translate(calc(-50% + ${clampedDx}px), calc(-50% + ${clampedDy}px))`;

        // Update player input
        if (window.game && window.game.player) {
            const threshold = 10;

            window.game.player.keys['a'] = dx < -threshold;
            window.game.player.keys['d'] = dx > threshold;
        }
    }

    handleShootStart(e) {
        e.preventDefault();

        const touch = e.changedTouches[0];
        this.shootTouchId = touch.identifier;

        this.shooting = true;

        this.updateShoot(touch.clientX, touch.clientY);
    }

    handleShootMove(e) {
        e.preventDefault();

        if (!this.shooting) return;

        const touch = Array.from(e.touches).find(t => t.identifier === this.shootTouchId);
        if (!touch) return;

        this.updateShoot(touch.clientX, touch.clientY);
    }

    handleShootEnd(e) {
        e.preventDefault();

        const touchStillActive = Array.from(e.touches).some(t => t.identifier === this.shootTouchId);
        if (touchStillActive) return;

        this.shooting = false;
        this.shootTouchId = null;

        // Stop shooting
        if (window.game && window.game.player) {
            window.game.player.keys.shoot = false;
        }
    }

    updateShoot(clientX, clientY) {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();

        // Convert touch position to canvas coordinates
        this.aimX = (clientX - rect.left) * canvas.width / rect.width;
        this.aimY = (clientY - rect.top) * canvas.height / rect.height;

        // Update player mouse position
        if (window.game && window.game.player) {
            window.game.player.mouseX = this.aimX;
            window.game.player.mouseY = this.aimY;
            window.game.player.keys.shoot = true;
        }

        // Move crosshair
        const crosshair = this.shootArea.querySelector('.shoot-crosshair');
        crosshair.style.left = `${clientX - this.shootArea.getBoundingClientRect().left}px`;
        crosshair.style.top = `${clientY - this.shootArea.getBoundingClientRect().top}px`;
    }

    setupOrientationHandler() {
        // Detect orientation
        const checkOrientation = () => {
            if (window.innerHeight > window.innerWidth) {
                // Portrait mode - show warning
                this.showOrientationWarning();
            } else {
                // Landscape mode - hide warning
                this.hideOrientationWarning();
            }
        };

        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);

        checkOrientation();
    }

    showOrientationWarning() {
        let warning = document.getElementById('orientationWarning');

        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'orientationWarning';
            warning.className = 'orientation-warning';
            warning.innerHTML = `
                <div class="warning-content">
                    <div class="warning-icon">📱</div>
                    <div class="warning-text">Please rotate your device to landscape mode</div>
                </div>
            `;
            document.body.appendChild(warning);
        }

        warning.style.display = 'flex';
    }

    hideOrientationWarning() {
        const warning = document.getElementById('orientationWarning');
        if (warning) {
            warning.style.display = 'none';
        }
    }

    show() {
        if (!this.enabled) return;

        this.joystick.style.display = 'block';
        this.shootArea.style.display = 'block';
        if (document.getElementById('weaponPanel')) document.getElementById('weaponPanel').style.display = 'flex';
        if (document.getElementById('actionPanel')) document.getElementById('actionPanel').style.display = 'flex';
    }

    hide() {
        if (!this.enabled) return;

        this.joystick.style.display = 'none';
        this.shootArea.style.display = 'none';
        if (document.getElementById('weaponPanel')) document.getElementById('weaponPanel').style.display = 'none';
        if (document.getElementById('actionPanel')) document.getElementById('actionPanel').style.display = 'none';
    }
}

// Initialize mobile controls
const mobileControls = new MobileControls();

// Show/hide mobile controls based on game state
window.addEventListener('load', () => {
    if (mobileControls.enabled) {
        // Show controls when game starts
        const originalStartGame = window.game?.startGame;
        if (window.game && originalStartGame) {
            window.game.startGame = function(...args) {
                originalStartGame.apply(this, args);
                mobileControls.show();
            };
        }

        // Hide controls in menu
        const originalShowMenu = window.game?.showMenu;
        if (window.game && originalShowMenu) {
            window.game.showMenu = function(...args) {
                originalShowMenu.apply(this, args);
                mobileControls.hide();
            };
        }
    }
});
