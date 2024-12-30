#!/bin/bash

# Default model
MODEL="llama2"

# Help message
if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    echo "Usage: $0 [model_name]"
    echo "Available models:"
    echo "  Base Models:"
    echo "    - llama2 (default)"
    echo "    - llama2:13b"
    echo "    - llama2:70b"
    echo "    - mistral"
    echo "    - mixtral"
    echo "    - codellama"
    echo "    - codellama:13b"
    echo "    - neural-chat"
    echo ""
    echo "  Specialized Models:"
    echo "    - llama2-uncensored"
    echo "    - codellama:python"
    echo "    - codellama:instruct"
    echo "    - stable-code:3b"
    echo "    - dolphin-phi"
    echo "    - phi"
    exit 0
fi

# Use provided model name if specified
if [ ! -z "$1" ]; then
    MODEL=$1
fi

echo "Setting up $MODEL model..."
echo "This may take some time depending on the model size..."

# Pull the model
ollama pull $MODEL

# Test the model
echo "Testing model with a simple query..."
curl -X POST http://192.168.137.69:11434/api/generate -d "{
  \"model\": \"$MODEL\",
  \"prompt\": \"Hello! Please respond with a short greeting.\",
  \"stream\": false
}"

echo -e "\n\nModel setup complete! You can now use the AI Assistant platform."
echo "Start the application with: cd ai-app-template && docker compose up --build"
