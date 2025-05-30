# Ghostline Revenue System V4.0

Advanced Multi-Platform Revenue Generation System with Enhanced Security Features

## 🚀 Features

### Core Modules
- **🌾 HarvesterCore**: Multi-platform task execution (Microworkers, Clickworker, Spare5)
- **💎 MnemonicValidator**: Secure wallet recovery and validation system
- **🔍 LostWalletAnalyzer**: Advanced blockchain analysis for abandoned wallets
- **🤖 TelegramInterface**: Real-time control and monitoring via Telegram

### Security Features
- **🔒 Enhanced Encryption**: AES-256-GCM encryption for sensitive data
- **🛡️ Security Manager**: Comprehensive security validation and monitoring
- **🚨 Threat Detection**: Suspicious activity monitoring and blocking
- **📊 Security Scoring**: Real-time security health assessment
- **🔐 Secure Storage**: Encrypted storage for API keys and discoveries

### Advanced Capabilities
- **📈 Real-time Metrics**: Live performance monitoring and analytics
- **💰 Auto-Withdrawal**: Secure automatic withdrawal to configured address
- **🔄 Rate Limiting**: Intelligent API rate limiting and queue management
- **🎯 Smart Prioritization**: AI-driven task and analysis prioritization
- **📱 Mobile Control**: Full system control via Telegram interface

## 🛠️ Installation

### Prerequisites
- Node.js 16.0.0 or higher
- Telegram Bot Token (from @BotFather)
- API keys for desired platforms (optional)

### Quick Setup

1. **Clone and Install**
```bash
git clone https://github.com/ghostline/revenue-system.git
cd revenue-system
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the System**
```bash
# Development mode
npm run dev

# Production mode
npm run prod
```

## ⚙️ Configuration

### Required Settings
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Optional Platform APIs
```env
MICROWORKERS_API_KEY=your_key
CLICKWORKER_API_KEY=your_key
SPARE5_API_KEY=your_key
ETHERSCAN_API_KEY=your_key
ALCHEMY_API_KEY=your_key
```

### Security Settings
```env
WITHDRAWAL_ADDRESS=0x742d35Cc6663C747049fdB5F3C00F0D3a67d8829
WITHDRAWAL_THRESHOLD=0.01
ENABLE_SECURITY_LOGGING=true
```

## 🎮 Telegram Commands

### Basic Commands
- `/start` - Main control panel
- `/menu` - Navigation menu
- `/status` - System status
- `/metrics` - Performance metrics
- `/security` - Security dashboard
- `/help` - Command help

### Advanced Commands
- `/emergency` - Emergency stop (requires confirmation)
- `/logs` - Log statistics
- Security reports and analysis

## 📊 System Architecture

```
main.js (Entry Point)
├── utils/
│   ├── SecurityManager.js    # Encryption & security
│   ├── Logger.js            # Secure logging
│   ├── Config.js            # Configuration management
│   └── index.js             # Utils export
└── modules/
    ├── TelegramInterface.js  # Bot interface
    ├── HarvesterCore.js     # Task harvesting
    ├── MnemonicValidator.js # Wallet validation
    └── LostWalletAnalyzer.js # Blockchain analysis
```

## 🔒 Security Features

### Data Protection
- **AES-256-GCM Encryption**: All sensitive data encrypted at rest
- **Key Rotation**: Automatic encryption key rotation
- **Secure Storage**: API keys stored in encrypted format
- **Memory Protection**: Sensitive data cleared from memory

### Access Control
- **Telegram Authentication**: Only authorized users can control system
- **Command Validation**: All commands validated before execution
- **Rate Limiting**: Protection against abuse and spam
- **Audit Logging**: Complete audit trail of all operations

### Threat Detection
- **Suspicious Pattern Detection**: AI-powered threat detection
- **Anomaly Detection**: Unusual activity monitoring
- **Security Scoring**: Real-time security health assessment
- **Automatic Blocking**: Suspicious addresses automatically blocked

## 📈 Performance Metrics

### Real-time Monitoring
- Task completion rates and earnings
- Security events and violations
- API response times and error rates
- Memory usage and system health

### Business Intelligence
- Revenue per hour/day/month
- Platform performance comparison
- Discovery success rates
- Security incident analysis

## 🛡️ Production Deployment

### Security Checklist
- [ ] Change all default API keys
- [ ] Configure secure withdrawal address
- [ ] Enable security logging
- [ ] Set up secure backup procedures
- [ ] Configure monitoring alerts
- [ ] Review security policies

### Performance Optimization
- [ ] Configure rate limits per platform
- [ ] Optimize batch sizes for analysis
- [ ] Set appropriate scan intervals
- [ ] Configure memory limits

## 📋 Maintenance

### Log Management
```bash
# Clean old logs
npm run clean-logs

# Backup configuration
npm run backup-config

# Security check
npm run security-check
```

### Monitoring
- Monitor log files in `./logs/` directory
- Check `security-events.json` for security incidents
- Review `business-*.json` for transaction logs
- Monitor system metrics via Telegram

## ⚠️ Important Notes

### Legal Compliance
- Ensure compliance with local laws regarding cryptocurrency
- Review platform terms of service
- Implement proper tax reporting procedures
- Consider regulatory requirements

### Security Best Practices
- Never share API keys or bot tokens
- Use strong withdrawal addresses
- Monitor security events regularly
- Keep system updated
- Backup encryption keys securely

### Ethical Considerations
- Respect platform terms of service
- Use reasonable rate limits
- Don't abuse discovery systems
- Consider privacy implications

## 🆘 Troubleshooting

### Common Issues

**Bot not responding**
- Check TELEGRAM_BOT_TOKEN validity
- Verify TELEGRAM_CHAT_ID is correct
- Check network connectivity

**Platform connection failed**
- Verify API keys are correct
- Check rate limit settings
- Review platform status

**Security warnings**
- Check withdrawal address format
- Review suspicious activity logs
- Verify encryption key integrity

**High memory usage**
- Reduce batch sizes
- Clear cache more frequently
- Restart system if needed

### Support
- Check logs in `./logs/` directory
- Review security events
- Monitor Telegram notifications
- Use `/help` command for guidance

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Implement security best practices
4. Add comprehensive tests
5. Submit pull request

---

**⚠️ Disclaimer**: This software is for educational purposes. Users are responsible for compliance with applicable laws and platform terms of service. Use at your own risk.
