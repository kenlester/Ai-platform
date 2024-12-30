#!/bin/bash

LOG_DIR="/root/Ai-platform/data/metrics/container_stats"
mkdir -p $LOG_DIR

while true; do
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Collect stats for each container
    for ct in 200 201 202 203; do
        pct exec $ct -- bash -c '
            cpu=$(top -bn1 | grep "Cpu(s)" | awk "{print \$2 + \$4}")
            mem=$(free | grep Mem | awk "{print \$3/\$2 * 100.0}")
            echo "{\"timestamp\": \"'$timestamp'\", \"cpu\": $cpu, \"memory\": $mem}"
        ' > "$LOG_DIR/ct${ct}_stats.json"
    done
    
    sleep 60
done
