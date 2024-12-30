# AI Platform System Blueprint

## Core Architecture

### Container Structure
1. CT 200 - LLM Service
- Purpose: Large Language Model serving
- Specs:
  * Memory: 2GB (512MB base + 1.5GB for model operations)
  * CPU Cores: 2
  * Storage: 20GB (sufficient for base models)
  * Components:
    - Ollama v0.5.4
    - Mistral model support
    - CPU-optimized (AVX2 support)

2. CT 201 - Vector Database
- Purpose: Vector storage and retrieval
- Specs:
  * Memory: 1GB (256MB base + 768MB for vector operations)
  * CPU Cores: 2 (optimized)
  * Storage: 50GB (scalable based on vector data)
  * Components:
    - Qdrant vector database
    - Collections API endpoint

3. CT 202 - Development Environment
- Purpose: Development workspace
- Specs:
  * Memory: 1GB (suitable for most development tasks)
  * CPU Cores: 2
  * Storage: 30GB (core development needs)
  * Components:
    - Python 3.10+
    - Development tools
    - Build essentials

4. CT 203 - MCP Server
- Purpose: Model Context Protocol services
- Specs:
  * Memory: 512MB (Node.js minimal footprint)
  * CPU Cores: 1
  * Storage: 10GB (MCP service requirements)
  * Components:
    - OpenAI MCP implementation
    - Node.js runtime

### Storage Configuration
- System Drive: 256GB NVMe
- Data Storage: 916GB HDD (/mnt/extra_storage)

## Service Configuration

### LLM Service (CT 200)
```systemd
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
```

### Vector DB Service (CT 201)
```systemd
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
```

## Network Configuration
- Bridge: vmbr0
- Static IP Configuration:
  * CT 200: 192.168.137.69/24
  * CT 201: 192.168.137.34/24
  * CT 202: 192.168.137.162/24
  * CT 203: 192.168.137.100/24

## API Endpoints
- LLM Service: http://localhost:11434
- Vector DB: http://localhost:6333
- Health Check Endpoints:
  * LLM: /api/version
  * Vector DB: /collections

## Development Tools
```bash
/opt/dev_tools/
├── ai_dev_agent.py
├── code_analyzer.py
└── ai_agent_config.json
```

## Monitoring & Maintenance

### Health Checks
```bash
# Container Status
pct status <ct_id>

# Service Status
systemctl status --no-pager ollama    # CT 200
systemctl status --no-pager qdrant    # CT 201

# API Health
curl http://localhost:11434/api/version
curl http://localhost:6333/collections
```

### Resource Monitoring
```bash
# Container Resources
pct monitor <ct_id>

# Storage Usage
df -h /mnt/extra_storage
du -h /mnt/extra_storage

# Service Logs
journalctl -u ollama --no-pager
journalctl -u qdrant --no-pager
```

## Security Configuration
- AppArmor enabled
- UFW firewall configured
- SSH access enabled
- Container isolation enforced

## Installation Requirements

### Base System
- Ubuntu 22.04 LTS
- Proxmox VE latest stable
- Python 3.10+
- Node.js LTS

### Container Dependencies
```bash
# CT 200
apt install -y ollama python3 python3-pip

# CT 201
apt install -y qdrant-server

# CT 202
apt install -y python3-dev build-essential git

# CT 203
apt install -y nodejs npm
```

## Performance Baselines
- LLM Service: ~39MB idle (0.47%), up to 1.5GB under load
- Vector DB: ~57MB idle (1.39%), up to 768MB under load
- Development Env: ~79MB idle (1.92%), up to 768MB under load
- MCP Server: ~43MB idle (2.09%), up to 384MB under load
- CPU Usage: 
  * LLM: Peaks at 24.6% during inference
  * MCP: Peaks at 46.7% during API processing
  * Normal idle state: 0-3%
- Network: Low latency maintained (<50ms)

## Best Practices
1. Always use containers for deployment
2. Regular health monitoring
3. Resource scaling based on usage
4. Backup strategy for /mnt/extra_storage
5. Regular security updates
6. API endpoint verification before use
