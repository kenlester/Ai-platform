#!/bin/bash

# AI Platform Automation Setup
# Version: 2.1.0
# Date: 2024-01-01
# Component: Resource

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Setting up AI Platform Automation...${NC}"

# Make scripts executable
chmod_scripts() {
    echo -e "\n${YELLOW}Making maintenance scripts executable...${NC}"
    chmod +x maintenance/*.sh
}

# Setup cron jobs
setup_cron() {
    echo -e "\n${YELLOW}Setting up cron jobs...${NC}"
    
    # Create cron file
    cat > /tmp/ai_platform_cron << EOF
# AI Platform Automation
# Version: 2.1.0
# Last Updated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

# Evolution Recording (Every hour)
0 * * * * cd /root/Ai-platform && ./maintenance/record_evolution.sh >> /var/log/ai-platform/evolution.log 2>&1

# Daily Backup (Every day at 00:00 UTC)
0 0 * * * cd /root/Ai-platform && ./maintenance/backup_system.sh >> /var/log/ai-platform/backup.log 2>&1

# Weekly Full Backup (Every Sunday at 00:00 UTC)
0 0 * * 0 cd /root/Ai-platform && ./maintenance/backup_system.sh --full >> /var/log/ai-platform/backup.log 2>&1

# Version Report (Every day at 01:00 UTC)
0 1 * * * cd /root/Ai-platform && ./maintenance/version_report.sh >> /var/log/ai-platform/version.log 2>&1

# Pattern Analysis (Every 6 hours)
0 */6 * * * cd /root/Ai-platform && ./maintenance/analyze_patterns.sh >> /var/log/ai-platform/patterns.log 2>&1

# Cleanup Old Data (Every day at 02:00 UTC)
0 2 * * * cd /root/Ai-platform && find /root/Ai-platform/data/evolution -type d -mtime +30 -exec rm -rf {} \; >> /var/log/ai-platform/cleanup.log 2>&1
EOF

    # Install new cron file
    crontab /tmp/ai_platform_cron
    rm /tmp/ai_platform_cron
}

# Setup log directories
setup_logs() {
    echo -e "\n${YELLOW}Setting up log directories...${NC}"
    
    # Create log directory
    mkdir -p /var/log/ai-platform
    
    # Create log files
    touch /var/log/ai-platform/{evolution,backup,version,patterns,cleanup}.log
    
    # Set permissions
    chmod 644 /var/log/ai-platform/*.log
    
    # Setup log rotation
    cat > /etc/logrotate.d/ai-platform << EOF
/var/log/ai-platform/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        systemctl restart rsyslog >/dev/null 2>&1 || true
    endscript
}
EOF
}

# Setup monitoring
setup_monitoring() {
    echo -e "\n${YELLOW}Setting up monitoring...${NC}"
    
    # Create monitoring script
    cat > /root/Ai-platform/maintenance/monitor_automation.sh << EOF
#!/bin/bash

# Check cron service
if ! systemctl is-active cron > /dev/null; then
    echo "ERROR: Cron service is not running"
    systemctl restart cron
fi

# Check log files
for log in evolution backup version patterns cleanup; do
    if [ ! -f "/var/log/ai-platform/\${log}.log" ]; then
        echo "ERROR: \${log}.log is missing"
        touch "/var/log/ai-platform/\${log}.log"
        chmod 644 "/var/log/ai-platform/\${log}.log"
    fi
done

# Check script permissions
for script in /root/Ai-platform/maintenance/*.sh; do
    if [ ! -x "\${script}" ]; then
        echo "ERROR: \${script} is not executable"
        chmod +x "\${script}"
    fi
done

# Report status
echo "Automation monitoring complete at \$(date -u)"
EOF
    
    chmod +x /root/Ai-platform/maintenance/monitor_automation.sh
    
    # Add monitoring to cron
    echo "*/15 * * * * /root/Ai-platform/maintenance/monitor_automation.sh >> /var/log/ai-platform/monitoring.log 2>&1" | crontab -
}

# Create status report
create_status() {
    echo -e "\n${YELLOW}Creating automation status report...${NC}"
    
    cat > /root/Ai-platform/AUTOMATION_STATUS.md << EOF
# AI Platform Automation Status

## Version: 2.1.0
## Last Updated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

### Automated Tasks
- Evolution Recording (Hourly)
- System Backup (Daily)
- Full System Backup (Weekly)
- Version Reporting (Daily)
- Pattern Analysis (Every 6 hours)
- Data Cleanup (Daily)
- Automation Monitoring (Every 15 minutes)

### Log Files
- /var/log/ai-platform/evolution.log
- /var/log/ai-platform/backup.log
- /var/log/ai-platform/version.log
- /var/log/ai-platform/patterns.log
- /var/log/ai-platform/cleanup.log
- /var/log/ai-platform/monitoring.log

### Maintenance Scripts
$(ls -1 /root/Ai-platform/maintenance/*.sh)

### Cron Status
$(systemctl status cron | grep Active)

### Log Rotation
Configured in /etc/logrotate.d/ai-platform
- Daily rotation
- 30 days retention
- Compressed archives
EOF
}

# Main execution
main() {
    # Make scripts executable
    chmod_scripts
    
    # Setup cron jobs
    setup_cron
    
    # Setup logging
    setup_logs
    
    # Setup monitoring
    setup_monitoring
    
    # Create status report
    create_status
    
    echo -e "\n${GREEN}Automation Setup Complete!${NC}"
    echo -e "Status report available at: /root/Ai-platform/AUTOMATION_STATUS.md"
}

# Run main function
main
