require('dotenv').config();
const { ethers } = require('ethers');
const bip39 = require('bip39');
const TelegramBot = require('node-telegram-bot-api');

class GhostlineHunter {
    constructor(options = {}) {
        this.name = 'GhostlineHunter';
        this.version = '2.0.0';
        this.isRunning = false;
        this.scanInterval = options.scanInterval || 300000; // 5 minutes default
        this.intervalId = null;
        this.startTime = null;
        
        // Environment configuration
        this.alchemyApiKey = process.env.ALCHEMY_API_KEY;
        this.etherscanApiKey = process.env.ETHERSCAN_API_KEY;
        this.telegramToken = process.env.TELEGRAM_TOKEN;
        this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
        
        // Performance metrics
        this.metrics = {
            keysGenerated: 0,
            balancesChecked: 0,
            positiveHits: 0,
            errors: 0,
            lastScanTime: null,
            scanCycles: 0
        };
        
        // Ethereum provider setup
        this.provider = new ethers.providers.JsonRpcProvider(
            `https://eth-mainnet.g.alchemy.com/v2/${this.alchemyApiKey}`
        );
        
        // Telegram bot initialization
        if (this.telegramToken) {
            this.bot = new TelegramBot(this.telegramToken);
        }
        
        // Rate limiting configuration
        this.rateLimitDelay = 1000; // 1 second between requests
        this.maxKeysPerCycle = 100; // Keys to check per scan cycle
        
        this.log('GhostlineHunter v2.0 initialized for private key generation and balance scanning');
        this.validateConfiguration();
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [HUNTER] ${message}`);
    }

    validateConfiguration() {
        const requiredVars = ['ALCHEMY_API_KEY', 'ETHERSCAN_API_KEY', 'TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID'];
        const missing = requiredVars.filter(env => !process.env[env]);
        
        if (missing.length > 0) {
            this.log(`Configuration warning: Missing environment variables: ${missing.join(', ')}`);
        } else {
            this.log('Configuration validated successfully');
        }
    }

    async start() {
        if (this.isRunning) {
            this.log('Hunter is already running');
            return;
        }

        this.isRunning = true;
        this.startTime = new Date();
        this.log('Starting GhostlineHunter scanning operations');
        
        await this.sendTelegramAlert('🔍 GhostlineHunter v2.0 started scanning for private keys with ETH balance');
        
        // Execute initial scan
        await this.executeScanCycle();
        
        // Set up recurring scans
        this.intervalId = setInterval(async () => {
            if (this.isRunning) {
                await this.executeScanCycle();
            }
        }, this.scanInterval);
    }

    async stop() {
        if (!this.isRunning) {
            this.log('Hunter is not currently running');
            return;
        }

        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.log('GhostlineHunter scanning operations stopped');
        await this.sendTelegramAlert('⏹️ GhostlineHunter v2.0 stopped scanning operations');
    }

    async executeScanCycle() {
        this.log('Starting new scan cycle');
        this.metrics.scanCycles++;
        this.metrics.lastScanTime = new Date();
        
        try {
            for (let i = 0; i < this.maxKeysPerCycle; i++) {
                if (!this.isRunning) break;
                
                await this.processRandomKey();
                
                // Rate limiting
                if (i < this.maxKeysPerCycle - 1) {
                    await this.sleep(this.rateLimitDelay);
                }
            }
            
            this.log(`Scan cycle completed: ${this.maxKeysPerCycle} keys processed`);
            
        } catch (error) {
            this.metrics.errors++;
            this.log(`Scan cycle error: ${error.message}`);
        }
    }

    async processRandomKey() {
        try {
            const keyData = this.generateRandomKeyData();
            this.metrics.keysGenerated++;
            
            const balance = await this.checkBalance(keyData.address);
            this.metrics.balancesChecked++;
            
            if (balance > 0) {
                this.metrics.positiveHits++;
                await this.handlePositiveBalance(keyData, balance);
            }
            
        } catch (error) {
            this.metrics.errors++;
            this.log(`Key processing error: ${error.message}`);
        }
    }

    generateRandomKeyData() {
        // Generate random mnemonic phrase
        const mnemonic = bip39.generateMnemonic(256); // 24 words
        
        // Create wallet from mnemonic
        const wallet = ethers.Wallet.fromMnemonic(mnemonic);
        
        return {
            mnemonic: mnemonic,
            privateKey: wallet.privateKey,
            address: wallet.address,
            publicKey: wallet.publicKey
        };
    }

    async checkBalance(address) {
        try {
            const balance = await this.provider.getBalance(address);
            return parseFloat(ethers.utils.formatEther(balance));
        } catch (error) {
            this.log(`Balance check failed for ${address}: ${error.message}`);
            throw error;
        }
    }

    async handlePositiveBalance(keyData, balance) {
        this.log(`POSITIVE BALANCE FOUND: ${keyData.address} - ${balance} ETH`);
        
        const discovery = {
            address: keyData.address,
            privateKey: keyData.privateKey,
            mnemonic: keyData.mnemonic,
            balance: balance,
            timestamp: new Date().toISOString(),
            scanCycle: this.metrics.scanCycles
        };
        
        // Log discovery securely
        await this.logDiscovery(discovery);
        
        // Send Telegram alert
        await this.sendBalanceAlert(discovery);
    }

    async logDiscovery(discovery) {
        try {
            const fs = require('fs').promises;
            const logEntry = {
                timestamp: discovery.timestamp,
                address: discovery.address,
                balance: discovery.balance,
                scanCycle: discovery.scanCycle,
                // Security note: privateKey and mnemonic excluded from log for security
                privateKeyHash: this.hashPrivateKey(discovery.privateKey)
            };
            
            const logFile = './hunter_discoveries.json';
            let discoveries = [];
            
            try {
                const existingData = await fs.readFile(logFile, 'utf8');
                discoveries = JSON.parse(existingData);
            } catch (error) {
                // File doesn't exist, start with empty array
            }
            
            discoveries.push(logEntry);
            await fs.writeFile(logFile, JSON.stringify(discoveries, null, 2));
            
        } catch (error) {
            this.log(`Discovery logging error: ${error.message}`);
        }
    }

    async sendBalanceAlert(discovery) {
        if (!this.bot || !this.telegramChatId) {
            this.log('Telegram not configured - skipping balance alert');
            return;
        }

        try {
            const message = this.formatBalanceAlert(discovery);
            await this.bot.sendMessage(this.telegramChatId, message);
            this.log('Balance discovery alert sent via Telegram');
        } catch (error) {
            this.log(`Telegram alert failed: ${error.message}`);
        }
    }

    formatBalanceAlert(discovery) {
        const maskedPrivateKey = discovery.privateKey.substring(0, 8) + '...' + discovery.privateKey.substring(58);
        const maskedMnemonic = discovery.mnemonic.split(' ').map((word, index) => 
            index < 3 || index > 20 ? word : '***'
        ).join(' ');
        
        return `🎯 POSITIVE BALANCE DISCOVERED\n\n` +
               `💰 Balance: ${discovery.balance} ETH\n` +
               `📍 Address: ${discovery.address}\n` +
               `🔑 Private Key: ${maskedPrivateKey}\n` +
               `🗝️ Mnemonic: ${maskedMnemonic}\n` +
               `📊 Scan Cycle: ${discovery.scanCycle}\n` +
               `⏰ Time: ${discovery.timestamp}\n\n` +
               `⚠️ SECURE THIS INFORMATION IMMEDIATELY`;
    }

    async sendTelegramAlert(message) {
        if (!this.bot || !this.telegramChatId) {
            return;
        }

        try {
            await this.bot.sendMessage(this.telegramChatId, message);
        } catch (error) {
            this.log(`Telegram notification failed: ${error.message}`);
        }
    }

    hashPrivateKey(privateKey) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(privateKey).digest('hex').substring(0, 16);
    }

    getStatus() {
        const runtime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
        const hours = Math.floor(runtime / 3600000);
        const minutes = Math.floor((runtime % 3600000) / 60000);
        
        return {
            isRunning: this.isRunning,
            runtime: `${hours}h ${minutes}m`,
            metrics: this.metrics,
            scanInterval: this.scanInterval,
            maxKeysPerCycle: this.maxKeysPerCycle,
            lastScanTime: this.metrics.lastScanTime
        };
    }

    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.balancesChecked > 0 ? 
                (this.metrics.positiveHits / this.metrics.balancesChecked * 100).toFixed(6) + '%' : '0%',
            errorRate: this.metrics.keysGenerated > 0 ? 
                (this.metrics.errors / this.metrics.keysGenerated * 100).toFixed(2) + '%' : '0%'
        };
    }

    updateScanInterval(newInterval) {
        this.scanInterval = newInterval;
        
        if (this.isRunning && this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(async () => {
                if (this.isRunning) {
                    await this.executeScanCycle();
                }
            }, this.scanInterval);
        }
        
        this.log(`Scan interval updated to ${newInterval}ms`);
    }

    sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }
}

module.exports = GhostlineHunter;
// Force Railway redeploy to include agent modules
