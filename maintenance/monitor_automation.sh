#!/bin/bash

# Check cron service
if ! systemctl is-active cron > /dev/null; then
    echo "ERROR: Cron service is not running"
    systemctl restart cron
fi

# Check log files
for log in evolution backup version patterns cleanup; do
    if [ ! -f "/var/log/ai-platform/${log}.log" ]; then
        echo "ERROR: ${log}.log is missing"
        touch "/var/log/ai-platform/${log}.log"
        chmod 644 "/var/log/ai-platform/${log}.log"
    fi
done

# Check script permissions
for script in /root/Ai-platform/maintenance/*.sh; do
    if [ ! -x "${script}" ]; then
        echo "ERROR: ${script} is not executable"
        chmod +x "${script}"
    fi
done

# Report status
echo "Automation monitoring complete at $(date -u)"
