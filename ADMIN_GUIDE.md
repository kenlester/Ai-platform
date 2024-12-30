# AI Platform Guide [v1.1.0]

[Previous sections remain the same until Platform Overview]

## Platform Overview
Core Components:
├── LLM Service (CT 200)
│   ├── Mistral model
│   ├── Ollama service v0.5.4
│   ├── Endpoint: http://192.168.137.69:11434
│   ├── CPU-only mode (no GPU detected)
│   └── Memory: 8GB allocated
│
├── Vector DB (CT 201)
│   ├── Qdrant storage
│   ├── Endpoint: http://192.168.137.34:6333
│   ├── Collections: ai_patterns, queries
│   └── Memory: 4GB allocated
│
├── Development (CT 202)
│   ├── Python 3.10+
│   ├── Memory: 4GB allocated
│   └── Dev tools
│
├── MCP Server (CT 203)
│   ├── OpenAI MCP implementation
│   ├── Memory: 2GB allocated
│   └── Tools:
│       ├── generate_text: GPT model text generation
│       └── analyze_code: Code analysis service
│
└── AI Communication Layer
    ├── Protocol Handler: Standardized AI-to-AI messaging
    ├── Platform Interface: Direct AI system access
    └── Optimization Features:
        ├── Token usage tracking
        ├── Neural pattern recognition
        ├── Response caching
        └── Batch processing

### Failure Learning System
Neural Pattern Recognition:
├── Machine Learning Components
│   ├── IsolationForest anomaly detection
│   ├── Time series analysis
│   ├── Feature extraction
│   └── Confidence scoring
│
├── Predictive Capabilities
│   ├── 1-hour prediction window
│   ├── Pattern-based forecasting
│   ├── Resource usage prediction
│   └── Failure probability estimation
│
├── Recovery Optimization
│   ├── Success rate tracking
│   ├── Solution confidence scoring
│   ├── Automated recovery procedures
│   └── Learning from outcomes
│
└── Monitoring Integration
    ├── AI-readable logging
    ├── Real-time metrics
    ├── Pattern database
    └── System state analysis

### Version Control
Local Development:
├── Branch Structure
│   ├── main: Stable release branch
│   ├── local_ml_improvements: Enhanced ML features
│   └── Tags: Version tracking (e.g., v1.1.0)
│
├── Independent Operation
│   ├── Local version control
│   ├── Branch-based development
│   ├── Tag-based versioning
│   └── No remote dependencies
│
└── Release Management
    ├── Local branching
    ├── Version tagging
    ├── Changelog maintenance
    └── Independent deployment

### Token Optimization System
Multi-Level Processing:
├── Level 1: Memory Cache
│   ├── LRU-based caching (500 entries)
│   ├── 24-hour TTL
│   └── Instant retrieval
│
├── Level 2: Vector Store
│   ├── Semantic similarity search
│   ├── Neural pattern matching
│   └── Context-aware retrieval
│
├── Level 3: Local Model
│   ├── Mistral inference
│   ├── Response validation
│   └── Quality checks
│
└── Level 4: External APIs
    ├── Used only when necessary
    ├── Response caching
    └── Token tracking

[Previous sections remain the same until System Monitoring]

### System Monitoring

#### Service Health Checks
```bash
# Check Ollama status
curl -s http://192.168.137.69:11434/api/version

# Check Qdrant collections
curl -s -H "Content-Type: application/json" http://192.168.137.34:6333/collections

# Monitor all containers
bash /root/Ai-platform/maintenance/monitor_containers.sh
```

#### Failure Learning System
```bash
# Check prediction status
tail -f /var/log/ai-failure-learning.log

# View pattern database
sqlite3 /opt/ai_platform/failure_learning.db \
  "SELECT * FROM learned_patterns ORDER BY last_seen DESC LIMIT 5;"

# Monitor prediction accuracy
sqlite3 /opt/ai_platform/failure_learning.db \
  "SELECT AVG(CASE WHEN was_correct THEN 1 ELSE 0 END) as accuracy \
   FROM failure_predictions WHERE predicted_time < datetime('now');"
```

#### Recovery Management
```bash
# View success rates
sqlite3 /opt/ai_platform/failure_learning.db \
  "SELECT service, error_type, \
   ROUND(AVG(CASE WHEN recovery_success THEN 1 ELSE 0 END) * 100, 2) as success_rate \
   FROM failure_events GROUP BY service, error_type;"

# Check recent recoveries
tail -n 50 /var/log/ai-failure-learning.log | grep "Recovery attempt"
```

