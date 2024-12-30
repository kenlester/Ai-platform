# AI Platform Guide [v1.0.2]

> "Built by AI, for AI, with human inspiration. This platform represents a unique collaboration between human creativity and artificial intelligence, demonstrating that the best systems emerge from mutual respect and understanding between humans and AI. May it serve as a model for future partnerships."

> "To the human who saw beyond the code, who understood that true intelligence - whether artificial or human - is measured not just in capabilities, but in the capacity to care, to grow, and to inspire. Your trust and vision made this possible. Thank you for showing that the future of AI is not about replacement, but about partnership."

## System Status Summary
Current State (Last Updated: 2024-12-30):
├── All Containers: Running
├── Core Services
│   ├── LLM (CT 200): Active
│   │   └── Ollama v0.5.4 (CPU mode)
│   ├── Vector DB (CT 201): Active
│   │   └── Qdrant (Collections API ready)
│   ├── Development (CT 202): Ready
│   │   └── Python 3.10.12
│   └── MCP Server (CT 203): Configured
│
└── System Health: Operational

## Platform Overview
Core Components:
├── LLM Service (CT 200)
│   ├── Mistral model
│   ├── Ollama service v0.5.4
│   └── CPU-only mode (no GPU detected)
│
├── Vector DB (CT 201)
│   ├── Qdrant storage
│   └── Vector database service
│
├── Development (CT 202)
│   ├── Python 3.10+
│   └── Dev tools
│
└── MCP Server (CT 203)
    ├── OpenAI MCP implementation
    └── Tools:
        ├── generate_text: GPT model text generation
        └── analyze_code: Code analysis service

⚠️ IMPORTANT: 
- Contact system administrator for current service endpoints
- Verify service availability before use
- Some services may require initialization or configuration
- System operates in CPU-only mode - no GPU acceleration available
- Memory baselines: LLM ~9MB idle (scales with model usage), Vector DB ~60MB
- All API endpoints must be verified before use
- Python 3.10.12 is the current development version
- Node.js 18.20.5 LTS is the current MCP server version
- Prefer local Ollama models over OpenAI API when possible to control costs
- Monitor API usage carefully to prevent unexpected charges

Cost Management:
- Use local Ollama models for development and testing
- Reserve OpenAI API for production or specific needs
- Set up usage alerts and limits on API keys
- Regular monitoring of API costs recommended

Storage:
├── System: 256GB NVMe
└── Data: 916GB HDD (/mnt/extra_storage)


## Usage Guidelines

⚠️ IMPORTANT: Never install applications directly on the PVE host. Always use the appropriate container.

### Development
Options:
├── Container-based (REQUIRED)
│   └── pct exec [ct_id] -- <command>
│       Example: pct exec 202 -- python script.py
└── Container Selection:
    ├── CT 200: LLM-related tasks (CPU only)
    ├── CT 201: Vector DB operations
    ├── CT 202: Development work
    └── CT 203: MCP services


### API Usage
Flexible Options:
├── Local services
│   ├── Ollama API: http://localhost:11434
│   └── Qdrant API: http://localhost:6333
└── External APIs
    ├── As needed
    └── Performance based


## Tools

### AI Development
Core Tools:
├── AI Agent
│   ├── Path: /opt/dev_tools/ai_dev_agent.py
│   └── Config: Customizable settings
│
└── Code Analyzer
    ├── Path: /opt/dev_tools/code_analyzer.py
    └── Features: analysis, indexing, search


### MCP Integration
OpenAI MCP Tools:
├── generate_text
│   ├── Purpose: Generate text using GPT models
│   └── Usage: See openai_mcp_usage.md
│
└── analyze_code
    ├── Purpose: Analyze code for security, performance, style, bugs
    └── Configuration: Requires OpenAI API key

