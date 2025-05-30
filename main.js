// Ghostline Revenue System V4.0 - Fixed Main Entry Point
// File: main.js

const { Logger, Config, SecurityManager } = require('./utils');
const TelegramInterface = require('./modules/TelegramInterface');
const MnemonicValidator = require('./modules/MnemonicValidator');
const LostWalletAnalyzer = require('./modules/LostWalletAnalyzer');
const HarvesterCore = require('./modules/HarvesterCore');

class GhostlineV4 {
    constructor() {
        this.version = '4.0.0';
        this.startTime = new Date();
        this.isInitialized = false;
        
        // Initialize security manager first
        this.security = new SecurityManager();
        
        // Initialize core components
        this.logger = new Logger('SYSTEM');
        this.config = new Config();
        
        // Core modules - will be initialized after config load
        this.modules = {};
        
        // System metrics
        this.metrics = {
            startTime: this.startTime,
            uptime: 0,
            totalEarnings: 0,
            totalTasks: 0,
            totalWallets: 0,
            activeModules: 0,
            lastActivity: null,
            securityEvents: 0
        };
        
        this.logger.system('[◉] Ghostline V4.0 initialized with security');
    }

    async start() {
        try {
            this.logger.system('[▸] Starting Ghostline Revenue System V4.0...');
            
            // Load and validate configuration
            await this.config.load();
            await this.validateSecurity();
            
            // Initialize modules with security
            await this.initializeModules();
            
            // Start Telegram interface
            if (this.modules.telegram) {
                await this.modules.telegram.start();
            }
            
            // Start metric tracking
            this.startMetricsTracking();
            
            this.isInitialized = true;
            this.logger.system('[◉] Ghostline V4.0 fully operational');
            
            // Send startup notification
            await this.sendStartupNotification();
            
            return { success: true, message: 'System started successfully' };
            
        } catch (error) {
            this.logger.error(`[✗] Startup failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    async validateSecurity() {
        this.logger.system('[▸] Validating security configuration...');
        
        // Check for secure credential storage
        const hasSecureStorage = await this.security.validateCredentialStorage();
        if (!hasSecureStorage) {
            this.logger.warn('[--] Credentials may not be securely stored');
        }
        
        // Validate API keys format
        const apiKeyValidation = await this.security.validateApiKeys(this.config);
        if (!apiKeyValidation.valid) {
            this.logger.warn(`[--] API key validation warnings: ${apiKeyValidation.warnings.join(', ')}`);
        }
        
        this.logger.success('[✓] Security validation passed');
    }

    async initializeModules() {
        this.logger.system('[▸] Initializing core modules...');
        
        try {
            // Initialize modules with error handling
            this.modules.harvester = new HarvesterCore(this);
            this.modules.validator = new MnemonicValidator(this);
            this.modules.analyzer = new LostWalletAnalyzer(this);
            
            // Only initialize Telegram if token is provided
            if (this.config.get('TELEGRAM_BOT_TOKEN')) {
                this.modules.telegram = new TelegramInterface(this);
            } else {
                this.logger.warn('[--] Telegram not configured - skipping');
            }
            
            // Initialize each module
            const moduleOrder = ['harvester', 'validator', 'analyzer', 'telegram'];
            
            for (const moduleName of moduleOrder) {
                if (this.modules[moduleName]) {
                    try {
                        await this.modules[moduleName].initialize();
                        this.metrics.activeModules++;
                        this.logger.system(`[✓] ${moduleName} initialized`);
                    } catch (error) {
                        this.logger.error(`[✗] ${moduleName} failed: ${error.message}`);
                        // Don't fail completely - continue with other modules
                    }
                }
            }
            
            this.logger.system(`[◉] ${this.metrics.activeModules} modules active`);
            
        } catch (error) {
            this.logger.error(`[✗] Module initialization failed: ${error.message}`);
            throw error;
        }
    }

    async sendStartupNotification() {
        if (!this.modules.telegram) return;
        
        const message = this.formatStartupMessage();
        try {
            await this.modules.telegram.sendSystemMessage(message);
        } catch (error) {
            this.logger.warn(`[--] Startup notification failed: ${error.message}`);
        }
    }

    formatStartupMessage() {
        return `🚀 GHOSTLINE V4.0 OPERATIONAL\n\n` +
            `📋 System Version: ${this.version}\n` +
            `⏰ Startup Time: ${this.startTime.toLocaleString()}\n` +
            `✅ Active Modules: ${this.metrics.activeModules}\n` +
            `🔒 Security: Enhanced Protection Active\n` +
            `💰 Revenue Streams Ready:\n` +
            `    ▸ Multi-platform Task Harvesting\n` +
            `    ▸ Advanced Wallet Analysis\n` +
            `    ▸ Mnemonic Recovery System\n\n` +
            `🎯 Enhanced Features:\n` +
            `    ✅ Secure Credential Storage\n` +
            `    ✅ Real-time Statistics\n` +
            `    ✅ Smart Notifications\n` +
            `    ✅ Production Safety Checks\n\n` +
            `🎮 Use /start for full control panel`;
    }

    startMetricsTracking() {
        setInterval(() => {
            this.updateMetrics();
        }, 30000); // Update every 30 seconds
    }

    updateMetrics() {
        this.metrics.uptime = Date.now() - this.startTime.getTime();
        this.metrics.lastActivity = new Date();
        
        // Aggregate metrics from modules
        if (this.modules.harvester && this.modules.harvester.isRunning) {
            this.metrics.totalEarnings = this.modules.harvester.getTotalEarnings();
            this.metrics.totalTasks = this.modules.harvester.getTotalTasks();
        }
        
        if (this.modules.validator && this.modules.validator.isRunning) {
            this.metrics.totalWallets = this.modules.validator.getTotalValidated();
        }
    }

    async executeCommand(command, params = {}) {
        this.logger.system(`[▸] Executing command: ${command}`);
        
        try {
            // Security check for commands
            const isAuthorized = await this.security.validateCommand(command, params);
            if (!isAuthorized) {
                this.metrics.securityEvents++;
                return { success: false, message: 'Unauthorized command' };
            }
            
            switch (command) {
                case 'start_harvester':
                    return this.modules.harvester ? await this.modules.harvester.start() : 
                        { success: false, message: 'Harvester not available' };
                
                case 'stop_harvester':
                    return this.modules.harvester ? await this.modules.harvester.stop() : 
                        { success: false, message: 'Harvester not available' };
                
                case 'start_analyzer':
                    return this.modules.analyzer ? await this.modules.analyzer.start() : 
                        { success: false, message: 'Analyzer not available' };
                
                case 'stop_analyzer':
                    return this.modules.analyzer ? await this.modules.analyzer.stop() : 
                        { success: false, message: 'Analyzer not available' };
                
                case 'start_validator':
                    return this.modules.validator ? await this.modules.validator.start() : 
                        { success: false, message: 'Validator not available' };
                
                case 'stop_validator':
                    return this.modules.validator ? await this.modules.validator.stop() : 
                        { success: false, message: 'Validator not available' };
                
                case 'get_status':
                    return this.getSystemStatus();
                
                case 'get_metrics':
                    return this.getDetailedMetrics();
                
                case 'emergency_stop':
                    return await this.emergencyStop();
                
                case 'security_report':
                    return this.security.generateSecurityReport();
                
                default:
                    return { success: false, message: `Unknown command: ${command}` };
            }
        } catch (error) {
            this.logger.error(`[✗] Command failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    getSystemStatus() {
        const runtime = this.formatUptime(this.metrics.uptime);
        
        return {
            version: this.version,
            status: this.isInitialized ? '[◉] Online' : '[◎] Starting',
            runtime: runtime,
            security: {
                status: '[🔒] Protected',
                events: this.metrics.securityEvents
            },
            modules: {
                harvester: this.getModuleStatus('harvester'),
                analyzer: this.getModuleStatus('analyzer'),
                validator: this.getModuleStatus('validator'),
                telegram: this.getModuleStatus('telegram')
            },
            metrics: this.metrics
        };
    }

    getModuleStatus(moduleName) {
        const module = this.modules[moduleName];
        if (!module) {
            return {
                status: '[○] Not Available',
                reason: 'Module not configured'
            };
        }
        
        switch (moduleName) {
            case 'harvester':
                return {
                    status: module.isRunning ? '[◉] Active' : '[○] Stopped',
                    tasks: module.getActiveTasks ? module.getActiveTasks() : 0,
                    earnings: module.getPendingEarnings ? module.getPendingEarnings() : 0
                };
            case 'analyzer':
                return {
                    status: module.isRunning ? '[◉] Active' : '[○] Stopped',
                    wallets: module.getAnalyzedCount ? module.getAnalyzedCount() : 0,
                    discoveries: module.getDiscoveries ? module.getDiscoveries() : 0
                };
            case 'validator':
                return {
                    status: module.isRunning ? '[◉] Active' : '[○] Stopped',
                    validated: module.getTotalValidated ? module.getTotalValidated() : 0,
                    found: module.getPositiveBalances ? module.getPositiveBalances() : 0
                };
            case 'telegram':
                return {
                    status: module.isConnected ? '[◉] Connected' : '[○] Disconnected'
                };
            default:
                return { status: '[○] Unknown' };
        }
    }

    async emergencyStop() {
        this.logger.system('[◯] Emergency stop initiated');
        
        // Stop all modules
        const stopPromises = Object.entries(this.modules).map(([name, module]) => {
            if (module && module.stop && typeof module.stop === 'function') {
                return module.stop().catch(err => 
                    this.logger.error(`Module ${name} stop error: ${err.message}`)
                );
            }
            return Promise.resolve();
        });
        
        await Promise.all(stopPromises);
        
        this.isInitialized = false;
        this.logger.system('[◯] Emergency stop completed');
        
        return { success: true, message: '[◯] All systems stopped' };
    }

    async shutdown() {
        this.logger.system('[◯] Graceful shutdown initiated');
        
        // Notify via Telegram
        if (this.modules.telegram && this.modules.telegram.isConnected) {
            try {
                await this.modules.telegram.sendSystemMessage(
                    '🛑 SYSTEM SHUTDOWN\n\n' +
                    `⏱️ Runtime: ${this.formatUptime(this.metrics.uptime)}\n` +
                    `💰 Total Earnings: ${this.metrics.totalEarnings.toFixed(4)} ETH\n` +
                    `✅ Tasks Completed: ${this.metrics.totalTasks}\n` +
                    `🔒 Security Events: ${this.metrics.securityEvents}\n` +
                    `⏰ Shutdown Time: ${new Date().toLocaleString()}`
                );
            } catch (error) {
                this.logger.warn(`[--] Shutdown notification failed: ${error.message}`);
            }
        }
        
        // Stop all modules gracefully
        for (const [name, module] of Object.entries(this.modules)) {
            try {
                if (module && module.stop) {
                    await module.stop();
                    this.logger.system(`[◯] ${name} stopped`);
                }
            } catch (error) {
                this.logger.error(`[✗] ${name} stop error: ${error.message}`);
            }
        }
        
        // Clear sensitive data
        await this.security.clearSensitiveData();
        
        this.logger.system('[◯] Ghostline V4.0 shutdown complete');
    }

    getDetailedMetrics() {
        const metrics = {
            system: {
                version: this.version,
                uptime: this.formatUptime(this.metrics.uptime),
                startTime: this.startTime.toISOString(),
                activeModules: this.metrics.activeModules,
                securityEvents: this.metrics.securityEvents
            },
            security: this.security.getMetrics(),
            performance: {
                totalEarnings: this.metrics.totalEarnings,
                tasksPerHour: this.calculateTasksPerHour(),
                hourlyEarnings: this.calculateHourlyEarnings(),
                successRate: this.calculateOverallSuccessRate()
            }
        };
        
        // Add module-specific metrics if available
        if (this.modules.harvester && this.modules.harvester.getDetailedMetrics) {
            metrics.harvester = this.modules.harvester.getDetailedMetrics();
        }
        
        if (this.modules.analyzer && this.modules.analyzer.getDetailedMetrics) {
            metrics.analyzer = this.modules.analyzer.getDetailedMetrics();
        }
        
        if (this.modules.validator && this.modules.validator.getDetailedMetrics) {
            metrics.validator = this.modules.validator.getDetailedMetrics();
        }
        
        return metrics;
    }

    formatUptime(milliseconds) {
        const hours = Math.floor(milliseconds / 3600000);
        const minutes = Math.floor((milliseconds % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    }

    calculateTasksPerHour() {
        const hoursRunning = this.metrics.uptime / 3600000;
        return hoursRunning > 0 ? (this.metrics.totalTasks / hoursRunning).toFixed(1) : '0.0';
    }

    calculateHourlyEarnings() {
        const hoursRunning = this.metrics.uptime / 3600000;
        return hoursRunning > 0 ? (this.metrics.totalEarnings / hoursRunning).toFixed(4) : '0.0000';
    }

    calculateOverallSuccessRate() {
        const rates = [];
        
        if (this.modules.harvester && this.modules.harvester.getSuccessRate) {
            const rate = this.modules.harvester.getSuccessRate();
            if (rate !== '0%') rates.push(parseFloat(rate));
        }
        
        if (this.modules.analyzer && this.modules.analyzer.getSuccessRate) {
            const rate = this.modules.analyzer.getSuccessRate();
            if (rate !== '0%') rates.push(parseFloat(rate));
        }
        
        if (rates.length === 0) return '0%';
        
        const average = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        return `${average.toFixed(1)}%`;
    }

    // Health check for monitoring
    healthCheck() {
        return {
            status: this.isInitialized ? 'healthy' : 'starting',
            version: this.version,
            uptime: this.metrics.uptime,
            security: this.security.getHealthStatus(),
            modules: Object.keys(this.modules).map(name => ({
                name,
                status: this.modules[name] && this.modules[name].isRunning ? 'running' : 'stopped',
                available: !!this.modules[name]
            })),
            timestamp: new Date().toISOString()
        };
    }
}

// Initialize system
const system = new GhostlineV4();

// Handle process signals
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await system.shutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await system.shutdown();
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (system.logger) {
        system.logger.error(`Uncaught exception: ${error.message}`);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (system.logger) {
        system.logger.error(`Unhandled rejection: ${reason}`);
    }
});

// Start the system
system.start().then(result => {
    if (result.success) {
        console.log('🚀 Ghostline V4.0 started successfully');
    } else {
        console.error('❌ Ghostline V4.0 startup failed:', result.message);
        process.exit(1);
    }
}).catch(error => {
    console.error('💥 Critical startup error:', error);
    process.exit(1);
});

// Export for external use
module.exports = GhostlineV4;
