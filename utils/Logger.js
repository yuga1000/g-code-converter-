// Advanced Logging System V4.0 - Enhanced Security
// File: utils/Logger.js

const fs = require('fs').promises;
const path = require('path');

class Logger {
    constructor(module = 'SYSTEM') {
        this.module = module;
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logToFile = process.env.LOG_TO_FILE === 'true';
        this.logDir = './logs';
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 5;
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            success: 3,
            debug: 4
        };
        
        this.colors = {
            error: '\x1b[31m',   // Red
            warn: '\x1b[33m',    // Yellow
            info: '\x1b[36m',    // Cyan
            success: '\x1b[32m', // Green
            debug: '\x1b[90m',   // Gray
            system: '\x1b[95m',  // Magenta
            security: '\x1b[41m', // Red background
            reset: '\x1b[0m'
        };
        
        this.emojis = {
            error: '[✗]',
            warn: '[--]',
            info: '[▸]',
            success: '[✓]',
            debug: '[◎]',
            system: '[◉]',
            security: '[🔒]'
        };
        
        // Sensitive data patterns to mask
        this.sensitivePatterns = [
            /\b[0-9]{8,10}:[A-Za-z0-9_-]{35}\b/g, // Telegram bot tokens
            /\b0x[a-fA-F0-9]{40}\b/g, // Ethereum addresses
            /\b[A-Za-z0-9]{32,}\b/g, // Generic API keys (32+ chars)
            /password[=:]\s*[^\s]+/gi,
            /secret[=:]\s*[^\s]+/gi,
            /key[=:]\s*[^\s]+/gi
        ];
        
