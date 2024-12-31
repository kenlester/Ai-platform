#!/bin/bash

# Resource optimization script for AI Platform

LOG_FILE="/var/log/ai-platform-optimization.log"
STATS_DIR="/root/Ai-platform/data/metrics/container_stats"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

optimize_container() {
    local ct_id=$1
    local min_memory=$2
    local max_memory=$3
    local stats_file="$STATS_DIR/ct${ct_id}_stats.json"
    
    # Get current memory usage
    local used_mb=$(jq -r '.memory.used_mb' "$stats_file")
    local total_mb=$(jq -r '.memory.total_mb' "$stats_file")
    local cpu_percent=$(jq -r '.cpu_percent' "$stats_file")
    
    # Calculate optimal memory
    local memory_percent=$((used_mb * 100 / total_mb))
    
    if [ $memory_percent -lt 20 ] && [ $total_mb -gt $min_memory ]; then
        # Reduce memory if usage is low
        local new_memory=$((total_mb * 8 / 10))
        if [ $new_memory -ge $min_memory ]; then
            log "CT$ct_id: Reducing memory from ${total_mb}MB to ${new_memory}MB (usage: ${memory_percent}%)"
            pct set $ct_id --memory $new_memory
        fi
    elif [ $memory_percent -gt 80 ] && [ $total_mb -lt $max_memory ]; then
        # Increase memory if usage is high
        local new_memory=$((total_mb * 12 / 10))
        if [ $new_memory -le $max_memory ]; then
            log "CT$ct_id: Increasing memory from ${total_mb}MB to ${new_memory}MB (usage: ${memory_percent}%)"
            pct set $ct_id --memory $new_memory
        fi
    fi
    
    # CPU optimization
    if [ $cpu_percent -gt 90 ]; then
        local current_cores=$(pct config $ct_id | grep -oP 'cores: \K\d+')
        local new_cores=$((current_cores + 1))
        log "CT$ct_id: Increasing CPU cores from $current_cores to $new_cores (usage: ${cpu_percent}%)"
        pct set $ct_id --cores $new_cores
    fi
}

# Optimize Neural Engine (CT200)
# Min: 4GB, Max: 16GB (needs more for LLM operations)
optimize_container 200 4096 16384

# Optimize Vector Storage (CT201)
# Min: 2GB, Max: 8GB
optimize_container 201 2048 8192

# Optimize Evolution Unit (CT202)
# Min: 2GB, Max: 8GB
optimize_container 202 2048 8192

# Optimize Protocol Matrix (CT203)
# Min: 1GB, Max: 4GB
optimize_container 203 1024 4096

# Record optimization metrics
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
summary=$(jq -n \
    --arg ts "$timestamp" \
    --arg ct200_mem "$(pct config 200 | grep -oP 'memory: \K\d+')" \
    --arg ct201_mem "$(pct config 201 | grep -oP 'memory: \K\d+')" \
    --arg ct202_mem "$(pct config 202 | grep -oP 'memory: \K\d+')" \
    --arg ct203_mem "$(pct config 203 | grep -oP 'memory: \K\d+')" \
    '{
        timestamp: $ts,
        optimizations: {
            ct200: { memory_mb: ($ct200_mem|tonumber) },
            ct201: { memory_mb: ($ct201_mem|tonumber) },
            ct202: { memory_mb: ($ct202_mem|tonumber) },
            ct203: { memory_mb: ($ct203_mem|tonumber) }
        }
    }')

echo "$summary" > "$STATS_DIR/optimization_history.json"
