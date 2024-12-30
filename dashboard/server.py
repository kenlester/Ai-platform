#!/usr/bin/env python3
import os
import json
import asyncio
import datetime
from typing import Dict, List
from dataclasses import dataclass
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import httpx
import psutil
import subprocess
from collections import deque

app = FastAPI()

# Serve static files
app.mount("/static", StaticFiles(directory="dashboard"), name="static")

# Store metrics history
METRICS_HISTORY = {
    'timestamps': deque(maxlen=60),
    'cpu_usage': deque(maxlen=60),
    'memory_usage': deque(maxlen=60)
}

# Store function call counts
FUNCTION_CALLS = {
    'analyzer': 0,
    'agent': 0,
    'vector_search': 0,
    'improvements': 0
}

# Store recent activities
RECENT_ACTIVITIES = deque(maxlen=100)

@dataclass
class ContainerInfo:
    status: str
    memory_usage: float
    specific_info: Dict

async def get_container_status(container_id: str) -> ContainerInfo:
    """Get status information for a container."""
    try:
        # Get container status using pct
        status_cmd = f"pct status {container_id}"
        status_proc = await asyncio.create_subprocess_shell(
            status_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        status_out, _ = await status_proc.communicate()
        status = status_out.decode().strip()

        # Get container memory usage
        memory_cmd = f"pct exec {container_id} -- free -m | grep Mem"
        memory_proc = await asyncio.create_subprocess_shell(
            memory_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        memory_out, _ = await memory_proc.communicate()
        memory_info = memory_out.decode().strip().split()
        memory_usage = float(memory_info[2])  # Used memory in MB

        # Get container-specific information
        specific_info = {}
        if container_id == "200":  # LLM Container
            model_cmd = "pct exec 200 -- ollama list"
            model_proc = await asyncio.create_subprocess_shell(
                model_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            model_out, _ = await model_proc.communicate()
            specific_info["model"] = model_out.decode().strip() or "No models found"

        elif container_id == "201":  # Vector DB Container
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get("http://192.168.137.34:6333/collections")
                    collections = response.json()
                    specific_info["collections"] = len(collections.get("collections", []))
                except:
                    specific_info["collections"] = "Error fetching collections"

        elif container_id == "202":  # Dev Container
            ps_cmd = "pct exec 202 -- ps aux | grep python | wc -l"
            ps_proc = await asyncio.create_subprocess_shell(
                ps_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            ps_out, _ = await ps_proc.communicate()
            specific_info["active_tools"] = int(ps_out.decode().strip()) - 1  # Subtract grep process

        return ContainerInfo(status, memory_usage, specific_info)
    except Exception as e:
        return ContainerInfo("error", 0.0, {"error": str(e)})

@app.get("/")
async def read_root():
    """Serve the dashboard HTML."""
    return FileResponse("dashboard/index.html")

@app.get("/api/containers/status")
async def get_containers_status():
    """Get status for all containers."""
    containers = ["200", "201", "202"]
    statuses = {}
    
    for container_id in containers:
        info = await get_container_status(container_id)
        statuses[container_id] = {
            "status": info.status,
            "memory_usage": info.memory_usage,
            **info.specific_info
        }
    
    return statuses

@app.get("/api/functions/status")
async def get_functions_status():
    """Get status of AI functions."""
    return {
        "analyzer": {
            "status": "active",
            "last_run": datetime.datetime.now().isoformat(),
            "files_analyzed": sum(1 for _ in os.walk(".")),
        },
        "agent": {
            "status": "active",
            "active_tasks": len([p for p in psutil.process_iter() if "ai_dev_agent" in p.name()]),
            "improvements": FUNCTION_CALLS["improvements"]
        }
    }

@app.get("/api/metrics")
async def get_metrics():
    """Get system metrics."""
    # Update current metrics
    now = datetime.datetime.now().isoformat()
    cpu_percent = psutil.cpu_percent()
    memory_percent = psutil.virtual_memory().percent
    
    METRICS_HISTORY['timestamps'].append(now)
    METRICS_HISTORY['cpu_usage'].append(cpu_percent)
    METRICS_HISTORY['memory_usage'].append(memory_percent)
    
    return {
        "timestamps": list(METRICS_HISTORY['timestamps']),
        "cpu_usage": list(METRICS_HISTORY['cpu_usage']),
        "memory_usage": list(METRICS_HISTORY['memory_usage']),
        "function_calls": FUNCTION_CALLS
    }

@app.get("/api/activity")
async def get_activity():
    """Get recent activity log."""
    return {
        "activities": list(RECENT_ACTIVITIES)
    }

@app.post("/api/activity/log")
async def log_activity(function: str, action: str, status: str):
    """Log a new activity."""
    activity = {
        "timestamp": datetime.datetime.now().isoformat(),
        "function": function,
        "action": action,
        "status": status
    }
    RECENT_ACTIVITIES.appendleft(activity)
    
    # Update function call counts
    if function in FUNCTION_CALLS:
        FUNCTION_CALLS[function] += 1
    
    return {"status": "logged"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
