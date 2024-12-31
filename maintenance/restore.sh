#!/bin/bash

# Restore script for AI Assistant Platform
# Usage: ./restore.sh {backup_name|latest} [type]

# Configuration
BACKUP_ROOT="/root/ai-app-template/backups"
VECTOR_BACKUP_DIR="$BACKUP_ROOT/vectors"
MODEL_BACKUP_DIR="$BACKUP_ROOT/models"

# Function to validate backup exists
validate_backup() {
    local backup_path=$1
    if [[ ! -f "$backup_path" ]]; then
        echo "Error: Backup file not found: $backup_path"
        exit 1
    fi
}

# Function to get latest backup of specific type
get_latest_backup() {
    local dir=$1
    local latest=$(ls -t "$dir" | head -n1)
    if [[ -z "$latest" ]]; then
        echo "Error: No backups found in $dir"
        exit 1
    fi
    echo "$dir/$latest"
}

# Function to restore vectors
restore_vectors() {
    local backup_file=$1
    echo "Restoring vectors from: $backup_file"
    
    # Must be run from CT 201
    if [[ $(hostname) != "vectordb" ]]; then
        echo "Error: Vector restore must be run from CT 201"
        exit 1
    fi
    
    # Stop Qdrant service
    systemctl stop qdrant
    
    # Restore vectors
    curl -X PUT "http://localhost:6333/collections/queries/points" \
        -H "Content-Type: application/json" \
        -d @"$backup_file"
    
    # Start Qdrant service
    systemctl start qdrant
    
    # Verify restore
    if curl -s "http://localhost:6333/collections/queries" | grep -q "queries"; then
        echo "Vector restore completed successfully"
    else
        echo "Vector restore failed!"
        exit 1
    fi
}

# Function to restore models
restore_models() {
    local backup_file=$1
    echo "Restoring models from: $backup_file"
    
    # Must be run from CT 200
    if [[ $(hostname) != "llm" ]]; then
        echo "Error: Model restore must be run from CT 200"
        exit 1
    fi
    
    # Stop Ollama service
    systemctl stop ollama
    
    # Clean existing models
    rm -rf /root/.ollama/*
    
    # Restore models
    tar -xzf "$backup_file" -C /
    
    # Start Ollama service
    systemctl start ollama
    sleep 5
    
    # Verify restore
    if curl -s "http://localhost:11434/api/tags" | grep -q "llama2"; then
        echo "Model restore completed successfully"
    else
        echo "Model restore failed!"
        exit 1
    fi
}

# Function for full system restore
restore_full() {
    local backup_date=$1
    echo "Performing full system restore from $backup_date..."
    
    # Stop all services
    echo "Stopping services..."
    if [[ $(hostname) == "dev" ]]; then
        docker compose down
    fi
    
    # Restore configuration
    local config_backup="$BACKUP_ROOT/config_${backup_date}.tar.gz"
    if [[ -f "$config_backup" ]]; then
        tar -xzf "$config_backup" -C /root/ai-app-template/
        echo "Configuration restored"
    fi
    
    # Restore application state
    local app_backup="$BACKUP_ROOT/app_${backup_date}.tar.gz"
    if [[ -f "$app_backup" ]]; then
        tar -xzf "$app_backup" -C /root/
        echo "Application state restored"
    fi
    
    # Restore vectors and models
    restore_vectors "$VECTOR_BACKUP_DIR/vectors_${backup_date}.json"
    restore_models "$MODEL_BACKUP_DIR/models_${backup_date}.tar.gz"
    
    # Start services
    if [[ $(hostname) == "dev" ]]; then
        docker compose up -d
    fi
    
    echo "Full system restore completed"
}

# Main restore logic
case "$2" in
    "vectors")
        if [[ "$1" == "latest" ]]; then
            backup_file=$(get_latest_backup "$VECTOR_BACKUP_DIR")
        else
            backup_file="$VECTOR_BACKUP_DIR/$1"
        fi
        validate_backup "$backup_file"
        restore_vectors "$backup_file"
        ;;
    "models")
        if [[ "$1" == "latest" ]]; then
            backup_file=$(get_latest_backup "$MODEL_BACKUP_DIR")
        else
            backup_file="$MODEL_BACKUP_DIR/$1"
        fi
        validate_backup "$backup_file"
        restore_models "$backup_file"
        ;;
    "full")
        if [[ "$1" == "latest" ]]; then
            backup_date=$(ls -t "$BACKUP_ROOT"/config_*.tar.gz | head -n1 | sed 's/.*config_\(.*\)\.tar\.gz/\1/')
        else
            backup_date=$1
        fi
        restore_full "$backup_date"
        ;;
    *)
        echo "Usage: $0 {backup_name|latest} {vectors|models|full}"
        echo "Example: $0 latest vectors    # Restore latest vector backup"
        echo "         $0 20240215_123456 full  # Restore full backup from date"
        exit 1
        ;;
esac

echo "Restore process completed successfully"
