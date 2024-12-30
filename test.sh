#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Thresholds
DISK_THRESHOLD=80  # Percentage
MEMORY_THRESHOLD=80  # Percentage
RESPONSE_TIME_THRESHOLD=2000  # Milliseconds

# Functions
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        if [ ! -z "$3" ]; then
            echo -e "${RED}  Error: $3${NC}"
        fi
    fi
}

check_system_resources() {
    echo -e "\n${YELLOW}Checking System Resources...${NC}"
    
    # Check disk space
    echo "Checking disk space..."
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | cut -d'%' -f1)
    if [ "$DISK_USAGE" -lt "$DISK_THRESHOLD" ]; then
        print_status 0 "Disk usage: ${DISK_USAGE}%"
    else
        print_status 1 "Disk usage critical" "Usage: ${DISK_USAGE}%"
    fi
    
    # Check memory
    echo "Checking memory usage..."
    MEMORY_USAGE=$(free | awk '/Mem:/ {printf("%.0f", $3/$2 * 100)}')
    if [ "$MEMORY_USAGE" -lt "$MEMORY_THRESHOLD" ]; then
        print_status 0 "Memory usage: ${MEMORY_USAGE}%"
    else
        print_status 1 "Memory usage critical" "Usage: ${MEMORY_USAGE}%"
    fi
    
    # Check swap usage
    echo "Checking swap usage..."
    SWAP_USAGE=$(free | awk '/Swap:/ {if ($2 > 0) printf("%.0f", $3/$2 * 100); else print "0"}')
    print_status 0 "Swap usage: ${SWAP_USAGE}%"
}

measure_response_time() {
    local url=$1
    local start=$(date +%s%N)
    curl -s -o /dev/null -w "%{http_code}" "$url" > /dev/null
    local end=$(date +%s%N)
    local duration=$(( (end - start) / 1000000 )) # Convert to milliseconds
    echo "$duration"
}

# Function to test connection
test_connection() {
    local url=$1
    local name=$2
    local timeout=5
    
    echo "Testing connection to $name ($url)..."
    if curl -s --connect-timeout $timeout -I "$url" > /dev/null 2>&1; then
        print_status 0 "Connection successful"
        return 0
    else
        local exit_code=$?
        case $exit_code in
            7)  print_status 1 "Connection failed" "Failed to connect to host";;
            28) print_status 1 "Connection failed" "Connection timed out";;
            *)  print_status 1 "Connection failed" "Curl error code: $exit_code";;
        esac
        return 1
    fi
}

echo -e "${YELLOW}AI Assistant System Test Suite${NC}"
echo -e "${BLUE}Running comprehensive system tests...${NC}"

# Check system resources first
check_system_resources

# Test base connectivity
echo -e "\n${YELLOW}Testing Base Connectivity...${NC}"
test_connection "http://192.168.137.69:11434" "Ollama LLM Service"
OLLAMA_CONN=$?

test_connection "http://192.168.137.34:6333" "Qdrant Vector DB"
QDRANT_CONN=$?

test_connection "http://192.168.137.162:8000" "Backend Service"
BACKEND_CONN=$?

# Test frontend service
test_connection "http://192.168.137.162:3000" "Frontend Service"
FRONTEND_CONN=$?

# Performance testing
echo -e "\n${YELLOW}Testing Response Times...${NC}"
if [ $BACKEND_CONN -eq 0 ]; then
    RESPONSE_TIME=$(measure_response_time "http://192.168.137.162:8000/health")
    if [ "$RESPONSE_TIME" -lt "$RESPONSE_TIME_THRESHOLD" ]; then
        print_status 0 "Backend response time: ${RESPONSE_TIME}ms"
    else
        print_status 1 "Backend response time high" "${RESPONSE_TIME}ms exceeds threshold of ${RESPONSE_TIME_THRESHOLD}ms"
    fi
fi

