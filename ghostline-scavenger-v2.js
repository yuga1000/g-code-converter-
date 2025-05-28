const axios = require('axios');
const bip39 = require('bip39');

class GhostlineScavenger {
    constructor(options = {}) {
        this.name = 'GhostlineScavenger';
        this.version = '2.0.0';
        this.isRunning = false;
        this.scanInterval = options.scanInterval || 600000; // 10 minutes default
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
        
        // HTTP client configuration
        this.httpClient = axios.create({
            timeout: 30000,
            maxContentLength: 1048576, // 1MB limit
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; GhostlineScavenger/2.0)'
            }
        });
        
        // Pattern recognition definitions
        this.patterns = {
            privateKey: {
                regex: /(?:^|[^a-fA-F0-9])([a-fA-F0-9]{64})(?:[^a-fA-F0-9]|$)/gm,
                validator: this.validatePrivateKey.bind(this),
                description: 'Ethereum Private Key'
            },
            ethAddress: {
                regex: /(?:^|[^a-fA-F0-9])(0x[a-fA-F0-9]{40})(?:[^a-fA-F0-9]|$)/gm,
                validator: this.validateEthereumAddress.bind(this),
                description: 'Ethereum Address'
            },
            walletJson: {
                regex: /"address"\s*:\s*"(0x[a-fA-F0-9]{40})"[\s\S]*?"privateKey"\s*:\s*"([a-fA-F0-9]{64})"/gm,
                validator: this.validateWalletJson.bind(this),
                description: 'Wallet JSON Export'
            }
        };
        
        // Source URLs for scanning
        this.sourceUrls = [
            'https://pastebin.com/raw/example1',
            'https://gist.githubusercontent.com/user/id/raw/file.txt',
            'https://raw.githubusercontent.com/user/repo/main/data.json',
            'https://paste.ubuntu.com/p/example/plain/',
            'https://justpaste.it/example/txt',
            'https://hastebin.com/raw/example',
            'https://controlc.com/example',
            'https://dpaste.com/example.txt',
            'https://archive.org/download/example/data.txt',
            'https://privatebin.net/?example#data'
        ];
        
        // Discovery storage
        this.discoveries = [];
        
        this.log('GhostlineScavenger v2.0 initialized for public source scanning');
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
        await this.scanNow();
        
        // Set up recurring scans
        this.intervalId = setInterval(async () => {
            if (this.isRunning) {
                await this.scanNow();
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

    async scanNow() {
        this.log('Initiating manual scan cycle');
        this.counters.scanCycles++;
        this.counters.lastScanTime = new Date();
        
        const scanPromises = this.sourceUrls.map(url => this.scanSource(url));
        const results = await Promise.allSettled(scanPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        this.log(`Scan cycle completed: ${successful} sources scanned successfully, ${failed} failed`);
        
        return {
            sourcesScanned: successful,
            sourcesFailed: failed,
            totalFindings: this.counters.matchesFound,
            lastScanTime: this.counters.lastScanTime
        };
    }

    async scanSource(url) {
        try {
            this.log(`Scanning source: ${url}`);
            
            const response = await this.httpClient.get(url);
            const content = response.data;
            
            if (typeof content !== 'string') {
                throw new Error('Invalid content type - expected text');
            }
            
            this.counters.sourcesScanned++;
            
            const findings = await this.analyzeContent(content, url);
            
            if (findings.length > 0) {
                this.log(`Found ${findings.length} potential matches in ${url}`);
                this.discoveries.push(...findings);
            }
            
            return findings;
            
        } catch (error) {
            this.counters.errors++;
            this.log(`Error scanning ${url}: ${error.message}`);
            throw error;
        }
    }

    async analyzeContent(content, sourceUrl) {
        const findings = [];
        
        // Scan for private keys
        const privateKeyMatches = this.extractPrivateKeys(content);
        privateKeyMatches.forEach(match => {
            findings.push({
                type: 'privateKey',
                value: match,
                source: sourceUrl,
                timestamp: new Date().toISOString(),
                confidence: this.patterns.privateKey.validator(match)
            });
            this.counters.privateKeysFound++;
        });
        
        // Scan for mnemonic phrases
        const mnemonicMatches = await this.extractMnemonics(content);
        mnemonicMatches.forEach(match => {
            findings.push({
                type: 'mnemonic',
                value: match,
                source: sourceUrl,
                timestamp: new Date().toISOString(),
                confidence: 'high'
            });
            this.counters.mnemonicsFound++;
        });
        
        // Scan for wallet JSON structures
        const walletJsonMatches = this.extractWalletJson(content);
        walletJsonMatches.forEach(match => {
            findings.push({
                type: 'walletJson',
                value: match,
                source: sourceUrl,
                timestamp: new Date().toISOString(),
                confidence: 'high'
            });
            this.counters.walletJsonFound++;
        });
        
        this.counters.matchesFound += findings.length;
        
        return findings;
    }

    extractPrivateKeys(content) {
        const matches = [];
        let match;
        
        while ((match = this.patterns.privateKey.regex.exec(content)) !== null) {
            const candidate = match[1];
            if (this.patterns.privateKey.validator(candidate) === 'high') {
                matches.push(candidate);
            }
        }
        
        this.patterns.privateKey.regex.lastIndex = 0;
        return matches;
    }

    async extractMnemonics(content) {
        const matches = [];
        const words = content.toLowerCase().match(/\b[a-z]+\b/g) || [];
        
        if (words.length < 12) return matches;
        
        // Check for sequences of 12, 15, 18, 21, or 24 consecutive BIP39 words
        const validLengths = [12, 15, 18, 21, 24];
        
        for (let i = 0; i <= words.length - 12; i++) {
            for (const length of validLengths) {
                if (i + length > words.length) continue;
                
                const candidatePhrase = words.slice(i, i + length).join(' ');
                
                if (await this.validateMnemonic(candidatePhrase)) {
                    matches.push(candidatePhrase);
                    i += length - 1; // Skip ahead to avoid overlaps
                    break;
                }
            }
        }
        
        return matches;
    }

    extractWalletJson(content) {
        const matches = [];
        let match;
        
        while ((match = this.patterns.walletJson.regex.exec(content)) !== null) {
            const address = match[1];
            const privateKey = match[2];
            
            if (this.validateEthereumAddress(address) === 'high' && 
                this.validatePrivateKey(privateKey) === 'high') {
                matches.push({
                    address: address,
                    privateKey: privateKey
                });
            }
        }
        
        this.patterns.walletJson.regex.lastIndex = 0;
        return matches;
    }

    validatePrivateKey(key) {
        if (!key || typeof key !== 'string') return 'low';
        if (key.length !== 64) return 'low';
        if (!/^[a-fA-F0-9]{64}$/.test(key)) return 'low';
        
        // Check for obvious patterns that indicate non-randomness
        if (/^0+$/.test(key) || /^f+$/i.test(key)) return 'low';
        if (/(.)\1{10,}/.test(key)) return 'medium'; // Repeated characters
        
        return 'high';
    }

    validateEthereumAddress(address) {
        if (!address || typeof address !== 'string') return 'low';
        if (!address.startsWith('0x')) return 'low';
        if (address.length !== 42) return 'low';
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return 'low';
        
        // Check for null address
        if (address === '0x0000000000000000000000000000000000000000') return 'low';
        
        return 'high';
    }

    async validateMnemonic(phrase) {
        try {
            return bip39.validateMnemonic(phrase);
        } catch (error) {
            return false;
        }
    }

    validateWalletJson(walletData) {
        if (!walletData || typeof walletData !== 'object') return 'low';
        if (!walletData.address || !walletData.privateKey) return 'low';
        
        const addressValid = this.validateEthereumAddress(walletData.address);
        const keyValid = this.validatePrivateKey(walletData.privateKey);
        
        if (addressValid === 'high' && keyValid === 'high') return 'high';
        if (addressValid === 'medium' || keyValid === 'medium') return 'medium';
        return 'low';
    }

    getStatus() {
        const runtime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
        const hours = Math.floor(runtime / 3600000);
        const minutes = Math.floor((runtime % 3600000) / 60000);
        
        return {
            isRunning: this.isRunning,
            runtime: `${hours}h ${minutes}m`,
            counters: this.counters,
            discoveredAssets: this.discoveries.length,
            scanInterval: this.scanInterval,
            sourceUrls: this.sourceUrls.length,
            lastScanTime: this.counters.lastScanTime
        };
    }

    getDiscoveries() {
        return this.discoveries.map(discovery => ({
            ...discovery,
            value: this.maskSensitiveData(discovery.value, discovery.type)
        }));
    }

    maskSensitiveData(value, type) {
        if (type === 'privateKey' && typeof value === 'string') {
            return value.substring(0, 8) + '...' + value.substring(56);
        }
        
        if (type === 'mnemonic' && typeof value === 'string') {
            const words = value.split(' ');
            return words.map((word, index) => 
                index < 3 || index > words.length - 4 ? word : '***'
            ).join(' ');
        }
        
        if (type === 'walletJson' && typeof value === 'object') {
            return {
                address: value.address,
                privateKey: this.maskSensitiveData(value.privateKey, 'privateKey')
            };
        }
        
        return value;
    }

    updateSourceUrls(newUrls) {
        if (!Array.isArray(newUrls)) {
            throw new Error('Source URLs must be provided as an array');
        }
        
        this.sourceUrls = newUrls;
        this.log(`Source URL list updated with ${newUrls.length} URLs`);
    }

    addSourceUrl(url) {
        if (typeof url !== 'string') {
            throw new Error('Source URL must be a string');
        }
        
        if (!this.sourceUrls.includes(url)) {
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
        this.discoveries = [];
        this.log('Discovery cache cleared');
    }

    updateScanInterval(newInterval) {
        this.scanInterval = newInterval;
        
        if (this.isRunning && this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(async () => {
                if (this.isRunning) {
                    await this.scanNow();
                }
            }, this.scanInterval);
        }
        
        this.log(`Scan interval updated to ${newInterval}ms`);
    }
}

module.exports = GhostlineScavenger;
