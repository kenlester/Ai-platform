#!/usr/bin/env python3
import os
import sys
from typing import List, Dict, Any
from pathlib import Path
import argparse
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from qdrant_client import QdrantClient
from qdrant_client.http import models
import httpx

class CodeAnalyzer:
    def __init__(self):
        self.ollama_url = "http://192.168.137.69:11434"
        self.qdrant_url = "http://192.168.137.34:6333"
        self.qdrant_client = QdrantClient(url=self.qdrant_url)
        self.collection_name = "code_snippets"
        self._ensure_collection_exists()

    def _ensure_collection_exists(self):
        """Ensure the vector collection exists."""
        collections = self.qdrant_client.get_collections().collections
        if not any(c.name == self.collection_name for c in collections):
            self.qdrant_client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE)
            )

    async def get_embeddings(self, text: str) -> List[float]:
        """Get embeddings from Ollama API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.ollama_url}/api/embeddings",
                json={"model": "mistral", "prompt": text}
            )
            return response.json()["embedding"]

    async def analyze_code(self, code: str) -> Dict[str, Any]:
        """Analyze code using Ollama."""
        prompt = f"""Analyze this code and provide:
1. Code quality assessment
2. Potential improvements
3. Security considerations
4. Performance optimization suggestions

Code to analyze:
```
{code}
```"""
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.ollama_url}/api/generate",
                json={"model": "mistral", "prompt": prompt}
            )
            return {"analysis": response.json()["response"]}

    async def index_code(self, file_path: str):
        """Index code file in vector database."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        with open(file_path, 'r') as f:
            content = f.read()

        # Split code into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        chunks = text_splitter.create_documents([content])

        # Get embeddings and store in Qdrant
        for i, chunk in enumerate(chunks):
            embedding = await self.get_embeddings(chunk.page_content)
            self.qdrant_client.upsert(
                collection_name=self.collection_name,
                points=[models.PointStruct(
                    id=hash(f"{file_path}_{i}"),
                    vector=embedding,
                    payload={"content": chunk.page_content, "file": file_path}
                )]
            )

    async def find_similar_code(self, code_snippet: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Find similar code snippets."""
        embedding = await self.get_embeddings(code_snippet)
        
        results = self.qdrant_client.search(
            collection_name=self.collection_name,
            query_vector=embedding,
            limit=limit
        )
        
        return [{"content": hit.payload["content"], 
                "file": hit.payload["file"],
                "score": hit.score} for hit in results]

def main():
    parser = argparse.ArgumentParser(description="Code Analysis Tool")
    parser.add_argument('action', choices=['analyze', 'index', 'search'],
                       help='Action to perform')
    parser.add_argument('input', help='File path or code snippet')
    parser.add_argument('--limit', type=int, default=5,
                       help='Number of similar results to return (for search)')
    
    args = parser.parse_args()
    analyzer = CodeAnalyzer()

    import asyncio
    if args.action == 'analyze':
        with open(args.input, 'r') as f:
            result = asyncio.run(analyzer.analyze_code(f.read()))
        print(result["analysis"])
    elif args.action == 'index':
        asyncio.run(analyzer.index_code(args.input))
        print(f"Indexed {args.input}")
    elif args.action == 'search':
        results = asyncio.run(analyzer.find_similar_code(args.input, args.limit))
        for i, result in enumerate(results, 1):
            print(f"\nMatch {i} (Score: {result['score']:.2f}):")
            print(f"File: {result['file']}")
            print("Content:")
            print(result['content'])

if __name__ == "__main__":
    main()
