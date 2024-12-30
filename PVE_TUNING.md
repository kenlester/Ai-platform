# PVE Container Tuning Guide

## Current Configuration Analysis

### CT 200 (LLM Service)
Current:
- Memory: 8192MB
- Cores: 4
- Swap: 4096MB
- Storage: 100G
- Network: Static IP

Optimization:
✓ Memory allocation appropriate for LLM workloads
✓ Core count suitable for CPU-only inference
✓ Swap space well-proportioned
! Consider increasing storage if model collection grows

### CT 201 (Vector DB)
Current:
- Memory: 4096MB
- Cores: 2
- Swap: 2048MB
- Storage: 200G
- Network: Static IP

Optimization:
✓ Storage allocation good for vector data
✓ Memory sufficient for current workload
! Consider increasing cores to 4 for better query performance
! Adjust swap to 4096MB for larger index operations

### CT 202 (Development)
Current:
- Memory: 2048MB
- Cores: 2
- Swap: 4096MB
- Storage: 100G
- Network: Static IP

Optimization:
✓ Storage sufficient for development
! Increase memory to 4096MB for development tools
! Consider increasing cores to 4 for build performance
✓ Swap space well-proportioned

### CT 203 (MCP Server)
Current:
- Memory: 2048MB
- Cores: Not specified
- Swap: 512MB
- Storage: 20G
- Network: DHCP

Optimization:
! Set cores to 2 (minimum)
! Increase swap to 2048MB
! Configure static IP for stability
✓ Memory allocation sufficient
✓ Storage adequate for MCP service

## Tuning Commands

```bash
# CT 201 (Vector DB) Optimizations
pct set 201 --cores 4
pct set 201 --swap 4096

# CT 202 (Development) Optimizations
pct set 202 --cores 4
pct set 202 --memory 4096

# CT 203 (MCP Server) Optimizations
pct set 203 --cores 2
pct set 203 --swap 2048
pct set 203 --net0 name=eth0,bridge=vmbr0,gw=192.168.137.1,ip=192.168.137.100/24,type=veth
```

## Resource Allocation Summary

Optimized Configuration:
```
CT 200 (LLM):
- Memory: 8GB (No change)
- Cores: 4 (No change)
- Swap: 4GB (No change)
- Storage: 100GB (Monitor usage)

CT 201 (Vector DB):
- Memory: 4GB (No change)
- Cores: 4 (Increased from 2)
- Swap: 4GB (Increased from 2GB)
- Storage: 200GB (No change)

CT 202 (Development):
- Memory: 4GB (Increased from 2GB)
- Cores: 4 (Increased from 2)
- Swap: 4GB (No change)
- Storage: 100GB (No change)

CT 203 (MCP):
- Memory: 2GB (No change)
- Cores: 2 (Newly set)
- Swap: 2GB (Increased from 512MB)
- Storage: 20GB (No change)
- Network: Static IP (Changed from DHCP)
```

## Performance Monitoring

After applying changes:
1. Monitor container resource usage:
   ```bash
   pct monitor <ct_id>
   ```

2. Check service performance:
   ```bash
   # CT 201 (Vector DB)
   pct exec 201 -- curl http://localhost:6333/metrics

   # CT 200 (LLM)
   pct exec 200 -- curl http://localhost:11434/api/version

   # CT 202 (Development)
   pct exec 202 -- free -h
   pct exec 202 -- top -bn1
   ```

3. Monitor storage usage:
   ```bash
   pct exec <ct_id> -- df -h
   ```

## Notes

- All containers configured to start on boot (onboot: 1)
- Network configuration uses vmbr0 bridge
- Static IPs assigned for stability (except CT 203, being updated)
- Resource allocations based on observed usage patterns
- Storage allocations sufficient for current workload

## Maintenance

Regular checks:
1. Monitor storage usage growth
2. Check swap usage patterns
3. Verify network stability
4. Monitor memory usage peaks
5. Track CPU utilization

Adjust resources if:
- Memory usage consistently above 80%
- Swap usage becomes frequent
- CPU usage regularly maxed
- Storage usage exceeds 80%