# Only proceed with detailed tests if base connectivity is established
if [ $OLLAMA_CONN -eq 0 ]; then
    echo -e "\n${YELLOW}1. Testing Ollama LLM Service (192.168.137.69)...${NC}"

    # Test Ollama API
    echo "1.1. Testing API connection..."
    OLLAMA_RESPONSE=$(curl -s -X GET http://192.168.137.69:11434/api/tags)
    if echo "$OLLAMA_RESPONSE" | grep -q "models"; then
        print_status 0 "Ollama API is accessible"
    else
        print_status 1 "Ollama API connection failed" "API returned unexpected response"
    fi

    # Test model availability
    echo "1.2. Testing llama2 model availability..."
    if echo "$OLLAMA_RESPONSE" | grep -q "llama2"; then
        print_status 0 "llama2 model is available"
    else
        print_status 1 "llama2 model not found" "Model may need to be pulled using setup_model.sh"
    fi

    # Test model generation with multiple prompts
    echo "1.3. Testing model generation..."
    declare -a PROMPTS=("Say hello in exactly one word" "What is 1+1? Answer with just the number" "Name one color")
    for PROMPT in "${PROMPTS[@]}"; do
        echo "Testing prompt: $PROMPT"
        START_TIME=$(date +%s%N)
        GEN_RESPONSE=$(curl -s -X POST http://192.168.137.69:11434/api/generate -d "{
          \"model\": \"llama2\",
          \"prompt\": \"$PROMPT\",
          \"stream\": false
        }")
        END_TIME=$(date +%s%N)
        DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
        
        if echo "$GEN_RESPONSE" | grep -q "response"; then
            RESPONSE_TEXT=$(echo "$GEN_RESPONSE" | grep -o '"response":"[^"]*"' | cut -d'"' -f4)
            WORD_COUNT=$(echo "$RESPONSE_TEXT" | wc -w)
            print_status 0 "Generation successful (${DURATION}ms) - Response: $RESPONSE_TEXT"
        else
            print_status 1 "Generation failed" "API returned unexpected response"
        fi
    done
    
    # Test model embedding generation
    echo "1.4. Testing embedding generation..."
    EMB_RESPONSE=$(curl -s -X POST http://192.168.137.69:11434/api/embeddings -d '{
      "model": "llama2",
      "prompt": "Test embedding generation"
    }')
    if echo "$EMB_RESPONSE" | grep -q "embedding"; then
        EMB_SIZE=$(echo "$EMB_RESPONSE" | grep -o '"embedding":\[[^]]*\]' | tr -cd ',' | wc -c)
        EMB_SIZE=$((EMB_SIZE + 1))
        print_status 0 "Embedding generation successful (Size: $EMB_SIZE)"
    else
        print_status 1 "Embedding generation failed" "API returned unexpected response"
    fi
fi

if [ $QDRANT_CONN -eq 0 ]; then
    echo -e "\n${YELLOW}2. Testing Qdrant Vector DB (192.168.137.34)...${NC}"

    # Test Qdrant API
    echo "2.1. Testing API connection..."
    QDRANT_RESPONSE=$(curl -s http://192.168.137.34:6333/collections)
    if echo "$QDRANT_RESPONSE" | grep -q "result"; then
        print_status 0 "Qdrant API is accessible"
    else
        print_status 1 "Qdrant API connection failed" "API returned unexpected response"
    fi

    # Test collection creation
    echo "2.2. Testing collection operations..."
    TEST_COLLECTION="test_collection_$(date +%s)"
    CREATE_RESPONSE=$(curl -s -X PUT "http://192.168.137.34:6333/collections/$TEST_COLLECTION" -H 'Content-Type: application/json' -d '{
        "vectors": {
            "size": 384,
            "distance": "Cosine"
        }
    }')
    if echo "$CREATE_RESPONSE" | grep -q "ok"; then
        print_status 0 "Collection creation successful"
        
        # Clean up test collection
        DELETE_RESPONSE=$(curl -s -X DELETE "http://192.168.137.34:6333/collections/$TEST_COLLECTION")
        if echo "$DELETE_RESPONSE" | grep -q "ok"; then
            print_status 0 "Collection cleanup successful"
        else
            print_status 1 "Collection cleanup failed" "Failed to delete test collection"
        fi
    else
        print_status 1 "Collection creation failed" "API returned unexpected response"
    fi
fi

if [ $BACKEND_CONN -eq 0 ]; then
    echo -e "\n${YELLOW}3. Testing Backend Service (192.168.137.162:8000)...${NC}"

    # Test OpenAPI docs
    echo "3.1. Testing API documentation..."
    BACKEND_RESPONSE=$(curl -s http://192.168.137.162:8000/docs)
    if echo "$BACKEND_RESPONSE" | grep -q "openapi"; then
        print_status 0 "Backend API documentation is accessible"
    else
        print_status 1 "Backend API documentation not available" "API docs endpoint returned unexpected response"
    fi

    # Test health endpoint with timing
    echo "3.2. Testing health endpoint..."
    START_TIME=$(date +%s%N)
    HEALTH_RESPONSE=$(curl -s http://192.168.137.162:8000/health)
    END_TIME=$(date +%s%N)
    DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
        print_status 0 "Health endpoint responding (${DURATION}ms)"
    else
        print_status 1 "Health check failed" "Endpoint returned unexpected response"
    fi

    # Test query endpoint
    echo "3.3. Testing query endpoint..."
    QUERY_RESPONSE=$(curl -s -X POST http://192.168.137.162:8000/query \
        -H "Content-Type: application/json" \
        -d '{"text": "What is 2+2?"}')
    if echo "$QUERY_RESPONSE" | grep -q "response"; then
        print_status 0 "Query endpoint is responding"
        RESPONSE=$(echo "$QUERY_RESPONSE" | grep -o '"response":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}  Response: $RESPONSE${NC}"
    else
        print_status 1 "Query endpoint test failed" "Endpoint returned unexpected response"
    fi

    # Test store endpoint
    echo "3.4. Testing store endpoint..."
    STORE_RESPONSE=$(curl -s -X POST http://192.168.137.162:8000/store \
        -H "Content-Type: application/json" \
        -d '{"text": "Test vector storage"}')
    if echo "$STORE_RESPONSE" | grep -q "stored"; then
        print_status 0 "Store endpoint is responding"
    else
        print_status 1 "Store endpoint test failed" "Endpoint returned unexpected response"
    fi

    # Test similar endpoint
    echo "3.5. Testing similar endpoint..."
    SIMILAR_RESPONSE=$(curl -s "http://192.168.137.162:8000/similar/test")
    if echo "$SIMILAR_RESPONSE" | grep -q "results"; then
        print_status 0 "Similar endpoint is responding"
    else
        print_status 1 "Similar endpoint test failed" "Endpoint returned unexpected response"
    fi
fi

echo -e "\n${YELLOW}Test Summary:${NC}"
if [ $OLLAMA_CONN -eq 0 ]; then
    echo "- Ollama LLM Service: Tested API, model availability, generation, and embeddings"
else
    echo "- Ollama LLM Service: Connection failed"
fi

if [ $QDRANT_CONN -eq 0 ]; then
    echo "- Qdrant Vector DB: Tested API and collection operations"
else
    echo "- Qdrant Vector DB: Connection failed"
fi

if [ $BACKEND_CONN -eq 0 ]; then
    echo "- Backend Service: Tested all endpoints with timing metrics"
else
    echo "- Backend Service: Connection failed"
fi

if [ $FRONTEND_CONN -eq 0 ]; then
    echo "- Frontend Service: Connection verified"
else
    echo "- Frontend Service: Connection failed"
fi

# Print resource usage summary
echo -e "\n${YELLOW}Resource Usage Summary:${NC}"
echo "Disk Usage: ${DISK_USAGE}%"
echo "Memory Usage: ${MEMORY_USAGE}%"
echo "Swap Usage: ${SWAP_USAGE}%"

echo -e "\n${GREEN}Test Suite Complete!${NC}"