#### Container Health
```bash
# Monitor container stats
watch -n 5 'cat /root/Ai-platform/data/metrics/container_stats/summary.json'

# View ML predictions
sqlite3 /opt/ai_platform/failure_learning.db \
  "SELECT * FROM failure_predictions \
   WHERE predicted_time > datetime('now') \
   ORDER BY confidence DESC LIMIT 5;"
```

#### Version Management
```bash
# Check current version
git describe --tags

# View local branches
git branch

# Check version history
git log --oneline --decorate
```

### Network Configuration

#### Service Endpoints
```bash
# Container Network Configuration
CT 200 (LLM): 192.168.137.69
CT 201 (Vector DB): 192.168.137.34
CT 202 (Development): 192.168.137.202
CT 203 (MCP Server): 192.168.137.203
```

#### Firewall Management
```bash
# Check firewall status for Ollama
pct exec 200 -- ufw status

# Check firewall status for Qdrant
pct exec 201 -- ufw status

# Allow service ports
pct exec 200 -- ufw allow 11434/tcp  # Ollama
pct exec 201 -- ufw allow 6333/tcp   # Qdrant HTTP
pct exec 201 -- ufw allow 6334/tcp   # Qdrant gRPC
```

#### Network Troubleshooting
```bash
# Check service binding
pct exec 200 -- ss -tlnp | grep ollama
pct exec 201 -- ss -tlnp | grep qdrant

# Verify network connectivity
ping -c 1 192.168.137.69  # Ollama
ping -c 1 192.168.137.34  # Qdrant

# Test service endpoints
curl -v http://192.168.137.69:11434/api/version
curl -v http://192.168.137.34:6333/collections
```

### Service Configuration

#### Configuration Files
```bash
# Ollama Service (CT 200)
/etc/systemd/system/ollama.service
Environment Variables:
├── OLLAMA_HOST=0.0.0.0:11434
└── OLLAMA_ORIGINS=*

# Qdrant Service (CT 201)
/etc/qdrant/config.yaml
Key Settings:
├── storage_path: "/var/lib/qdrant/storage"
├── service.host: "0.0.0.0"
├── service.http_port: 6333
└── service.grpc_port: 6334

# Failure Learning System
/etc/systemd/system/ai-failure-learning.service
Data Locations:
├── Log file: /var/log/ai-failure-learning.log
├── Database: /opt/ai_platform/failure_learning.db
└── Patterns: /opt/ai_platform/failure_patterns.json
```

#### Configuration Management
```bash
# Apply configuration changes
pct exec 200 -- systemctl daemon-reload  # After service file changes
pct exec 201 -- systemctl daemon-reload

# Verify configurations
pct exec 200 -- systemctl show ollama
pct exec 201 -- cat /etc/qdrant/config.yaml

# Backup configurations
cp /root/Ai-platform/dev_tools/ai-failure-learning.service /root/Ai-platform/backup/
pct exec 200 -- cp /etc/systemd/system/ollama.service /root/service-backups/
pct exec 201 -- cp /etc/qdrant/config.yaml /root/service-backups/
```

### Service Management

#### Ollama Service (CT 200)
```bash
# Start/Stop/Restart Ollama
pct exec 200 -- systemctl start ollama
pct exec 200 -- systemctl stop ollama
pct exec 200 -- systemctl restart ollama

# Check Ollama logs
pct exec 200 -- journalctl -u ollama --no-pager -n 50
```

#### Qdrant Service (CT 201)
```bash
# Start/Stop/Restart Qdrant
pct exec 201 -- systemctl start qdrant
pct exec 201 -- systemctl stop qdrant
pct exec 201 -- systemctl restart qdrant

# Check Qdrant logs
pct exec 201 -- journalctl -u qdrant --no-pager -n 50
```

### Best Practices

#### Service Management
Guidelines:
├── Monitor service endpoints regularly
├── Check service logs for errors
├── Verify network connectivity
└── Monitor resource usage

#### Failure Prevention
Guidelines:
├── Monitor prediction accuracy
├── Review pattern database regularly
├── Adjust confidence thresholds
└── Validate recovery procedures

#### ML System Management
Best Practices:
├── Regular pattern database maintenance
├── Monitor prediction window effectiveness
├── Review recovery success rates
└── Adjust anomaly detection parameters

#### Local Development
Guidelines:
├── Use local branching for features
├── Maintain version tags
├── Update changelog regularly
└── Test recovery procedures

[Rest of the original content remains the same]
