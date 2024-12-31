#!/bin/bash

# System Recovery Script
# Automates the process of bringing up core services after a system reboot

echo "Starting system recovery process..."

# Function to check if a container is running
check_container() {
    local ct=$1
    if ! pct status $ct | grep -q "running"; then
        echo "Container $ct not running. Starting..."
        pct start $ct
        sleep 5  # Give container time to start
    fi
}

# Function to verify service health
verify_service() {
    local ct=$1
    local service=$2
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if pct exec $ct -- systemctl is-active --quiet $service; then
            echo "Service $service in CT $ct is running"
            return 0
        else
            echo "Attempt $attempt: Restarting $service in CT $ct..."
            pct exec $ct -- systemctl restart $service
            sleep 5
        fi
        attempt=$((attempt + 1))
    done
    echo "WARNING: Failed to start $service in CT $ct after $max_attempts attempts"
    return 1
}

# Function to verify API endpoint
verify_endpoint() {
    local ct=$1
    local url=$2
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if pct exec $ct -- curl -s -f "$url" > /dev/null; then
            echo "Endpoint $url in CT $ct is responding"
            return 0
        else
            echo "Attempt $attempt: Endpoint $url not responding. Waiting..."
            sleep 5
        fi
        attempt=$((attempt + 1))
    done
    echo "WARNING: Endpoint $url in CT $ct is not responding after $max_attempts attempts"
    return 1
}

# Function to verify storage mount
verify_storage() {
    if ! df -h /mnt/extra_storage > /dev/null 2>&1; then
        echo "Storage not mounted. Attempting to mount..."
        mount /dev/sda1 /mnt/extra_storage
        if [ $? -eq 0 ]; then
            echo "Storage mounted successfully"
        else
            echo "ERROR: Failed to mount storage"
            return 1
        fi
    else
        echo "Storage mount verified"
    fi
}

echo "Step 1: Verifying containers..."
for ct in 200 201 202 203; do
    check_container $ct
done

echo "Step 2: Verifying storage..."
verify_storage

echo "Step 3: Starting core services..."

# CT 200 - Ollama
echo "Starting Ollama service..."
verify_service 200 "ollama"
verify_endpoint 200 "http://localhost:11434/api/version"

# CT 201 - Qdrant
echo "Starting Qdrant service..."
verify_service 201 "qdrant"
verify_endpoint 201 "http://localhost:6333/collections"

# CT 203 - MCP Service
echo "Starting MCP service..."
pct exec 203 -- pkill -f "node openai_mcp_example.ts" || true  # Kill any existing instances
pct exec 203 -- nohup node openai_mcp_example.ts > openai_mcp.log 2>&1 &

echo "Step 4: Final health check..."
for ct in 200 201 202 203; do
    echo "=== CT $ct Status ==="
    pct status $ct
done

echo "Recovery process complete. Please check the logs for any warnings or errors."