        this.initializeLogDirectory();
    }

    async initializeLogDirectory() {
        if (this.logToFile) {
            try {
                await fs.mkdir(this.logDir, { recursive: true });
            } catch (error) {
                console.error('Failed to create log directory:', error.message);
            }
        }
    }

    formatMessage(level, message, module = null) {
        const timestamp = new Date().toISOString();
        const mod = module || this.module;
        const emoji = this.emojis[level] || this.emojis.info;
        
        // Mask sensitive data in message
        const sanitizedMessage = this.sanitizeMessage(message);
        
        return {
            timestamp,
            level: level.toUpperCase(),
            module: mod,
            message: sanitizedMessage,
            originalMessage: message, // Keep for internal use only
            formatted: `[${timestamp}] ${emoji} [${mod}] ${sanitizedMessage}`
        };
    }

    sanitizeMessage(message) {
        let sanitized = message;
        
        // Mask sensitive patterns
        for (const pattern of this.sensitivePatterns) {
            sanitized = sanitized.replace(pattern, (match) => {
                if (match.length <= 6) return '***';
                return match.substring(0, 3) + '***' + match.substring(match.length - 3);
            });
        }
        
        return sanitized;
    }

    shouldLog(level) {
        const currentLevel = this.levels[this.logLevel] || 2;
        const messageLevel = this.levels[level] || 2;
        return messageLevel <= currentLevel;
    }

    async log(level, message, module = null) {
        if (!this.shouldLog(level)) return;
        
        const logEntry = this.formatMessage(level, message, module);
        
        // Console output with colors
        const color = this.colors[level] || this.colors.reset;
        console.log(`${color}${logEntry.formatted}${this.colors.reset}`);
        
        // File output (always sanitized)
        if (this.logToFile) {
            await this.writeToFile(logEntry);
        }
        
        // Special handling for security events
        if (level === 'security' || message.includes('security') || message.includes('🔒')) {
            await this.writeSecurityLog(logEntry);
        }
        
        return logEntry;
    }

    async writeToFile(logEntry) {
        try {
            const logFile = path.join(this.logDir, `ghostline-${new Date().toISOString().split('T')[0]}.log`);
            const logLine = `${logEntry.formatted}\n`;
            
            // Check file size and rotate if needed
            await this.rotateLogsIfNeeded(logFile);
            
            await fs.appendFile(logFile, logLine);
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    async writeSecurityLog(logEntry) {
        try {
            const securityLogFile = path.join(this.logDir, 'security.log');
            const securityLogLine = `${logEntry.formatted}\n`;
            
            // Security logs are always written, regardless of log level
            await fs.appendFile(securityLogFile, securityLogLine);
            
            // Rotate security logs if needed
            await this.rotateLogsIfNeeded(securityLogFile);
        } catch (error) {
            console.error('Failed to write to security log:', error.message);
        }
    }

    async rotateLogsIfNeeded(logFile) {
        try {
            const stats = await fs.stat(logFile);
            if (stats.size > this.maxLogSize) {
                await this.rotateLogs(logFile);
            }
        } catch (error) {
            // File doesn't exist, no rotation needed
        }
    }

    async rotateLogs(logFile) {
        try {
            const baseName = path.basename(logFile, '.log');
            const logDir = path.dirname(logFile);
            
            // Remove oldest log if we exceed max files
            const oldestLog = path.join(logDir, `${baseName}.${this.maxLogFiles}.log`);
            try {
                await fs.unlink(oldestLog);
            } catch (error) {
                // File doesn't exist
            }
            
            // Rotate existing logs
            for (let i = this.maxLogFiles - 1; i > 0; i--) {
                const oldFile = path.join(logDir, `${baseName}.${i}.log`);
                const newFile = path.join(logDir, `${baseName}.${i + 1}.log`);
                
                try {
                    await fs.rename(oldFile, newFile);
                } catch (error) {
                    // File doesn't exist, continue
                }
            }
            
            // Move current log to .1
            const rotatedFile = path.join(logDir, `${baseName}.1.log`);
            await fs.rename(logFile, rotatedFile);
            
        } catch (error) {
            console.error('Failed to rotate logs:', error.message);
        }
    }

    // Convenience methods
    error(message, module = null) {
        return this.log('error', message, module);
    }

    warn(message, module = null) {
        return this.log('warn', message, module);
    }

    info(message, module = null) {
        return this.log('info', message, module);
    }

    success(message, module = null) {
        return this.log('success', message, module);
    }

    debug(message, module = null) {
        return this.log('debug', message, module);
    }

    system(message, module = null) {
        return this.log('system', message, module || 'SYSTEM');
    }

    security(message, module = null) {
        return this.log('security', message, module || 'SECURITY');
    }

    // Create logger for specific module
    create(module, initialMessage = null) {
        const moduleLogger = new Logger(module);
        moduleLogger.logLevel = this.logLevel;
        moduleLogger.logToFile = this.logToFile;
        moduleLogger.logDir = this.logDir;
        
        if (initialMessage) {
            moduleLogger.info(initialMessage);
        }
        return moduleLogger;
    }

    // Performance logging
    async logPerformance(operation, duration, details = {}) {
        const sanitizedDetails = this.sanitizeObject(details);
        const message = `Performance: ${operation} completed in ${duration}ms`;
        
        if (Object.keys(sanitizedDetails).length > 0) {
            await this.debug(`${message} | Details: ${JSON.stringify(sanitizedDetails)}`);
        } else {
            await this.debug(message);
        }
    }

    // Error logging with stack trace
    async logError(error, context = '') {
        const message = context ? `${context}: ${error.message}` : error.message;
        await this.error(message);
        
        if (error.stack && this.shouldLog('debug')) {
            // Sanitize stack trace as well
            const sanitizedStack = this.sanitizeMessage(error.stack);
            await this.debug(`Stack trace: ${sanitizedStack}`);
        }
    }

    // Security logging with enhanced details
    async logSecurity(event, details = {}) {
        const sanitizedDetails = this.sanitizeObject(details);
        const message = `Security Event: ${event}`;
        
        // Always log security events regardless of log level
        const originalLogLevel = this.logLevel;
        this.logLevel = 'debug';
        
        await this.security(`${message} | ${JSON.stringify(sanitizedDetails)}`);
        
        this.logLevel = originalLogLevel;
        
        // Additional structured security log
        await this.writeStructuredSecurityLog(event, sanitizedDetails);
    }

    async writeStructuredSecurityLog(event, details) {
        try {
            const securityEvent = {
                timestamp: new Date().toISOString(),
                event: event,
                details: details,
                severity: this.getSecuritySeverity(event),
                module: this.module
            };
            
            const securityFile = path.join(this.logDir, 'security-events.json');
            let securityEvents = [];
            
            try {
                const existingData = await fs.readFile(securityFile, 'utf8');
                securityEvents = JSON.parse(existingData);
            } catch (error) {
                // File doesn't exist
            }
            
            securityEvents.push(securityEvent);
            
            // Keep only last 1000 security events
            if (securityEvents.length > 1000) {
                securityEvents = securityEvents.slice(-1000);
            }
            
            await fs.writeFile(securityFile, JSON.stringify(securityEvents, null, 2));
        } catch (error) {
            console.error('Failed to write structured security log:', error.message);
        }
    }

    getSecuritySeverity(event) {
        const severityMap = {
            'unauthorized_access': 'critical',
            'invalid_credentials': 'high',
            'suspicious_activity': 'medium',
            'failed_authentication': 'medium',
            'data_access': 'high',
            'configuration_change': 'medium',
            'system_start': 'low',
            'system_stop': 'low'
        };
        
        return severityMap[event] || 'low';
    }

    // Sanitize objects recursively
    sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return typeof obj === 'string' ? this.sanitizeMessage(obj) : obj;
        }
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip sensitive keys entirely
            if (this.isSensitiveKey(key)) {
                sanitized[key] = '***MASKED***';
            } else if (typeof value === 'string') {
                sanitized[key] = this.sanitizeMessage(value);
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    isSensitiveKey(key) {
        const sensitiveKeys = [
            'password', 'secret', 'token', 'key', 'private', 
            'mnemonic', 'seed', 'wallet', 'credentials'
        ];
        
        const lowerKey = key.toLowerCase();
        return sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
    }

    // Business logic logging
    async logTransaction(type, details) {
        const message = `Transaction: ${type}`;
        const sanitizedDetails = this.sanitizeObject(details);
        
        await this.info(`${message} | ${JSON.stringify(sanitizedDetails)}`);
        
        // Write to business log
        await this.writeBusinessLog('transaction', type, sanitizedDetails);
    }

    async logWalletDiscovery(address, balance, source) {
        const message = `Wallet Discovery: ${this.sanitizeMessage(address)} - Balance: ${balance} ETH`;
        await this.success(message);
        
        await this.writeBusinessLog('wallet_discovery', 'found', {
            address: this.sanitizeMessage(address),
            balance: balance,
            source: source,
            timestamp: new Date().toISOString()
        });
    }

    async logTaskCompletion(taskId, platform, reward, success) {
        const status = success ? 'completed' : 'failed';
        const message = `Task ${status}: ${taskId} on ${platform} - Reward: ${reward} ETH`;
        
        if (success) {
            await this.success(message);
        } else {
            await this.warn(message);
        }
        
        await this.writeBusinessLog('task', status, {
            taskId: taskId,
            platform: platform,
            reward: reward,
            timestamp: new Date().toISOString()
        });
    }

    async writeBusinessLog(category, action, details) {
        try {
            const businessLogFile = path.join(this.logDir, `business-${category}.json`);
            const logEntry = {
                timestamp: new Date().toISOString(),
                action: action,
                details: details,
                module: this.module
            };
            
            let businessLogs = [];
            try {
                const existingData = await fs.readFile(businessLogFile, 'utf8');
                businessLogs = JSON.parse(existingData);
            } catch (error) {
                // File doesn't exist
            }
            
            businessLogs.push(logEntry);
            
            // Keep only last 5000 business events
            if (businessLogs.length > 5000) {
                businessLogs = businessLogs.slice(-5000);
            }
            
            await fs.writeFile(businessLogFile, JSON.stringify(businessLogs, null, 2));
        } catch (error) {
            console.error(`Failed to write business log for ${category}:`, error.message);
        }
    }

    // Get log statistics
    async getLogStats() {
        try {
            const stats = {
                totalLogFiles: 0,
                totalLogSize: 0,
                securityEvents: 0,
                businessEvents: 0,
                oldestLog: null,
                newestLog: null
            };
            
            const files = await fs.readdir(this.logDir);
            
            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const fileStat = await fs.stat(filePath);
                
                stats.totalLogFiles++;
                stats.totalLogSize += fileStat.size;
                
                if (!stats.oldestLog || fileStat.birthtime < stats.oldestLog) {
                    stats.oldestLog = fileStat.birthtime;
                }
                
                if (!stats.newestLog || fileStat.mtime > stats.newestLog) {
                    stats.newestLog = fileStat.mtime;
                }
                
                if (file.includes('security')) {
                    try {
                        const content = await fs.readFile(filePath, 'utf8');
                        if (file.endsWith('.json')) {
                            const events = JSON.parse(content);
                            stats.securityEvents += Array.isArray(events) ? events.length : 0;
                        }
                    } catch (error) {
                        // File not readable or invalid JSON
                    }
                }
                
                if (file.includes('business')) {
                    try {
                        const content = await fs.readFile(filePath, 'utf8');
                        const events = JSON.parse(content);
                        stats.businessEvents += Array.isArray(events) ? events.length : 0;
                    } catch (error) {
                        // File not readable or invalid JSON
                    }
                }
            }
            
            return stats;
        } catch (error) {
            console.error('Failed to get log statistics:', error.message);
            return null;
        }
    }

    // Clean old logs
    async cleanOldLogs(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            const files = await fs.readdir(this.logDir);
            let cleanedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const fileStat = await fs.stat(filePath);
                
                if (fileStat.birthtime < cutoffDate) {
                    await fs.unlink(filePath);
                    cleanedCount++;
                }
            }
            
            await this.info(`Log cleanup completed: ${cleanedCount} old files removed`);
            return cleanedCount;
        } catch (error) {
            await this.error(`Log cleanup failed: ${error.message}`);
            return 0;
        }
    }
}

module.exports = Logger;
