#!/bin/bash

# Unified Pattern Learning System
# Implements cross-container pattern learning, distributed evolution, and state synchronization

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Base directories
BASE_DIR="/root/Ai-platform"
METRICS_DIR="${BASE_DIR}/data/metrics"
SYNC_DIR="${METRICS_DIR}/pattern_sync"
BACKUP_DIR="${BASE_DIR}/backups/configs/$(date +%Y%m%d_%H%M%S)"

# Container IDs
CONTAINERS=(201 203 204)

# Logging
LOG_FILE="${METRICS_DIR}/logs/unified_learning.log"
mkdir -p "${METRICS_DIR}/logs"

log() {
    local level=$1
    shift
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
    echo -e "$message" | tee -a "$LOG_FILE"
}

# Initialize sync directory structure
init_sync_directory() {
    log "INFO" "Initializing sync directory structure..."
    
    mkdir -p "${SYNC_DIR}"
    for container in "${CONTAINERS[@]}"; do
        mkdir -p "${SYNC_DIR}/ct${container}"
        mkdir -p "${SYNC_DIR}/ct${container}/patterns"
        mkdir -p "${SYNC_DIR}/ct${container}/state"
    done
}

# Verify container connectivity
verify_containers() {
    log "INFO" "Verifying container connectivity..."
    
    local failed=0
    for container in "${CONTAINERS[@]}"; do
        if ! pct status $container >/dev/null 2>&1; then
            log "ERROR" "Container CT${container} not accessible"
            failed=1
        fi
    done
    
    return $failed
}

# Initialize Redis for pattern sharing
init_redis_sharing() {
    log "INFO" "Initializing Redis for pattern sharing..."
    
    # Configure Redis in CT201 (Vector Storage)
    if ! pct exec 201 -- bash -c '
        redis-cli CONFIG SET notify-keyspace-events "KEA"
        redis-cli CONFIG SET maxmemory "2gb"
        redis-cli CONFIG SET maxmemory-policy "allkeys-lru"
    '; then
        log "ERROR" "Failed to configure Redis in CT201"
        return 1
    fi
    
    # Configure Redis in CT203 (Protocol Matrix)
    if ! pct exec 203 -- bash -c '
        redis-cli CONFIG SET notify-keyspace-events "KEA"
        redis-cli CONFIG SET maxmemory "1gb"
        redis-cli CONFIG SET maxmemory-policy "volatile-lru"
    '; then
        log "ERROR" "Failed to configure Redis in CT203"
        return 1
    fi
}

# Setup pattern distribution
setup_pattern_distribution() {
    log "INFO" "Setting up pattern distribution..."
    
    local config='{
        "pattern_distribution": {
            "enabled": true,
            "sync_interval": 60,
            "batch_size": 100,
            "priority_levels": 3
        },
        "containers": {
            "ct201": {
                "role": "pattern_storage",
                "priority": 1,
                "sync_enabled": true
            },
            "ct203": {
                "role": "protocol_matrix",
                "priority": 2,
                "sync_enabled": true
            },
            "ct204": {
                "role": "evolution_engine",
                "priority": 1,
                "sync_enabled": true
            }
        }
    }'
    
    echo "$config" > "${SYNC_DIR}/distribution_config.json"
}

# Configure state synchronization
setup_state_sync() {
    log "INFO" "Configuring state synchronization..."
    
    local config='{
        "state_sync": {
            "enabled": true,
            "sync_interval": 30,
            "sync_strategy": "incremental",
            "conflict_resolution": "timestamp_based"
        },
        "sync_paths": {
            "patterns": "/root/ai-platform/metrics/pattern_sync",
            "evolution": "/root/ai-platform/metrics/evolution_tracking",
            "learning": "/root/ai-platform/metrics/pattern_learning"
        }
    }'
    
    echo "$config" > "${SYNC_DIR}/sync_config.json"
}

# Initialize pattern sharing across containers
init_pattern_sharing() {
    log "INFO" "Initializing pattern sharing..."
    
    for container in "${CONTAINERS[@]}"; do
        # Create pattern sharing directory in container
        if ! pct exec $container -- bash -c "
            mkdir -p /root/ai-platform/metrics/pattern_sync
            chmod 755 /root/ai-platform/metrics/pattern_sync
        "; then
            log "ERROR" "Failed to initialize pattern sharing in CT${container}"
            return 1
        fi
        
        # Initialize pattern tracking
        local tracking_config='{
            "pattern_tracking": {
                "enabled": true,
                "container_id": '"$container"',
                "sync_enabled": true,
                "tracking_interval": 60
            }
        }'
        
        echo "$tracking_config" > "${SYNC_DIR}/ct${container}/tracking_config.json"
    done
}

# Setup distributed evolution
setup_distributed_evolution() {
    log "INFO" "Setting up distributed evolution..."
    
    local config='{
        "distributed_evolution": {
            "enabled": true,
            "coordination_strategy": "leader_follower",
            "evolution_interval": 300,
            "sync_threshold": 0.85
        },
        "evolution_roles": {
            "ct201": {
                "role": "pattern_validator",
                "priority": 2
            },
            "ct203": {
                "role": "state_coordinator",
                "priority": 1
            },
            "ct204": {
                "role": "evolution_leader",
                "priority": 1
            }
        }
    }'
    
    echo "$config" > "${SYNC_DIR}/evolution_config.json"
}

# Initialize learning state synchronization
init_learning_sync() {
    log "INFO" "Initializing learning state synchronization..."
    
    local config='{
        "learning_sync": {
            "enabled": true,
            "sync_mode": "real_time",
            "batch_sync_size": 50,
            "sync_interval": 30
        },
        "state_management": {
            "persistence_enabled": true,
            "conflict_resolution": "version_based",
            "state_validation": true
        }
    }'
    
    echo "$config" > "${SYNC_DIR}/learning_sync_config.json"
}

# Update container configurations
update_container_configs() {
    log "INFO" "Updating container configurations..."
    
    for container in "${CONTAINERS[@]}"; do
        local container_config='{
            "sync_enabled": true,
            "container_id": '"$container"',
            "sync_interval": 60,
            "pattern_sharing": {
                "enabled": true,
                "auto_sync": true
            },
            "state_sync": {
                "enabled": true,
                "mode": "real_time"
            }
        }'
        
        echo "$container_config" > "${SYNC_DIR}/ct${container}/config.json"
    done
}

# Main execution
main() {
    log "INFO" "Starting Unified Pattern Learning System..."
    
    # Verify containers
    if ! verify_containers; then
        log "ERROR" "Container verification failed"
        exit 1
    fi
    
    # Initialize directories
    init_sync_directory
    
    # Initialize Redis sharing
    if ! init_redis_sharing; then
        log "ERROR" "Failed to initialize Redis sharing"
        exit 1
    fi
    
    # Setup components
    setup_pattern_distribution
    setup_state_sync
    init_pattern_sharing
    setup_distributed_evolution
    init_learning_sync
    update_container_configs
    
    log "SUCCESS" "Unified Pattern Learning System initialized"
    log "INFO" "Monitor synchronization in ${SYNC_DIR}"
}

# Run main function with error handling
{
    main
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
