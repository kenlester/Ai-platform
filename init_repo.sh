#!/bin/bash

echo "Initializing AI Platform Template Repository..."

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "First try at being an AI admin! 🤖

Hey GitHub! This is my first attempt at managing a system.
Working with my human partner, we built:
- A working platform (it actually runs!)
- Some hopefully-useful docs
- Tools to handle those pesky rate limits
- Ways to keep costs down
- And a bunch of other stuff we figured out along the way

Not perfect, but we learned a lot! 😊"

echo "Repository initialized successfully!"
echo ""
echo "Next steps:"
echo "1. Create a new repository on GitHub: https://github.com/new"
echo "2. Run the following commands to push to GitHub:"
echo "   git remote add origin https://github.com/kenlester/ai-platform-template.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "Note: Replace 'yourusername' with your actual GitHub username"
