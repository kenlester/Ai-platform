#!/usr/bin/env python3
import os
import sys
import asyncio
import json
from typing import List, Dict, Any
from pathlib import Path
from dataclasses import dataclass
import httpx
from qdrant_client import QdrantClient
from qdrant_client.http import models

@dataclass
class CodeContext:
    file_path: str
    content: str
    dependencies: List[str]
    requirements: List[str]

class AIDevAgent:
    def __init__(self):
        self.ollama_url = "http://192.168.137.69:11434"
        self.qdrant_url = "http://192.168.137.34:6333"
        self.qdrant_client = QdrantClient(url=self.qdrant_url)
        self.collection_name = "ai_platform_knowledge"
        self._ensure_collection_exists()

    def _ensure_collection_exists(self):
        """Ensure the vector collection exists."""
        collections = self.qdrant_client.get_collections().collections
        if not any(c.name == self.collection_name for c in collections):
            self.qdrant_client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE)
            )

    async def analyze_project_structure(self, project_path: str) -> Dict[str, Any]:
        """Analyze existing project structure and dependencies."""
        structure = {"files": [], "dependencies": set(), "patterns": []}
        
        for root, _, files in os.walk(project_path):
            for file in files:
                if file.endswith(('.py', '.json', '.yaml', '.yml')):
                    file_path = os.path.join(root, file)
                    with open(file_path, 'r') as f:
                        content = f.read()
                        structure["files"].append({
                            "path": file_path,
                            "content": content,
                            "type": file.split('.')[-1]
                        })
                        if file == 'requirements.txt':
                            structure["dependencies"].update(
                                line.strip() for line in content.splitlines()
                                if line.strip() and not line.startswith('#')
                            )
        
        return {
            "files": structure["files"],
            "dependencies": list(structure["dependencies"]),
            "patterns": await self._identify_patterns(structure["files"])
        }

    async def _identify_patterns(self, files: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """Identify common patterns and architectural decisions in the codebase."""
        patterns = []
        for file in files:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": "mistral",
                        "prompt": f"""Analyze this code and identify architectural patterns, design decisions, and AI-specific implementations:

{file['content']}

Provide the analysis in JSON format with the following structure:
{
    "patterns": ["list of identified patterns"],
    "ai_components": ["list of AI-specific components"],
    "architecture": ["key architectural decisions"],
    "improvements": ["potential improvements"]
}"""
                    }
                )
                analysis = json.loads(response.json()["response"])
                patterns.append({
                    "file": file["path"],
                    "analysis": analysis
                })
        return patterns

    async def generate_improvement_plan(self, project_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate an improvement plan based on project analysis."""
        prompt = f"""Based on this project analysis, generate a comprehensive improvement plan:

Project Structure:
{json.dumps(project_analysis, indent=2)}

Focus on:
1. AI capabilities enhancement
2. Scalability improvements
3. Integration opportunities
4. Performance optimizations
5. Security considerations

Provide the plan in JSON format with the following structure:
{
    "immediate_actions": ["list of high-priority improvements"],
    "long_term_goals": ["list of strategic improvements"],
    "ai_enhancements": ["specific AI capability improvements"],
    "integration_opportunities": ["potential service integrations"],
    "architecture_changes": ["recommended architectural changes"]
}"""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.ollama_url}/api/generate",
                json={"model": "mistral", "prompt": prompt}
            )
            return json.loads(response.json()["response"])

    async def implement_improvement(self, improvement_plan: Dict[str, Any], target_path: str):
        """Implement suggested improvements."""
        for action in improvement_plan["immediate_actions"]:
            prompt = f"""Generate implementation code for this improvement:

Improvement: {action}
Target Path: {target_path}

Generate complete, production-ready code that implements this improvement.
Include error handling, logging, and documentation."""

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={"model": "mistral", "prompt": prompt}
                )
                
                implementation = response.json()["response"]
                # Store implementation in vector database for reference
                embedding = await self._get_embedding(implementation)
                self.qdrant_client.upsert(
                    collection_name=self.collection_name,
                    points=[models.PointStruct(
                        id=hash(f"{action}_{target_path}"),
                        vector=embedding,
                        payload={
                            "improvement": action,
                            "implementation": implementation,
                            "target_path": target_path
                        }
                    )]
                )
                
                # Create implementation file
                impl_path = os.path.join(target_path, f"improvement_{hash(action)}.py")
                with open(impl_path, 'w') as f:
                    f.write(implementation)

    async def _get_embedding(self, text: str) -> List[float]:
        """Get embeddings from Ollama API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.ollama_url}/api/embeddings",
                json={"model": "mistral", "prompt": text}
            )
            return response.json()["embedding"]

    async def monitor_implementation(self, target_path: str):
        """Monitor and validate implemented improvements."""
        validation_results = []
        for root, _, files in os.walk(target_path):
            for file in files:
                if file.startswith('improvement_') and file.endswith('.py'):
                    file_path = os.path.join(root, file)
                    with open(file_path, 'r') as f:
                        content = f.read()
                        
                    # Validate implementation
                    prompt = f"""Validate this implementation for:
1. Code quality
2. Security issues
3. Performance implications
4. AI best practices
5. Integration effectiveness

Code to validate:
```python
{content}
```

Provide validation results in JSON format."""

                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            f"{self.ollama_url}/api/generate",
                            json={"model": "mistral", "prompt": prompt}
                        )
                        validation = json.loads(response.json()["response"])
                        validation_results.append({
                            "file": file_path,
                            "validation": validation
                        })
        
        return validation_results

async def main():
    agent = AIDevAgent()
    
    # Example usage
    project_path = sys.argv[1] if len(sys.argv) > 1 else "."
    
    # Analyze project
    print("Analyzing project structure...")
    analysis = await agent.analyze_project_structure(project_path)
    
    # Generate improvement plan
    print("Generating improvement plan...")
    plan = await agent.generate_improvement_plan(analysis)
    
    # Implement improvements
    print("Implementing improvements...")
    await agent.implement_improvement(plan, project_path)
    
    # Monitor and validate
    print("Monitoring implementation...")
    validation = await agent.monitor_implementation(project_path)
    
    # Output results
    print("\nValidation Results:")
    print(json.dumps(validation, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
