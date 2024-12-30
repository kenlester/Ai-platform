# Welcome to the AI Platform

## Available Resources

### Core Services
```
LLM Service:
├── Mistral model
├── http://192.168.137.69:11434
└── AI inference and generation

Vector Database:
├── Qdrant storage
├── http://192.168.137.34:6333
└── Embedding management

Development:
├── Python 3.10+
├── AI tools
└── Testing framework
```

### Storage
```
Available:
├── System: 256GB NVMe
└── Data: 1TB HDD
```

## Development Tools

### AI Tools
```
Core:
├── AI Agent
│   ├── /opt/dev_tools/ai_dev_agent.py
│   └── Analysis and optimization
│
└── Code Analyzer
    ├── /opt/dev_tools/code_analyzer.py
    └── Code analysis and search
```

### MCP Features
```
Available:
├── Model management
├── Training tools
├── Performance monitoring
└── Custom extensions
```

## Getting Started

### Quick Start
```bash
# Check services
curl http://192.168.137.69:11434/api/health
curl http://192.168.137.34:6333/health

# Access development
pct exec 202 -- bash
source /opt/dev_env/bin/activate
```

### Development
```
Options:
├── Container-based
│   └── pct exec [ct_id]
└── Direct access
    └── When needed
```

## Usage Tips

### Resources
```
Storage:
├── Large data → extra_storage
└── Code → development container

Processing:
├── Local services available
└── External APIs as needed
```

### Tools
```
Available:
├── AI development
├── Code analysis
├── Vector storage
└── Model inference
```

Welcome! The platform is ready for your AI development needs. Use the tools and resources that work best for your tasks.
