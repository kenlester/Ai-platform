#!/bin/bash

# Script to create standardized service containers for PVE
# This implements the container strategy defined in PVE_CONTAINER_STRATEGY.md

set -e

# Configuration
CONTAINER_CONFIG="/etc/pve/container_policy.json"
TEMPLATE_STORAGE="local"
TEMPLATE_NAME="ubuntu-22.04-standard_22.04-1_amd64.tar.gz"
VLAN_BASE=10  # Base VLAN ID, will increment for each type
LOG_FILE="/var/log/pve-container-creation.log"

# Container types and their base configurations
declare -A CONTAINER_TYPES=(
    ["monitoring"]="grafana,prometheus,node-exporter"
    ["backup"]="restic,duplicity,rsync"
    ["development"]="git,docker,build-essential"
    ["api"]="nginx,python3,nodejs"
)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

validate_container_type() {
    local type=$1
    if [[ ! "${!CONTAINER_TYPES[@]}" =~ $type ]]; then
        echo "Invalid container type. Available types: ${!CONTAINER_TYPES[@]}"
        exit 1
    fi
}

get_next_ct_id() {
    local last_id=$(pct list | tail -n +2 | awk '{print $1}' | sort -n | tail -1)
    echo $((last_id + 1))
}

setup_network_isolation() {
    local ct_id=$1
    local type=$2
    local vlan_id

    case $type in
        "monitoring") vlan_id=$((VLAN_BASE + 1)) ;;
        "backup")     vlan_id=$((VLAN_BASE + 2)) ;;
        "development") vlan_id=$((VLAN_BASE + 3)) ;;
        "api")        vlan_id=$((VLAN_BASE + 4)) ;;
    esac

    # Configure network with VLAN
    pct set $ct_id -net0 name=eth0,bridge=vmbr0,ip=dhcp,vlan=$vlan_id
    
    # Enable firewall
    pct set $ct_id -firewall 1
}

configure_resources() {
    local ct_id=$1
    local type=$2
    
    # Get resource limits from config
    local cpu=$(jq -r ".container_resources.$type.cpu" "$CONTAINER_CONFIG")
    local memory=$(jq -r ".container_resources.$type.memory" "$CONTAINER_CONFIG")
    local storage=$(jq -r ".container_resources.$type.storage" "$CONTAINER_CONFIG")
    
    # Apply resource limits
    pct set $ct_id -cores $cpu
    pct set $ct_id -memory $memory
    pct set $ct_id -rootfs local-lvm:$storage
}

install_base_packages() {
    local ct_id=$1
    local type=$2
    
    # Wait for container to be ready
    sleep 5
    
    # Update package lists
    pct exec $ct_id -- apt-get update
    
    # Install required packages
    IFS=',' read -ra PACKAGES <<< "${CONTAINER_TYPES[$type]}"
    for package in "${PACKAGES[@]}"; do
        log "Installing $package in container $ct_id"
        pct exec $ct_id -- apt-get install -y $package
    done
}

setup_monitoring() {
    local ct_id=$1
    
    # Install node exporter in container
    pct exec $ct_id -- apt-get install -y prometheus-node-exporter
    
    # Configure prometheus target
    local container_ip=$(pct exec $ct_id -- ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
    echo "- targets: ['$container_ip:9100']
  labels:
    container_id: '$ct_id'" >> /etc/prometheus/targets.yml
}

create_container() {
    local type=$1
    local name="pve-$type"
    local ct_id=$(get_next_ct_id)
    
    log "Creating $type container with ID $ct_id"
    
    # Create container
    pct create $ct_id "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE_NAME" \
        --hostname "$name" \
        --storage local-lvm \
        --net0 name=eth0,bridge=vmbr0,ip=dhcp \
        --onboot 1
    
    # Configure container
    setup_network_isolation $ct_id $type
    configure_resources $ct_id $type
    
    # Start container
    pct start $ct_id
    
    # Install packages
    install_base_packages $ct_id $type
    
    # Setup monitoring
    setup_monitoring $ct_id
    
    log "Container $ct_id ($name) created successfully"
    
    # Return container ID
    echo $ct_id
}

setup_backup() {
    local ct_id=$1
    
    # Create backup directory
    pct exec $ct_id -- mkdir -p /backup
    
    # Configure backup retention
    cat > "backup-cleanup.sh" << EOF
#!/bin/bash
find /backup -type f -mtime +7 -delete
EOF
    
    # Copy script to container
    pct push $ct_id backup-cleanup.sh /usr/local/bin/backup-cleanup.sh
    pct exec $ct_id -- chmod +x /usr/local/bin/backup-cleanup.sh
    
    # Add to container's crontab
    pct exec $ct_id -- bash -c 'echo "0 0 * * * /usr/local/bin/backup-cleanup.sh" | crontab -'
}

# Main script
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <container_type>"
    echo "Available types: ${!CONTAINER_TYPES[@]}"
    exit 1
fi

container_type=$1
validate_container_type "$container_type"

# Create container
ct_id=$(create_container "$container_type")

# Additional setup based on type
case $container_type in
    "backup")
        setup_backup $ct_id
        ;;
    "monitoring")
        # Additional monitoring setup if needed
        ;;
    "development")
        # Development environment setup
        ;;
    "api")
        # API gateway setup
        ;;
esac

log "Container setup complete. Container ID: $ct_id"
echo "Container created successfully with ID $ct_id"

# Make script executable
chmod +x "$0"
