#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const simpleGit = require('simple-git');
const { execSync } = require('child_process');

class GhostlineEngineer {
    constructor(options = {}) {
        this.repoPath = options.repoPath || process.cwd();
        this.git = simpleGit(this.repoPath);
        this.engineerName = 'Ghostline Engineer';
        this.engineerEmail = 'engineer@ghostline.system';
        this.pipelineMode = options.pipeline || false;
        this.scanInterval = options.interval || 300000; // 5 minutes default
        
        this.agentPatterns = [
            /LostHunter/i,
            /Keygen/i,
            /Scavenger/i,
            /Agent/i,
            /ghostline.*agent/i
        ];
        
        this.codeAnalyzers = this.initializeAnalyzers();
        this.improvementStrategies = this.initializeStrategies();
    }

    async initialize() {
        console.log(`[${new Date().toISOString()}] Initializing Ghostline Engineer`);
        
        await this.configureGit();
        await this.validateRepository();
        
        console.log(`[${new Date().toISOString()}] Engineer initialization complete`);
    }

    async configureGit() {
        try {
            const currentName = await this.git.getConfig('user.name');
            const currentEmail = await this.git.getConfig('user.email');
            
            if (!currentName.value) {
                await this.git.addConfig('user.name', this.engineerName);
            }
            if (!currentEmail.value) {
                await this.git.addConfig('user.email', this.engineerEmail);
            }
            
            console.log(`[${new Date().toISOString()}] Git configuration verified`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Git configuration failed:`, error.message);
            throw error;
        }
    }

    async validateRepository() {
        try {
            await this.git.status();
            console.log(`[${new Date().toISOString()}] Repository validation successful`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Repository validation failed:`, error.message);
            throw error;
        }
    }

