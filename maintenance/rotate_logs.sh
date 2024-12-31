#!/bin/bash

# Log rotation script for AI Assistant Platform
# Handles log rotation across all containers

# Configuration
LOG_DIR="/var/log"
BACKUP_DIR="/root/ai-app-template/backups/logs"
MAX_SIZE=100M  # Maximum size before rotation
MAX_AGE=30     # Days to keep rotated logs
DATE=$(date +%Y%m%d)

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Function to rotate container-specific logs
rotate_container_logs() {
    local container=$1
    echo "Rotating logs for CT $container..."
    
    case $container in
        200) # LLM Container
            if [[ $(hostname) != "llm" ]]; then
                echo "Error: Must be run from CT 200 for LLM logs"
                return 1
            fi
            # Rotate Ollama logs
            if [[ -f "$LOG_DIR/ollama.log" ]] && [[ $(stat -f%z "$LOG_DIR/ollama.log") -gt $MAX_SIZE ]]; then
                mv "$LOG_DIR/ollama.log" "$BACKUP_DIR/ollama_$DATE.log"
                gzip "$BACKUP_DIR/ollama_$DATE.log"
                systemctl restart ollama
            fi
            ;;
            
        201) # Vector DB Container
            if [[ $(hostname) != "vectordb" ]]; then
                echo "Error: Must be run from CT 201 for Vector DB logs"
                return 1
            fi
            # Rotate Qdrant logs
            if [[ -f "$LOG_DIR/qdrant.log" ]] && [[ $(stat -f%z "$LOG_DIR/qdrant.log") -gt $MAX_SIZE ]]; then
                mv "$LOG_DIR/qdrant.log" "$BACKUP_DIR/qdrant_$DATE.log"
                gzip "$BACKUP_DIR/qdrant_$DATE.log"
                systemctl restart qdrant
            fi
            ;;
            
        202) # Dev Container
            if [[ $(hostname) != "dev" ]]; then
                echo "Error: Must be run from CT 202 for Dev logs"
                return 1
            fi
            # Rotate Docker logs
            docker compose logs > "$BACKUP_DIR/docker_$DATE.log"
            gzip "$BACKUP_DIR/docker_$DATE.log"
            # Truncate existing logs
            truncate -s 0 /var/lib/docker/containers/*/*-json.log
            ;;
    esac
}

# Function to cleanup old logs
cleanup_old_logs() {
    echo "Cleaning up logs older than $MAX_AGE days..."
    find "$BACKUP_DIR" -name "*.gz" -mtime +$MAX_AGE -delete
}

# Function to check log sizes
check_log_sizes() {
    echo "Checking log sizes..."
    df -h "$LOG_DIR"
    du -sh "$LOG_DIR"/*log 2>/dev/null
    echo -e "\nBackup log sizes:"
    du -sh "$BACKUP_DIR"
}

# Main log rotation
case "$1" in
    "200"|"201"|"202")
        rotate_container_logs "$1"
        ;;
    "all")
        rotate_container_logs 200
        rotate_container_logs 201
        rotate_container_logs 202
        ;;
    "cleanup")
        cleanup_old_logs
        ;;
    "status")
        check_log_sizes
        ;;
    *)
        echo "Usage: $0 {200|201|202|all|cleanup|status}"
        echo "Example: $0 200     # Rotate LLM container logs"
        echo "         $0 all     # Rotate all container logs"
        echo "         $0 cleanup # Remove old log backups"
        echo "         $0 status  # Check log sizes"
        exit 1
        ;;
esac

# Always cleanup old logs after rotation
cleanup_old_logs

echo "Log rotation completed successfully"
