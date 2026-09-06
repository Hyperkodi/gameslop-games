// ========================================
// ICE AGENT GAME - MASTER CONFIG
// ========================================
// Edit values here to tweak game balance, difficulty, and features
// All time values in milliseconds (1000 = 1 second)

const CONFIG = {
    // ========================================
    // GAME SETTINGS
    // ========================================
    TOTAL_LEVELS: 7,
    STARTING_LIVES: 1, // Gets 3 lives after beating level 1
    MAX_LIVES: 3,
    
    // ========================================
    // PLAYER STATS
    // ========================================
    PLAYER: {
        MAX_HEALTH: 100,
        SPEED: 5,
        JUMP_POWER: 15,
        WIDTH: 40,
        HEIGHT: 70
    },
    
    // ========================================
    // WEAPON CONFIGURATIONS
    // ========================================
    WEAPONS: {
        pistol: {
            damage: 10,
            fireRate: 300,
            bulletSpeed: 12,
            bulletSize: 5,
            spread: 0,
            bulletsPerShot: 1,
            maxAmmo: 100, // EDIT THIS to change pistol ammo
            color: '#f39c12'
        },
        smg: {
            damage: 8,
            fireRate: 100,
            bulletSpeed: 14,
            bulletSize: 4,
            spread: 0.1,
            bulletsPerShot: 1,
            maxAmmo: 200, // EDIT THIS
            color: '#3498db'
        },
        shotgun: {
            damage: 6,
            fireRate: 600,
            bulletSpeed: 10,
            bulletSize: 6,
            spread: 0.3,
            bulletsPerShot: 5,
            maxAmmo: 30, // EDIT THIS (in shells, each shell = 5 pellets)
            color: '#e74c3c'
        },
        rifle: {
            damage: 25,
            fireRate: 500,
            bulletSpeed: 20,
            bulletSize: 7,
            spread: 0,
            bulletsPerShot: 1,
            maxAmmo: 50, // EDIT THIS
            color: '#9b59b6'
        },
        knife: {
            damage: 15,
            range: 40,
            attackRate: 400,
            maxAmmo: Infinity // Knife never runs out
        }
    },
    
    // ========================================
    // ENEMY CONFIGURATIONS
    // ========================================
    ENEMIES: {
        machete: {
            health: 20, // EDIT: How many hits to kill
            speed: 1.2, // EDIT: Movement speed
            damage: 15, // EDIT: Damage to player
            attackRange: 50,
            attackCooldown: 60,
            scoreValue: 100
        },
        karen: {
            health: 20, // Same as machete
            speed: 1.2,
            damage: 15,
            attackRange: 50,
            attackCooldown: 60,
            scoreValue: 150,
            spawnRate: 0.14 // 1 in 7 enemies (1/7 = 0.14)
        },
        glueHuffer: {
            health: 15,
            speed: 2.5,
            explosionDamage: 25, // EDIT: Explosion damage
            explosionRadius: 80,
            scoreValue: 150
        },
        suicideBomber: {
            health: 20,
            speed: 2.0,
            explosionDamage: 35, // EDIT: More than glue huffer
            explosionRadius: 100, // EDIT: Bigger radius
            scoreValue: 200,
            canShootVest: true
        },
        gunPirate: {
            health: 15, // EDIT: Reduced from 25
            speed: 0.5, // EDIT: Very slow
            bulletDamage: 10,
            shootCooldown: 300, // EDIT: Shoots every 5 seconds
            preferredDistance: 80, // EDIT: Close range only
            scoreValue: 150
        },
        rpgPirate: {
            health: 30,
            speed: 0.8,
            rocketDamage: 40,
            rocketSpeed: 5, // Slow moving
            shootCooldown: 300, // Every 5 seconds
            explosionRadius: 120,
            startsAtLevel: 3, // Only appears level 3+
            scoreValue: 250
        }
    },
    
    // ========================================
    // BOSS CONFIGURATION
    // ========================================
    BOSS: {
        baseHealth: 200, // Level 1 boss
        healthPerLevel: 100, // +100 HP each level
        speed: 1,
        damage: 20,
        summonCooldown: 300, // 5 seconds
        specialAttackCooldown: 180, // 3 seconds
        phase2Threshold: 0.6, // Enters phase 2 at 60% HP
        phase3Threshold: 0.3, // Enters phase 3 at 30% HP
        scoreValue: 1000
    },
    
    // ========================================
    // POWER-UP DURATIONS
    // ========================================
    POWERUPS: {
        mushroom: {
            duration: 20000, // EDIT: 20 seconds
            message: '🍄 OH NO! YOU GOT SOMALI SHROOMED!'
        },
        cocaine: {
            duration: 16000, // EDIT: 16 seconds
            comedownDuration: 16000, // EDIT: Equal comedown
            speedMultiplier: 2,
            fireRateMultiplier: 3,
            message: '❄️ COKE DISCO TIME!',
            comedownMessage: '😓 MAN WHAT A COMEDOWN! GOT ANY MORE COKE?'
        },
        steroids: {
            duration: 24000, // EDIT: 24 seconds
            sizeMultiplier: 1.5,
            speedMultiplier: 1.5,
            jumpMultiplier: 1.5,
            damageMultiplier: 2,
            message: '💪 ROID TIME!'
        },
        alcohol: {
            duration: 20000, // EDIT: 20 seconds
            speedMultiplier: 0.7,
            damageReduction: 0.5, // Take 50% less damage
            message: '🍺 YOU GOT BOOZED!'
        },
        fentanyl: {
            duration: 5000, // EDIT: 5 seconds (short)
            speedMultiplier: 0.4, // EDIT: 40% speed
            invulnerable: true,
            message: '💉 YOU GOT DAT SOMALI FENTED SONNN!'
        },
        health: {
            healAmount: 50
        },
        extraLife: {
            rarity: 0.03 // 3% chance from desks
        }
    },
    
    // ========================================
    // DIFFICULTY SETTINGS
    // ========================================
    DIFFICULTY: {
        easy: {
            playerHealthMultiplier: 1.5, // 150 HP
            enemyHealthMultiplier: 0.7, // Enemies 30% weaker
            enemyDamageMultiplier: 0.7, // Enemies do 30% less damage
            enemySpawnMultiplier: 0.7, // 30% fewer enemies
            scoreMultiplier: 0.8, // 80% score
            healthDropRate: 0.4 // 40% chance on enemy kill
        },
        normal: {
            playerHealthMultiplier: 1, // 100 HP
            enemyHealthMultiplier: 1,
            enemyDamageMultiplier: 1,
            enemySpawnMultiplier: 1,
            scoreMultiplier: 1,
            healthDropRate: 0.25 // 25% chance
        },
        hard: {
            playerHealthMultiplier: 1, // Still 100 HP
            enemyHealthMultiplier: 1.3, // EDIT: Enemies 30% tougher
            enemyDamageMultiplier: 1, // EDIT: Same damage (you said no harder damage)
            enemySpawnMultiplier: 1.5, // EDIT: 50% more enemies
            scoreMultiplier: 2, // 2x score
            healthDropRate: 0.25 // Still drop health
        }
    },
    
    // ========================================
    // LEVEL PROGRESSION
    // ========================================
    LEVELS: {
        1: {
            killRequirement: 10, // Kill 10 enemies to spawn boss
            macheteCount: 5,
            karenCount: 1, // 1 in 7 spawn rate
            glueCount: 1,
            gunCount: 0,
            bomberCount: 0,
            rpgCount: 0,
            deskCount: 10,
            obstacleCount: 5,
            collectibleCount: 8
        },
        2: {
            killRequirement: 15,
            macheteCount: 7,
            karenCount: 1,
            glueCount: 2,
            gunCount: 1, // ONLY 1 gun pirate
            bomberCount: 1,
            rpgCount: 0,
            deskCount: 10,
            obstacleCount: 7,
            collectibleCount: 10
        },
        3: {
            killRequirement: 20,
            macheteCount: 10,
            karenCount: 2,
            glueCount: 2,
            gunCount: 1, // Still only 1
            bomberCount: 2,
            rpgCount: 1, // RPG starts here
            deskCount: 10,
            obstacleCount: 8,
            collectibleCount: 12
        },
        4: {
            killRequirement: 25,
            macheteCount: 12,
            karenCount: 2,
            glueCount: 3,
            gunCount: 1,
            bomberCount: 2,
            rpgCount: 2,
            deskCount: 10,
            obstacleCount: 10,
            collectibleCount: 15
        },
        5: {
            killRequirement: 30,
            macheteCount: 15,
            karenCount: 3,
            glueCount: 3,
            gunCount: 1,
            bomberCount: 3,
            rpgCount: 2,
            deskCount: 10,
            obstacleCount: 12,
            collectibleCount: 18
        },
        6: {
            killRequirement: 35,
            macheteCount: 18,
            karenCount: 3,
            glueCount: 4,
            gunCount: 2, // Can have 2 now on level 6
            bomberCount: 3,
            rpgCount: 3,
            deskCount: 12,
            obstacleCount: 14,
            collectibleCount: 20
        },
        7: {
            killRequirement: 40,
            macheteCount: 20,
            karenCount: 4,
            glueCount: 4,
            gunCount: 2,
            bomberCount: 4,
            rpgCount: 3,
            deskCount: 12,
            obstacleCount: 15,
            collectibleCount: 25
        }
    },
    
    // ========================================
    // VISUAL/AUDIO SETTINGS
    // ========================================
    EFFECTS: {
        particlesEnabled: true, // EDIT: Turn particles on/off
        particleIntensity: 1.0, // EDIT: 0.5 = half particles, 2.0 = double
        screenShakeEnabled: true, // EDIT: Turn shake on/off
        screenShakeIntensity: 1.0, // EDIT: Shake strength
        bloodEnabled: true
    },
    
    AUDIO: {
        musicVolume: 0.3, // EDIT: 0.0 to 1.0
        sfxVolume: 0.5, // EDIT: 0.0 to 1.0
        soundVariations: false, // EDIT: Set to true for random sound variations
        musicFadeTime: 1000 // EDIT: Fade duration in ms
    },
    
    // ========================================
    // CRYPTO INTEGRATION (NOT YET ENABLED)
    // ========================================
    CRYPTO: {
        enabled: false, // Set to true when ready to integrate
        networkId: 1, // 1 = Ethereum mainnet
        contractAddress: null, // Add your NFT contract address
        useWalletConnect: true,
        features: {
            nftAchievements: false,
            onChainLeaderboard: false,
            tokenRewards: false
        }
    },
    
    // ========================================
    // ACHIEVEMENTS
    // ========================================
    ACHIEVEMENTS: {
        firstBlood: { name: 'First Blood', condition: 'kill', value: 1, reward: null },
        taxCollector: { name: 'Tax Collector', condition: 'money', value: 5000, reward: null },
        daycareHero: { name: 'Daycare Hero', condition: 'kids', value: 20, reward: null },
        crackhead: { name: 'Crackhead', condition: 'cocaine', value: 10, reward: null },
        mushroomTrip: { name: 'Mushroom Trip', condition: 'flyTime', value: 100, reward: null },
        untouchable: { name: 'Untouchable', condition: 'noDamageLevel', value: 1, reward: 'bonusLevel' },
        arsenal: { name: 'Arsenal', condition: 'allWeapons', value: 4, reward: null },
        karenSlayer: { name: 'Karen Slayer', condition: 'karenKills', value: 10, reward: null },
        bossKiller: { name: 'Boss Killer', condition: 'bossKills', value: 1, reward: null },
        perfectRun: { name: 'Perfect Run', condition: 'beatGame', value: 1, reward: 'credits' }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
