// ========================================
// MAIN GAME CONTROLLER
// ========================================
// Game states, main loop, and coordination

class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;

        // Game state
        this.state = 'menu'; // menu, playing, paused, gameOver, levelTransition
        this.difficulty = 'normal';
        this.currentLevelNumber = 1;
        this.lives = CONFIG.STARTING_LIVES;

        // Entities
        this.player = null;
        this.level = null;

        // Animation
        this.animationId = null;
        this.lastTime = 0;
        this.fps = 60;
        this.frameDelay = 1000 / this.fps;

        // Global reference
        window.game = this;
        window.currentDifficulty = this.difficulty;
    }

    init() {
        // Get canvas
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Setup effects manager
        effects.setCanvas(this.canvas, this.ctx);

        // Setup controls
        this.setupControls();

        // Show menu
        this.showMenu();

        console.log('🎮 Game initialized');
    }

    resizeCanvas() {
        this.canvas.width = Math.min(1280, window.innerWidth);
        this.canvas.height = Math.min(720, window.innerHeight);
    }

    setupControls() {
        // Pause key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.state === 'playing') {
                    this.pause();
                } else if (this.state === 'paused') {
                    this.resume();
                }
            }
        });

        // UI button handlers
        document.getElementById('startGame')?.addEventListener('click', () => {
            this.selectDifficulty();
        });

        document.getElementById('resumeGame')?.addEventListener('click', () => {
            this.resume();
        });

        document.getElementById('quitGame')?.addEventListener('click', () => {
            this.quitToMenu();
        });

        document.getElementById('playAgain')?.addEventListener('click', () => {
            this.restart();
        });

        document.getElementById('viewLeaderboard')?.addEventListener('click', () => {
            this.showLeaderboard();
        });

        document.getElementById('viewAchievements')?.addEventListener('click', () => {
            this.showAchievements();
        });

        document.getElementById('backToMenu')?.addEventListener('click', () => {
            this.showMenu();
        });

        // Difficulty buttons
        document.getElementById('easyMode')?.addEventListener('click', () => {
            this.startGame('easy');
        });

        document.getElementById('normalMode')?.addEventListener('click', () => {
            this.startGame('normal');
        });

        document.getElementById('hardMode')?.addEventListener('click', () => {
            this.startGame('hard');
        });

        // Volume controls
        document.getElementById('musicVolume')?.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            soundManager.setMusicVolume(volume);
        });

        document.getElementById('sfxVolume')?.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            soundManager.setSFXVolume(volume);
        });
    }

    showMenu() {
        this.state = 'menu';

        // Hide all screens
        this.hideAllScreens();

        // Show menu
        document.getElementById('menuScreen').style.display = 'flex';

        // Play menu music
        soundManager.playMusic('mainMenu', true);

        // Stop game loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    selectDifficulty() {
        this.hideAllScreens();
        document.getElementById('difficultyScreen').style.display = 'flex';
    }

    startGame(difficulty) {
        this.difficulty = difficulty;
        window.currentDifficulty = difficulty;

        this.currentLevelNumber = 1;
        this.lives = CONFIG.STARTING_LIVES;

        // Hide all screens
        this.hideAllScreens();

        // Show game canvas
        this.canvas.style.display = 'block';

        // Start level
        this.startLevel(1);

        this.state = 'playing';

        // Play gameplay music
        soundManager.playMusic('gameplay', true);

        // Start game loop
        this.startGameLoop();
    }

    startLevel(levelNumber) {
        this.currentLevelNumber = levelNumber;

        // Create player
        this.player = new Player(100, 400);

        // Apply difficulty modifier to player health
        const diff = CONFIG.DIFFICULTY[this.difficulty];
        this.player.maxHealth = CONFIG.PLAYER.MAX_HEALTH * diff.playerHealthMultiplier;
        this.player.health = this.player.maxHealth;

        // Create level
        this.level = new Level(levelNumber, this.player);

        // Set global reference
        window.currentLevel = this.level;

        console.log(`🎮 Starting Level ${levelNumber} on ${this.difficulty} difficulty`);
    }

    levelComplete() {
        this.state = 'levelTransition';

        // Check if more levels
        if (this.currentLevelNumber < CONFIG.TOTAL_LEVELS) {
            // Give extra lives after level 1
            if (this.currentLevelNumber === 1) {
                this.lives = CONFIG.MAX_LIVES;
                effects.showPopup('YOU NOW HAVE 3 LIVES!', 'achievement');
            }

            // Next level
            setTimeout(() => {
                this.startLevel(this.currentLevelNumber + 1);
                this.state = 'playing';
            }, 3000);
        } else {
            // Game complete!
            this.gameComplete();
        }
    }

    gameComplete() {
        this.state = 'gameComplete';

        soundManager.playMusic('outro', true);

        effects.showPopup('🎉 YOU BEAT THE GAME! 🎉', 'achievement');

        // Calculate final score
        const finalScore = this.player.score;
        const stats = {
            money: this.player.money,
            kids: this.player.kids,
            documents: this.player.documents
        };

        // Submit to leaderboard
        this.submitScore(finalScore, CONFIG.TOTAL_LEVELS, stats);

        // Show game over screen with victory message
        setTimeout(() => {
            this.showGameOver(true);
        }, 3000);
    }

    playerDied() {
        this.lives--;

        if (this.lives > 0) {
            // Respawn
            effects.showPopup(`${this.lives} LIVES LEFT`, 'special');

            setTimeout(() => {
                this.startLevel(this.currentLevelNumber);
                this.state = 'playing';
            }, 2000);
        } else {
            // Game over
            this.gameOver();
        }
    }

    gameOver() {
        this.state = 'gameOver';

        soundManager.playSound('gameOver');
        soundManager.stopMusic(true);

        // Submit score
        const finalScore = this.player.score;
        const stats = {
            money: this.player.money,
            kids: this.player.kids,
            documents: this.player.documents
        };

        this.submitScore(finalScore, this.currentLevelNumber, stats);

        // Show game over screen
        setTimeout(() => {
            this.showGameOver(false);
        }, 2000);
    }

    showGameOver(victory) {
        this.hideAllScreens();

        const gameOverScreen = document.getElementById('gameOverScreen');
        gameOverScreen.style.display = 'flex';

        // Update text
        document.getElementById('gameOverTitle').textContent = victory ? '🎉 VICTORY! 🎉' : '💀 GAME OVER 💀';
        document.getElementById('finalScore').textContent = this.player.score;
        document.getElementById('finalLevel').textContent = this.currentLevelNumber;
        document.getElementById('finalMoney').textContent = this.player.money;
        document.getElementById('finalKids').textContent = this.player.kids;
        document.getElementById('finalDocuments').textContent = this.player.documents;
    }

    submitScore(score, level, stats) {
        // Get player name
        let playerName = localStorage.getItem('playerName');

        if (!playerName) {
            playerName = prompt('Enter your name for the leaderboard:', 'Anonymous') || 'Anonymous';
            localStorage.setItem('playerName', playerName);
        }

        // Submit to leaderboard
        const rank = leaderboardManager.addScore(playerName, score, level, stats);

        console.log(`🏆 Score submitted! Rank: ${rank}`);
    }

    addLife() {
        if (this.lives < CONFIG.MAX_LIVES) {
            this.lives++;
        }
    }

    pause() {
        if (this.state !== 'playing') return;

        this.state = 'paused';

        soundManager.pauseMusic();

        this.hideAllScreens();
        document.getElementById('pauseScreen').style.display = 'flex';
    }

    resume() {
        if (this.state !== 'paused') return;

        this.state = 'playing';

        soundManager.resumeMusic();

        this.hideAllScreens();
        this.canvas.style.display = 'block';
    }

    quitToMenu() {
        this.showMenu();

        // Clean up
        this.player = null;
        this.level = null;
        window.currentLevel = null;
    }

    restart() {
        this.startGame(this.difficulty);
    }

    showLeaderboard() {
        this.hideAllScreens();

        const leaderboardScreen = document.getElementById('leaderboardScreen');
        leaderboardScreen.style.display = 'flex';

        // Populate leaderboard
        const tbody = document.getElementById('leaderboardTable').querySelector('tbody');
        tbody.innerHTML = '';

        const topScores = leaderboardManager.getTopScores(20);

        topScores.forEach((entry, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${entry.name}</td>
                <td>${entry.score}</td>
                <td>${entry.level}</td>
                <td>$${entry.money}</td>
                <td>${entry.kids}</td>
                <td>${entry.documents}</td>
                <td>${entry.date}</td>
            `;
            tbody.appendChild(row);
        });
    }

    showAchievements() {
        this.hideAllScreens();

        const achievementScreen = document.getElementById('achievementScreen');
        achievementScreen.style.display = 'flex';

        // Populate achievements
        const container = document.getElementById('achievementList');
        container.innerHTML = '';

        const progress = achievementManager.getProgress();

        progress.forEach(achievement => {
            const div = document.createElement('div');
            div.className = 'achievement-item' + (achievement.unlocked ? ' unlocked' : '');

            div.innerHTML = `
                <div class="achievement-icon">${achievement.unlocked ? '🏆' : '🔒'}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-progress">
                        ${achievement.current} / ${achievement.required}
                        (${Math.floor(achievement.percentage)}%)
                    </div>
                </div>
            `;

            container.appendChild(div);
        });
    }

    hideAllScreens() {
        const screens = [
            'menuScreen',
            'difficultyScreen',
            'pauseScreen',
            'gameOverScreen',
            'leaderboardScreen',
            'achievementScreen'
        ];

        screens.forEach(id => {
            const screen = document.getElementById(id);
            if (screen) {
                screen.style.display = 'none';
            }
        });

        this.canvas.style.display = 'none';
    }

    startGameLoop() {
        const gameLoop = (timestamp) => {
            if (this.state !== 'playing') {
                this.animationId = null;
                return;
            }

            // Frame rate limiting
            const deltaTime = timestamp - this.lastTime;

            if (deltaTime >= this.frameDelay) {
                this.lastTime = timestamp;

                // Update
                this.update();

                // Draw
                this.draw();
            }

            this.animationId = requestAnimationFrame(gameLoop);
        };

        this.lastTime = performance.now();
        this.animationId = requestAnimationFrame(gameLoop);
    }

    update() {
        if (!this.player || !this.level) return;

        // Update player
        this.player.update(this.level);

        // Update level
        this.level.update();

        // Update effects
        effects.updateParticles();
        effects.updatePopups();
        effects.updateShake();
        effects.updateDrugEffects();

        // Check if player fell off map
        if (this.player.y > 1000) {
            this.player.die();
        }
    }

    draw() {
        if (!this.ctx || !this.level) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply screen shake
        const shake = effects.getShakeOffset();
        this.ctx.save();
        this.ctx.translate(shake.x, shake.y);

        // Draw level
        this.level.draw(this.ctx);

        // Draw particles
        effects.drawParticles(this.ctx, this.level.camera.x);

        this.ctx.restore();

        // Draw drug effects (on top of everything)
        effects.drawDrugEffects(this.ctx, this.canvas);

        // Draw popups (absolute position, no camera)
        effects.drawPopups(this.ctx);

        // Draw lives
        this.drawLives();
    }

    drawLives() {
        const padding = 20;
        const y = this.canvas.height - 30;

        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 18px "Courier New", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`LIVES: ${'❤️'.repeat(this.lives)}`, padding, y);
    }
}

// ========================================
// START GAME
// ========================================

window.addEventListener('load', () => {
    const game = new Game();
    game.init();
});
