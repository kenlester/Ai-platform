# AI Platform Development Tools

## Failure Learning System

The Failure Learning System is an AI-driven monitoring and recovery system that learns from system failures and automatically applies successful recovery patterns.

### Components

1. Main Service
- Script: `failure_learning_system.py`
- Service: `ai-failure-learning.service`
- Config: `failure_patterns.json`
- Database: `/opt/ai_platform/failure_learning.db`

2. Container Dependencies
```
CT 201 (Qdrant) → CT 200 (Ollama) → CT 202 (Dev) → CT 203 (MCP)
```

### Installation

1. Ensure directories exist:
```bash
mkdir -p /opt/ai_platform
chmod 755 /opt/ai_platform
```

2. Install service:
```bash
cp ai-failure-learning.service /etc/systemd/system/
systemctl daemon-reload
```

3. Start service:
```bash
systemctl start ai-failure-learning
systemctl enable ai-failure-learning
```

### Monitoring

1. Check service status:
```bash
systemctl status ai-failure-learning --no-pager
```

2. View logs:
```bash
# Service logs
tail -f /var/log/ai-failure-learning.log

# Error logs
tail -f /var/log/ai-failure-learning.error.log

# Journal logs
journalctl -u ai-failure-learning --no-pager -n 50
```

3. Database queries:
```sql
-- Check learned patterns
SELECT pattern_hash, success_count, fail_count, best_solution 
FROM learned_patterns 
ORDER BY success_count DESC;

-- View recent failures
SELECT timestamp, service, error_type, recovery_success 
FROM failure_events 
ORDER BY timestamp DESC 
LIMIT 10;
```

### Cost Management

The system is designed to minimize costs by:
1. Using local Ollama models instead of OpenAI API
2. Implementing efficient memory usage (~32MB per container)
3. Operating in CPU-only mode
4. Caching successful recovery patterns

### Recovery Procedures

If the learning system fails:

1. Check logs for errors:
```bash
journalctl -u ai-failure-learning --no-pager -n 100
```

2. Verify database access:
```bash
ls -l /opt/ai_platform/failure_learning.db
```

3. Restart service:
```bash
systemctl restart ai-failure-learning
```

4. Verify monitoring:
```bash
tail -f /var/log/ai-failure-learning.log
```

### Best Practices

1. Regular Maintenance
- Monitor log files for growth
- Review learned patterns periodically
- Backup failure_learning.db regularly

2. Performance Optimization
- Keep database size manageable
- Review and prune old failure events
- Monitor memory usage

3. Cost Control
- Use local models exclusively
- Implement caching where possible
- Batch operations when feasible

### Troubleshooting

1. Service won't start:
- Check permissions on /opt/ai_platform
- Verify Python virtual environment
- Check log files for errors

2. Learning not working:
- Verify database permissions
- Check pattern matching logic
- Review failure_patterns.json

3. Recovery not automatic:
- Check solution cache
- Verify pvesh permissions
- Review container status checks

### Future Improvements

1. Planned Features:
- Pattern prediction for preemptive recovery
- Advanced failure analysis
- Cross-container dependency mapping

2. Optimization Opportunities:
- Enhanced caching strategies
- Improved pattern recognition
- Resource usage optimization

For more details, see ADMIN_GUIDE.md
