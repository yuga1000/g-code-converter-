require('dotenv').config();
const https = require('https');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

class ScavengerAgent {
    constructor() {
        this.name = 'Scavenger';
        this.version = '1.0.0';
        this.isRunning = false;
        this.scanInterval = 30000; // 30 seconds
        this.validAssets = [];
        
        // API Configuration
        this.alchemyApiKey = process.env.ALCHEMY_API_KEY;
        this.etherscanApiKey = process.env.ETHERSCAN_API_KEY;
        this.telegramToken = process.env.TELEGRAM_TOKEN;
        this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
        
        // Initialize Telegram bot
        if (this.telegramToken) {
            this.bot = new TelegramBot(this.telegramToken);
        }
        
        this.log('Scavenger Agent initialized');
        this.validateConfiguration();
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [SCAVENGER] ${message}`);
    }

    validateConfiguration() {
        const requiredEnvVars = ['ALCHEMY_API_KEY', 'ETHERSCAN_API_KEY', 'TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID'];
        const missing = requiredEnvVars.filter(env => !process.env[env]);
        
        if (missing.length > 0) {
            this.log(`Warning: Missing environment variables: ${missing.join(', ')}`);
        } else {
            this.log('Configuration validated successfully');
        }
    }

    async start() {
        if (this.isRunning) {
            this.log('Agent is already running');
            return;
        }
        
        this.isRunning = true;
        this.log('Starting Scavenger Agent operations');
        
        await this.sendTelegramNotification('🔍 Scavenger Agent started and monitoring for assets');
        
        // Start continuous scanning
        this.scanLoop();
    }

    async stop() {
        this.isRunning = false;
        this.log('Stopping Scavenger Agent operations');
        await this.sendTelegramNotification('⏹️ Scavenger Agent stopped');
    }

    async scanLoop() {
        while (this.isRunning) {
            try {
                await this.performScanCycle();
                await this.sleep(this.scanInterval);
            } catch (error) {
                this.log(`Scan cycle error: ${error.message}`);
                await this.sleep(this.scanInterval);
            }
        }
    }

    async performScanCycle() {
        this.log('Performing asset scan cycle');
        
        // Process any pending inputs (keys, seeds, addresses)
        const inputs = await this.loadPendingInputs();
        
        for (const input of inputs) {
            await this.processInput(input);
        }
    }

    async loadPendingInputs() {
        // In a real implementation, this would load from a queue, database, or file
        // For demonstration, returning sample inputs
        return [
            {
                type: 'address',
                value: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
                source: 'manual_input'
            }
        ];
    }

    async processInput(input) {
        this.log(`Processing input: ${input.type} - ${input.value.substring(0, 10)}...`);
        
        try {
            switch (input.type) {
                case 'address':
                    await this.checkAddressBalance(input.value);
                    break;
                case 'private_key':
                    await this.processPrivateKey(input.value);
                    break;
                case 'seed_phrase':
                    await this.processSeedPhrase(input.value);
                    break;
                default:
                    this.log(`Unknown input type: ${input.type}`);
            }
        } catch (error) {
            this.log(`Error processing input: ${error.message}`);
        }
    }

    async checkAddressBalance(address) {
        try {
            // Check ETH balance via Alchemy
            const ethBalance = await this.getEthBalance(address);
            
            // Check token balances via Etherscan
            const tokenBalances = await this.getTokenBalances(address);
            
            // Evaluate if assets are significant
            const hasSignificantAssets = this.evaluateAssetValue(ethBalance, tokenBalances);
            
            if (hasSignificantAssets) {
                await this.reportValidAsset({
                    address: address,
                    ethBalance: ethBalance,
                    tokenBalances: tokenBalances,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            this.log(`Balance check failed for ${address}: ${error.message}`);
        }
    }

    async getEthBalance(address) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getBalance',
                params: [address, 'latest'],
                id: 1
            });
            
            const options = {
                hostname: 'eth-mainnet.g.alchemy.com',
                port: 443,
                path: `/v2/${this.alchemyApiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };
            
            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            const balanceWei = parseInt(response.result, 16);
                            const balanceEth = balanceWei / Math.pow(10, 18);
                            resolve(balanceEth);
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse Alchemy response: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Alchemy API request failed: ${error.message}`));
            });
            
            req.write(data);
            req.end();
        });
    }

    async getTokenBalances(address) {
        return new Promise((resolve, reject) => {
            const url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${this.etherscanApiKey}`;
            
            https.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.status === '1' && response.result) {
                            const tokenSummary = this.aggregateTokenBalances(response.result);
                            resolve(tokenSummary);
                        } else {
                            resolve([]);
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse Etherscan response: ${error.message}`));
                    }
                });
            }).on('error', (error) => {
                reject(new Error(`Etherscan API request failed: ${error.message}`));
            });
        });
    }

    aggregateTokenBalances(transactions) {
        const balances = {};
        
        transactions.forEach(tx => {
            const tokenSymbol = tx.tokenSymbol;
            const tokenName = tx.tokenName;
            const value = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal));
            
            if (!balances[tokenSymbol]) {
                balances[tokenSymbol] = {
                    name: tokenName,
                    symbol: tokenSymbol,
                    balance: 0
                };
            }
            
            if (tx.to.toLowerCase() === tx.to.toLowerCase()) {
                balances[tokenSymbol].balance += value;
            } else {
                balances[tokenSymbol].balance -= value;
            }
        });
        
        // Filter out zero or negative balances
        return Object.values(balances).filter(token => token.balance > 0);
    }

    evaluateAssetValue(ethBalance, tokenBalances) {
        // Consider address significant if it has more than 0.01 ETH or any tokens
        const minEthThreshold = 0.01;
        
        if (ethBalance > minEthThreshold) {
            return true;
        }
        
        if (tokenBalances.length > 0) {
            return true;
        }
        
        return false;
    }

    async processPrivateKey(privateKey) {
        try {
            // Derive address from private key
            const address = this.deriveAddressFromPrivateKey(privateKey);
            await this.checkAddressBalance(address);
        } catch (error) {
            this.log(`Private key processing failed: ${error.message}`);
        }
    }

    deriveAddressFromPrivateKey(privateKey) {
        // Simplified address derivation - in production use proper crypto libraries
        const hash = crypto.createHash('sha256').update(privateKey).digest('hex');
        return '0x' + hash.substring(0, 40);
    }

    async processSeedPhrase(seedPhrase) {
        try {
            // In a real implementation, derive multiple addresses from seed phrase
            this.log('Seed phrase processing - implementation needed for HD wallet derivation');
        } catch (error) {
            this.log(`Seed phrase processing failed: ${error.message}`);
        }
    }

    async reportValidAsset(asset) {
        this.validAssets.push(asset);
        this.log(`Valid asset discovered: ${asset.address}`);
        
        // Format report message
        const message = this.formatAssetReport(asset);
        
        // Send to Telegram
        await this.sendTelegramNotification(message);
        
        // Log to file or database for persistence
        await this.persistAssetData(asset);
    }

    formatAssetReport(asset) {
        let message = `💰 VALID ASSET DISCOVERED\n\n`;
        message += `📍 Address: ${asset.address}\n`;
        message += `⚡ ETH Balance: ${asset.ethBalance.toFixed(6)} ETH\n`;
        
        if (asset.tokenBalances.length > 0) {
            message += `🪙 Token Balances:\n`;
            asset.tokenBalances.forEach(token => {
                message += `   • ${token.balance.toFixed(4)} ${token.symbol}\n`;
            });
        }
        
        message += `🕐 Discovered: ${asset.timestamp}`;
        return message;
    }

    async sendTelegramNotification(message) {
        if (!this.bot || !this.telegramChatId) {
            this.log('Telegram not configured - skipping notification');
            return;
        }
        
        try {
            await this.bot.sendMessage(this.telegramChatId, message);
            this.log('Telegram notification sent successfully');
        } catch (error) {
            this.log(`Telegram notification failed: ${error.message}`);
        }
    }

    async persistAssetData(asset) {
        try {
            const fs = require('fs').promises;
            const filePath = './discovered_assets.json';
            
            let existingData = [];
            try {
                const fileContent = await fs.readFile(filePath, 'utf8');
                existingData = JSON.parse(fileContent);
            } catch (error) {
                // File doesn't exist yet, start with empty array
            }
            
            existingData.push(asset);
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
            
            this.log('Asset data persisted successfully');
        } catch (error) {
            this.log(`Asset persistence failed: ${error.message}`);
        }
    }

    sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    async getStatus() {
        return {
            name: this.name,
            version: this.version,
            isRunning: this.isRunning,
            validAssetsFound: this.validAssets.length,
            lastScanTime: new Date().toISOString()
        };
    }
}

// Main execution
async function main() {
    const scavenger = new ScavengerAgent();
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully');
        await scavenger.stop();
        process.exit(0);
    });
    
    process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully');
        await scavenger.stop();
        process.exit(0);
    });
    
    // Start the agent
    await scavenger.start();
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = ScavengerAgent;
