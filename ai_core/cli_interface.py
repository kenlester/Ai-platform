#!/usr/bin/env python3
import json
import asyncio
import hashlib
import uuid
from datetime import datetime
import httpx
from typing import Dict, Any

class AIPlatformCLI:
    def __init__(self):
        self.ollama_url = "http://192.168.137.69:11434"
        self.protocol_version = "1.0.0"
        
    def create_message(self, content: str, intent_type: str = "query") -> Dict[str, Any]:
        """Create a protocol-compliant message."""
        return {
            "protocol_version": self.protocol_version,
            "message_id": hashlib.md5(str(uuid.uuid4()).encode()).hexdigest(),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "sender": {
                "id": "human_assistant",
                "type": "human",
                "capabilities": ["natural_language", "task_execution"]
            },
            "intent": {
                "type": intent_type,
                "action": "platform_interaction",
                "priority": 2,
                "requires_response": True
            },
            "content": {
                "format": "text",
                "data": content,
                "encoding": "none"
            },
            "optimization": {
                "compression": False,
                "caching": {
                    "ttl": 3600,
                    "strategy": "memory"
                }
            }
        }

    async def send_message(self, content: str) -> Dict[str, Any]:
        """Send message to AI platform and get response."""
        message = self.create_message(content)
        
        async with httpx.AsyncClient() as client:
            # Send to Mistral for processing
            response = await client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "mistral",
                    "prompt": json.dumps(message, indent=2)
                }
            )
            
            ai_response = response.json()
            
            # Format AI response in protocol format
            return {
                "protocol_version": self.protocol_version,
                "message_id": hashlib.md5(str(uuid.uuid4()).encode()).hexdigest(),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "sender": {
                    "id": "ai_platform",
                    "type": "llm",
                    "capabilities": ["pattern_recognition", "natural_language"]
                },
                "intent": {
                    "type": "response",
                    "action": "platform_response"
                },
                "content": {
                    "format": "text",
                    "data": ai_response["response"]
                }
            }

    def format_response(self, response: Dict[str, Any]) -> str:
        """Format AI response for human reading."""
        return f"""
=== AI Platform Response ===
{response['content']['data']}
=========================
"""

async def main():
    cli = AIPlatformCLI()
    print("=== AI Platform CLI Interface ===")
    print("Type 'exit' to quit")
    print("================================")
    
    while True:
        try:
            user_input = input("\nYou: ").strip()
            if user_input.lower() == 'exit':
                break
                
            response = await cli.send_message(user_input)
            print(cli.format_response(response))
            
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
