#!/bin/bash

# AI Platform Deployment Script
# This script automates the deployment of the AI platform containers and services

set -e  # Exit on error

echo "Starting AI Platform Deployment..."

# Cleanup function
cleanup_old_deployments() {
    echo "Cleaning up old deployments..."
    
    # Stop and remove existing containers
    for CT in 200 201 202 203; do
        if pct status $CT >/dev/null 2>&1; then
            echo "Stopping CT $CT..."
            pct stop $CT --force >/dev/null 2>&1 || true
            echo "Destroying CT $CT..."
            pct destroy $CT >/dev/null 2>&1 || true
        fi
    done

    # Clean up storage
    echo "Cleaning up storage..."
    lvremove -f /dev/pve/vm-*-disk-* >/dev/null 2>&1 || true
    
    # Clean up any stale mounts
    echo "Cleaning up mounts..."
    umount /mnt/extra_storage >/dev/null 2>&1 || true
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Run cleanup
cleanup_old_deployments

# Function to create and configure container
create_container() {
    local CT_ID=$1
    local HOSTNAME=$2
    local MEMORY=$3
    local CORES=$4
    local STORAGE=$5
    local IP=$6

    echo "Creating CT $CT_ID - $HOSTNAME..."
    
    pct create $CT_ID /var/lib/vz/template/cache/ubuntu-22.04-standard_22.04-1_amd64.tar.gz \
        --hostname $HOSTNAME \
        --memory $MEMORY \
        --cores $CORES \
        --rootfs local-lvm:$STORAGE \
        --net0 name=eth0,bridge=vmbr0,gw=192.168.137.1,ip=$IP/24 \
        --onboot 1
}

# Create Containers
echo "Creating containers..."

# CT 200 - LLM Service (Increased for future models while being reasonable)
create_container 200 "llm" 4096 4 "50G" "192.168.137.69"

# CT 201 - Vector DB
create_container 201 "vectordb" 1024 2 "50G" "192.168.137.34"

# CT 202 - Development
create_container 202 "devenv" 1024 2 "30G" "192.168.137.162"

# CT 203 - MCP Server
create_container 203 "mcp-server" 512 1 "10G" "192.168.137.100"

# Start containers
echo "Starting containers..."
for CT in 200 201 202 203; do
    pct start $CT
    sleep 5  # Wait for container to start
done

# Configure CT 200 - LLM Service
echo "Configuring LLM Service..."
pct exec 200 -- bash -c '
    apt-get update && apt-get install -y curl python3 python3-pip
    curl https://ollama.ai/install.sh | sh
    useradd -r -s /bin/false ollama
    cat > /etc/systemd/system/ollama.service << EOF
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="PATH=/sbin:/bin:/usr/sbin:/usr/bin"

[Install]
WantedBy=default.target
EOF
    systemctl daemon-reload
    systemctl enable ollama
    systemctl start ollama
'

# Configure CT 201 - Vector DB
echo "Configuring Vector DB..."
pct exec 201 -- bash -c '
    apt-get update && apt-get install -y curl
    curl -L https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz | tar xz
    mv qdrant /usr/local/bin/
    cat > /etc/systemd/system/qdrant.service << EOF
[Unit]
Description=Qdrant Vector Database
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/qdrant
WorkingDirectory=/var/lib/qdrant
Restart=always

[Install]
WantedBy=multi-user.target
EOF
    mkdir -p /var/lib/qdrant
    systemctl daemon-reload
    systemctl enable qdrant
    systemctl start qdrant
'

# Configure CT 202 - Development Environment
echo "Configuring Development Environment..."
pct exec 202 -- bash -c '
    apt-get update && apt-get install -y python3-dev build-essential git
    mkdir -p /opt/dev_tools
'

# Configure CT 203 - MCP Server
echo "Configuring MCP Server..."
pct exec 203 -- bash -c '
    apt-get update && apt-get install -y nodejs npm
'

# Create development tools
echo "Setting up development tools..."
pct exec 202 -- bash -c '
cat > /opt/dev_tools/ai_dev_agent.py << EOF
#!/usr/bin/env python3
"""
AI Development Agent
Provides development assistance and code analysis capabilities.
"""
import sys

def main():
    print("AI Development Agent initialized")
    
if __name__ == "__main__":
    main()
EOF

cat > /opt/dev_tools/code_analyzer.py << EOF
#!/usr/bin/env python3
"""
Code Analysis Tool
Analyzes code for patterns, issues, and improvements.
"""
import sys

def main():
    print("Code Analyzer initialized")
    
if __name__ == "__main__":
    main()
EOF

cat > /opt/dev_tools/ai_agent_config.json << EOF
{
    "version": "1.0.0",
    "settings": {
        "analysis_depth": "detailed",
        "optimization_level": "balanced",
        "logging_level": "info"
    }
}
EOF

chmod +x /opt/dev_tools/*.py
'

# Configure storage
echo "Configuring storage..."
mkdir -p /mnt/extra_storage
mount -t ext4 /dev/sda1 /mnt/extra_storage || echo "Storage mount point already exists"

# Set up security
echo "Configuring security..."
for CT in 200 201 202 203; do
    pct exec $CT -- bash -c '
        apt-get update && apt-get install -y ufw
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw --force enable
    '
done

# Verify services
echo "Verifying services..."
sleep 10  # Wait for services to start

echo "Checking LLM Service..."
pct exec 200 -- curl -s http://localhost:11434/api/version || echo "LLM Service not responding"

echo "Checking Vector DB..."
pct exec 201 -- curl -s http://localhost:6333/collections || echo "Vector DB not responding"

echo "Deployment complete!"
echo "Please verify all services are running correctly and configure any necessary API keys."
