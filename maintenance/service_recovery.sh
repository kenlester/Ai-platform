#!/bin/bash

# Automated service recovery script for AI Platform

LOG_FILE="/var/log/ai-platform-recovery.log"
DB_FILE="/opt/ai_platform/failure_learning.db"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_and_recover_service() {
    local ct_id=$1
    local service=$2
    local status

    # Check service status
    status=$(pct exec $ct_id -- systemctl is-active $service 2>/dev/null)
    
    if [ "$status" != "active" ]; then
        log "Service $service in CT$ct_id is $status. Attempting recovery..."
        
        # Restart service
        pct exec $ct_id -- systemctl restart $service
        sleep 5
        
        # Verify recovery
        status=$(pct exec $ct_id -- systemctl is-active $service 2>/dev/null)
        
        if [ "$status" = "active" ]; then
            log "Successfully recovered $service in CT$ct_id"
            # Record successful recovery
            sqlite3 "$DB_FILE" "INSERT INTO failure_events (service, error_type, recovery_success) VALUES ('$service', 'service_inactive', 1);"
            return 0
        else
            log "Failed to recover $service in CT$ct_id"
            # Record failed recovery
            sqlite3 "$DB_FILE" "INSERT INTO failure_events (service, error_type, recovery_success) VALUES ('$service', 'service_inactive', 0);"
            return 1
        fi
    fi
}

# Check Neural Engine (CT200)
check_and_recover_service 200 "ollama"

# Check Vector Storage (CT201)
check_and_recover_service 201 "qdrant"

# Check Protocol Matrix (CT203)
check_and_recover_service 203 "mcp"

# Update recovery statistics
sqlite3 "$DB_FILE" "UPDATE failure_predictions SET was_correct = 1 WHERE service IN ('ollama', 'qdrant', 'mcp') AND predicted_time < datetime('now');"
