#!/bin/bash

# Pattern Recognition and Optimization Management Script
# Manages AI-to-AI interface optimizations and pattern recognition features

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting Pattern Optimization...${NC}"

# Monitor Pattern Health
monitor_pattern_health() {
    echo -e "\n${YELLOW}Monitoring Pattern Health...${NC}"
    
    # Check Redis health in CT203
    if ! pct exec 203 -- redis-cli ping > /dev/null; then
        echo -e "${RED}Redis is not responding. Restarting service...${NC}"
        pct exec 203 -- systemctl restart redis-server
    fi
    
    # Check pattern monitor service in CT203
    if ! pct exec 203 -- systemctl is-active pattern-monitor > /dev/null; then
        echo -e "${RED}Pattern monitor is down. Restarting service...${NC}"
        pct exec 203 -- systemctl restart pattern-monitor
    fi
}

# Optimize Pattern Recognition
optimize_patterns() {
    echo -e "\n${YELLOW}Optimizing Pattern Recognition...${NC}"
    pct exec 203 -- bash -c '
        # Initialize pattern success rate if not exists
        redis-cli SET pattern_success_rate 0.5 NX
        
        # Set confidence threshold based on success rate
        success_rate=$(redis-cli GET pattern_success_rate)
        redis-cli SET pattern_confidence_threshold "$success_rate"
        
        # Initialize token stats if needed
        redis-cli HSET token_stats total_savings 0 NX
        
        # Configure Redis for optimal performance
        redis-cli CONFIG SET maxmemory-samples 15
        redis-cli CONFIG SET maxmemory-policy allkeys-lru
        redis-cli CONFIG SET maxmemory "2gb"
        
        # Configure optimization settings
        redis-cli HSET optimization_config compression_threshold 256
        redis-cli HSET optimization_config batch_size 20
        redis-cli HSET optimization_config enable_aggressive_compression true
        redis-cli HSET optimization_config pattern_deduplication true
    '
    
    echo -e "${GREEN}Pattern optimization settings applied${NC}"
}

# Main execution
main() {
    # Monitor health
    monitor_pattern_health
    
    # Apply optimizations
    optimize_patterns
    
    echo -e "\n${GREEN}Pattern Optimization Complete!${NC}"
    echo -e "Monitor the results in CT203:/root/ai-platform/metrics/pattern_stats"
}

# Run main function
main
