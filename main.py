from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from starlette.requests import Request
import time

app = FastAPI(title="AI Assistant API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting settings
RATE_LIMIT_DURATION = 60  # seconds
RATE_LIMIT_REQUESTS = 30  # requests per duration
rate_limit_data = {}

# Retry settings
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds
REQUEST_TIMEOUT = 10  # seconds

# Environment variables
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://192.168.137.69:11434")
QDRANT_URL = os.getenv("QDRANT_URL", "http://192.168.137.34:6333")

# Initialize clients
qdrant_client = QdrantClient(url=QDRANT_URL)
http_client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

# Rate limiting dependency
async def check_rate_limit(request: Request):
    client_ip = request.client.host
    current_time = time.time()
    
    # Clean up old rate limit data
    for ip in list(rate_limit_data.keys()):
        if current_time - rate_limit_data[ip]["start_time"] > RATE_LIMIT_DURATION:
            del rate_limit_data[ip]
    
    # Initialize or update rate limit data for client
    if client_ip not in rate_limit_data:
        rate_limit_data[client_ip] = {
            "count": 1,
            "start_time": current_time
        }
    else:
        if current_time - rate_limit_data[client_ip]["start_time"] > RATE_LIMIT_DURATION:
            rate_limit_data[client_ip] = {
                "count": 1,
                "start_time": current_time
            }
        else:
            rate_limit_data[client_ip]["count"] += 1
            if rate_limit_data[client_ip]["count"] > RATE_LIMIT_REQUESTS:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_REQUESTS} requests per {RATE_LIMIT_DURATION} seconds."
                )

async def retry_request(func, *args, **kwargs):
    for attempt in range(MAX_RETRIES):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            if attempt == MAX_RETRIES - 1:
                raise e
            await asyncio.sleep(RETRY_DELAY * (attempt + 1))

class Query(BaseModel):
    text: str

import psutil
import time
from datetime import datetime

@app.get("/health")
async def health_check():
    try:
        start_time = time.time()
        
        # Check Ollama with model verification
        async with httpx.AsyncClient() as client:
            ollama_response = await client.get(f"{OLLAMA_API_URL}/api/tags")
            if ollama_response.status_code != 200:
                raise HTTPException(status_code=503, detail="Ollama service unavailable")
            
            # Verify model availability
            models = ollama_response.json().get("models", [])
            if not any(model.get("name", "").startswith(("llama2", "mistral")) for model in models):
                raise HTTPException(status_code=503, detail="No supported model available")
            
            # Test model responsiveness
            gen_response = await client.post(
                f"{OLLAMA_API_URL}/api/generate",
                json={
                    "model": "mistral",
                    "prompt": "test",
                    "stream": False
                }
            )
            if gen_response.status_code != 200:
                raise HTTPException(status_code=503, detail="Model generation failed")
        
        # Check Qdrant
        collections = qdrant_client.get_collections()
        
        # System metrics
        disk = psutil.disk_usage('/')
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        # Calculate response time
        response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "response_time_ms": round(response_time, 2),
            "services": {
                "ollama": {
                    "status": "connected",
                    "models": models
                },
                "qdrant": {
                    "status": "connected",
                    "collections": collections.collections
                }
            },
            "system": {
                "disk": {
                    "total_gb": round(disk.total / (1024**3), 2),
                    "used_gb": round(disk.used / (1024**3), 2),
                    "free_gb": round(disk.free / (1024**3), 2),
                    "percent": disk.percent
                },
                "memory": {
                    "total_gb": round(memory.total / (1024**3), 2),
                    "used_gb": round(memory.used / (1024**3), 2),
                    "free_gb": round(memory.free / (1024**3), 2),
                    "percent": memory.percent
                },
                "swap": {
                    "total_gb": round(swap.total / (1024**3), 2),
                    "used_gb": round(swap.used / (1024**3), 2),
                    "percent": round((swap.used / swap.total) * 100 if swap.total > 0 else 0, 2)
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

@app.post("/query")
async def query_model(query: Query, _: None = Depends(check_rate_limit)):
    try:
        async def make_request():
            response = await http_client.post(
                f"{OLLAMA_API_URL}/api/generate",
                json={
                    "model": "mistral",
                    "prompt": query.text,
                    "stream": False
                }
            )
            response.raise_for_status()
            return response.json()
        
        return await retry_request(make_request)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Ollama request failed: {e.response.text}"
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Request timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/store")
async def store_vector(query: Query, _: None = Depends(check_rate_limit)):
    try:
        async def generate_embedding():
            response = await http_client.post(
                f"{OLLAMA_API_URL}/api/embeddings",
                json={
                    "model": "mistral",
                    "prompt": query.text
                }
            )
            response.raise_for_status()
            return response.json()["embedding"]
        
        # Generate embedding with retry
        embedding = await retry_request(generate_embedding)
        
        # Store in Qdrant
        try:
            qdrant_client.upsert(
                collection_name="queries",
                points=[
                    models.PointStruct(
                        id=hash(query.text),
                        vector=embedding,
                        payload={
                            "text": query.text,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )
                ]
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to store vector: {str(e)}"
            )
        
        return {
            "status": "stored",
            "text": query.text,
            "timestamp": datetime.utcnow().isoformat()
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Embedding generation failed: {e.response.text}"
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Request timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.get("/similar/{text}")
async def find_similar(
    text: str,
    limit: Optional[int] = 5,
    threshold: Optional[float] = 0.7,
    _: None = Depends(check_rate_limit)
):
    try:
        async def generate_embedding():
            response = await http_client.post(
                f"{OLLAMA_API_URL}/api/embeddings",
                json={
                    "model": "mistral",
                    "prompt": text
                }
            )
            response.raise_for_status()
            return response.json()["embedding"]
        
        # Generate embedding with retry
        embedding = await retry_request(generate_embedding)
        
        # Search in Qdrant with score threshold
        try:
            search_result = qdrant_client.search(
                collection_name="queries",
                query_vector=embedding,
                limit=min(limit, 20),  # Cap at 20 results
                score_threshold=threshold
            )
            
            return {
                "query": text,
                "threshold": threshold,
                "results": [
                    {
                        "text": hit.payload["text"],
                        "score": hit.score,
                        "timestamp": hit.payload.get("timestamp")
                    }
                    for hit in search_result
                ]
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Vector search failed: {str(e)}"
            )
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Embedding generation failed: {e.response.text}"
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Request timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.on_event("shutdown")
async def shutdown_event():
    await http_client.aclose()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