    async scanForAgentModules() {
        const agentModules = [];
        
        try {
            const entries = await this.recursiveDirectoryScan(this.repoPath);
            
            for (const entry of entries) {
                if (await this.isAgentModule(entry)) {
                    const content = await fs.readFile(entry.path, 'utf8');
                    agentModules.push({
                        name: entry.name,
                        path: entry.path,
                        relativePath: path.relative(this.repoPath, entry.path),
                        content: content,
                        size: content.length,
                        lastModified: (await fs.stat(entry.path)).mtime
                    });
                }
            }
            
            console.log(`[${new Date().toISOString()}] Discovered ${agentModules.length} agent modules`);
            return agentModules;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Agent module scan failed:`, error.message);
            return [];
        }
    }

    async recursiveDirectoryScan(directory, entries = []) {
        const items = await fs.readdir(directory, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(directory, item.name);
            
            if (item.isDirectory() && !this.shouldSkipDirectory(item.name)) {
                await this.recursiveDirectoryScan(fullPath, entries);
            } else if (item.isFile() && this.isJavaScriptFile(item.name)) {
                entries.push({
                    name: item.name,
                    path: fullPath,
                    type: 'file'
                });
            }
        }
        
        return entries;
    }

    shouldSkipDirectory(name) {
        const skipPatterns = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'coverage',
            '.nyc_output',
            'logs',
            '*.log'
        ];
        
        return skipPatterns.some(pattern => 
            name.includes(pattern) || name.startsWith('.')
        );
    }

    isJavaScriptFile(filename) {
        return filename.endsWith('.js') || filename.endsWith('.mjs') || filename.endsWith('.ts');
    }

    async isAgentModule(entry) {
        try {
            const content = await fs.readFile(entry.path, 'utf8');
            return this.agentPatterns.some(pattern => pattern.test(content)) ||
                   this.agentPatterns.some(pattern => pattern.test(entry.name));
        } catch (error) {
            return false;
        }
    }

    async analyzeModule(module) {
        const analysis = {
            module: module.name,
            path: module.relativePath,
            timestamp: new Date().toISOString(),
            issues: [],
            improvements: [],
            metrics: this.calculateCodeMetrics(module.content),
            riskLevel: 'low'
        };

        for (const analyzer of this.codeAnalyzers) {
            const result = await analyzer.analyze(module.content, module);
            analysis.issues.push(...result.issues);
            analysis.improvements.push(...result.improvements);
        }

        analysis.riskLevel = this.calculateRiskLevel(analysis);
        
        console.log(`[${new Date().toISOString()}] Analysis complete for ${module.name}: ${analysis.issues.length} issues, ${analysis.improvements.length} improvements`);
        
        return analysis;
    }

    calculateCodeMetrics(code) {
        const lines = code.split('\n');
        return {
            totalLines: lines.length,
            codeLines: lines.filter(line => line.trim() && !line.trim().startsWith('//')).length,
            commentLines: lines.filter(line => line.trim().startsWith('//')).length,
            functions: (code.match(/function\s+\w+|=>\s*{|async\s+function/g) || []).length,
            classes: (code.match(/class\s+\w+/g) || []).length,
            complexity: this.calculateCyclomaticComplexity(code)
        };
    }

    calculateCyclomaticComplexity(code) {
        const complexityIndicators = [
            /if\s*\(/g,
            /else\s*if\s*\(/g,
            /while\s*\(/g,
            /for\s*\(/g,
            /switch\s*\(/g,
            /case\s+/g,
            /catch\s*\(/g,
            /&&|\|\|/g
        ];
        
        let complexity = 1;
        complexityIndicators.forEach(pattern => {
            const matches = code.match(pattern);
            if (matches) complexity += matches.length;
        });
        
        return complexity;
    }

    calculateRiskLevel(analysis) {
        const criticalIssues = analysis.issues.filter(issue => issue.severity === 'critical').length;
        const highIssues = analysis.issues.filter(issue => issue.severity === 'high').length;
        
        if (criticalIssues > 0) return 'critical';
        if (highIssues > 2) return 'high';
        if (analysis.issues.length > 5) return 'medium';
        return 'low';
    }

    async applyImprovements(module, analysis) {
        let modifiedContent = module.content;
        const appliedImprovements = [];
        
        for (const improvement of analysis.improvements) {
            const strategy = this.improvementStrategies.find(s => s.type === improvement.type);
            if (strategy && strategy.canApply(improvement, modifiedContent)) {
                try {
                    const result = await strategy.apply(modifiedContent, improvement, module);
                    if (result.success) {
                        modifiedContent = result.content;
                        appliedImprovements.push(improvement);
                        console.log(`[${new Date().toISOString()}] Applied improvement: ${improvement.description}`);
                    }
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Failed to apply improvement ${improvement.type}:`, error.message);
                }
            }
        }
        
        if (appliedImprovements.length > 0) {
            await fs.writeFile(module.path, modifiedContent, 'utf8');
            return {
                success: true,
                improvements: appliedImprovements,
                newContent: modifiedContent
            };
        }
        
        return { success: false, improvements: [] };
    }

    async commitChanges(changedModules) {
        try {
            await this.git.add('.');
            
            const commitMessage = this.generateCommitMessage(changedModules);
            await this.git.commit(commitMessage);
            
            console.log(`[${new Date().toISOString()}] Changes committed successfully`);
            return { success: true, message: commitMessage };
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Commit failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    generateCommitMessage(changedModules) {
        const timestamp = new Date().toISOString();
        const totalImprovements = changedModules.reduce((sum, mod) => sum + mod.improvements.length, 0);
        
        let message = `🤖 Ghostline Engineer: Automated improvements\n\n`;
        message += `Applied ${totalImprovements} improvements across ${changedModules.length} modules:\n\n`;
        
        changedModules.forEach(module => {
            message += `• ${module.name}: ${module.improvements.length} improvements\n`;
            module.improvements.slice(0, 3).forEach(imp => {
                message += `  - ${imp.description}\n`;
            });
        });
        
        message += `\nTimestamp: ${timestamp}`;
        message += `\nEngineer: ${this.engineerName}`;
        
        return message;
    }

    async pushChanges() {
        try {
            await this.git.push('origin', 'main');
            console.log(`[${new Date().toISOString()}] Changes pushed to GitHub successfully`);
            return { success: true };
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Push failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async triggerDeployment() {
        try {
            console.log(`[${new Date().toISOString()}] Triggering Railway deployment`);
            execSync('railway up', { cwd: this.repoPath, stdio: 'inherit' });
            console.log(`[${new Date().toISOString()}] Railway deployment triggered successfully`);
            return { success: true };
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Railway deployment failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async executeEngineeringCycle() {
        console.log(`[${new Date().toISOString()}] Starting engineering cycle`);
        
        try {
            const modules = await this.scanForAgentModules();
            if (modules.length === 0) {
                console.log(`[${new Date().toISOString()}] No agent modules found`);
                return { success: true, changes: false };
            }
            
            const changedModules = [];
            
            for (const module of modules) {
                const analysis = await this.analyzeModule(module);
                
                if (analysis.improvements.length > 0) {
                    const result = await this.applyImprovements(module, analysis);
                    if (result.success) {
                        changedModules.push({
                            name: module.name,
                            improvements: result.improvements,
                            analysis: analysis
                        });
                    }
                }
            }
            
            if (changedModules.length > 0) {
                const commitResult = await this.commitChanges(changedModules);
                if (commitResult.success) {
                    const pushResult = await this.pushChanges();
                    if (pushResult.success) {
                        await this.triggerDeployment();
                    }
                }
                
                return {
                    success: true,
                    changes: true,
                    modules: changedModules.length,
                    improvements: changedModules.reduce((sum, mod) => sum + mod.improvements.length, 0)
                };
            }
            
            console.log(`[${new Date().toISOString()}] No improvements applied in this cycle`);
            return { success: true, changes: false };
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Engineering cycle failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async startPipeline() {
        console.log(`[${new Date().toISOString()}] Starting continuous pipeline mode`);
        
        const runCycle = async () => {
            try {
                const result = await this.executeEngineeringCycle();
                if (result.changes) {
                    console.log(`[${new Date().toISOString()}] Cycle completed with ${result.improvements} improvements across ${result.modules} modules`);
                }
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Pipeline cycle error:`, error.message);
            }
        };
        
        await runCycle();
        setInterval(runCycle, this.scanInterval);
    }

    initializeAnalyzers() {
        return [
            {
                name: 'security-analyzer',
                analyze: async (code, module) => {
                    const issues = [];
                    const improvements = [];
                    
                    if (code.includes('eval(') || code.includes('Function(')) {
                        issues.push({
                            type: 'security',
                            severity: 'critical',
                            description: 'Dangerous eval usage detected',
                            line: this.findLineNumber(code, /eval\(|Function\(/)
                        });
                    }
                    
                    if (code.includes('process.env') && !code.includes('dotenv')) {
                        improvements.push({
                            type: 'security-env',
                            priority: 'high',
                            description: 'Add environment variable validation',
                            suggestion: 'Implement proper environment variable handling'
                        });
                    }
                    
                    return { issues, improvements };
                }
            },
            {
                name: 'error-handling-analyzer',
                analyze: async (code, module) => {
                    const issues = [];
                    const improvements = [];
                    
                    const asyncFunctions = code.match(/async\s+function\s+\w+/g) || [];
                    const tryBlocks = code.match(/try\s*{/g) || [];
                    
                    if (asyncFunctions.length > tryBlocks.length) {
                        improvements.push({
                            type: 'error-handling',
                            priority: 'high',
                            description: 'Add try-catch blocks to async functions',
                            suggestion: 'Wrap async operations in proper error handling'
                        });
                    }
                    
                    return { issues, improvements };
                }
            },
            {
                name: 'performance-analyzer',
                analyze: async (code, module) => {
                    const issues = [];
                    const improvements = [];
                    
                    if (code.includes('for (') && code.includes('.push(')) {
                        improvements.push({
                            type: 'performance-optimization',
                            priority: 'medium',
                            description: 'Optimize array operations',
                            suggestion: 'Consider using map/filter/reduce instead of for loops with push'
                        });
                    }
                    
                    if (code.includes('console.log') && !code.includes('debug')) {
                        improvements.push({
                            type: 'logging-improvement',
                            priority: 'low',
                            description: 'Replace console.log with proper logging',
                            suggestion: 'Implement structured logging system'
                        });
                    }
                    
                    return { issues, improvements };
                }
            }
        ];
    }

    initializeStrategies() {
        return [
            {
                type: 'error-handling',
                canApply: (improvement, code) => {
                    return code.includes('async function') && !code.includes('try {');
                },
                apply: async (content, improvement, module) => {
                    const asyncFunctionRegex = /(async\s+function\s+\w+\([^)]*\)\s*{)/g;
                    const modifiedContent = content.replace(asyncFunctionRegex, (match) => {
                        return match + '\n        try {';
                    });
                    
                    if (modifiedContent !== content) {
                        return { success: true, content: modifiedContent };
                    }
                    return { success: false, content };
                }
            },
            {
                type: 'logging-improvement',
                canApply: (improvement, code) => {
                    return code.includes('console.log');
                },
                apply: async (content, improvement, module) => {
                    const loggerImport = "const logger = require('./utils/logger') || console;\n";
                    const modifiedContent = content.replace(/console\.log/g, 'logger.info');
                    
                    if (!content.includes('logger')) {
                        return { 
                            success: true, 
                            content: loggerImport + modifiedContent 
                        };
                    }
                    return { success: false, content };
                }
            }
        ];
    }

    findLineNumber(code, pattern) {
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
                return i + 1;
            }
        }
        return null;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const pipelineMode = args.includes('--pipeline');
    const interval = args.includes('--interval') ? 
        parseInt(args[args.indexOf('--interval') + 1]) * 1000 : 300000;
    
    const engineer = new GhostlineEngineer({
        pipeline: pipelineMode,
        interval: interval
    });
    
    try {
        await engineer.initialize();
        
        if (pipelineMode) {
            await engineer.startPipeline();
        } else {
            const result = await engineer.executeEngineeringCycle();
            console.log(`[${new Date().toISOString()}] Engineering cycle completed:`, result);
            process.exit(result.success ? 0 : 1);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Fatal error:`, error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = GhostlineEngineer;
