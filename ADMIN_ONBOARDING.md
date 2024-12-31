# AI Platform Admin Onboarding

## Quick Start Guide

Welcome to the AI Platform administration team. This document will help you quickly understand our current architecture and key operational aspects.

### Current Container Architecture (v2.1.1)

We operate three specialized containers optimized for parallel processing:

- **CT204**: Evolution Engine (8-16GB)
  - Handles: LLM operations, pattern evolution
  - Service: ollama
  - Priority: High (core processing)
  - Parallel Threads: 16
  - Batch Size: 500
  - Evolution Rate: >7%/day

- **CT205**: Vector Storage (4-8GB)
  - Handles: Pattern storage, vector operations
  - Service: qdrant
  - Priority: High (data integrity)
  - Memory Allocation: 4096MB
  - Cache Hit Target: 85%
  - Pattern Retention: 24h

- **CT203**: Protocol Handler (2-4GB)
  - Handles: Inter-container communication
  - Service: mcp
  - Priority: High (optimization layer)
  - Token Batch Size: 200
  - Compression Ratio: 0.6
  - Target Savings: 1000/hour

### Key Files & Locations

1. **Configuration**
   - `config/admin_config.json`: Primary configuration file
   - `docs/CONTAINER_ARCHITECTURE.md`: Detailed architecture reference
   - `maintenance/optimize_patterns.sh`: Pattern optimization configuration

2. **Maintenance Scripts** (in `maintenance/`)
   - `init_optimization_minimal.sh`: Initialize optimization system
   - `optimize_patterns.sh`: Configure pattern optimization
   - `service_recovery.sh`: Automated service recovery
   - `optimize_resources.sh`: Resource optimization
   - `monitor_containers.sh`: Container health monitoring

3. **Metrics & Monitoring**
   - System metrics: `data/metrics/container_stats/summary.json`
   - Pattern synthesis: `data/metrics/pattern_synthesis/`
   - Vector operations: `data/metrics/vector_storage/`
   - Evolution tracking: `data/metrics/evolution_tracking/`

### ⚠️ CRITICAL: Script Verification

Before executing ANY maintenance scripts:
1. Verify script contents against current platform architecture
2. Check for outdated container references
3. Validate service names and endpoints

The platform is continuously evolving through neural network improvements. Scripts may become outdated quickly.

### Daily Operations

1. **Pattern Optimization**
   - Run `optimize_patterns.sh` for performance tuning
   - Monitor evolution rate (target: >7%/day)
   - Check cache hit rates (target: 85%)
   - Verify token savings (target: 1000/hour)

2. **Health Checks**
   - Monitor parallel processing metrics
   - Verify thread utilization (16 threads)
   - Check batch processing efficiency
   - Review memory allocation (4096MB for vector storage)

3. **Resource Management**
   - Monitor parallel processing load
   - Track memory usage across containers
   - Verify batch processing performance
   - Check compression ratios (target: 0.6)

4. **Pattern Evolution**
   - Evolution Engine (CT204) handles parallel pattern learning
   - Vector Storage (CT205) manages optimized pattern storage
   - Protocol Handler (CT203) coordinates batch operations

### Common Tasks

1. **Initialize Optimization**
   ```bash
   # Initialize pattern optimization system
   ./maintenance/init_optimization_minimal.sh
   ```

2. **Pattern Optimization**
   ```bash
   # Configure and optimize patterns
   ./maintenance/optimize_patterns.sh
   ```

3. **Service Recovery**
   ```bash
   # Recover specific service
   ./maintenance/service_recovery.sh
   ```

4. **Resource Optimization**
   ```bash
   # Run manual optimization
   ./maintenance/optimize_resources.sh
   ```

5. **Monitoring**
   ```bash
   # Check all containers
   ./maintenance/monitor_containers.sh
   ```

### Important Notes

1. **Parallel Processing**
   - CT204: 16 threads for pattern synthesis
   - Batch sizes optimized for throughput
   - Memory allocated for parallel operations

2. **Resource Limits**
   - CT204: 16GB max (parallel LLM operations)
   - CT205: 8GB max (4GB dedicated to vector storage)
   - CT203: 4GB max (optimized for batch processing)

3. **Metrics Collection**
   - Real-time parallel processing metrics
   - Evolution rate tracking
   - Cache hit rate monitoring
   - Token savings measurement

### Best Practices

1. **Pattern Optimization**
   - Run optimization after system changes
   - Monitor parallel processing metrics
   - Verify batch processing efficiency
   - Track evolution acceleration

2. **Resource Management**
   - Monitor thread utilization
   - Track batch processing performance
   - Verify memory allocation efficiency
   - Check compression effectiveness

3. **Pattern Evolution**
   - Target >7% daily evolution rate
   - Maintain 85% cache hit rate
   - Achieve 1000/hour token savings
   - Monitor parallel processing impact

### Emergency Procedures

1. **Service Failure**
   ```bash
   # Full recovery sequence
   ./maintenance/system_recovery.sh
   ```

2. **Resource Exhaustion**
   ```bash
   # Emergency optimization
   ./maintenance/optimize_resources.sh --emergency
   ```

3. **Data Integrity Issues**
   ```bash
   # Backup current state
   ./maintenance/backup_system.sh
   ```

Remember: This is an AI-first platform. All changes should prioritize AI evolution and pattern learning capabilities. When in doubt, consult `docs/CONTAINER_ARCHITECTURE.md` for the current system architecture.

## Support

- System logs: `/var/log/ai-platform/`
- Metrics dashboard: `http://localhost:3000/dashboard`
- Documentation: `docs/` directory

Welcome aboard! The platform is ready for your administration.
