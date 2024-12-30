#!/bin/bash

# Backup script for AI Assistant Platform
# Usage: ./backup.sh {vectors|models|all|full|pre_scale}

# Configuration
BACKUP_ROOT="/root/ai-app-template/backups"
VECTOR_BACKUP_DIR="$BACKUP_ROOT/vectors"
MODEL_BACKUP_DIR="$BACKUP_ROOT/models"
DATE=$(date +%Y%m%d_%H%M%S)

# Ensure backup directories exist
mkdir -p "$VECTOR_BACKUP_DIR" "$MODEL_BACKUP_DIR"

# Function to backup vectors
backup_vectors() {
    echo "Backing up vectors..."
    # Must be run from CT 201
    if [[ $(hostname) != "vectordb" ]]; then
        echo "Error: Vector backup must be run from CT 201"
        exit 1
    fi
    
    curl -X GET "http://localhost:6333/collections/queries/points" \
        > "$VECTOR_BACKUP_DIR/vectors_$DATE.json"
    
    if [ $? -eq 0 ]; then
        echo "Vector backup completed: vectors_$DATE.json"
    else
        echo "Vector backup failed!"
        exit 1
    fi
}

# Function to backup models
backup_models() {
    echo "Backing up models..."
    # Must be run from CT 200
    if [[ $(hostname) != "llm" ]]; then
        echo "Error: Model backup must be run from CT 200"
        exit 1
    fi
    
    tar -czf "$MODEL_BACKUP_DIR/models_$DATE.tar.gz" /root/.ollama
    
    if [ $? -eq 0 ]; then
        echo "Model backup completed: models_$DATE.tar.gz"
    else
        echo "Model backup failed!"
        exit 1
    fi
}

# Function for full system backup
backup_full() {
    echo "Performing full system backup..."
    
    # Backup configuration
    tar -czf "$BACKUP_ROOT/config_$DATE.tar.gz" /root/ai-app-template/config
    
    # Backup application state
    if [[ $(hostname) == "dev" ]]; then
        docker compose down
        tar -czf "$BACKUP_ROOT/app_$DATE.tar.gz" /root/ai-app-template
        docker compose up -d
    fi
    
    # Call other backups
    backup_vectors
    backup_models
    
    echo "Full backup completed"
}

# Main backup logic
case "$1" in
    "vectors")
        backup_vectors
        ;;
    "models")
        backup_models
        ;;
    "all"|"full")
        backup_full
        ;;
    "pre_scale")
        echo "Performing pre-scaling backup..."
        backup_full
        ;;
    *)
        echo "Usage: $0 {vectors|models|all|full|pre_scale}"
        exit 1
        ;;
esac

# Cleanup old backups (keep last 7 days)
find "$BACKUP_ROOT" -type f -mtime +7 -delete

echo "Backup process completed successfully"
