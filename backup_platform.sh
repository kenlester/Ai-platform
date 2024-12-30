#!/bin/bash

# Create backup directory
mkdir -p platform_backup

# Copy core files
cp ADMIN_GUIDE.md platform_backup/
cp deploy_system.sh platform_backup/
cp SYSTEM_BLUEPRINT.md platform_backup/

# Copy development tools
mkdir -p platform_backup/dev_tools
cp -r /opt/dev_tools/* platform_backup/dev_tools/

# Initialize git repository
cd platform_backup
git init
git add .
git commit -m "Initial platform backup - AI-managed system"

echo "Files collected and git repository initialized."
echo "Next steps:"
echo "1. Create a free GitHub repository at https://github.com/new"
echo "2. Run: git remote add origin <your-repo-url>"
echo "3. Run: git push -u origin main"
