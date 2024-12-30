#!/usr/bin/env python3

import json
import logging
import os
import time
import subprocess
from datetime import datetime
from typing import Dict, List, Optional
import sqlite3
from dataclasses import dataclass
from collections import defaultdict
import threading
import queue

@dataclass
class FailureEvent:
    timestamp: float
    service: str
    container_id: str
    error_type: str
    error_message: str
    system_state: Dict
    recovery_attempt: Optional[str] = None
    recovery_success: Optional[bool] = None
    recovery_time: Optional[float] = None

class FailureLearningSystem:
    def __init__(self, db_path: str = "/opt/ai_platform/failure_learning.db"):
        self.db_path = db_path
        self.setup_database()
        self.pattern_cache = defaultdict(int)
        self.solution_cache = {}
        self.event_queue = queue.Queue()
        
        # Start background analysis thread
        self.analysis_thread = threading.Thread(target=self._background_analysis, daemon=True)
        self.analysis_thread.start()
        logging.info("Failure Learning System initialized")

    def setup_database(self):
        """Initialize the SQLite database with necessary tables."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Failure events table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS failure_events (
            id INTEGER PRIMARY KEY,
            timestamp REAL,
            service TEXT,
            container_id TEXT,
            error_type TEXT,
            error_message TEXT,
            system_state TEXT,
            recovery_attempt TEXT,
            recovery_success INTEGER,
            recovery_time REAL
        )
        ''')

        # Learned patterns table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS learned_patterns (
            id INTEGER PRIMARY KEY,
            pattern_hash TEXT UNIQUE,
            error_pattern TEXT,
            success_count INTEGER,
            fail_count INTEGER,
            last_seen REAL,
            best_solution TEXT
        )
        ''')

        conn.commit()
        conn.close()
        logging.info("Database setup complete")

    def record_failure(self, event: FailureEvent):
        """Record a new failure event and queue it for analysis."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
        INSERT INTO failure_events 
        (timestamp, service, container_id, error_type, error_message, 
         system_state, recovery_attempt, recovery_success, recovery_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            event.timestamp,
            event.service,
            event.container_id,
            event.error_type,
            event.error_message,
            json.dumps(event.system_state),
            event.recovery_attempt,
            event.recovery_success,
            event.recovery_time
        ))

        conn.commit()
        conn.close()

        logging.info(f"Recorded failure event: {event.service} in CT {event.container_id} - {event.error_type}")
        # Queue event for analysis
        self.event_queue.put(event)

    def _background_analysis(self):
        """Continuously analyze new failure events in the background."""
        while True:
            try:
                event = self.event_queue.get(timeout=60)
                self._analyze_event(event)
            except queue.Empty:
                # No new events, perform periodic pattern analysis
                self._analyze_patterns()
            except Exception as e:
                logging.error(f"Error in background analysis: {e}")

    def _analyze_event(self, event: FailureEvent):
        """Analyze a single failure event for patterns."""
        # Create pattern hash from key event attributes
        pattern_key = f"{event.service}:{event.error_type}:{event.container_id}"
        logging.info(f"Analyzing event pattern: {pattern_key}")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Update pattern statistics
        cursor.execute('''
        INSERT INTO learned_patterns 
        (pattern_hash, error_pattern, success_count, fail_count, last_seen)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(pattern_hash) DO UPDATE SET
        success_count = success_count + ?,
        fail_count = fail_count + ?,
        last_seen = ?
        ''', (
            pattern_key,
            json.dumps({
                'service': event.service,
                'error_type': event.error_type,
                'container_id': event.container_id
            }),
            1 if event.recovery_success else 0,
            0 if event.recovery_success else 1,
            event.timestamp,
            1 if event.recovery_success else 0,
            0 if event.recovery_success else 1,
            event.timestamp
        ))

        # If recovery was successful, update best solution
        if event.recovery_success:
            cursor.execute('''
            UPDATE learned_patterns
            SET best_solution = ?
            WHERE pattern_hash = ?
            ''', (event.recovery_attempt, pattern_key))
            logging.info(f"Updated best solution for pattern: {pattern_key}")

        conn.commit()
        conn.close()

    def _analyze_patterns(self):
        """Analyze all patterns to identify common issues and successful solutions."""
        logging.info("Performing periodic pattern analysis")
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get all patterns with their success rates
        cursor.execute('''
        SELECT pattern_hash, error_pattern, success_count, fail_count, best_solution
        FROM learned_patterns
        ''')
        
        patterns = cursor.fetchall()
        conn.close()

        # Analyze success rates and update solution cache
        for pattern in patterns:
            pattern_hash, error_pattern, success_count, fail_count, best_solution = pattern
            total = success_count + fail_count
            if total > 0:
                success_rate = success_count / total
                if success_rate > 0.8:  # 80% success rate threshold
                    self.solution_cache[pattern_hash] = best_solution
                    logging.info(f"Pattern {pattern_hash} added to solution cache (success rate: {success_rate:.2%})")

    def get_recovery_solution(self, service: str, error_type: str, container_id: str) -> Optional[str]:
        """Get the best known recovery solution for a given failure pattern."""
        pattern_key = f"{service}:{error_type}:{container_id}"
        solution = self.solution_cache.get(pattern_key)
        logging.info(f"Retrieved solution for {pattern_key}: {'Found' if solution else 'Not found'}")
        return solution

    def record_recovery_attempt(self, event_id: int, attempt: str, success: bool, time_taken: float):
        """Record the results of a recovery attempt."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
        UPDATE failure_events
        SET recovery_attempt = ?,
            recovery_success = ?,
            recovery_time = ?
        WHERE id = ?
        ''', (attempt, success, time_taken, event_id))

        conn.commit()
        conn.close()
        logging.info(f"Recorded recovery attempt for event {event_id}: {'Success' if success else 'Failed'}")

    def get_success_rate(self, service: str, error_type: str) -> float:
        """Get the success rate for handling a specific type of failure."""
        pattern_key = f"{service}:{error_type}"
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
        SELECT COUNT(*), SUM(CASE WHEN recovery_success = 1 THEN 1 ELSE 0 END)
        FROM failure_events
        WHERE service = ? AND error_type = ?
        ''', (service, error_type))

        total, successes = cursor.fetchone()
        conn.close()

        success_rate = (successes or 0) / total if total else 0.0
        logging.info(f"Success rate for {pattern_key}: {success_rate:.2%}")
        return success_rate

    def get_common_patterns(self) -> List[Dict]:
        """Get the most common failure patterns and their solutions."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
        SELECT error_pattern, success_count, fail_count, best_solution
        FROM learned_patterns
        ORDER BY (success_count + fail_count) DESC
        LIMIT 10
        ''')

        patterns = cursor.fetchall()
        conn.close()

        return [
            {
                'pattern': json.loads(pattern[0]),
                'success_rate': pattern[1] / (pattern[1] + pattern[2]) if (pattern[1] + pattern[2]) > 0 else 0,
                'total_occurrences': pattern[1] + pattern[2],
                'best_solution': pattern[3]
            }
            for pattern in patterns
        ]

def check_container_status(container_id: str) -> Dict:
    """Check container status using pvesh with proper JSON parsing."""
    logging.debug(f"Checking status for container {container_id}")
    try:
        # Get current status
        cmd = ['pvesh', 'get', f'/nodes/pve/lxc/{container_id}/status/current', '--output-format=json']
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        status_data = json.loads(result.stdout)
        
        # Log detailed status information
        logging.info(f"Container {container_id} status data:\n{json.dumps(status_data, indent=2)}")
        
        # Check if container is not running
        if not status_data.get('status', '').startswith('running'):
            logging.warning(f"Container {container_id} is not running. Status: {status_data.get('status', 'unknown')}")
        
        return status_data
    except subprocess.CalledProcessError as e:
        logging.error(f"Failed to get container status: {e.stderr}")
        return {"status": "error", "error": e.stderr}
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse JSON from pvesh output: {e}")
        return {"status": "unknown", "error": str(e)}
    except Exception as e:
        logging.error(f"Error checking container status: {e}")
        return {"status": "error", "error": str(e)}

def monitor_system_health():
    """Example usage of the FailureLearningSystem."""
    learning_system = FailureLearningSystem()
    logging.info("Starting system health monitoring")
    
    while True:
        try:
            # Monitor system state
            system_state = {
                'timestamp': time.time(),
                'memory_usage': subprocess.run(['free', '-m'], capture_output=True, text=True).stdout,
                'disk_usage': subprocess.run(['df', '-h'], capture_output=True, text=True).stdout,
                'load_avg': os.getloadavg()
            }

            # Check services
            services_to_check = [
                ('ollama', '200'),
                ('qdrant', '201'),
                ('mcp', '203')
            ]

            for service, container_id in services_to_check:
                try:
                    # Check container status
                    status_data = check_container_status(container_id)
                    
                    # Check if container is running based on PVE API response
                    if not status_data.get('status', '').startswith('running'):
                        # Record failure
                        event = FailureEvent(
                            timestamp=time.time(),
                            service=service,
                            container_id=container_id,
                            error_type='container_inactive',
                            error_message=f"Container {container_id} status: {status_data.get('status', 'unknown')} (CPU: {status_data.get('cpu', 'N/A')}%, Memory: {status_data.get('mem', 'N/A')} bytes)",
                            system_state=system_state
                        )
                        learning_system.record_failure(event)

                        # Get and apply recovery solution
                        solution = learning_system.get_recovery_solution(service, 'container_inactive', container_id)
                        if solution:
                            # Attempt recovery using pvesh
                            start_time = time.time()
                            if 'restart' in solution:
                                cmd = ['pvesh', 'create', f'/nodes/pve/lxc/{container_id}/status/restart']
                            else:
                                cmd = ['pvesh', 'create', f'/nodes/pve/lxc/{container_id}/status/start']
                            
                            logging.info(f"Attempting recovery with command: {' '.join(cmd)}")
                            try:
                                result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                                success = True
                                logging.info(f"Recovery command output: {result.stdout}")
                            except subprocess.CalledProcessError as e:
                                success = False
                                logging.error(f"Recovery command failed: {e.stderr}")
                            
                            recovery_time = time.time() - start_time
                            
                            # Record recovery attempt
                            event.recovery_attempt = ' '.join(cmd)
                            event.recovery_success = success
                            event.recovery_time = recovery_time
                            learning_system.record_failure(event)
                            
                            logging.info(f"Recovery attempt {'successful' if success else 'failed'}")

                except Exception as e:
                    logging.error(f"Error checking service {service}: {e}")

            # Sleep before next check (10 seconds for more responsive monitoring)
            time.sleep(10)

        except Exception as e:
            logging.error(f"Error in health monitoring: {e}")
            time.sleep(10)

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('/var/log/ai-failure-learning.log'),
            logging.StreamHandler()
        ]
    )
    logging.info("AI Platform Failure Learning System starting up...")
    monitor_system_health()
