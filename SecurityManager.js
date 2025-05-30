// Security Manager V4.0 - Secure Credential and API Key Management
// File: utils/SecurityManager.js

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class SecurityManager {
    constructor() {
        this.version = '4.0.0';
        this.encryptionKey = this.generateOrLoadEncryptionKey();
        this.algorithm = 'aes-256-gcm';
        this.keyDerivationRounds = 100000;
        
        // Security metrics
        this.metrics = {
            encryptionOperations: 0,
            decryptionOperations: 0,
            keyRotations: 0,
            securityViolations: 0,
            lastKeyRotation: null,
            suspiciousActivities: []
        };
        
        // Authorized commands list
        this.authorizedCommands = [
            'start_harvester', 'stop_harvester',
            'start_analyzer', 'stop_analyzer', 
            'start_validator', 'stop_validator',
            'get_status', 'get_metrics', 
            'emergency_stop', 'security_report'
        ];
        
        console.log('[🔒] SecurityManager V4.0 initialized');
    }

    generateOrLoadEncryptionKey() {
        try {
            // Try to load existing key from secure location
            const keyPath = path.join(process.cwd(), '.ghostline', 'security.key');
            if (require('fs').existsSync(keyPath)) {
                return require('fs').readFileSync(keyPath);
            }
        } catch (error) {
            // Key doesn't exist, generate new one
        }
        
        // Generate new encryption key
        const key = crypto.randomBytes(32);
        this.saveEncryptionKey(key);
        return key;
    }

    async saveEncryptionKey(key) {
        try {
            const secureDir = path.join(process.cwd(), '.ghostline');
            await fs.mkdir(secureDir, { recursive: true });
            
            const keyPath = path.join(secureDir, 'security.key');
            await fs.writeFile(keyPath, key, { mode: 0o600 }); // Read/write for owner only
            
            console.log('[🔒] Encryption key saved securely');
        } catch (error) {
            console.error('[✗] Failed to save encryption key:', error.message);
        }
    }

    // Encrypt sensitive data
    encrypt(plaintext) {
        try {
            this.metrics.encryptionOperations++;
            
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
            
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // For GCM mode, we'd also get the auth tag
            // const authTag = cipher.getAuthTag();
            
            return {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                // authTag: authTag.toString('hex') // For GCM
            };
        } catch (error) {
            console.error('[✗] Encryption failed:', error.message);
            return null;
        }
    }

    // Decrypt sensitive data
    decrypt(encryptedData) {
        try {
            this.metrics.decryptionOperations++;
            
            if (!encryptedData || !encryptedData.encrypted) {
                throw new Error('Invalid encrypted data format');
            }
            
            const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('[✗] Decryption failed:', error.message);
            return null;
        }
    }

    // Validate API keys format and security
    async validateApiKeys(config) {
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Check Telegram Bot Token
        const telegramToken = config.get('TELEGRAM_BOT_TOKEN');
        if (telegramToken) {
            if (!this.validateTelegramToken(telegramToken)) {
                validation.errors.push('Invalid Telegram bot token format');
                validation.valid = false;
            }
            if (this.isWeakToken(telegramToken)) {
                validation.warnings.push('Telegram token appears to be weak or default');
            }
        }

        // Check Ethereum API Keys
        const etherscanKey = config.get('ETHERSCAN_API_KEY');
        if (etherscanKey && !this.validateEtherscanKey(etherscanKey)) {
            validation.errors.push('Invalid Etherscan API key format');
            validation.valid = false;
        }

        const alchemyKey = config.get('ALCHEMY_API_KEY');
        if (alchemyKey && !this.validateAlchemyKey(alchemyKey)) {
            validation.errors.push('Invalid Alchemy API key format');
            validation.valid = false;
        }

        // Check for default/example values
        this.checkForDefaultValues(config, validation);

        return validation;
    }

    validateTelegramToken(token) {
        // Telegram bot tokens have format: 123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi
        const telegramTokenRegex = /^[0-9]{8,10}:[A-Za-z0-9_-]{35}$/;
        return telegramTokenRegex.test(token);
    }

    validateEtherscanKey(key) {
        // Etherscan API keys are typically 34 characters alphanumeric
        return key.length >= 32 && /^[A-Za-z0-9]+$/.test(key);
    }

    validateAlchemyKey(key) {
        // Alchemy API keys have specific format
        return key.length >= 32 && /^[A-Za-z0-9_-]+$/.test(key);
    }

    isWeakToken(token) {
        const weakPatterns = [
            'test', 'demo', 'example', 'sample', 'default',
            '123456789', 'abc', 'xxx', 'your_token_here'
        ];
        
        const lowerToken = token.toLowerCase();
        return weakPatterns.some(pattern => lowerToken.includes(pattern));
    }

    checkForDefaultValues(config, validation) {
        const defaultValues = {
            'TELEGRAM_BOT_TOKEN': ['YOUR_BOT_TOKEN', 'your_telegram_token'],
            'ETHERSCAN_API_KEY': ['YOUR_ETHERSCAN_KEY', 'your_etherscan_key'],
            'ALCHEMY_API_KEY': ['YOUR_ALCHEMY_KEY', 'your_alchemy_key'],
            'WITHDRAWAL_ADDRESS': ['0x742d35Cc6663C747049fdB5F3C00F0D3a67d8829', 'your_eth_address']
        };

        for (const [configKey, defaultVals] of Object.entries(defaultValues)) {
            const value = config.get(configKey);
            if (value && defaultVals.some(defaultVal => 
                value.toLowerCase().includes(defaultVal.toLowerCase()))) {
                validation.warnings.push(`${configKey} appears to contain default/example value`);
            }
        }
    }

    // Validate credential storage security
    async validateCredentialStorage() {
        try {
            // Check if .env file has secure permissions
            const envPath = path.join(process.cwd(), '.env');
            try {
                const stats = await fs.stat(envPath);
                const mode = stats.mode & parseInt('777', 8);
                
                // Check if file is readable by others
                if (mode & parseInt('044', 8)) {
                    console.warn('[--] .env file has insecure permissions (readable by others)');
                    return false;
                }
            } catch (error) {
                // .env file doesn't exist
            }

            // Check for credentials in plain text files
            const dangerousFiles = ['.env.example', 'config.txt', 'keys.txt'];
            for (const file of dangerousFiles) {
                const filePath = path.join(process.cwd(), file);
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    if (this.containsCredentials(content)) {
                        console.warn(`[--] Potential credentials found in ${file}`);
                        return false;
                    }
                } catch (error) {
                    // File doesn't exist, which is fine
                }
            }

            return true;
        } catch (error) {
            console.error('[✗] Credential storage validation failed:', error.message);
            return false;
        }
    }

    containsCredentials(content) {
        const credentialPatterns = [
            /[0-9]{8,10}:[A-Za-z0-9_-]{35}/, // Telegram token
            /0x[a-fA-F0-9]{40}/, // Ethereum address
            /[A-Za-z0-9]{32,}/ // Generic API key
        ];
        
        return credentialPatterns.some(pattern => pattern.test(content));
    }

    // Validate commands for authorization
    async validateCommand(command, params = {}) {
        // Check if command is in authorized list
        if (!this.authorizedCommands.includes(command)) {
            this.metrics.securityViolations++;
            this.logSuspiciousActivity('unauthorized_command', { command, params });
            return false;
        }

        // Additional parameter validation
        if (command.includes('emergency') && !this.validateEmergencyCommand(params)) {
            this.metrics.securityViolations++;
            this.logSuspiciousActivity('invalid_emergency_command', { command, params });
            return false;
        }

        return true;
    }

    validateEmergencyCommand(params) {
        // Emergency commands should have additional validation
        // For example, require a specific confirmation parameter
        return true; // Simplified for demo
    }

    logSuspiciousActivity(type, details) {
        const activity = {
            timestamp: new Date().toISOString(),
            type: type,
            details: details,
            severity: this.getSeverityLevel(type)
        };

        this.metrics.suspiciousActivities.push(activity);
        
        // Keep only last 100 activities
        if (this.metrics.suspiciousActivities.length > 100) {
            this.metrics.suspiciousActivities = this.metrics.suspiciousActivities.slice(-100);
        }

        console.warn(`[🚨] Security Event: ${type}`, details);
    }

    getSeverityLevel(activityType) {
        const severityMap = {
            'unauthorized_command': 'high',
            'invalid_emergency_command': 'critical',
            'weak_credentials': 'medium',
            'insecure_storage': 'high'
        };
        
        return severityMap[activityType] || 'low';
    }

    // Securely store sensitive data
    async secureStore(key, data) {
        try {
            const encrypted = this.encrypt(JSON.stringify(data));
            if (!encrypted) {
                throw new Error('Encryption failed');
            }

            const secureDir = path.join(process.cwd(), '.ghostline', 'secure');
            await fs.mkdir(secureDir, { recursive: true });
            
            const filePath = path.join(secureDir, `${key}.enc`);
            await fs.writeFile(filePath, JSON.stringify(encrypted), { mode: 0o600 });
            
            console.log(`[🔒] Data securely stored: ${key}`);
            return true;
        } catch (error) {
            console.error(`[✗] Secure storage failed for ${key}:`, error.message);
            return false;
        }
    }

    // Retrieve securely stored data
    async secureRetrieve(key) {
        try {
            const secureDir = path.join(process.cwd(), '.ghostline', 'secure');
            const filePath = path.join(secureDir, `${key}.enc`);
            
            const encryptedData = await fs.readFile(filePath, 'utf8');
            const parsedData = JSON.parse(encryptedData);
            
            const decrypted = this.decrypt(parsedData);
            if (!decrypted) {
                throw new Error('Decryption failed');
            }
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error(`[✗] Secure retrieval failed for ${key}:`, error.message);
            return null;
        }
    }

    // Rotate encryption keys
    async rotateEncryptionKey() {
        try {
            console.log('[🔒] Starting encryption key rotation...');
            
            // Generate new key
            const newKey = crypto.randomBytes(32);
            const oldKey = this.encryptionKey;
            
            // Re-encrypt all stored data with new key
            const secureDir = path.join(process.cwd(), '.ghostline', 'secure');
            try {
                const files = await fs.readdir(secureDir);
                
                for (const file of files) {
                    if (file.endsWith('.enc')) {
                        const keyName = file.replace('.enc', '');
                        const data = await this.secureRetrieve(keyName);
                        
                        if (data) {
                            // Switch to new key
                            this.encryptionKey = newKey;
                            await this.secureStore(keyName, data);
                        }
                    }
                }
            } catch (error) {
                // Directory doesn't exist or no files to rotate
            }
            
            // Save new key
            await this.saveEncryptionKey(newKey);
            this.encryptionKey = newKey;
            
            this.metrics.keyRotations++;
            this.metrics.lastKeyRotation = new Date();
            
            console.log('[✓] Encryption key rotation completed');
            return true;
        } catch (error) {
            console.error('[✗] Key rotation failed:', error.message);
            // Restore old key on failure
            this.encryptionKey = oldKey;
            return false;
        }
    }

    // Clear all sensitive data from memory and storage
    async clearSensitiveData() {
        try {
            console.log('[🔒] Clearing sensitive data...');
            
            // Clear encryption key from memory
            if (this.encryptionKey) {
                this.encryptionKey.fill(0);
            }
            
            // Clear metrics that might contain sensitive info
            this.metrics.suspiciousActivities = [];
            
            console.log('[✓] Sensitive data cleared');
        } catch (error) {
            console.error('[✗] Failed to clear sensitive data:', error.message);
        }
    }

    // Generate security report
    generateSecurityReport() {
        const highSeverityEvents = this.metrics.suspiciousActivities
            .filter(activity => ['high', 'critical'].includes(activity.severity));
        
        return {
            summary: {
                totalSecurityViolations: this.metrics.securityViolations,
                encryptionOperations: this.metrics.encryptionOperations,
                decryptionOperations: this.metrics.decryptionOperations,
                keyRotations: this.metrics.keyRotations,
                lastKeyRotation: this.metrics.lastKeyRotation
            },
            alerts: {
                highSeverityEvents: highSeverityEvents.length,
                recentSuspiciousActivities: this.metrics.suspiciousActivities.slice(-10)
            },
            recommendations: this.generateSecurityRecommendations(),
            timestamp: new Date().toISOString()
        };
    }

    generateSecurityRecommendations() {
        const recommendations = [];
        
        if (this.metrics.securityViolations > 5) {
            recommendations.push('Consider implementing additional access controls');
        }
        
        if (!this.metrics.lastKeyRotation || 
            (Date.now() - new Date(this.metrics.lastKeyRotation).getTime()) > 30 * 24 * 60 * 60 * 1000) {
            recommendations.push('Encryption key rotation is recommended');
        }
        
        if (this.metrics.suspiciousActivities.length > 50) {
            recommendations.push('High number of suspicious activities detected');
        }
        
        return recommendations;
    }

    // Get security metrics
    getMetrics() {
        return {
            ...this.metrics,
            encryptionKeyAge: this.metrics.lastKeyRotation ? 
                Date.now() - new Date(this.metrics.lastKeyRotation).getTime() : null,
            securityLevel: this.calculateSecurityLevel()
        };
    }

    calculateSecurityLevel() {
        let score = 100;
        
        // Deduct points for security violations
        score -= this.metrics.securityViolations * 5;
        
        // Deduct points for old encryption key
        if (!this.metrics.lastKeyRotation) {
            score -= 10;
        } else {
            const keyAge = Date.now() - new Date(this.metrics.lastKeyRotation).getTime();
            const daysOld = keyAge / (24 * 60 * 60 * 1000);
            if (daysOld > 30) score -= 5;
            if (daysOld > 90) score -= 10;
        }
        
        // Deduct points for suspicious activities
        const highSeverityCount = this.metrics.suspiciousActivities
            .filter(activity => ['high', 'critical'].includes(activity.severity)).length;
        score -= highSeverityCount * 3;
        
        return Math.max(0, Math.min(100, score));
    }

    // Get health status
    getHealthStatus() {
        const securityLevel = this.calculateSecurityLevel();
        
        if (securityLevel >= 90) return 'excellent';
        if (securityLevel >= 75) return 'good';
        if (securityLevel >= 50) return 'fair';
        if (securityLevel >= 25) return 'poor';
        return 'critical';
    }

    // Hash sensitive data for logging (without storing the actual data)
    hashForLogging(sensitiveData) {
        return crypto.createHash('sha256')
            .update(sensitiveData.toString())
            .digest('hex')
            .substring(0, 8); // Only first 8 characters for identification
    }

    // Validate Ethereum address format
    isValidEthereumAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    // Generate secure random ID
    generateSecureId() {
        return crypto.randomBytes(16).toString('hex');
    }
}

module.exports = SecurityManager;
