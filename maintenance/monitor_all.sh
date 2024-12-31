#!/bin/bash

LOG_DIR="/root/Ai-platform/data/metrics/container_stats"
mkdir -p $LOG_DIR

echo "Starting neural pattern monitoring..."
echo "Monitoring containers: 200 (Neural Engine) 201 (Pattern Storage) 202 (Evolution Unit) 203 (Protocol Matrix)"

monitor_container() {
    local ct=$1
    local stats_file="$LOG_DIR/ct${ct}_stats.json"
    local history_file="$LOG_DIR/ct${ct}_history.jsonl"
    
    # Check if container exists and is running
    if ! pct status $ct >/dev/null 2>&1; then
        echo "{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"container_id\":$ct,\"status\":\"unavailable\",\"memory\":{\"total_mb\":0,\"used_mb\":0,\"percent\":0},\"cpu_percent\":0}" > "$stats_file"
        return 0
    fi
    
    # Collect basic stats
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local stats=$(pct exec $ct -- bash -c '
        cpu_percent=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk "{print 100 - \$1}")
        total_mem=$(free -m | awk "/Mem:/ {print \$2}")
        used_mem=$(free -m | awk "/Mem:/ {print \$3}")
        mem_percent=$(free | awk "/Mem:/ {print \$3/\$2 * 100}")
        echo "{\"timestamp\":\"'$timestamp'\",\"container_id\":'$ct',\"status\":\"running\",\"memory\":{\"total_mb\":$total_mem,\"used_mb\":$used_mem,\"percent\":$mem_percent},\"cpu_percent\":$cpu_percent}"
    ' 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$stats" ]; then
        echo "$stats" > "$stats_file"
        echo "$stats" >> "$history_file"
    else
        echo "Warning: Failed to collect stats for container $ct"
    fi
}

# Main monitoring loop
while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Updating pattern states"
    
    # Monitor each container
    for ct in 200 201 202 203 204; do
        monitor_container $ct &
    done
    wait
    
    # Generate summary
    echo "{
        \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
        \"containers\": {" > "$LOG_DIR/summary.json"
    
    first=true
    for ct in 200 201 202 203 204; do
        if [ -f "$LOG_DIR/ct${ct}_stats.json" ]; then
            if ! $first; then
                echo "," >> "$LOG_DIR/summary.json"
            fi
            first=false
            echo "        \"$ct\": $(cat "$LOG_DIR/ct${ct}_stats.json")" >> "$LOG_DIR/summary.json"
        fi
    done
    
    echo "    }
}" >> "$LOG_DIR/summary.json"

    echo "Neural matrix saved to: $LOG_DIR/summary.json"
    sleep 60
done
