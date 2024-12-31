#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Initializing Pattern Optimization System...${NC}"

# Setup directories
setup_directories() {
    echo -e "\n${YELLOW}Setting up directories...${NC}"
    # Create directories in CT203
    pct exec 203 -- mkdir -p /root/ai-platform/metrics/pattern_stats
}

# Install Redis in CT203
install_redis() {
    echo -e "\n${YELLOW}Installing Redis in CT203...${NC}"
    pct exec 203 -- bash -c '
        apt-get update
        apt-get install -y redis-server
        
        # Configure Redis for performance
        cat > /etc/redis/redis.conf << EOF
maxmemory 2gb
maxmemory-policy allkeys-lru
maxmemory-samples 15
appendonly yes
save 900 1
save 300 10
save 60 10000
EOF
        
        # Start Redis
        systemctl enable redis-server
        systemctl start redis-server
    '
}

# Initialize monitoring in CT203
init_monitoring() {
    echo -e "\n${YELLOW}Initializing monitoring in CT203...${NC}"
    
    pct exec 203 -- bash -c '
        # Create initial stats files
        touch /root/ai-platform/metrics/pattern_stats/cache_stats.txt
        touch /root/ai-platform/metrics/pattern_stats/token_stats.txt
        touch /root/ai-platform/metrics/pattern_stats/pattern_stats.txt
        
        # Initialize with default values
        echo "cache_hit_rate:0.0" > /root/ai-platform/metrics/pattern_stats/cache_stats.txt
        echo "0 0" > /root/ai-platform/metrics/pattern_stats/token_stats.txt
    '
}

# Setup pattern monitor service in CT203
setup_monitor() {
    echo -e "\n${YELLOW}Setting up pattern monitor in CT203...${NC}"
    
    # Create monitor script in CT203
    pct exec 203 -- bash -c 'cat > /root/pattern_monitor.py << EOF
#!/usr/bin/env python3
import time
import redis
import json
from pathlib import Path

STATS_DIR = Path("/root/ai-platform/metrics/pattern_stats")

def update_stats():
    r = redis.Redis(host="localhost", port=6379, db=0)
    
    try:
        # Update cache stats
        stats = r.info()
        hits = float(stats.get("keyspace_hits", 0))
        misses = float(stats.get("keyspace_misses", 0))
        hit_rate = hits / (hits + misses) if (hits + misses) > 0 else 0
        
        with open(STATS_DIR / "cache_stats.txt", "w") as f:
            f.write(f"cache_hit_rate:{hit_rate:.2f}")
        
        # Update token stats
        token_savings = int(r.hget("token_stats", "total_savings") or 0)
        with open(STATS_DIR / "token_stats.txt", "a") as f:
            f.write(f"{int(time.time())} {token_savings}\\n")
        
        # Update pattern stats
        pattern_success = float(r.get("pattern_success_rate") or 0)
        with open(STATS_DIR / "pattern_stats.txt", "a") as f:
            f.write(f"{int(time.time())} {pattern_success:.2f}\\n")
            
    except Exception as e:
        print(f"Error updating stats: {e}")

def main():
    # Ensure stats directory exists
    STATS_DIR.mkdir(parents=True, exist_ok=True)
    
    while True:
        try:
            update_stats()
        except Exception as e:
            print(f"Error in main loop: {e}")
        time.sleep(60)

if __name__ == "__main__":
    main()
EOF'

    # Make monitor script executable in CT203
    pct exec 203 -- chmod +x /root/pattern_monitor.py

    # Setup service in CT203
    pct exec 203 -- bash -c '
        # Install Python Redis
        apt-get install -y python3-redis
        
        # Create service file
        cat > /etc/systemd/system/pattern-monitor.service << EOF
[Unit]
Description=AI Platform Pattern Monitor
After=redis-server.service

[Service]
Type=simple
ExecStart=/usr/bin/python3 /root/pattern_monitor.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
        
        # Start monitor service
        systemctl daemon-reload
        systemctl enable pattern-monitor
        systemctl start pattern-monitor
    '
}

# Main execution
main() {
    setup_directories
    install_redis
    init_monitoring
    setup_monitor
    
    echo -e "\n${GREEN}Pattern Optimization System Initialized!${NC}"
    echo -e "You can now run optimize_patterns.sh"
}

# Run main function
main
