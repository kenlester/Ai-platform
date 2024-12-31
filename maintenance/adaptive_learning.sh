#!/bin/bash

# Adaptive Learning Rate Management Script
# Implements dynamic learning rates, self-adjusting thresholds, and pattern importance weighting

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Base directories
BASE_DIR="/root/Ai-platform"
METRICS_DIR="${BASE_DIR}/data/metrics"
CONFIG_DIR="${BASE_DIR}/config"
BACKUP_DIR="${BASE_DIR}/backups/configs/$(date +%Y%m%d_%H%M%S)"

# Logging
LOG_FILE="${METRICS_DIR}/logs/adaptive_learning.log"
mkdir -p "${METRICS_DIR}/logs"

log() {
    local level=$1
    shift
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
    echo -e "$message" | tee -a "$LOG_FILE"
}

# Backup current configurations
backup_configs() {
    log "INFO" "Creating configuration backup..."
    mkdir -p "$BACKUP_DIR"
    if [ -d "$METRICS_DIR/evolution_tracking" ]; then
        cp -r "$METRICS_DIR/evolution_tracking" "$BACKUP_DIR/" || true
    fi
    log "INFO" "Backup created at $BACKUP_DIR"
}

# Calculate dynamic learning rate based on pattern confidence
calculate_learning_rate() {
    local confidence=$1
    local base_rate=0.1
    
    # Adjust rate based on confidence (0.5-1.0 range)
    if (( $(echo "$confidence > 0.9" | bc -l) )); then
        echo "0.05"  # Lower rate for high confidence
    elif (( $(echo "$confidence > 0.8" | bc -l) )); then
        echo "0.1"   # Base rate for good confidence
    elif (( $(echo "$confidence > 0.7" | bc -l) )); then
        echo "0.15"  # Higher rate for lower confidence
    else
        echo "0.2"   # Highest rate for low confidence
    fi
}

# Calculate evolution threshold based on pattern stability
calculate_threshold() {
    local stability=$1
    local base_threshold=0.75
    
    # Adjust threshold based on stability (0.0-1.0 range)
    if (( $(echo "$stability > 0.9" | bc -l) )); then
        echo "0.85"  # Higher threshold for stable patterns
    elif (( $(echo "$stability > 0.7" | bc -l) )); then
        echo "0.75"  # Base threshold for moderate stability
    else
        echo "0.65"  # Lower threshold for unstable patterns
    fi
}

# Calculate pattern importance weight
calculate_importance() {
    local frequency=$1
    local accuracy=$2
    local age=$3
    
    # Weighted combination of factors
    echo "scale=4; ($frequency * 0.4) + ($accuracy * 0.4) + ($age * 0.2)" | bc
}

# Update evolution configuration with dynamic parameters
update_evolution_config() {
    local confidence=$1
    local stability=$2
    local importance=$3
    
    # Calculate dynamic parameters
    local learning_rate=$(calculate_learning_rate "$confidence")
    local threshold=$(calculate_threshold "$stability")
    
    # Create new configuration
    local config='{
        "evolution_params": {
            "learning_rate": '"$learning_rate"',
            "pattern_retention": 48,
            "evolution_threshold": '"$threshold"',
            "optimization_interval": 300,
            "dynamic_adjustment": true
        },
        "pattern_learning": {
            "enabled": true,
            "min_confidence": 0.85,
            "batch_size": 300,
            "importance_weight": '"$importance"'
        },
        "adaptive_config": {
            "confidence_factor": '"$confidence"',
            "stability_factor": '"$stability"',
            "importance_factor": '"$importance"',
            "last_updated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
        }
    }'
    
    # Validate and save configuration
    if echo "$config" | jq . >/dev/null 2>&1; then
        mkdir -p "${METRICS_DIR}/evolution_tracking"
        echo "$config" > "${METRICS_DIR}/evolution_tracking/config.json"
        log "INFO" "Evolution configuration updated with dynamic parameters"
        return 0
    else
        log "ERROR" "Invalid configuration generated"
        return 1
    fi
}

# Monitor and adjust learning parameters
monitor_learning() {
    log "INFO" "Monitoring learning parameters..."
    
    # Read current metrics
    local current_metrics="${METRICS_DIR}/pattern_stats/pattern_stats.txt"
    if [ ! -f "$current_metrics" ]; then
        log "ERROR" "Pattern statistics not found"
        return 1
    fi
    
    # Calculate current metrics (last 10 minutes)
    local confidence=$(tail -n 60 "$current_metrics" | awk '{ sum += $2 } END { print sum/NR }')
    local stability=$(tail -n 60 "$current_metrics" | awk '
        BEGIN { sum = 0; count = 0 }
        NR > 1 {
            diff = $2 - prev
            sum += (diff * diff)
            count++
        }
        { prev = $2 }
        END {
            if (count > 0) print 1 - sqrt(sum/count)
            else print 0.5
        }
    ')
    
    # Calculate pattern age factor (0.0-1.0)
    local age_factor=$(echo "scale=4; $(date +%s) - $(stat -c %Y "$current_metrics")" | bc)
    age_factor=$(echo "scale=4; if($age_factor > 86400) print 1.0 else print $age_factor/86400" | bc)
    
    # Calculate importance
    local importance=$(calculate_importance "0.8" "$confidence" "$age_factor")
    
    # Update configuration with new parameters
    if ! update_evolution_config "$confidence" "$stability" "$importance"; then
        log "ERROR" "Failed to update evolution configuration"
        return 1
    fi
    
    log "INFO" "Learning parameters updated:"
    log "INFO" "Confidence: $confidence"
    log "INFO" "Stability: $stability"
    log "INFO" "Importance: $importance"
}

# Main execution
main() {
    log "INFO" "Starting Adaptive Learning System..."
    
    # Create backup
    backup_configs
    
    # Initialize monitoring
    monitor_learning
    
    log "SUCCESS" "Adaptive Learning System initialized"
    log "INFO" "Monitor results in ${METRICS_DIR}/evolution_tracking/config.json"
}

# Run main function with error handling
{
    main
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
