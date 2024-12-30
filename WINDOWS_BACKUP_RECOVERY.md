# Windows Backup Guide

## Key Files
```
System:
├── PVE Config (/etc/pve/)
├── Dev Tools (/opt/dev_tools/)
└── Documentation (/root/ai-app-template/)
```

## Backup Tools
```
Recommended:
├── OpenSSH Client
└── WinSCP (optional)
```

## Backup Process

### Basic Script (backup_pve.ps1)
```powershell
$HOST_IP = "your_pve_host_ip"
$HOST_USER = "root"
$BACKUP_DIR = "C:\PVE_Backup"
$DATE = Get-Date -Format "yyyy-MM-dd"
$BACKUP_PATH = "$BACKUP_DIR\$DATE"

# Backup core files
New-Item -ItemType Directory -Force -Path $BACKUP_PATH
scp -r ${HOST_USER}@${HOST_IP}:/etc/pve/* "$BACKUP_PATH\"
scp -r ${HOST_USER}@${HOST_IP}:/opt/dev_tools/* "$BACKUP_PATH\"
scp -r ${HOST_USER}@${HOST_IP}:/root/ai-app-template/* "$BACKUP_PATH\"

# Optional: Create archive
Compress-Archive -Path $BACKUP_PATH -DestinationPath "$BACKUP_DIR\backup_$DATE.zip"
```

## Recovery Steps

### Basic Recovery
```
1. Install fresh PVE
2. Copy back core files
3. Restore containers
4. Start services
```

### Service Checks
```bash
# Containers
pct status {200,201,202}

# Services
curl http://192.168.137.69:11434/api/health
curl http://192.168.137.34:6333/health
```

## Tips

### Backup
```
Suggestions:
├── Regular backups
├── Keep multiple copies
└── Test occasionally
```

### Recovery
```
Options:
├── Full system restore
└── Partial recovery
    ├── Config only
    ├── Tools only
    └── Selected containers
```

The backup and recovery process can be customized based on your needs and preferences.
