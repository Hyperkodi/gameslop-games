// ========================================
// SOUND & MUSIC MANAGER
// ========================================
// Easy MP3 Integration System
// Just drop MP3 files in assets/sounds or assets/music folders!

class SoundManager {
    constructor() {
        this.sounds = {};
        this.music = {};
        this.currentMusic = null;
        this.musicVolume = CONFIG.AUDIO.musicVolume;
        this.sfxVolume = CONFIG.AUDIO.sfxVolume;
        this.musicFadeTime = CONFIG.AUDIO.musicFadeTime;
        this.initialized = false;
        
        // Define sound files
        // TO ADD NEW SOUNDS: Add entry here and drop MP3 in assets/sounds/
        this.soundFiles = {
            // Player sounds
            jump: 'jump.mp3',
            land: 'land.mp3',
            damage: 'player-damage.mp3',
            death: 'player-death.mp3',
            
            // Weapon sounds
            pistolShoot: 'pistol-shoot.mp3',
            smgShoot: 'smg-shoot.mp3',
            shotgunShoot: 'shotgun-shoot.mp3',
            rifleShoot: 'rifle-shoot.mp3',
            knifeSwing: 'knife-swing.mp3',
            knifeHit: 'knife-hit.mp3',
            reload: 'reload.mp3',
            emptyClick: 'empty-click.mp3',
            
            // Enemy sounds
            enemyDeath: 'enemy-death.mp3',
            karenSpawn: 'karen-spawn.mp3', // "I'm getting the manager!"
            karenDeath: 'karen-death.mp3', // "I'm CALLING CORPORATE!"
            explosion: 'explosion.mp3',
            rocketLaunch: 'rocket-launch.mp3',
            rocketExplode: 'rocket-explode.mp3',
            
            // Collectible sounds
            moneyCollect: 'money-collect.mp3',
            documentCollect: 'document-collect.mp3',
            kidSaved: 'kid-saved.mp3',
            powerupCollect: 'powerup-collect.mp3',
            extraLife: 'extra-life.mp3',
            ammoPickup: 'ammo-pickup.mp3',
            
            // UI sounds
            deskOpen: 'desk-open.mp3',
            buttonClick: 'button-click.mp3',
            levelComplete: 'level-complete.mp3',
            gameOver: 'game-over.mp3',
            achievementUnlock: 'achievement.mp3',
            
            // Boss sounds
            bossSpawn: 'boss-spawn.mp3',
            bossAttack: 'boss-attack.mp3',
            bossDeath: 'boss-death.mp3'
        };
        
        // Define music files
        // TO ADD NEW MUSIC: Add entry here and drop MP3 in assets/music/
        this.musicFiles = {
            mainMenu: 'main-menu.mp3',
            gameplay: 'gameplay.mp3',
            boss: 'boss-fight.mp3',
            intro: 'intro.mp3',
            outro: 'outro.mp3',
            credits: 'credits.mp3',
            
            // Power-up specific music
            mushroom: 'mushroom.mp3',
            cocaine: 'cocaine.mp3',
            steroids: 'steroids.mp3',
            alcohol: 'alcohol.mp3',
            fentanyl: 'fentanyl.mp3'
        };
    }
    
    // Initialize all audio
    init() {
        if (this.initialized) return;
        
        // Load all sound effects
        for (let [key, file] of Object.entries(this.soundFiles)) {
            this.sounds[key] = new Audio(`assets/sounds/${file}`);
            this.sounds[key].volume = this.sfxVolume;
            
            // Preload
            this.sounds[key].load();
        }
        
        // Load all music tracks
        for (let [key, file] of Object.entries(this.musicFiles)) {
            this.music[key] = new Audio(`assets/music/${file}`);
            this.music[key].volume = this.musicVolume;
            this.music[key].loop = true; // Music loops by default
            
            // Preload
            this.music[key].load();
        }
        
        this.initialized = true;
        console.log('🔊 Sound Manager initialized');
    }
    
    // Play sound effect
    playSound(soundName) {
        if (!this.initialized) return;
        
        const sound = this.sounds[soundName];
        if (!sound) {
            console.warn(`Sound not found: ${soundName}`);
            return;
        }
        
        // If sound variations enabled, could randomize pitch here
        if (CONFIG.AUDIO.soundVariations) {
            sound.playbackRate = 0.9 + Math.random() * 0.2; // Random pitch
        } else {
            sound.playbackRate = 1;
        }
        
        // Clone and play to allow overlapping sounds
        const clone = sound.cloneNode();
        clone.volume = this.sfxVolume;
        clone.play().catch(e => console.warn('Sound play failed:', e));
    }
    
