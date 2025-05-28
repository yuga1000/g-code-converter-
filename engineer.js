const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const simpleGit = require('simple-git');

class GhostlineAgentEngineer {
    constructor() {
        this.repoPath = process.cwd();
        this.git = simpleGit(this.repoPath);
        this.isRunning = false;
        this.cycleInterval = 5 * 60 * 1000; // 5 minutes
        
        this.targetAgents = ['LostHunter', 'Keygen', 'Scavenger'];
        this.log('Ghostline Agent Engineer initialized');
    }

    log(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    async initialize() {
        try {
            await this.setupGitConfig();
            await this.validateRepository();
            this.log('Engineer initialization completed successfully');
            return true;
        } catch (error) {
            this.log(`Initialization failed: ${error.message}`);
            return false;
        }
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
        const status = await this.git.status();
        this.log(`Repository status validated - ${status.files.length} tracked files`);
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

        // Security analysis
        if (agent.content.includes('eval(')) {
            analysis.issues.push({
                type: 'security',
                severity: 'critical',
                description: 'Dangerous eval() usage detected'
            });
        }

        // Error handling analysis
        const asyncCount = (agent.content.match(/async\s+function/g) || []).length;
        const tryCount = (agent.content.match(/try\s*{/g) || []).length;
        
        if (asyncCount > tryCount) {
            analysis.improvements.push({
                type: 'error-handling',
                priority: 'high',
                description: 'Add error handling to async functions'
            });
        }

        // Logging analysis
        if (agent.content.includes('console.log') && !agent.content.includes('logger')) {
            analysis.improvements.push({
                type: 'logging',
                priority: 'medium',
                description: 'Replace console.log with structured logging'
            });
        }

        // Performance analysis
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
            const agents = await this.scanForAgents();
            
            if (agents.length === 0) {
                this.log('No agent files found');
                return { success: true, changes: false };
            }

            const changedAgents = [];

            for (const agent of agents) {
                const analysis = this.analyzeAgent(agent);
                
                if (analysis.improvements.length > 0) {
                    const result = await this.applyImprovements(agent, analysis);
                    if (result.success) {
                        changedAgents.push({
                            name: agent.name,
                            changes: result.changes
                        });
                    }
                }
            }

            if (changedAgents.length > 0) {
                const commitResult = await this.commitChanges(changedAgents);
                if (commitResult.success) {
                    await this.pushChanges();
                }
                
                this.log(`Engineering cycle completed with changes to ${changedAgents.length} agents`);
                return { success: true, changes: true, agents: changedAgents };
            }

            this.log('Engineering cycle completed with no changes needed');
            return { success: true, changes: false };

        } catch (error) {
            this.log(`Engineering cycle failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async startPipeline() {
        this.log('Starting continuous pipeline mode');
        this.isRunning = true;

        const runCycle = async () => {
            if (!this.isRunning) return;
            
            try {
                await this.executeEngineeringCycle();
            } catch (error) {
                this.log(`Pipeline cycle error: ${error.message}`);
            }
            
            if (this.isRunning) {
                setTimeout(runCycle, this.cycleInterval);
            }
        };

        await runCycle();
    }

    stop() {
        this.isRunning = false;
        this.log('Pipeline stopped');
    }
}

async function main() {
    // Start health check server immediately
    startHealthServer();
    
    // Add delay to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const args = process.argv.slice(2);
    const pipelineMode = args.includes('--pipeline');
    
    const engineer = new GhostlineAgentEngineer();
    
    const initialized = await engineer.initialize();
    if (!initialized) {
        process.exit(1);
    }
    
    if (pipelineMode) {
        await engineer.startPipeline();
    } else {
        const result = await engineer.executeEngineeringCycle();
        process.exit(result.success ? 0 : 1);
    }
}

function startHealthServer() {
    const port = process.env.PORT || 3000;
    
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        if (req.url === '/health' || req.url === '/' || req.url === '/healthz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'healthy', 
                service: 'ghostline-agent-engineer',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    });
    
    server.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Health server error:`, err.message);
    });
    
    server.listen(port, '0.0.0.0', () => {
        console.log(`[${new Date().toISOString()}] Health server running on 0.0.0.0:${port}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log(`[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully`);
        server.close(() => {
            process.exit(0);
        });
    });
    
    return server;
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = GhostlineAgentEngineer;
