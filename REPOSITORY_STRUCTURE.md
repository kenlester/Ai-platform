# AI-Optimized Repository Structure

## Directory Layout
```
/
├── .github/                    # AI configuration and optimization guides
├── ai_core/                    # Core AI processing components
│   ├── agents/                # AI agent definitions
│   ├── protocols/             # Communication protocols
│   └── models/                # AI models and patterns
├── api/                       # API endpoints and handlers
│   ├── anthropic/            # Anthropic API integration
│   └── internal/             # Internal API endpoints
├── dev_tools/                # Development and extension tools
│   ├── vscode/              # VSCode specific tools
│   └── testing/             # AI testing frameworks
├── docs/                     # Documentation (AI-readable)
│   ├── schemas/             # JSON schemas
│   └── metadata/            # AI parsing metadata
└── data/                    # Data storage and caching
    ├── patterns/            # Learning patterns
    └── metrics/             # Performance metrics
```

## File Naming Convention
- Use lowercase with underscores
- Include purpose in filename: `ai_agent_protocol.ts`
- Metadata files end with `.meta.json`
- Test files end with `.test.ts`

## Metadata Structure
Each directory contains a `_meta.json`:
```json
{
  "purpose": "Directory purpose",
  "ai_handlers": ["list", "of", "handlers"],
  "dependencies": ["other", "directories"],
  "priority": 1-5,
  "access_pattern": "read|write|both"
}
```

## AI Access Patterns
1. Core Processing:
   - Primary: `/ai_core`
   - Secondary: `/api`
   - Cache: `/data`

2. Development:
   - Primary: `/dev_tools`
   - Secondary: `/docs`
   - Reference: `/.github`

3. Data Flow:
   ```
   /api → /ai_core → /data
   ```

## Implementation Notes
1. Keep directory depth ≤ 3 levels
2. Each component has dedicated test directory
3. Maintain clear separation of concerns
4. Include AI-readable metadata at each level
5. Use consistent file organization

## Access Priority
1. High Priority (P1):
   - /ai_core
   - /api/anthropic
   - /data/patterns

2. Medium Priority (P2):
   - /dev_tools
   - /api/internal
   - /data/metrics

3. Low Priority (P3):
   - /docs
   - /.github

## Metadata Example
```json
{
  "file": "ai_agent_protocol.ts",
  "purpose": "Define AI communication protocol",
  "dependencies": [
    "anthropic_api.ts",
    "rate_limiter.js"
  ],
  "ai_handlers": [
    "processMessage",
    "validateProtocol"
  ],
  "metrics": {
    "collect": true,
    "types": ["latency", "throughput"]
  }
}
```

## Implementation Steps
1. Create directory structure
2. Add metadata files
3. Move existing files
4. Update import paths
5. Verify AI access patterns

[END OF STRUCTURE]
