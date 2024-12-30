#!/bin/bash

# Script to identify and migrate non-core services to containers
# This implements the migration strategy from PVE_CONTAINER_STRATEGY.md

set -e

# Configuration
LOG_FILE="/var/log/pve-migration.log"
CONTAINER_SCRIPT="./create_service_container.sh"
BACKUP_DIR="/root/service_backups"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Service patterns to identify and categorize
declare -A SERVICE_PATTERNS=(
    ["monitoring"]="grafana|prometheus|zabbix|nagios|influxdb|telegraf"
    ["backup"]="duplicity|restic|borg|bacula|rsnapshot"
    ["development"]="jenkins|gitlab|docker|kubernetes|harbor"
    ["api"]="nginx|apache2|nodejs|uwsgi|gunicorn"
)

# Service configuration locations
declare -A SERVICE_CONFIGS=(
    ["grafana"]="/etc/grafana"
    ["prometheus"]="/etc/prometheus"
    ["nginx"]="/etc/nginx"
    ["docker"]="/var/lib/docker"
)

identify_services() {
    log "Identifying installed services..."
    
    # Get list of installed packages
    installed_packages=$(dpkg -l | awk '/^ii/ {print $2}')
    
    # Initialize arrays for each category
    declare -A found_services
    for category in "${!SERVICE_PATTERNS[@]}"; do
        found_services[$category]=""
    done
    
    # Categorize installed packages
    for pkg in $installed_packages; do
        for category in "${!SERVICE_PATTERNS[@]}"; do
            if [[ $pkg =~ ${SERVICE_PATTERNS[$category]} ]]; then
                found_services[$category]+="$pkg "
            fi
        done
    done
    
    # Output findings
    echo "{"
    for category in "${!found_services[@]}"; do
        echo "  \"$category\": [$(echo ${found_services[$category]} | sed 's/ /, /g')]"
    done
    echo "}" | tee service_inventory.json
}

backup_service_data() {
    local service=$1
    local config_path=${SERVICE_CONFIGS[$service]}
    
    if [ -n "$config_path" ] && [ -d "$config_path" ]; then
        log "Backing up configuration for $service"
        mkdir -p "$BACKUP_DIR/$service"
        cp -r "$config_path" "$BACKUP_DIR/$service/"
        
        # Backup service data if exists
        case $service in
            "grafana")
                cp -r /var/lib/grafana "$BACKUP_DIR/$service/data"
                ;;
            "prometheus")
                cp -r /var/lib/prometheus "$BACKUP_DIR/$service/data"
                ;;
            "docker")
                # Just backup docker compose files and configs, not all images
                mkdir -p "$BACKUP_DIR/$service/compose"
                find / -name "docker-compose*.yml" -exec cp {} "$BACKUP_DIR/$service/compose/" \;
                ;;
        esac
    fi
}

stop_service() {
    local service=$1
    log "Stopping service: $service"
    
    if systemctl is-active --quiet $service; then
        systemctl stop $service
        systemctl disable $service
    fi
}

migrate_service() {
    local service=$1
    local category=$2
    
    log "Starting migration for $service to $category container"
    
    # Backup service data
    backup_service_data $service
    
    # Create new container
    log "Creating container for $category"
    local ct_id=$($CONTAINER_SCRIPT $category)
    
    # Restore configuration and data
    if [ -d "$BACKUP_DIR/$service" ]; then
        log "Restoring $service configuration to container $ct_id"
        
        # Copy configs
        for config in "$BACKUP_DIR/$service"/*; do
            pct push $ct_id "$config" "${SERVICE_CONFIGS[$service]}/"
        done
        
        # Service-specific restoration
        case $service in
            "grafana")
                pct exec $ct_id -- chown -R grafana:grafana /var/lib/grafana
                ;;
            "prometheus")
                pct exec $ct_id -- chown -R prometheus:prometheus /var/lib/prometheus
                ;;
            "docker")
                pct exec $ct_id -- systemctl start docker
                # Restore docker compose projects
                if [ -d "$BACKUP_DIR/$service/compose" ]; then
                    pct push $ct_id "$BACKUP_DIR/$service/compose" /root/compose
                fi
                ;;
        esac
    fi
    
    # Start service in container
    pct exec $ct_id -- systemctl start $service
    
    # Verify service
    if pct exec $ct_id -- systemctl is-active --quiet $service; then
        log "Service $service successfully migrated to container $ct_id"
        
        # Stop and remove from host
        stop_service $service
        
        # Remove package from host
        log "Removing $service from host system"
        apt-get remove -y $service
    else
        log "ERROR: Service $service failed to start in container $ct_id"
        return 1
    fi
}

cleanup_host() {
    log "Cleaning up host system..."
    
    # Remove unnecessary packages
    apt-get autoremove -y
    
    # Clean package cache
    apt-get clean
    
    # Remove backup files older than 7 days
    find "$BACKUP_DIR" -type f -mtime +7 -delete
}

verify_migration() {
    local service=$1
    local ct_id=$2
    
    log "Verifying migration of $service in container $ct_id"
    
    # Check service status
    if ! pct exec $ct_id -- systemctl is-active --quiet $service; then
        log "ERROR: Service $service is not running in container $ct_id"
        return 1
    fi
    
    # Service-specific checks
    case $service in
        "grafana")
            # Check if Grafana is responding
            pct exec $ct_id -- curl -f http://localhost:3000
            ;;
        "prometheus")
            # Check if Prometheus is responding
            pct exec $ct_id -- curl -f http://localhost:9090/-/healthy
            ;;
        "nginx")
            # Check if Nginx is responding
            pct exec $ct_id -- curl -f http://localhost
            ;;
    esac
    
    log "Migration verification successful for $service"
    return 0
}

# Main execution
log "Starting service migration process"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Identify installed services
identify_services

# Read service inventory
if [ -f service_inventory.json ]; then
    for category in "${!SERVICE_PATTERNS[@]}"; do
        services=$(jq -r ".$category[]" service_inventory.json 2>/dev/null)
        if [ -n "$services" ]; then
            for service in $services; do
                log "Processing $service ($category)"
                if migrate_service $service $category; then
                    verify_migration $service $ct_id
                else
                    log "ERROR: Migration failed for $service"
                fi
            done
        fi
    done
fi

# Cleanup
cleanup_host

log "Migration process complete"

# Make script executable
chmod +x "$0"