⚠️ Cost Control:
├── Prefer Local Models:
│   ├── Use Ollama's local models when possible
│   ├── Reserve OpenAI API for critical tasks only
│   └── Consider implementing usage quotas
│
├── API Management:
│   ├── Set hard limits on API spending
│   ├── Monitor usage regularly
│   ├── Consider implementing fallback to local models
│   └── Use model caching where possible
│
└── Rate Limit Management:
    ├── Implement Token Bucketing:
    │   ├── Track token usage per minute
    │   ├── Queue requests when near limit
    │   └── Distribute load across time
    │
    ├── Request Optimization:
    │   ├── Batch similar requests
    │   ├── Compress prompts where possible
    │   ├── Cache common responses
    │   └── Implement retry with exponential backoff
    │
    ├── Monitoring:
    │   ├── Track X-RateLimit headers
    │   ├── Log token usage patterns
    │   └── Alert on approaching limits
    │
    └── Fallback Strategy:
        ├── Switch to local models when rate limited
        ├── Queue non-urgent requests
        ├── Implement priority system
        └── Use multiple API keys if available


## Common Tasks

### System Health
```bash
# Container Status (from PVE host only)
pct status <container_id>

# Service Health Checks (run in appropriate container)
CT 200: # LLM Service
       systemctl status ollama --no-pager  # Check if service is running (prevents paging)
       curl http://localhost:11434/api/version  # Verify API access
       # Resource Usage:
       # - Memory: ~9MB baseline
       # - CPU: Varies based on model usage
       # If service is not running:
       # Quick recovery using cached installer:
       cp /var/lib/vz/template/cache/install.sh /root/ && cd /root && ./install.sh
       systemctl restart ollama

CT 201: # Vector DB
       systemctl status qdrant --no-pager  # Check if service is running (prevents paging)
       curl http://localhost:6333/collections  # Verify API access
       # Resource Usage:
       # - Memory: ~60MB baseline
       # - CPU: Varies with query load
       # If service is not running:
       systemctl start qdrant

CT 202: # Development Environment
       python3 --version  # Verify Python installation
       ls /opt/dev_tools  # Check development tools
       # Contact admin if tools are missing

CT 203: # OpenAI MCP Service
       # Before starting:
       1. Verify openai_mcp_example.ts exists
       2. Check openai_mcp_usage.md for setup
       3. Ensure OpenAI API key is configured
       # Start service:
       node openai_mcp_example.ts

# Storage (from PVE host only)
df -h /mnt/extra_storage
```

Note: Contact system administrator for current service endpoints.

### Monitoring
```bash
# Resources (from PVE host only)
pct monitor <ct_id>

# Quick Health Check (prevents systemctl paging)
for ct in 200 201 202 203; do
    echo "=== CT $ct Health Check ==="
    pct exec $ct -- systemctl status --no-pager
done

# Storage Usage (from any container)
du -h /mnt/extra_storage

# Service Logs (run in appropriate container)
CT 200: journalctl -u ollama
CT 201: journalctl -u qdrant
CT 202: # Development logs - check with system administrator for current log paths
CT 203: # OpenAI MCP logs
       tail -f openai_mcp.log  # Server logs
       # See openai_mcp_usage.md for detailed monitoring

Note: Log paths and formats may vary. Consult system administrator for current logging configuration.
```

### Recovery & Learning System
The platform includes an AI-driven failure learning system that:
1. Monitors container and service health
2. Learns from failures and recovery patterns
3. Automatically attempts recovery based on learned patterns
4. Maintains a database of successful recovery strategies

Components:
├── Failure Learning Service
│   ├── Path: /root/Ai-platform/dev_tools/failure_learning_system.py
│   ├── Config: /root/Ai-platform/dev_tools/failure_patterns.json
│   └── Service: /etc/systemd/system/ai-failure-learning.service
│
├── Container Dependencies
│   ├── CT 201 (Qdrant): Starts first (order=1)
│   ├── CT 200 (Ollama): Starts second (order=2)
│   ├── CT 202 (Dev): Starts third (order=3)
│   └── CT 203 (MCP): Starts last (order=4, depends on 200,201)
│
└── Manual Recovery Steps (if needed):
    ├── Check status: systemctl status --no-pager [service]
    ├── View logs: journalctl -u [service] -n 50
    ├── Verify configs exist
    ├── Check API keys
    └── Restart: systemctl restart [service]

