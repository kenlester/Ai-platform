#!/bin/bash

# AI Platform Backup System
# Version: 2.1.0
# Date: 2024-01-01
# Component: Resource

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BACKUP_ROOT="/root/Ai-platform/backups"
VERSION="2.1.0"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}_v${VERSION}"

echo -e "${GREEN}Starting AI Platform Backup...${NC}"

# Create backup directories
create_dirs() {
    echo -e "\n${YELLOW}Creating backup structure...${NC}"
    mkdir -p "${BACKUP_DIR}"/{system,metrics,evolution,config}
}

# Backup system configuration
backup_config() {
    echo -e "\n${YELLOW}Backing up system configuration...${NC}"
    
    # Container configurations
    pct exec 203 -- bash -c '
        # Redis config
        cp /etc/redis/redis.conf /root/redis.conf
        # Pattern monitor config
        cp /etc/systemd/system/pattern-monitor.service /root/pattern-monitor.service
    '
    
    # Copy configs from container
    pct pull 203 /root/redis.conf "${BACKUP_DIR}/config/redis.conf"
    pct pull 203 /root/pattern-monitor.service "${BACKUP_DIR}/config/pattern-monitor.service"
    
    # Backup maintenance scripts
    cp maintenance/*.sh "${BACKUP_DIR}/system/"
    
    echo "Configuration backup complete"
}

# Backup evolution data
backup_evolution() {
    echo -e "\n${YELLOW}Backing up evolution data...${NC}"
    
    # Create evolution backup structure
    mkdir -p "${BACKUP_DIR}/evolution"/{patterns,metrics,reports}
    
    # Backup pattern stats
    pct exec 203 -- bash -c '
        cd /root/ai-platform/metrics/pattern_stats/
        tar czf /root/pattern_stats.tar.gz *
    '
    pct pull 203 /root/pattern_stats.tar.gz "${BACKUP_DIR}/evolution/patterns/"
    
    # Backup evolution metrics
    pct exec 203 -- bash -c '
        redis-cli SAVE
        cp /var/lib/redis/dump.rdb /root/redis_dump.rdb
    '
    pct pull 203 /root/redis_dump.rdb "${BACKUP_DIR}/evolution/metrics/"
    
    echo "Evolution data backup complete"
}

# Backup metrics data
backup_metrics() {
    echo -e "\n${YELLOW}Backing up metrics data...${NC}"
    
    # Create metrics backup structure
    mkdir -p "${BACKUP_DIR}/metrics"/{performance,analysis}
    
    # Export current metrics
    pct exec 203 -- bash -c '
        redis-cli --raw dump evolution_metrics > /root/evolution_metrics.dump
        redis-cli --raw dump optimization_config > /root/optimization_config.dump
        redis-cli --raw dump flow_config > /root/flow_config.dump
    '
    
    # Pull metric dumps
    pct pull 203 /root/evolution_metrics.dump "${BACKUP_DIR}/metrics/performance/"
    pct pull 203 /root/optimization_config.dump "${BACKUP_DIR}/metrics/performance/"
    pct pull 203 /root/flow_config.dump "${BACKUP_DIR}/metrics/performance/"
    
    echo "Metrics backup complete"
}

# Create backup manifest
create_manifest() {
    echo -e "\n${YELLOW}Creating backup manifest...${NC}"
    
    cat > "${BACKUP_DIR}/MANIFEST.json" << EOF
{
    "backup_info": {
        "version": "${VERSION}",
        "timestamp": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
        "type": "full_system"
    },
    "components": {
        "system": {
            "scripts": "$(ls -1 ${BACKUP_DIR}/system/)",
            "config": "$(ls -1 ${BACKUP_DIR}/config/)"
        },
        "evolution": {
            "patterns": "$(ls -1 ${BACKUP_DIR}/evolution/patterns/)",
            "metrics": "$(ls -1 ${BACKUP_DIR}/evolution/metrics/)"
        },
        "metrics": {
            "performance": "$(ls -1 ${BACKUP_DIR}/metrics/performance/)"
        }
    },
    "container_states": {
        "ct200": "$(pct status 200)",
        "ct201": "$(pct status 201)",
        "ct202": "$(pct status 202)",
        "ct203": "$(pct status 203)"
    }
}
EOF
}

# Cleanup old backups
cleanup_old() {
    echo -e "\n${YELLOW}Cleaning up old backups...${NC}"
    
    # Keep last 4 weekly backups
    cd "${BACKUP_ROOT}"
    ls -1t | tail -n +5 | xargs -r rm -rf
    
    echo "Cleanup complete"
}

# Main execution
main() {
    # Create backup structure
    create_dirs
    
    # Perform backups
    backup_config
    backup_evolution
    backup_metrics
    
    # Create manifest
    create_manifest
    
    # Cleanup old backups
    cleanup_old
    
    echo -e "\n${GREEN}Backup Complete!${NC}"
    echo -e "Backup location: ${BACKUP_DIR}"
}

# Run main function
main
