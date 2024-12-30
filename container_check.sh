#!/bin/bash

# Function to get current container ID
get_container_id() {
    local hostname=$(hostname)
    case $hostname in
        "llm") echo "200";;
        "vectordb") echo "201";;
        "dev") echo "202";;
        *) echo "unknown";;
    esac
}

# Function to verify we're in the correct container
verify_container() {
    local required_id=$1
    local current_id=$(get_container_id)
    
    if [ "$current_id" = "unknown" ]; then
        echo "Error: Not running inside a known container"
        echo "This command must be run inside container CT $required_id"
        return 1
    elif [ "$current_id" != "$required_id" ]; then
        echo "Error: Wrong container"
        echo "Current container: CT $current_id"
        echo "Required container: CT $required_id"
        echo "Use: pct enter $required_id"
        return 1
    fi
    return 0
}

# Function to check LLM service (CT 200)
check_llm() {
    verify_container "200" || return 1
    echo "Checking Ollama service..."
    if ! systemctl is-active --quiet ollama; then
        echo "Error: Ollama service is not running"
        echo "Run: systemctl start ollama"
        return 1
    fi
    echo "Checking model availability..."
    if ! curl -s "http://localhost:11434/api/tags" | grep -q "llama2"; then
        echo "Error: Default model (llama2) not found"
        echo "Run: ollama pull llama2"
        return 1
    fi
    echo "LLM service is healthy"
    return 0
}

# Function to check Vector DB service (CT 201)
check_vectordb() {
    verify_container "201" || return 1
    echo "Checking Qdrant service..."
    if ! systemctl is-active --quiet qdrant; then
        echo "Error: Qdrant service is not running"
        echo "Run: systemctl start qdrant"
        return 1
    fi
    echo "Checking API availability..."
    if ! curl -s "http://localhost:6333/health" | grep -q "ok"; then
        echo "Error: Qdrant API not responding"
        return 1
    fi
    echo "Vector DB service is healthy"
    return 0
}

# Function to check Development services (CT 202)
check_dev() {
    verify_container "202" || return 1
    echo "Checking Docker services..."
    if ! docker ps &>/dev/null; then
        echo "Error: Docker not running or not accessible"
        return 1
    fi
    if ! docker compose ps | grep -q "Up"; then
        echo "Error: Application services not running"
        echo "Run: docker compose up -d"
        return 1
    fi
    echo "Checking API availability..."
    if ! curl -s "http://localhost:8000/health" | grep -q "ok"; then
        echo "Error: Backend API not responding"
        return 1
    fi
    echo "Development services are healthy"
    return 0
}

# Main script
case "$1" in
    "llm")
        check_llm
        ;;
    "vectordb")
        check_vectordb
        ;;
    "dev")
        check_dev
        ;;
    *)
        echo "Usage: $0 {llm|vectordb|dev}"
        echo "Example: $0 llm    # Check LLM service in CT 200"
        exit 1
        ;;
esac
