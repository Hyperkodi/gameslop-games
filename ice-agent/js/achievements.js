// ========================================
// ACHIEVEMENTS & LEADERBOARD SYSTEM
// ========================================
// Local storage + Crypto-ready structure

class AchievementManager {
    constructor() {
        this.achievements = { ...CONFIG.ACHIEVEMENTS };
        this.unlocked = this.loadUnlockedAchievements();
        this.stats = this.loadStats();
    }
    
    // Load unlocked achievements from localStorage
    loadUnlockedAchievements() {
        const saved = localStorage.getItem('achievements');
        return saved ? JSON.parse(saved) : {};
    }
    
    // Load player stats from localStorage
    loadStats() {
        const saved = localStorage.getItem('playerStats');
        return saved ? JSON.parse(saved) : {
            totalKills: 0,
            karenKills: 0,
            bossKills: 0,
            moneyCollected: 0,
            kidsSaved: 0,
            cocaineUses: 0,
            totalFlyTime: 0,
            weaponsCollected: [],
            levelsCompleted: [],
            noDamageLevels: []
        };
    }
    
    // Save achievements
    saveAchievements() {
        localStorage.setItem('achievements', JSON.stringify(this.unlocked));
    }
    
    // Save stats
    saveStats() {
        localStorage.setItem('playerStats', JSON.stringify(this.stats));
    }
    
    // Update stat and check achievements
    updateStat(statName, value) {
        if (statName === 'weaponsCollected' || statName === 'levelsCompleted' || statName === 'noDamageLevels') {
            if (!this.stats[statName].includes(value)) {
                this.stats[statName].push(value);
            }
        } else {
            this.stats[statName] += value;
        }
        
        this.saveStats();
        this.checkAchievements();
    }
    
    // Check if any achievements should be unlocked
    checkAchievements() {
        for (let [key, achievement] of Object.entries(this.achievements)) {
            if (this.unlocked[key]) continue; // Already unlocked
            
            let shouldUnlock = false;
            
            switch(achievement.condition) {
                case 'kill':
                    shouldUnlock = this.stats.totalKills >= achievement.value;
                    break;
                case 'money':
                    shouldUnlock = this.stats.moneyCollected >= achievement.value;
                    break;
                case 'kids':
                    shouldUnlock = this.stats.kidsSaved >= achievement.value;
                    break;
                case 'cocaine':
                    shouldUnlock = this.stats.cocaineUses >= achievement.value;
                    break;
                case 'flyTime':
                    shouldUnlock = this.stats.totalFlyTime >= achievement.value;
                    break;
                case 'noDamageLevel':
                    shouldUnlock = this.stats.noDamageLevels.length >= achievement.value;
                    break;
                case 'allWeapons':
                    shouldUnlock = this.stats.weaponsCollected.length >= achievement.value;
                    break;
                case 'karenKills':
                    shouldUnlock = this.stats.karenKills >= achievement.value;
                    break;
                case 'bossKills':
                    shouldUnlock = this.stats.bossKills >= achievement.value;
                    break;
                case 'beatGame':
                    shouldUnlock = this.stats.levelsCompleted.length >= CONFIG.TOTAL_LEVELS;
                    break;
            }
            
            if (shouldUnlock) {
                this.unlockAchievement(key, achievement);
            }
        }
    }
    
    // Unlock achievement
    unlockAchievement(key, achievement) {
        this.unlocked[key] = {
            name: achievement.name,
            unlockedAt: new Date().toISOString(),
            reward: achievement.reward
        };
        
        this.saveAchievements();
        
        // Show popup
        effects.showPopup(`🏆 ACHIEVEMENT UNLOCKED: ${achievement.name.toUpperCase()}!`, 'achievement');
        soundManager.playSound('achievementUnlock');
        
        // Handle rewards
        if (achievement.reward === 'bonusLevel') {
            this.unlockBonusLevel();
        }
        
        // CRYPTO HOOK: Mint NFT achievement
        if (CONFIG.CRYPTO.enabled && CONFIG.CRYPTO.features.nftAchievements) {
            this.mintAchievementNFT(key, achievement);
        }
    }
    
    // Unlock bonus level
    unlockBonusLevel() {
        localStorage.setItem('bonusLevelUnlocked', 'true');
        effects.showPopup('🎮 BONUS LEVEL UNLOCKED!', 'special');
    }
    
    // Get achievement progress for display
    getProgress() {
        const progress = [];
        
        for (let [key, achievement] of Object.entries(this.achievements)) {
            const unlocked = !!this.unlocked[key];
            let current = 0;
            
            switch(achievement.condition) {
                case 'kill':
                    current = this.stats.totalKills;
                    break;
                case 'money':
                    current = this.stats.moneyCollected;
                    break;
                case 'kids':
                    current = this.stats.kidsSaved;
                    break;
                case 'cocaine':
                    current = this.stats.cocaineUses;
                    break;
                case 'flyTime':
                    current = this.stats.totalFlyTime;
                    break;
                case 'karenKills':
                    current = this.stats.karenKills;
                    break;
                case 'bossKills':
                    current = this.stats.bossKills;
                    break;
                case 'allWeapons':
                    current = this.stats.weaponsCollected.length;
                    break;
            }
            
            progress.push({
                key,
                name: achievement.name,
                unlocked,
                current,
                required: achievement.value,
                percentage: Math.min(100, (current / achievement.value) * 100)
            });
        }
        
        return progress;
    }
    
