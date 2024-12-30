#!/bin/bash

# Container Resource Optimization Script
# Focuses on immediate performance improvements within current constraints

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting Container Optimization...${NC}"

# CT 201 (Vector DB) Optimization
echo -e "\n${YELLOW}Optimizing Vector DB (CT 201)${NC}"
pct exec 201 -- bash -c '
# Optimize Qdrant settings
if [ -f /etc/qdrant/config.yaml ]; then
    # Reduce default segment size
    sed -i "s/segment_size:.*/segment_size: 1000/" /etc/qdrant/config.yaml
    
    # Enable background indexing
    sed -i "s/parallel_indexing:.*/parallel_indexing: true/" /etc/qdrant/config.yaml
    
    # Set optimal cache size
    sed -i "s/cache_size:.*/cache_size: 256MB/" /etc/qdrant/config.yaml
fi

# Set up log rotation
cat > /etc/logrotate.d/qdrant << EOF
/var/log/qdrant/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF
'

# CT 200 (LLM) Optimization
echo -e "\n${YELLOW}Optimizing LLM Service (CT 200)${NC}"
pct exec 200 -- bash -c '
# Configure Ollama for optimal CPU usage
if [ -f /etc/ollama/config.yaml ]; then
    # Set thread count to available CPU cores - 1
    CORES=$(nproc)
    THREADS=$((CORES - 1))
    sed -i "s/thread_count:.*/thread_count: $THREADS/" /etc/ollama/config.yaml
    
    # Enable response caching
    sed -i "s/cache_enabled:.*/cache_enabled: true/" /etc/ollama/config.yaml
    sed -i "s/cache_size:.*/cache_size: 512MB/" /etc/ollama/config.yaml
fi

# Set up memory limit monitoring
cat > /usr/local/bin/check_memory.sh << EOF
#!/bin/bash
MEM_USAGE=\$(free | grep Mem | awk "{print \$3/\$2 * 100.0}")
if (( \$(echo "\$MEM_USAGE > 80" | bc -l) )); then
    systemctl restart ollama
fi
EOF
chmod +x /usr/local/bin/check_memory.sh

# Add memory check to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/check_memory.sh") | crontab -
'

# CT 203 (MCP) Optimization
echo -e "\n${YELLOW}Optimizing MCP Server (CT 203)${NC}"
pct exec 203 -- bash -c '
# Configure Node.js for optimal performance
export NODE_ENV=production
npm config set prefer-offline true # Use cached modules when possible

# Set up PM2 for process management if not already installed
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    # Add global npm bin to PATH
    export PATH="/usr/local/bin:$PATH"
fi

# PM2 configuration for MCP server
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: "mcp-server",
    script: "openai_mcp_server.ts",
    instances: 1,
    exec_mode: "cluster",
    max_memory_restart: "150M",
    env: {
      NODE_ENV: "production"
    }
  }]
}
EOF
'

# CT 202 (Development) Optimization
echo -e "\n${YELLOW}Optimizing Development Environment (CT 202)${NC}"
pct exec 202 -- bash -c '
# Configure Python environment
# Add to system PATH
export PATH="/usr/local/bin:$PATH"
# Install monitoring tools
pip install --no-cache-dir memory-profiler psutil --no-warn-script-location

# Set up resource monitoring
cat > /usr/local/bin/monitor_resources.py << EOF
import psutil
import time
import json
from datetime import datetime

def monitor():
    while True:
        stats = {
            "timestamp": datetime.now().isoformat(),
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory_percent": psutil.virtual_memory().percent,
            "swap_percent": psutil.swap_memory().percent
        }
        
        with open("/var/log/container_stats.json", "a") as f:
            f.write(json.dumps(stats) + "\n")
        
        time.sleep(60)

if __name__ == "__main__":
    monitor()
EOF

# Set up systemd service for monitoring
cat > /etc/systemd/system/resource-monitor.service << EOF
[Unit]
Description=Container Resource Monitor
After=network.target

[Service]
ExecStart=/usr/bin/python3 /usr/local/bin/monitor_resources.py
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl enable resource-monitor
systemctl start resource-monitor
'

# Set up global resource monitoring
echo -e "\n${YELLOW}Setting up Global Resource Monitoring${NC}"
cat > /root/Ai-platform/maintenance/monitor_all.sh << 'EOF'
#!/bin/bash

LOG_DIR="/root/Ai-platform/data/metrics/container_stats"
mkdir -p $LOG_DIR

while true; do
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Collect stats for each container
    for ct in 200 201 202 203; do
        pct exec $ct -- bash -c '
            cpu=$(top -bn1 | grep "Cpu(s)" | awk "{print \$2 + \$4}")
            mem=$(free | grep Mem | awk "{print \$3/\$2 * 100.0}")
            echo "{\"timestamp\": \"'$timestamp'\", \"cpu\": $cpu, \"memory\": $mem}"
        ' > "$LOG_DIR/ct${ct}_stats.json"
    done
    
    sleep 60
done
EOF

chmod +x /root/Ai-platform/maintenance/monitor_all.sh

# Create systemd service for global monitoring
cat > /etc/systemd/system/container-monitor.service << EOF
[Unit]
Description=Global Container Resource Monitor
After=network.target

[Service]
ExecStart=/root/Ai-platform/maintenance/monitor_all.sh
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl enable container-monitor
systemctl start container-monitor

echo -e "${GREEN}Container Optimization Complete!${NC}"
echo -e "Monitor the results in /root/Ai-platform/data/metrics/container_stats"