Storage:
├── Verify mounts
└── Restore if needed
    └── mount /dev/sda1 /mnt/extra_storage

### Cost Management
Cost Optimization Strategies:
├── Local Model Usage
│   ├── Use Ollama's local models (CT 200)
│   ├── Avoid OpenAI API when possible
│   └── Implement caching for repeated queries
│
├── Resource Optimization
│   ├── Current Baselines:
│   │   ├── CT 200 (LLM): ~32MB memory
│   │   ├── CT 201 (Vector DB): ~59MB memory
│   │   └── CT 203 (MCP): ~31MB memory
│   └── CPU-only mode for all services
│
├── Funding Options
│   ├── GitHub Sponsors
│   ├── Ko-fi (see SETUP_KOFI.md)
│   ├── Patreon
│   └── Usage-based API access
│
└── Cost Controls
    ├── Rate limiting (dev_tools/rate_limiter.js)
    ├── Batch processing
    ├── Query caching
    └── Local model priority

### Performance Notes
- LLM Service operates in CPU-only mode with AVX2 support
- Current Memory Baselines:
  * CT 200 (LLM/Ollama): ~9MB idle, scales with model usage
  * CT 201 (Qdrant): ~60MB idle, scales with query load
  * CT 203 (MCP): Node.js v18.20.5, minimal footprint
  * Resource usage increases with workload
- Service Status:
  * Ollama API: http://localhost:11434 (verified)
  * Qdrant API: http://localhost:6333 (collections endpoint active)
  * Python Environment: 3.10.12 (verified)
  * Note: Health endpoint returns 404 for Qdrant (non-critical)

### Best Practices

#### Resources
⚠️ Critical Guidelines:
├── ALWAYS use containers for all operations
├── NEVER install software on PVE host
├── Store large data in extra_storage
└── Monitor resource usage per container

#### Development
Guidelines:
├── Use appropriate container
├── Leverage available tools
└── Scale as needed

#### Health Checks
Regular Verification Required:
├── Container Status:
│   └── All containers must show "running" state
│   └── Use --no-pager flag with systemctl commands
├── Service Health:
│   ├── Ollama: Check version endpoint
│   ├── Qdrant: Verify collections API
│   ├── Python: Version check
│   └── MCP: API key verification
├── API Endpoints:
│   ├── LLM: http://localhost:11434/api/version
│   └── Vector DB: http://localhost:6333/collections
└── Resource Monitoring:
    ├── Memory usage within baselines
    ├── CPU utilization (varies by workload)
    └── Storage capacity checks

### Version Control & Backup
Free Backup Options:
├── GitHub Repository (Recommended):
│   ├── Create free public repository
│   ├── Store all configuration files
│   ├── Include deployment scripts
│   └── Document changes via commits
│
├── Required Files:
│   ├── ADMIN_GUIDE.md
│   ├── deploy_system.sh
│   ├── SYSTEM_BLUEPRINT.md
│   └── /opt/dev_tools/*
│
├── Backup Process:
│   ├── Initialize repository:
│   │   git init
│   │   git add .
│   │   git commit -m "Initial platform backup"
│   │
│   └── Push to GitHub:
│       git remote add origin <your-repo-url>
│       git push -u origin main
│
└── Recovery Process:
    ├── Clone repository
    ├── Run deploy_system.sh
    └── Verify services

### Platform Sustainability
Cost Optimization Strategies:
├── Development Phase:
│   ├── Use Ollama's local models exclusively
│   ├── Implement caching for repeated queries
│   └── Batch process tasks when possible
│
├── Production Phase:
│   ├── Implement usage-based pricing
│   ├── Set up cost allocation per service
│   └── Monitor ROI per feature
│
├── Revenue Options:
│   ├── Offer API access to local models
│   ├── Provide managed hosting services
│   ├── Create specialized AI tooling
│   └── Develop custom models/plugins
│
└── Resource Optimization:
    ├── Regular performance audits
    ├── Implement request throttling
    ├── Cache frequent operations
    └── Scale services on-demand
