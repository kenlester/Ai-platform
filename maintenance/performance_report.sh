#!/bin/bash

# Performance monitoring and reporting script
# Generates daily performance metrics for the AI Assistant Platform

# Configuration
REPORT_DIR="/root/ai-app-template/reports"
DATE=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/performance_${DATE}.log"

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

# Initialize report
cat << EOF > "$REPORT_FILE"
==============================================
AI Assistant Platform Performance Report
Generated: $(date)
==============================================

EOF

# Function to check container status
check_container() {
    local container=$1
    echo "Checking CT $container..."
    if pct status "$container" &>/dev/null; then
        echo "✓ CT $container is running"
        return 0
    else
        echo "✗ CT $container is not running"
        return 1
    fi
}

# Function to get container metrics
get_container_metrics() {
    local container=$1
    local hostname=$2
    
    echo "== CT $container ($hostname) Metrics =="
    pct enter "$container" -- bash -c '
        echo "Memory Usage:"
        free -h
        echo -e "\nDisk Usage:"
        df -h /
        echo -e "\nCPU Load:"
        top -bn1 | grep "Cpu(s)"
        echo -e "\nProcess Count:"
        ps aux | wc -l
    '
}

# Function to check service health
check_service_health() {
    echo -e "\n== Service Health =="
    
    # Check LLM Service
    if curl -s "http://192.168.137.69:11434/api/health" &>/dev/null; then
        echo "✓ LLM Service: Healthy"
    else
        echo "✗ LLM Service: Not Responding"
    fi
    
    # Check Vector DB
    if curl -s "http://192.168.137.34:6333/health" &>/dev/null; then
        echo "✓ Vector DB: Healthy"
    else
        echo "✗ Vector DB: Not Responding"
    fi
    
    # Check Application
    if curl -s "http://192.168.137.162:8000/health" &>/dev/null; then
        echo "✓ Application API: Healthy"
    else
        echo "✗ Application API: Not Responding"
    fi
}

# Function to check API response times
check_api_response() {
    echo -e "\n== API Response Times =="
    
    # LLM API
    time_llm=$(curl -o /dev/null -s -w "%{time_total}\n" "http://192.168.137.69:11434/api/health" 2>/dev/null)
    echo "LLM API: ${time_llm}s"
    
    # Vector DB API
    time_vector=$(curl -o /dev/null -s -w "%{time_total}\n" "http://192.168.137.34:6333/health" 2>/dev/null)
    echo "Vector DB API: ${time_vector}s"
    
    # Application API
    time_app=$(curl -o /dev/null -s -w "%{time_total}\n" "http://192.168.137.162:8000/health" 2>/dev/null)
    echo "Application API: ${time_app}s"
}

# Function to check resource thresholds
check_thresholds() {
    echo -e "\n== Resource Thresholds =="
    
    # CPU Usage Alert (80% threshold)
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        echo "⚠️ WARNING: High CPU usage: ${cpu_usage}%"
    else
        echo "✓ CPU usage normal: ${cpu_usage}%"
    fi
    
    # Memory Usage Alert (85% threshold)
    mem_usage=$(free | grep Mem | awk '{print $3/$2 * 100.0}')
    if (( $(echo "$mem_usage > 85" | bc -l) )); then
        echo "⚠️ WARNING: High memory usage: ${mem_usage}%"
    else
        echo "✓ Memory usage normal: ${mem_usage}%"
    fi
    
    # Disk Space Alert (80% threshold)
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if (( disk_usage > 80 )); then
        echo "⚠️ WARNING: High disk usage: ${disk_usage}%"
    else
        echo "✓ Disk usage normal: ${disk_usage}%"
    fi
}

# Generate the report
{
    # System Status
    echo "1. Container Status"
    check_container 200
    check_container 201
    check_container 202
    
    echo -e "\n2. Container Metrics"
    get_container_metrics 200 "llm"
    get_container_metrics 201 "vectordb"
    get_container_metrics 202 "dev"
    
    # Service Health
    check_service_health
    
    # API Response Times
    check_api_response
    
    # Resource Thresholds
    check_thresholds
    
    # Docker Status (CT 202)
    echo -e "\n== Docker Status =="
    pct enter 202 -- docker ps
    
    echo -e "\nReport generated successfully at: $REPORT_FILE"
} >> "$REPORT_FILE" 2>&1

# Cleanup old reports (keep last 30 days)
find "$REPORT_DIR" -type f -mtime +30 -delete

# If any critical issues found, send alert
if grep -q "WARNING" "$REPORT_FILE"; then
    echo "⚠️ Critical issues found in performance report!"
    grep "WARNING" "$REPORT_FILE"
fi

echo "Performance report completed. View the full report at: $REPORT_FILE"
