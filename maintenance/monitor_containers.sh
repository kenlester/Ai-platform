#!/bin/bash

LOG_DIR="/root/Ai-platform/data/metrics/container_stats"
mkdir -p "$LOG_DIR"

format_json() {
    jq -c '.' | jq '.' 2>/dev/null || echo "{}"
}

check_container_exists() {
    local ct="$1"
    pct status "$ct" &>/dev/null
    return $?
}

collect_container_stats() {
    local ct="$1"
    local timestamp="$2"
    
    # First verify container exists
    if ! check_container_exists "$ct"; then
        return 1
    fi
    
    # Get status without parsing errors
    local status=$(pct status "$ct" 2>/dev/null | grep -oP '(?<=status: )\w+' || echo "unknown")
    
    if [[ $status == "running" ]]; then
        # Memory stats with timeout and error handling
        local mem_info=$(timeout 5s pct exec "$ct" -- free -m 2>/dev/null || echo "0 0 0")
        local total_mem=$(echo "$mem_info" | awk 'NR==2{print $2}' || echo "0")
        local used_mem=$(echo "$mem_info" | awk 'NR==2{print $3}' || echo "0")
        local mem_percent=0
        
        if [[ $total_mem != "0" ]]; then
            mem_percent=$(echo "scale=2; $used_mem * 100 / $total_mem" | bc 2>/dev/null || echo "0")
        fi
        
        # CPU stats with timeout
        local cpu_info=$(timeout 5s pct exec "$ct" -- top -bn1 2>/dev/null | grep "Cpu(s)" || echo "0.0")
        local cpu_percent=$(echo "$cpu_info" | awk -F'[,%]+' '{gsub(/[^0-9.]/, "", $2); print $2}' || echo "0")
        
        # Create JSON with validation
        jq -n \
            --arg ts "$timestamp" \
            --arg id "$ct" \
            --arg tm "${total_mem:-0}" \
            --arg um "${used_mem:-0}" \
            --arg mp "${mem_percent:-0}" \
            --arg cp "${cpu_percent:-0}" \
            '{
                timestamp: $ts,
                container_id: ($id|tonumber),
                status: "running",
                memory: {
                    total_mb: ($tm|tonumber),
                    used_mb: ($um|tonumber),
                    percent: ($mp|tonumber)
                },
                cpu_percent: ($cp|tonumber),
                error: null
            }' | format_json
    else
        # Non-running container stats
        jq -n \
            --arg ts "$timestamp" \
            --arg id "$ct" \
            --arg st "$status" \
            '{
                timestamp: $ts,
                container_id: ($id|tonumber),
                status: $st,
                memory: {
                    total_mb: 0,
                    used_mb: 0,
                    percent: 0
                },
                cpu_percent: 0,
                error: null
            }' | format_json
    fi
}

cleanup() {
    echo "Stopping container monitoring..."
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "Starting container monitoring..."
echo "Monitoring containers: 200, 201, 202, 203"
echo "Log directory: $LOG_DIR"

while true; do
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    containers="200 201 202 203"  # Explicitly define known containers
    
    # Initialize containers object
    containers_json="{}"
    
    # Collect stats for each container
    for ct in $containers; do
        # Get container stats
        stats=$(collect_container_stats "$ct" "$timestamp")
        
        if [[ $? -eq 0 && -n "$stats" ]]; then
            # Save individual stats
            echo "$stats" > "$LOG_DIR/ct${ct}_stats.json"
            echo "$stats" >> "$LOG_DIR/ct${ct}_history.jsonl"
            
            # Add to containers object
            containers_json=$(echo "$containers_json" | jq --arg id "$ct" --argjson stats "$stats" '.[$id] = $stats')
        else
            # Handle failed stat collection
            error_json=$(jq -n \
                --arg ts "$timestamp" \
                --arg id "$ct" \
                '{
                    timestamp: $ts,
                    container_id: ($id|tonumber),
                    status: "error",
                    memory: {
                        total_mb: 0,
                        used_mb: 0,
                        percent: 0
                    },
                    cpu_percent: 0,
                    error: "Failed to collect stats"
                }')
            echo "$error_json" > "$LOG_DIR/ct${ct}_stats.json"
            echo "$error_json" >> "$LOG_DIR/ct${ct}_history.jsonl"
            containers_json=$(echo "$containers_json" | jq --arg id "$ct" --argjson stats "$error_json" '.[$id] = $stats')
        fi
    done
    
    # Create final summary
    summary=$(jq -n \
        --arg ts "$timestamp" \
        --arg log_dir "$LOG_DIR" \
        --argjson containers "$containers_json" \
        '{
            timestamp: $ts,
            containers: $containers,
            meta: {
                monitored_containers: 4,
                log_directory: $log_dir,
                last_update: $ts
            }
        }' | format_json)
    
    echo "$summary" > "$LOG_DIR/summary.json"
    
    # Status output with timestamp
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Updated container stats"
    echo "Summary saved to: $LOG_DIR/summary.json"
    sleep 60
done
