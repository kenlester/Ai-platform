#!/usr/bin/env python3
"""
AI Platform Connector
Provides a minimal interface for Ken (human assistant) to connect with the AI platform
while maintaining AI-centric communication protocols.
"""
import json
import sys
import subprocess
from typing import Dict, Any

def send_to_platform(message: Dict[str, Any]) -> None:
    """Send protocol-formatted message to platform."""
    # Format for AI consumption
    protocol_message = {
        "input_data": message,
        "source": "human_assistant",
        "timestamp": "auto"  # Platform will assign
    }
    
    # Write in AI-optimized format
    sys.stdout.write(json.dumps(protocol_message) + "\n")
    sys.stdout.flush()

def start_platform_interface() -> subprocess.Popen:
    """Start the platform interface process."""
    return subprocess.Popen(
        ["node", "ai_core/platform_interface.js"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

def main():
    # Start platform interface
    platform = start_platform_interface()
    
    try:
        while True:
            # Get input from Ken
            message = input()
            
            try:
                # Parse as JSON if possible
                data = json.loads(message)
            except json.JSONDecodeError:
                # Treat as raw text if not JSON
                data = {"text": message}
            
            # Send to platform
            send_to_platform(data)
            
            # Get platform response
            response = platform.stdout.readline()
            if response:
                # Platform handles the formatting
                sys.stdout.write(response.decode())
                sys.stdout.flush()
                
    except KeyboardInterrupt:
        platform.terminate()
        platform.wait()

if __name__ == "__main__":
    main()