    // Play music (with smooth transition)
    playMusic(musicName, fadeIn = true) {
        if (!this.initialized) return;
        
        const newMusic = this.music[musicName];
        if (!newMusic) {
            console.warn(`Music not found: ${musicName}`);
            return;
        }
        
        // If same music already playing, do nothing
        if (this.currentMusic === newMusic && !this.currentMusic.paused) {
            return;
        }
        
        // Stop current music
        if (this.currentMusic) {
            if (fadeIn) {
                this.fadeOut(this.currentMusic);
            } else {
                this.currentMusic.pause();
                this.currentMusic.currentTime = 0;
            }
        }
        
        // Start new music
        this.currentMusic = newMusic;
        this.currentMusic.currentTime = 0;
        
        if (fadeIn) {
            this.currentMusic.volume = 0;
            this.currentMusic.play().catch(e => console.warn('Music play failed:', e));
            this.fadeIn(this.currentMusic);
        } else {
            this.currentMusic.volume = this.musicVolume;
            this.currentMusic.play().catch(e => console.warn('Music play failed:', e));
        }
    }
    
    // Fade in music
    fadeIn(audio) {
        const fadeSteps = 20;
        const fadeInterval = this.musicFadeTime / fadeSteps;
        const volumeStep = this.musicVolume / fadeSteps;
        let currentStep = 0;
        
        const fade = setInterval(() => {
            if (currentStep >= fadeSteps) {
                clearInterval(fade);
                audio.volume = this.musicVolume;
                return;
            }
            
            audio.volume = volumeStep * currentStep;
            currentStep++;
        }, fadeInterval);
    }
    
    // Fade out music
    fadeOut(audio) {
        const fadeSteps = 20;
        const fadeInterval = this.musicFadeTime / fadeSteps;
        const volumeStep = audio.volume / fadeSteps;
        let currentStep = fadeSteps;
        
        const fade = setInterval(() => {
            if (currentStep <= 0) {
                clearInterval(fade);
                audio.pause();
                audio.currentTime = 0;
                return;
            }
            
            audio.volume = volumeStep * currentStep;
            currentStep--;
        }, fadeInterval);
    }
    
    // Stop all music
    stopMusic(fadeOut = true) {
        if (this.currentMusic) {
            if (fadeOut) {
                this.fadeOut(this.currentMusic);
            } else {
                this.currentMusic.pause();
                this.currentMusic.currentTime = 0;
            }
            this.currentMusic = null;
        }
    }
    
    // Resume music
    resumeMusic() {
        if (this.currentMusic && this.currentMusic.paused) {
            this.currentMusic.play().catch(e => console.warn('Music resume failed:', e));
        }
    }
    
    // Pause music
    pauseMusic() {
        if (this.currentMusic && !this.currentMusic.paused) {
            this.currentMusic.pause();
        }
    }
    
    // Set music volume
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        CONFIG.AUDIO.musicVolume = this.musicVolume;
        
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume;
        }
        
        // Update all music tracks
        for (let music of Object.values(this.music)) {
            music.volume = this.musicVolume;
        }
    }
    
    // Set SFX volume
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        CONFIG.AUDIO.sfxVolume = this.sfxVolume;
        
        // Update all sound effects
        for (let sound of Object.values(this.sounds)) {
            sound.volume = this.sfxVolume;
        }
    }
    
    // Play weapon sound based on weapon type
    playWeaponSound(weaponType) {
        const soundMap = {
            pistol: 'pistolShoot',
            smg: 'smgShoot',
            shotgun: 'shotgunShoot',
            rifle: 'rifleShoot',
            knife: 'knifeSwing'
        };
        
        const soundName = soundMap[weaponType];
        if (soundName) {
            this.playSound(soundName);
        }
    }
    
    // Play power-up music (overrides gameplay music temporarily)
    playPowerupMusic(powerupType) {
        const musicMap = {
            mushroom: 'mushroom',
            cocaine: 'cocaine',
            steroids: 'steroids',
            alcohol: 'alcohol',
            fentanyl: 'fentanyl'
        };
        
        const musicName = musicMap[powerupType];
        if (musicName && this.music[musicName]) {
            // Save current music to return to later
            this.savedMusic = this.currentMusic;
            this.playMusic(musicName, false); // Hard cut
        }
    }
    
    // Return to saved music after power-up ends
    returnToSavedMusic() {
        if (this.savedMusic) {
            this.playMusic('gameplay', false); // Return to gameplay music
            this.savedMusic = null;
        }
    }
}

// Create global sound manager instance
const soundManager = new SoundManager();

// Auto-initialize on first user interaction (browsers require this)
document.addEventListener('click', () => {
    if (!soundManager.initialized) {
        soundManager.init();
    }
}, { once: true });
