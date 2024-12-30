#!/bin/bash

# Script to enforce PVE container strategy and guardrails
# This script should be run periodically to ensure compliance

set -e

# Configuration
CONTAINER_CONFIG="/etc/pve/container_policy.json"
LOG_FILE="/var/log/pve-container-audit.log"
ALERT_EMAIL="admin@yourdomain.com"

# Create config if it doesn't exist
if [ ! -f "$CONTAINER_CONFIG" ]; then
    cat > "$CONTAINER_CONFIG" << EOF
{
    "allowed_core_packages": [
        "^pve-",
        "^lxc-",
        "^qemu-",
        "^kernel-",
        "^zfs-"
    ],
    "container_resources": {
        "monitoring": {
            "cpu": 2,
            "memory": 4096,
            "storage": 20
        },
        "backup": {
            "cpu": 1,
            "memory": 2048,
            "storage": 50
        },
        "development": {
            "cpu": 2,
            "memory": 4096,
            "storage": 50
        },
        "api": {
            "cpu": 1,
            "memory": 2048,
            "storage": 10
        }
    }
}
EOF
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

alert() {
    local message="$1"
    log "ALERT: $message"
    echo "$message" | mail -s "PVE Container Alert" "$ALERT_EMAIL"
}

check_non_core_packages() {
    log "Checking for non-core packages..."
    
    # Load allowed package patterns
    allowed_patterns=$(jq -r '.allowed_core_packages[]' "$CONTAINER_CONFIG")
    
    # Get list of installed packages
    installed_packages=$(dpkg -l | awk '/^ii/ {print $2}')
    
    for pkg in $installed_packages; do
        is_allowed=false
        for pattern in $allowed_patterns; do
            if [[ $pkg =~ $pattern ]]; then
                is_allowed=true
                break
            fi
        done
        
        if [ "$is_allowed" = false ]; then
            alert "Non-core package detected on host: $pkg"
        fi
    done
}

check_container_resources() {
    log "Checking container resource compliance..."
    
    for ct in $(pct list | tail -n +2 | awk '{print $1}'); do
        # Get container config
        config=$(pct config "$ct")
        
        # Extract current resources
        current_cpu=$(echo "$config" | grep -oP 'cores: \K\d+')
        current_memory=$(echo "$config" | grep -oP 'memory: \K\d+')
        
        # Get container type from name
        ct_name=$(pct config "$ct" | grep -oP 'hostname: \K.*')
        
        for type in monitoring backup development api; do
            if [[ $ct_name == *"$type"* ]]; then
                expected_cpu=$(jq -r ".container_resources.$type.cpu" "$CONTAINER_CONFIG")
                expected_memory=$(jq -r ".container_resources.$type.memory" "$CONTAINER_CONFIG")
                
                if [ "$current_cpu" -gt "$expected_cpu" ]; then
                    alert "Container $ct ($ct_name) exceeds CPU limit: $current_cpu > $expected_cpu"
                fi
                
                if [ "$current_memory" -gt "$expected_memory" ]; then
                    alert "Container $ct ($ct_name) exceeds memory limit: $current_memory > $expected_memory"
                fi
            fi
        done
    done
}

enforce_network_isolation() {
    log "Enforcing network isolation..."
    
    # Check if VLANs are properly configured
    for ct in $(pct list | tail -n +2 | awk '{print $1}'); do
        ct_name=$(pct config "$ct" | grep -oP 'hostname: \K.*')
        net_config=$(pct config "$ct" | grep '^net0')
        
        # Check if VLAN is configured
        if ! echo "$net_config" | grep -q "vlan="; then
            alert "Container $ct ($ct_name) missing VLAN configuration"
        fi
        
        # Check firewall rules
        if ! pct config "$ct" | grep -q "^firewall: 1"; then
            alert "Container $ct ($ct_name) firewall not enabled"
        fi
    done
}

check_backup_compliance() {
    log "Checking backup compliance..."
    
    # Check if backup jobs are configured
    if ! pvesm list | grep -q "backup"; then
        alert "No backup storage configured"
    fi
    
    # Check backup schedule
    if ! systemctl is-active pve-daily-update.timer > /dev/null; then
        alert "Daily backup timer not active"
    fi
}

monitor_container_health() {
    log "Monitoring container health..."
    
    for ct in $(pct list | tail -n +2 | awk '{print $1}'); do
        status=$(pct status "$ct")
        if [ "$status" != "running" ]; then
            alert "Container $ct is not running (status: $status)"
            continue
        fi
        
        # Check resource usage
        cpu_usage=$(pct exec "$ct" -- top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d. -f1)
        memory_usage=$(pct exec "$ct" -- free | grep Mem | awk '{print $3/$2 * 100.0}')
        disk_usage=$(pct exec "$ct" -- df / | tail -1 | awk '{print $5}' | sed 's/%//')
        
        if [ "$cpu_usage" -gt 80 ]; then
            alert "Container $ct high CPU usage: ${cpu_usage}%"
        fi
        
        if [ "${memory_usage%.*}" -gt 85 ]; then
            alert "Container $ct high memory usage: ${memory_usage%.*}%"
        fi
        
        if [ "$disk_usage" -gt 90 ]; then
            alert "Container $ct high disk usage: ${disk_usage}%"
        fi
    done
}

# Main execution
log "Starting PVE container policy enforcement"

# Create installation policy if it doesn't exist
if [ ! -f "/etc/pve/installation_policy.conf" ]; then
    log "Creating installation policy..."
    cat > /etc/pve/installation_policy.conf << EOF
ALLOW_CORE_ONLY=true
REQUIRE_APPROVAL=true
CONTAINER_FIRST=true
EOF
fi

# Run checks
check_non_core_packages
check_container_resources
enforce_network_isolation
check_backup_compliance
monitor_container_health

log "Enforcement complete"

# Add to crontab if not already present
if ! crontab -l | grep -q "enforce_pve_containers.sh"; then
    (crontab -l 2>/dev/null; echo "0 * * * * /root/maintenance/enforce_pve_containers.sh") | crontab -
    log "Added enforcement script to hourly cron"
fi