    // CRYPTO INTEGRATION HOOK
    async mintAchievementNFT(achievementKey, achievement) {
        // This will be implemented when crypto is enabled
        console.log('🔗 Would mint NFT for achievement:', achievement.name);
        
        // Example implementation (not active):
        /*
        if (window.ethereum) {
            const web3 = new Web3(window.ethereum);
            const contract = new web3.eth.Contract(ABI, CONFIG.CRYPTO.contractAddress);
            
            await contract.methods.mintAchievement(
                achievementKey,
                achievement.name,
                Date.now()
            ).send({ from: userWalletAddress });
        }
        */
    }
}

// ========================================
// LEADERBOARD SYSTEM
// ========================================

class LeaderboardManager {
    constructor() {
        this.localScores = this.loadLocalScores();
    }
    
    // Load local high scores
    loadLocalScores() {
        const saved = localStorage.getItem('highScores');
        return saved ? JSON.parse(saved) : [];
    }
    
    // Save local high scores
    saveLocalScores() {
        localStorage.setItem('highScores', JSON.stringify(this.localScores));
    }
    
    // Add new score
    addScore(playerName, score, level, stats) {
        const entry = {
            name: playerName || 'Anonymous',
            score: score,
            level: level,
            money: stats.money || 0,
            kids: stats.kids || 0,
            documents: stats.documents || 0,
            date: new Date().toLocaleDateString(),
            timestamp: Date.now()
        };
        
        this.localScores.push(entry);
        
        // Sort by score (highest first)
        this.localScores.sort((a, b) => b.score - a.score);
        
        // Keep top 100
        this.localScores = this.localScores.slice(0, 100);
        
        this.saveLocalScores();
        
        // CRYPTO HOOK: Submit to on-chain leaderboard
        if (CONFIG.CRYPTO.enabled && CONFIG.CRYPTO.features.onChainLeaderboard) {
            this.submitToBlockchain(entry);
        }
        
        return this.getRank(entry.timestamp);
    }
    
    // Get player's rank
    getRank(timestamp) {
        const index = this.localScores.findIndex(s => s.timestamp === timestamp);
        return index >= 0 ? index + 1 : null;
    }
    
    // Get top N scores
    getTopScores(limit = 10) {
        return this.localScores.slice(0, limit);
    }
    
    // Get player's best score
    getPersonalBest(playerName) {
        const playerScores = this.localScores.filter(s => s.name === playerName);
        return playerScores.length > 0 ? playerScores[0] : null;
    }
    
    // CRYPTO INTEGRATION HOOK
    async submitToBlockchain(entry) {
        // This will be implemented when crypto is enabled
        console.log('🔗 Would submit to blockchain:', entry);
        
        // Example implementation (not active):
        /*
        if (window.ethereum) {
            const web3 = new Web3(window.ethereum);
            const contract = new web3.eth.Contract(ABI, CONFIG.CRYPTO.contractAddress);
            
            await contract.methods.submitScore(
                entry.score,
                entry.level,
                entry.timestamp
            ).send({ from: userWalletAddress });
        }
        */
    }
    
    // CRYPTO: Fetch global leaderboard from blockchain
    async fetchGlobalLeaderboard() {
        if (!CONFIG.CRYPTO.enabled || !CONFIG.CRYPTO.features.onChainLeaderboard) {
            return this.localScores;
        }
        
        console.log('🔗 Would fetch global leaderboard from blockchain');
        
        // Example implementation (not active):
        /*
        const web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(ABI, CONFIG.CRYPTO.contractAddress);
        const globalScores = await contract.methods.getTopScores(100).call();
        return globalScores;
        */
        
        return this.localScores;
    }
}

// ========================================
// CRYPTO WALLET INTEGRATION (PLACEHOLDER)
// ========================================

class CryptoManager {
    constructor() {
        this.connected = false;
        this.walletAddress = null;
        this.networkId = null;
    }
    
    // Connect wallet (MetaMask, WalletConnect, etc.)
    async connectWallet() {
        if (!CONFIG.CRYPTO.enabled) {
            console.log('Crypto features not enabled');
            return false;
        }
        
        console.log('🔗 Crypto integration placeholder - not yet active');
        
        // Example implementation (not active):
        /*
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ 
                    method: 'eth_requestAccounts' 
                });
                
                this.walletAddress = accounts[0];
                this.networkId = await window.ethereum.request({ 
                    method: 'net_version' 
                });
                
                this.connected = true;
                return true;
            } catch (error) {
                console.error('Wallet connection failed:', error);
                return false;
            }
        }
        */
        
        return false;
    }
    
    // Disconnect wallet
    disconnectWallet() {
        this.connected = false;
        this.walletAddress = null;
        this.networkId = null;
    }
    
    // Check if wallet is connected
    isConnected() {
        return this.connected;
    }
}

// Create global instances
const achievementManager = new AchievementManager();
const leaderboardManager = new LeaderboardManager();
const cryptoManager = new CryptoManager();
