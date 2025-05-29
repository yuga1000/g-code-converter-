const https = require('https');
const http = require('http');
const crypto = require('crypto');

class GhostlineScavenger {
    constructor(options = {}) {
        this.name = 'GhostlineScavenger';
        this.version = '2.1.0';
        this.isRunning = false;
        this.scanInterval = options.scanInterval || 600000; // 10 minutes
        this.intervalId = null;
        this.startTime = null;
        
        // Performance counters
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
        
        // Default sources for scanning
        this.sourceUrls = [
            'https://api.github.com/search/code?q=private+key+ethereum',
            'https://api.github.com/search/code?q=mnemonic+seed+phrase',
            'https://pastebin.com/api/api_scraping.php',
            'https://api.github.com/search/repositories?q=wallet+backup'
        ];
        
        // Pattern recognition definitions
        this.patterns = {
            privateKey: {
                regex: /(?:private[_\s]*key|privateKey)['\"\s:=]*([a-fA-F0-9]{64})/gi,
                validator: this.validatePrivateKey.bind(this),
                description: 'Ethereum Private Key'
            },
            ethAddress: {
                regex: /0x[a-fA-F0-9]{40}/gi,
                validator: this.validateEthereumAddress.bind(this),
                description: 'Ethereum Address'
            },
            mnemonic: {
                regex: /((?:\w+\s+){11,23}\w+)/gi,
                validator: this.validateMnemonic.bind(this),
                description: 'Mnemonic Seed Phrase'
            }
        };
        
        this.log('GhostlineScavenger v2.1 initialized for public source scanning');
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [SCAVENGER] ${message}`);
    }

    async start() {
        if (this.isRunning) {
            this.log('Scavenger is already running');
            return;
        }

        this.isRunning = true;
        this.startTime = new Date();
        this.log('Starting GhostlineScavenger scanning operations');
        
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
            this.log('Scavenger is not currently running');
            return;
        }

        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.log('GhostlineScavenger scanning operations stopped');
    }

    async executeScanCycle() {
        this.log('Starting new scan cycle');
        this.counters.scanCycles++;
        this.counters.lastScanTime = new Date();
        
        try {
            for (const sourceUrl of this.sourceUrls) {
                if (!this.isRunning) break;
                
                await this.scanSource(sourceUrl);
                
                // Rate limiting between sources
                await this.sleep(3000);
            }
            
            this.log(`Scan cycle completed: ${this.sourceUrls.length} sources processed`);
            
        } catch (error) {
            this.counters.errors++;
            this.log(`Scan cycle error: ${error.message}`);
        }
    }

    async scanSource(sourceUrl) {
        try {
            this.log(`Scanning source: ${sourceUrl}`);
            this.counters.sourcesScanned++;
            
            const content = await this.fetchContent(sourceUrl);
            if (content) {
                await this.analyzeContent(content, sourceUrl);
            }
            
        } catch (error) {
            this.counters.errors++;
            this.log(`Source scan error for ${sourceUrl}: ${error.message}`);
        }
    }

    async fetchContent(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; GhostlineScavenger/2.1)',
                    'Accept': 'application/json, text/plain, */*'
                },
                timeout: 10000
            };
            
            const req = client.get(url, options, (res) => {
                let data = '';
                
                res.on('data', chunk => {
                    data += chunk;
                    // Limit response size to prevent memory issues
                    if (data.length > 1048576) { // 1MB limit
                        req.destroy();
                        resolve(data);
                    }
                });
                
                res.on('end', () => {
                    resolve(data);
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
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
            this.log(`Content analysis error: ${error.message}`);
        }
    }

    validatePrivateKey(key) {
        // Basic validation for Ethereum private key format
        const cleaned = key.replace(/[^a-fA-F0-9]/g, '');
        return cleaned.length === 64 && /^[a-fA-F0-9]+$/.test(cleaned);
    }

    validateEthereumAddress(address) {
        // Basic validation for Ethereum address format
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    validateMnemonic(phrase) {
        // Basic validation for mnemonic phrase
        const words = phrase.trim().split(/\s+/);
        return words.length >= 12 && words.length <= 24;
    }

    async handleMatch(patternType, match, sourceUrl) {
        this.log(`MATCH FOUND: ${patternType} from ${sourceUrl}`);
        
        const discovery = {
            type: patternType,
            content: this.maskSensitiveData(match, patternType),
            source: sourceUrl,
            timestamp: new Date().toISOString(),
            scanCycle: this.counters.scanCycles
        };
        
        // Update specific counters
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
        
        await this.logDiscovery(discovery);
    }

    maskSensitiveData(data, type) {
        // Mask sensitive information for logging
        if (type === 'privateKey') {
            return data.substring(0, 8) + '...' + data.substring(data.length - 8);
        } else if (type === 'mnemonic') {
            const words = data.split(' ');
            return words.map((word, index) => 
                index < 3 || index > words.length - 4 ? word : '***'
            ).join(' ');
        }
        return data;
    }

    async logDiscovery(discovery) {
        try {
            // In production, implement secure logging to file or database
            this.log(`Discovery logged: ${discovery.type} from ${discovery.source}`);
        } catch (error) {
            this.log(`Discovery logging error: ${error.message}`);
        }
    }

    getStatus() {
        const runtime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
        const hours = Math.floor(runtime / 3600000);
        const minutes = Math.floor((runtime % 3600000) / 60000);
        
        return {
            isRunning: this.isRunning,
            runtime: `${hours}h ${minutes}m`,
            counters: this.counters,
            scanInterval: this.scanInterval,
            sourcesCount: this.sourceUrls.length,
            lastScanTime: this.counters.lastScanTime
        };
    }

    getMetrics() {
        return {
            ...this.counters,
            successRate: this.counters.sourcesScanned > 0 ? 
                (this.counters.matchesFound / this.counters.sourcesScanned * 100).toFixed(2) + '%' : '0%',
            errorRate: this.counters.scanCycles > 0 ? 
                (this.counters.errors / this.counters.scanCycles * 100).toFixed(2) + '%' : '0%'
        };
    }

    addSourceUrl(url) {
        if (typeof url === 'string' && !this.sourceUrls.includes(url)) {
            this.sourceUrls.push(url);
            this.log(`Added new source URL: ${url}`);
        }
    }

    removeSourceUrl(url) {
        const index = this.sourceUrls.indexOf(url);
        if (index > -1) {
            this.sourceUrls.splice(index, 1);
            this.log(`Removed source URL: ${url}`);
        }
    }

    clearDiscoveries() {
        this.counters.matchesFound = 0;
        this.counters.privateKeysFound = 0;
        this.counters.mnemonicsFound = 0;
        this.counters.walletJsonFound = 0;
        this.log('Discovery cache cleared');
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

module.exports = GhostlineScavenger;
