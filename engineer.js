const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const simpleGit = require('simple-git');
const { spawn } = require('child_process');
const TelegramBot = require('node-telegram-bot-api');
const GhostlineHunter = require('./ghostline-hunter');

// Railway-optimized health check server with comprehensive binding strategies
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
        service: 'ghostline-agent-engineer',
        version: '1.0.0',
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
    
    healthServer.on('clientError', (error, socket) => {
        console.error(`[${new Date().toISOString()}] Client error:`, error.message);
        if (socket.writable) {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
    });
    
    healthServer.on('listening', () => {
        const addr = healthServer.address();
        serverReady = true;
        console.log(`[${new Date().toISOString()}] Health server ready on ${addr.address}:${addr.port}`);
        console.log(`[${new Date().toISOString()}] Available endpoints: /health, /healthz, /ready, /`);
        
        setTimeout(performSelfHealthCheck, 1000);
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
    const fallbackHosts = ['0.0.0.0', '::'];
    
    console.log(`[${new Date().toISOString()}] Attempting fallback binding strategies`);
    
    for (const host of fallbackHosts) {
        for (const port of fallbackPorts) {
            try {
                if (healthServer) {
                    healthServer.close();
                }
                
                healthServer = http.createServer(createHealthHandler);
                healthServer.listen(port, host, () => {
                    const addr = healthServer.address();
                    serverReady = true;
                    console.log(`[${new Date().toISOString()}] Fallback binding successful on ${addr.address}:${addr.port}`);
                });
                return;
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Fallback binding failed for ${host}:${port}`, error.message);
                continue;
            }
        }
    }
    
    console.error(`[${new Date().toISOString()}] All binding attempts failed`);
}

function performSelfHealthCheck() {
    const addr = healthServer.address();
    if (!addr) return;
    
    console.log(`[${new Date().toISOString()}] Performing self health check`);
    
    const options = {
        hostname: 'localhost',
        port: addr.port,
        path: '/health',
        method: 'GET',
        timeout: 5000
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`[${new Date().toISOString()}] Self health check successful: ${res.statusCode}`);
        });
    });
    
    req.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] Self health check failed:`, error.message);
    });
    
    req.on('timeout', () => {
        console.error(`[${new Date().toISOString()}] Self health check timeout`);
        req.destroy();
    });
    
    req.end();
}

// Unconditional process persistence mechanism
setInterval(() => {
    // Heartbeat to maintain process for Railway health monitoring
}, 30000);

class GhostlineAgentEngineer {
    constructor() {
        this.repoPath = process.cwd();
        this.git = simpleGit(this.repoPath);
        this.isRunning = false;
        this.cycleInterval = 5 * 60 * 1000;
        this.isGitRepository = false;
        this.runningAgents = new Map();
        this.agentLogs = new Map();
        
        // GhostlineHunter integration
        this.hunterAgent = null;
        this.hunterActive = false;
        
        this.targetAgents = ['LostHunter', 'Keygen', 'Scavenger'];
        this.log('Ghostline Agent Engineer initialized');
        
        if (process.env.TELEGRAM_TOKEN) {
            this.initializeTelegramBot();
        }
    }

    initializeTelegramBot() {
        this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
        
        // Existing agent management commands
        this.bot.onText(/\/start (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const agentName = match[1];
            
            try {
                const result = await this.startAgent(agentName);
                this.bot.sendMessage(chatId, result.message);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error starting agent: ${error.message}`);
            }
        });
        
        this.bot.onText(/\/stop (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const agentName = match[1];
            
            try {
                const result = await this.stopAgent(agentName);
                this.bot.sendMessage(chatId, result.message);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error stopping agent: ${error.message}`);
            }
        });
        
        this.bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;
            const status = this.getAgentStatus();
            this.bot.sendMessage(chatId, status);
        });
        
        this.bot.onText(/\/log (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const agentName = match[1];
            
            try {
                const logs = await this.getAgentLogs(agentName);
                this.bot.sendMessage(chatId, logs);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error getting logs: ${error.message}`);
            }
        });

        // GhostlineHunter-specific commands
        this.bot.onText(/\/start_hunter/, async (msg) => {
            const chatId = msg.chat.id;
            
            try {
                const result = await this.startHunter();
                this.bot.sendMessage(chatId, result.message);
            } catch (error) {
                this.bot.sendMessage(chatId, `Error starting Hunter: ${error.message}`);
            }
        });

        this.bot.onText(/\/stop_hunter/, async (msg) => {
            const chatId = msg.chat.id;
            
            try {
                const result = await this.stopHunter();
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

        // Help command displaying all available commands
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id;
            const helpText = this.generateHelpText();
            this.bot.sendMessage(chatId, helpText);
        });

        // Handle unknown commands gracefully
        this.bot.on('message', (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            
            if (text && text.startsWith('/') && !this.isKnownCommand(text)) {
                this.bot.sendMessage(chatId, 
                    `Unknown command: ${text}\n\nType /help to see available commands.`
                );
            }
        });
        
        this.log('Telegram bot initialized successfully with Hunter integration');
    }

    // GhostlineHunter management methods
    async startHunter() {
        try {
            if (this.hunterActive && this.hunterAgent) {
                return { 
                    success: false, 
                    message: 'GhostlineHunter is already active and scanning.' 
                };
            }

            this.hunterAgent = new GhostlineHunter();
            await this.hunterAgent.start();
            this.hunterActive = true;

            this.log('GhostlineHunter (Ranger) activated via Telegram command');
            return { 
                success: true, 
                message: '🎯 GhostlineHunter (Ranger) activated successfully.\nScanning for Ethereum assets across public sources.' 
            };
        } catch (error) {
            this.log(`Failed to start GhostlineHunter: ${error.message}`);
            return { 
                success: false, 
                message: `Failed to activate Hunter: ${error.message}` 
            };
        }
    }

    async stopHunter() {
        try {
            if (!this.hunterActive || !this.hunterAgent) {
                return { 
                    success: false, 
                    message: 'GhostlineHunter is not currently active.' 
                };
            }

            await this.hunterAgent.stop();
            this.hunterAgent = null;
            this.hunterActive = false;

            this.log('GhostlineHunter (Ranger) deactivated via Telegram command');
            return { 
                success: true, 
                message: '⏹️ GhostlineHunter (Ranger) deactivated successfully.' 
            };
        } catch (error) {
            this.log(`Failed to stop GhostlineHunter: ${error.message}`);
            return { 
                success: false, 
                message: `Failed to deactivate Hunter: ${error.message}` 
            };
        }
    }

    getHunterStatus() {
        if (!this.hunterActive || !this.hunterAgent) {
            return '🔴 GhostlineHunter Status: INACTIVE\n\nUse /start_hunter to activate scanning operations.';
        }

        try {
            const status = this.hunterAgent.getStatus ? this.hunterAgent.getStatus() : { discoveredAssets: 0, scanCycles: 0 };
            const startTime = this.hunterAgent.startTime || new Date();
            const runtime = Math.floor((Date.now() - startTime.getTime()) / 1000);
            const hours = Math.floor(runtime / 3600);
            const minutes = Math.floor((runtime % 3600) / 60);
            
            return `🟢 GhostlineHunter Status: ACTIVE (Ranger)\n\n` +
                   `📊 Assets Discovered: ${status.discoveredAssets || 0}\n` +
                   `⏱️ Runtime: ${hours}h ${minutes}m\n` +
                   `🔍 Current Operation: Scanning public sources\n` +
                   `📈 Scan Cycles: ${status.scanCycles || 0}\n\n` +
                   `Use /stop_hunter to deactivate scanning.`;
        } catch (error) {
            return `🟡 GhostlineHunter Status: ACTIVE (Limited Info)\n\nRuntime data temporarily unavailable.\nUse /stop_hunter to deactivate scanning.`;
        }
    }

    generateHelpText() {
        return `🤖 Ghostline Engineer - Available Commands\n\n` +
               `📋 Agent Management:\n` +
               `/start <agent>` + ` - Start specific agent from registry\n` +
               `/stop <agent>` + ` - Stop running agent\n` +
               `/status` + ` - Show all running agents\n` +
               `/log <agent>` + ` - Get recent logs for agent\n\n` +
               `🎯 GhostlineHunter Commands:\n` +
               `/start_hunter` + ` - Activate Hunter scanning\n` +
               `/stop_hunter` + ` - Deactivate Hunter scanning\n` +
               `/hunter_status` + ` - Show Hunter status and metrics\n\n` +
               `ℹ️ System Commands:\n` +
               `/help` + ` - Show this help message\n\n` +
               `💡 Example Usage:\n` +
               `• /start_hunter` + ` - Begin autonomous asset discovery\n` +
               `• /status` + ` - Check all active agents\n` +
               `• /hunter_status` + ` - View Hunter performance metrics`;
    }

    isKnownCommand(text) {
        const knownCommands = [
            '/start', '/stop', '/status', '/log', '/help',
            '/start_hunter', '/stop_hunter', '/hunter_status'
        ];

        const command = text.split(' ')[0];
        return knownCommands.includes(command);
    }

    async loadAgentRegistry() {
        try {
            const agentsFile = path.join(this.repoPath, 'agents.json');
            const data = await fs.readFile(agentsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            this.log(`Failed to load agents.json: ${error.message}`);
            return {};
        }
    }

    async startAgent(agentName) {
        const registry = await this.loadAgentRegistry();
        const agentConfig = registry[agentName];
        
        if (!agentConfig) {
            return { success: false, message: `Agent '${agentName}' not found in registry` };
        }
        
        if (this.runningAgents.has(agentName)) {
            return { success: false, message: `Agent '${agentName}' is already running` };
        }
        
        try {
            const agentProcess = spawn('node', [agentConfig.script], {
                cwd: this.repoPath,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            this.runningAgents.set(agentName, {
                process: agentProcess,
                startTime: new Date(),
                config: agentConfig
            });
            
            this.agentLogs.set(agentName, []);
            
            agentProcess.stdout.on('data', (data) => {
                this.addAgentLog(agentName, `[OUT] ${data.toString()}`);
            });
            
            agentProcess.stderr.on('data', (data) => {
                this.addAgentLog(agentName, `[ERR] ${data.toString()}`);
            });
            
            agentProcess.on('close', (code) => {
                this.addAgentLog(agentName, `Process exited with code ${code}`);
                this.runningAgents.delete(agentName);
            });
            
            this.log(`Started agent: ${agentName}`);
            return { success: true, message: `Agent '${agentName}' started successfully` };
            
        } catch (error) {
            return { success: false, message: `Failed to start agent: ${error.message}` };
        }
    }

    async stopAgent(agentName) {
        const runningAgent = this.runningAgents.get(agentName);
        
        if (!runningAgent) {
            return { success: false, message: `Agent '${agentName}' is not running` };
        }
        
        try {
            runningAgent.process.kill('SIGTERM');
            this.runningAgents.delete(agentName);
            this.log(`Stopped agent: ${agentName}`);
            return { success: true, message: `Agent '${agentName}' stopped successfully` };
        } catch (error) {
            return { success: false, message: `Failed to stop agent: ${error.message}` };
        }
    }

    getAgentStatus() {
        let status = '';
        
        // Regular agents status
        if (this.runningAgents.size === 0) {
            status += 'No standard agents are currently running.\n\n';
        } else {
            status += `Running agents (${this.runningAgents.size}):\n\n`;
            
            for (const [name, agent] of this.runningAgents) {
                const uptime = Math.floor((Date.now() - agent.startTime.getTime()) / 1000);
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = uptime % 60;
                
                status += `• ${name}\n`;
                status += `  PID: ${agent.process.pid}\n`;
                status += `  Uptime: ${hours}h ${minutes}m ${seconds}s\n`;
                status += `  Script: ${agent.config.script}\n\n`;
            }
        }

        // Hunter status
        if (this.hunterActive) {
            status += `🎯 GhostlineHunter: ACTIVE (Ranger)\n`;
            status += `Use /hunter_status for detailed metrics.\n\n`;
        } else {
            status += `🎯 GhostlineHunter: INACTIVE\n`;
            status += `Use /start_hunter to activate scanning.\n\n`;
        }

        status += `Type /help for available commands.`;
        
        return status;
    }

    async getAgentLogs(agentName) {
        const logs = this.agentLogs.get(agentName);
        
        if (!logs) {
            return `No logs available for agent '${agentName}'`;
        }
        
        if (logs.length === 0) {
            return `Agent '${agentName}' has no log entries`;
        }
        
        const recentLogs = logs.slice(-10);
        return `Last logs for '${agentName}':\n\n${recentLogs.join('\n')}`;
    }

    addAgentLog(agentName, logEntry) {
        const logs = this.agentLogs.get(agentName) || [];
        const timestamp = new Date().toISOString();
        logs.push(`[${timestamp}] ${logEntry.trim()}`);
        
        if (logs.length > 100) {
            logs.splice(0, logs.length - 100);
        }
        
        this.agentLogs.set(agentName, logs);
    }

    log(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    async setupGitConfig() {
        try {
            await this.git.addConfig('user.name', 'Ghostline Engineer', false, 'local');
            await this.git.addConfig('user.email', 'engineer@ghostline.system', false, 'local');
            this.log('Git configuration applied');
        } catch (error) {
            this.log(`Git config warning: ${error.message}`);
        }
    }

    async validateRepository() {
        try {
            const status = await this.git.status();
            this.log(`Repository status validated - ${status.files.length} tracked files`);
            return true;
        } catch (error) {
            this.log(`Not a git repository - git operations will be skipped`);
            return false;
        }
    }

    async initialize() {
        try {
            await this.setupGitConfig();
            this.isGitRepository = await this.validateRepository();
            this.log('Engineer initialization completed successfully');
            
            // Initialize health server after successful engineer initialization
            if (!healthServer) {
                initializeHealthServer();
            }
            
            return true;
        } catch (error) {
            this.log(`Initialization failed: ${error.message}`);
            return false;
        }
    }

    async scanForAgents() {
        const agentFiles = [];
        
        try {
            const files = await this.getAllJSFiles(this.repoPath);
            
            for (const filePath of files) {
                const content = await fs.readFile(filePath, 'utf8');
                const fileName = path.basename(filePath);
                
                if (this.isAgentFile(content, fileName)) {
                    agentFiles.push({
                        name: fileName,
                        path: filePath,
                        relativePath: path.relative(this.repoPath, filePath),
                        content: content,
                        lastModified: (await fs.stat(filePath)).mtime
                    });
                }
            }
            
            this.log(`Discovered ${agentFiles.length} agent files`);
            return agentFiles;
        } catch (error) {
            this.log(`Agent scan failed: ${error.message}`);
            return [];
        }
    }

    async getAllJSFiles(directory) {
        const jsFiles = [];
        
        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                
                if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
                    const subFiles = await this.getAllJSFiles(fullPath);
                    jsFiles.push(...subFiles);
                } else if (entry.isFile() && entry.name.endsWith('.js')) {
                    jsFiles.push(fullPath);
                }
            }
        } catch (error) {
            this.log(`Directory scan error for ${directory}: ${error.message}`);
        }
        
        return jsFiles;
    }

    shouldSkipDirectory(name) {
        const skipList = ['node_modules', '.git', 'logs', 'dist', 'build'];
        return skipList.includes(name) || name.startsWith('.');
    }

    isAgentFile(content, fileName) {
        const agentIndicators = this.targetAgents.concat(['agent', 'Agent']);
        
        return agentIndicators.some(indicator => 
            fileName.toLowerCase().includes(indicator.toLowerCase()) ||
            content.includes(indicator)
        );
    }

    analyzeAgent(agent) {
        const analysis = {
            name: agent.name,
            issues: [],
            improvements: [],
            metrics: this.calculateMetrics(agent.content)
        };

        if (agent.content.includes('eval(')) {
            analysis.issues.push({
                type: 'security',
                severity: 'critical',
                description: 'Dangerous eval() usage detected'
            });
        }

        const asyncCount = (agent.content.match(/async\s+function/g) || []).length;
        const tryCount = (agent.content.match(/try\s*{/g) || []).length;
        
        if (asyncCount > tryCount) {
            analysis.improvements.push({
                type: 'error-handling',
                priority: 'high',
                description: 'Add error handling to async functions'
            });
        }

        if (agent.content.includes('console.log') && !agent.content.includes('logger')) {
            analysis.improvements.push({
                type: 'logging',
                priority: 'medium',
                description: 'Replace console.log with structured logging'
            });
        }

        if (agent.content.includes('for (') && agent.content.includes('.push(')) {
            analysis.improvements.push({
                type: 'performance',
                priority: 'low',
                description: 'Optimize array operations'
            });
        }

        return analysis;
    }

    calculateMetrics(code) {
        const lines = code.split('\n');
        return {
            totalLines: lines.length,
            codeLines: lines.filter(line => line.trim() && !line.trim().startsWith('//')).length,
            functions: (code.match(/function\s+\w+|=>\s*{/g) || []).length,
            complexity: this.calculateComplexity(code)
        };
    }

    calculateComplexity(code) {
        const patterns = [/if\s*\(/g, /while\s*\(/g, /for\s*\(/g, /switch\s*\(/g];
        let complexity = 1;
        
        patterns.forEach(pattern => {
            const matches = code.match(pattern);
            if (matches) complexity += matches.length;
        });
        
        return complexity;
    }

    async applyImprovements(agent, analysis) {
        let modifiedContent = agent.content;
        const appliedChanges = [];

        for (const improvement of analysis.improvements) {
            const result = await this.applyImprovement(modifiedContent, improvement);
            if (result.success) {
                modifiedContent = result.content;
                appliedChanges.push(improvement);
            }
        }

        if (appliedChanges.length > 0) {
            await fs.writeFile(agent.path, modifiedContent, 'utf8');
            this.log(`Applied ${appliedChanges.length} improvements to ${agent.name}`);
            return { success: true, changes: appliedChanges };
        }

        return { success: false, changes: [] };
    }

    async applyImprovement(content, improvement) {
        switch (improvement.type) {
            case 'error-handling':
                return this.addErrorHandling(content);
            case 'logging':
                return this.improveLogging(content);
            case 'performance':
                return this.optimizePerformance(content);
            default:
                return { success: false, content };
        }
    }

    addErrorHandling(content) {
        const asyncFunctionRegex = /(async\s+function\s+\w+\([^)]*\)\s*{)/g;
        const improved = content.replace(asyncFunctionRegex, (match) => {
            return match + '\n    try {';
        });

        if (improved !== content) {
            return { success: true, content: improved };
        }
        return { success: false, content };
    }

    improveLogging(content) {
        if (!content.includes('// Logger setup')) {
            const loggerSetup = '// Logger setup\nconst logger = console;\n\n';
            const improved = loggerSetup + content.replace(/console\.log/g, 'logger.info');
            return { success: true, content: improved };
        }
        return { success: false, content };
    }

    optimizePerformance(content) {
        const forLoopPattern = /for\s*\([^)]*\)\s*{[^}]*\.push\([^)]*\)[^}]*}/g;
        if (forLoopPattern.test(content)) {
            const improved = content + '\n// TODO: Consider using map/filter/reduce for better performance';
            return { success: true, content: improved };
        }
        return { success: false, content };
    }

    async commitChanges(changedAgents) {
        if (!this.isGitRepository) {
            this.log('Git operations skipped - not a git repository');
            return { success: true, message: 'No git repository available' };
        }
        
        try {
            await this.git.add('.');
            
            const message = this.generateCommitMessage(changedAgents);
            await this.git.commit(message);
            
            this.log('Changes committed successfully');
            return { success: true, message };
        } catch (error) {
            this.log(`Commit failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    generateCommitMessage(changedAgents) {
        const timestamp = new Date().toISOString();
        const totalChanges = changedAgents.reduce((sum, agent) => sum + agent.changes.length, 0);
        
        let message = `🤖 Ghostline Engineer: Automated improvements\n\n`;
        message += `Applied ${totalChanges} improvements across ${changedAgents.length} agents:\n`;
        
        changedAgents.forEach(agent => {
            message += `- ${agent.name}: ${agent.changes.length} changes\n`;
        });
        
        message += `\nTimestamp: ${timestamp}`;
        return message;
    }

    async pushChanges() {
        if (!this.isGitRepository) {
            this.log('Git operations skipped - not a git repository');
            return { success: true, message: 'No git repository available' };
        }
        
        try {
            await this.git.push('origin', 'main');
            this.log('Changes pushed to GitHub successfully');
            return { success: true };
        } catch (error) {
            this.log(`Push failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async executeEngineeringCycle() {
        this.log('Starting engineering cycle');
        
        try {
            const agents = await this.scanForAgents
