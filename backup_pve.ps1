# PVE Backup Script for Windows 11
# Run as Administrator

$HOST_IP = "your_pve_host_ip"
$HOST_USER = "root"
$BACKUP_DIR = "C:\PVE_Backup"
$DATE = Get-Date -Format "yyyy-MM-dd"
$BACKUP_PATH = "$BACKUP_DIR\$DATE"

# Create backup directories
Write-Host "Creating backup directories..."
New-Item -ItemType Directory -Force -Path $BACKUP_PATH
New-Item -ItemType Directory -Force -Path "$BACKUP_PATH\pve"
New-Item -ItemType Directory -Force -Path "$BACKUP_PATH\dev_tools"
New-Item -ItemType Directory -Force -Path "$BACKUP_PATH\docs"

# Backup PVE configs
Write-Host "Backing up PVE configurations..."
scp -r ${HOST_USER}@${HOST_IP}:/etc/pve/* "$BACKUP_PATH\pve\"

# Backup development tools
Write-Host "Backing up development tools..."
scp -r ${HOST_USER}@${HOST_IP}:/opt/dev_tools/* "$BACKUP_PATH\dev_tools\"

# Backup documentation
Write-Host "Backing up documentation..."
scp -r ${HOST_USER}@${HOST_IP}:/root/ai-app-template/* "$BACKUP_PATH\docs\"

# Create checksum file
Write-Host "Generating checksums..."
Get-ChildItem -Recurse $BACKUP_PATH | Get-FileHash | Export-Csv "$BACKUP_PATH\checksums.csv"

# Compress backup
Write-Host "Compressing backup..."
Compress-Archive -Path $BACKUP_PATH -DestinationPath "$BACKUP_DIR\pve_backup_$DATE.zip"

Write-Host "Backup completed successfully!"
Write-Host "Backup location: $BACKUP_DIR\pve_backup_$DATE.zip"
Write-Host "Remember to store this backup in a secure, off-site location."
