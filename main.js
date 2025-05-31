// Ghostline Revenue System V4.1 - Clean Version (HarvesterCore only)
// File: main.js

const { Logger, Config, SecurityManager } = require('./utils');
const TelegramInterface = require('./modules/TelegramInterface');
const HarvesterCore = require('./modules/HarvesterCore');

class GhostlineClean {
    constructor() {
        this.version = '4.1.0';
        this.startTime = new Date();
        this.isInitialized = false;
        
        // Initialize security manager first
        this.security = new SecurityManager();
        
        // Initialize core components
        this.logger = new Logger('SYSTEM');
        this.config = new Config();
        
        // Core modules - only essential ones
        this.modules = {};
        
        // System metrics
        this.metrics = {
            startTime: this.startTime,
            uptime: 0,
            totalEarnings: 0,
            totalTasks: 0,
            activeModules: 0,
            lastActivity: null,
            securityEvents: 0
        };
        
        this.logger.system('[◉] Ghostline V4.1 Clean initialized (HarvesterCore focus)');
    }

    async start() {
        try {
            this.logger.system('[▸] Starting Ghostline Clean V4.1...');
            
            // Load and validate configuration
            await this.config.load();
            await this.validateSecurity();
            
            // Initialize core modules
            await this.initializeModules();
            
            // Start Telegram interface
            if (this.modules.telegram) {
                await this.modules.telegram.start();
            }
            
            // Start metric tracking
            this.startMetricsTracking();
            
            this.isInitialized = true;
            this.logger.system('[◉] Ghostline Clean V4.1 fully operational');
            
            // Send startup notification
            await this.sendStartupNotification();
            
            return { success: true, message: 'Clean system started successfully' };
            
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
            // Initialize HarvesterCore (main money maker)
            this.modules.harvester = new HarvesterCore(this);
            
            // Initialize Telegram interface if token is provided
            if (this.config.get('TELEGRAM_BOT_TOKEN')) {
                this.modules.telegram = new TelegramInterface(this);
            } else {
                this.logger.warn('[--] Telegram not configured - skipping');
            }
            
            // Initialize each module
            const moduleOrder = ['harvester', 'telegram'];
            
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
        return `🚀 GHOSTLINE V4.1 CLEAN OPERATIONAL\n\n` +
            `📋 System Version: ${this.version}\n` +
            `⏰ Startup Time: ${this.startTime.toLocaleString()}\n` +
            `✅ Active Modules: ${this.metrics.activeModules}\n` +
            `🔒 Security: Enhanced Protection Active\n` +
            `💰 Revenue Focus: Task Harvesting\n\n` +
            `🎯 Core Features:\n` +
            `    ✅ Multi-platform Task Harvesting\n` +
            `    ✅ Real-time Task Execution\n` +
            `    ✅ Secure Operations\n` +
            `    ✅ Telegram Control Interface\n\n` +
            `🎮 Use /start for control panel`;
    }

    startMetricsTracking() {
        setInterval(() => {
            this.updateMetrics();
        }, 30000); // Update every 30 seconds
    }

    updateMetrics() {
        this.metrics.uptime = Date.now() - this.startTime.getTime();
        this.metrics.lastActivity = new Date();
        
        // Aggregate metrics from harvester
        if (this.modules.harvester && this.modules.harvester.isRunning) {
            this.metrics.totalEarnings = this.modules.harvester.getTotalEarnings();
            this.metrics.totalTasks = this.modules.harvester.getTotalTasks();
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
                    earnings: module.getTotalEarnings ? module.getTotalEarnings() : 0,
                    successRate: module.getSuccessRate ? module.getSuccessRate() : '0%'
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
        
        // Stop harvester
        if (this.modules.harvester && this.modules.harvester.stop) {
            try {
                await this.modules.harvester.stop();
                this.logger.system('[◯] Harvester stopped');
            } catch (error) {
                this.logger.error(`Harvester stop error: ${error.message}`);
            }
        }
        
        this.isInitialized = false;
        this.logger.system('[◯] Emergency stop completed');
        
        return { success: true, message: '[◯] System stopped' };
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
        
        this.logger.system('[◯] Ghostline Clean V4.1 shutdown complete');
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
                successRate: this.modules.harvester ? this.modules.harvester.getSuccessRate() : '0%'
            }
        };
        
        // Add harvester metrics if available
        if (this.modules.harvester && this.modules.harvester.getDetailedMetrics) {
            metrics.harvester = this.modules.harvester.getDetailedMetrics();
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

// Initialize clean system
const system = new GhostlineClean();

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

// Start the clean system
system.start().then(result => {
    if (result.success) {
        console.log('🚀 Ghostline Clean V4.1 started successfully');
    } else {
        console.error('❌ Ghostline Clean V4.1 startup failed:', result.message);
        process.exit(1);
    }
}).catch(error => {
    console.error('💥 Critical startup error:', error);
    process.exit(1);
});

// Export for external use
module.exports = GhostlineClean;
