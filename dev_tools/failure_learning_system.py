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

# Define status codes for AI-readable logging
class StatusCodes:
    OPERATIONAL = 'OPERATIONAL'
    DEGRADED = 'DEGRADED'
    FAILED = 'FAILED'
    RECOVERING = 'RECOVERING'

class JsonFormatter(logging.Formatter):
    """Custom formatter for AI-readable JSON logs"""
    def format(self, record):
        # Base log entry with AI-readable status indicators
        log_entry = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'status_code': getattr(record, 'status_code', StatusCodes.OPERATIONAL),
            'component': 'failure_learning_system',
            'message': record.getMessage(),
            'metadata': getattr(record, 'metadata', {}),
            'ai_readable': True
        }
        
        # Add error info if present
        if record.exc_info:
            log_entry['error'] = {
                'type': record.exc_info[0].__name__,
                'details': str(record.exc_info[1])
            }
        
        return json.dumps(log_entry)

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

from sklearn.ensemble import IsolationForest
import numpy as np
from typing import List, Dict, Optional, Tuple
import pandas as pd

class FailureLearningSystem:
    def __init__(self, db_path: str = "/opt/ai_platform/failure_learning.db"):
        self.db_path = db_path
        self.setup_database()
        self.pattern_cache = defaultdict(int)
        self.solution_cache = {}
        self.event_queue = queue.Queue()
        self.anomaly_detector = IsolationForest(
            contamination=0.1,
            random_state=42
        )
        self.prediction_window = 3600  # 1 hour prediction window
        self.last_training = 0
        self.training_interval = 3600  # Retrain every hour
        
        # Start background analysis thread
        self.analysis_thread = threading.Thread(target=self._background_analysis, daemon=True)
        self.analysis_thread.start()
        
        # Start prediction thread
        self.prediction_thread = threading.Thread(target=self._prediction_loop, daemon=True)
        self.prediction_thread.start()
        
        # Log initialization with metadata
        extra = {
            'status_code': StatusCodes.OPERATIONAL,
            'metadata': {
                'db_path': db_path,
                'pid': os.getpid(),
                'thread_id': self.analysis_thread.ident
            }
        }
        logging.info("Failure Learning System initialized", extra=extra)

    def setup_database(self):
        """Initialize the SQLite database with necessary tables including prediction tracking."""
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

        # Learned patterns table with neural weights
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS learned_patterns (
            id INTEGER PRIMARY KEY,
            pattern_hash TEXT UNIQUE,
            error_pattern TEXT,
            success_count INTEGER,
            fail_count INTEGER,
            last_seen REAL,
            best_solution TEXT,
            neural_weights TEXT,
            confidence_score REAL
        )
        ''')

        # Predictions table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS failure_predictions (
            id INTEGER PRIMARY KEY,
            timestamp REAL,
            service TEXT,
            container_id TEXT,
            predicted_error_type TEXT,
            confidence REAL,
            predicted_time REAL,
            was_correct BOOLEAN
        )
        ''')

        conn.commit()
        conn.close()
        
        extra = {
            'status_code': StatusCodes.OPERATIONAL,
            'metadata': {
                'tables': ['failure_events', 'learned_patterns'],
                'db_path': self.db_path
            }
        }
        logging.info("Database setup complete", extra=extra)

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

        extra = {
            'status_code': StatusCodes.DEGRADED,
            'metadata': {
                'service': event.service,
                'container_id': event.container_id,
                'error_type': event.error_type,
                'timestamp': event.timestamp
            }
        }
        logging.info(f"Recorded failure event: {event.service} in CT {event.container_id} - {event.error_type}", extra=extra)
        
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
                extra = {
                    'status_code': StatusCodes.FAILED,
                    'metadata': {
                        'error_type': type(e).__name__,
                        'error_details': str(e)
                    }
                }
                logging.error(f"Error in background analysis: {e}", extra=extra)

    def _analyze_event(self, event: FailureEvent):
        """Analyze a single failure event for patterns."""
        # Create pattern hash from key event attributes
        pattern_key = f"{event.service}:{event.error_type}:{event.container_id}"
        
        extra = {
            'status_code': StatusCodes.OPERATIONAL,
            'metadata': {
                'pattern_key': pattern_key,
                'service': event.service,
                'error_type': event.error_type
            }
        }
        logging.info(f"Analyzing event pattern: {pattern_key}", extra=extra)
        
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
            
            extra = {
                'status_code': StatusCodes.OPERATIONAL,
                'metadata': {
                    'pattern_key': pattern_key,
                    'solution': event.recovery_attempt
                }
            }
            logging.info(f"Updated best solution for pattern: {pattern_key}", extra=extra)

        conn.commit()
        conn.close()

    def _analyze_patterns(self):
        """Analyze patterns using machine learning to identify anomalies and predict failures."""
        extra = {
            'status_code': StatusCodes.OPERATIONAL,
            'metadata': {
                'analysis_type': 'periodic',
                'timestamp': time.time()
            }
        }
        logging.info("Performing periodic pattern analysis", extra=extra)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
        SELECT pattern_hash, error_pattern, success_count, fail_count, best_solution
        FROM learned_patterns
        ''')
        
        patterns = cursor.fetchall()
        conn.close()

        # Convert patterns to feature matrix
        pattern_features = []
        for pattern in patterns:
            pattern_hash, error_pattern, success_count, fail_count, best_solution = pattern
            total = success_count + fail_count
            if total > 0:
                success_rate = success_count / total
                pattern_data = json.loads(error_pattern)
                
                # Extract numerical features
                features = [
                    success_rate,
                    total,
                    success_count,
                    fail_count,
                    time.time() - json.loads(error_pattern).get('last_seen', 0)
                ]
                pattern_features.append(features)
                
                # Update solution cache with confidence score
                if success_rate > 0.8:
                    confidence = self._calculate_confidence(features)
                    if confidence > 0.7:  # High confidence threshold
                        self.solution_cache[pattern_hash] = {
                            'solution': best_solution,
                            'confidence': confidence
                        }
                        
                        # Update neural weights in database
                        cursor.execute('''
                        UPDATE learned_patterns
                        SET neural_weights = ?,
                            confidence_score = ?
                        WHERE pattern_hash = ?
                        ''', (json.dumps(features), confidence, pattern_hash))
                        
        # Train anomaly detector if enough data
        if pattern_features:
            X = np.array(pattern_features)
            self.anomaly_detector.fit(X)
            self.last_training = time.time()
            extra = {
                'status_code': StatusCodes.OPERATIONAL,
                'metadata': {
                    'pattern_hash': pattern_hash,
                    'success_rate': success_rate,
                    'total_occurrences': total
                }
            }
            logging.info(f"Pattern {pattern_hash} added to solution cache (success rate: {success_rate:.2%})", extra=extra)

    def get_recovery_solution(self, service: str, error_type: str, container_id: str) -> Optional[Dict]:
        """Get the best known recovery solution with confidence score."""
        pattern_key = f"{service}:{error_type}:{container_id}"
        solution_data = self.solution_cache.get(pattern_key)
        
        extra = {
            'status_code': StatusCodes.OPERATIONAL,
            'metadata': {
                'pattern_key': pattern_key,
                'solution_found': solution is not None,
                'service': service,
                'error_type': error_type
            }
        }
        logging.info(f"Retrieved solution for {pattern_key}: {'Found' if solution else 'Not found'}", extra=extra)
        if solution_data:
            return {
                'solution': solution_data['solution'],
                'confidence': solution_data['confidence'],
                'predicted_success_rate': self._predict_success_probability(service, error_type, container_id)
            }
        return None

    def _prediction_loop(self):
        """Continuously predict potential failures."""
        while True:
            try:
                self._predict_failures()
                time.sleep(60)  # Check every minute
            except Exception as e:
                logging.error(f"Error in prediction loop: {e}")
                time.sleep(60)

    def _predict_failures(self):
        """Predict potential failures in the near future."""
        # Get recent system states
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get last hour of events
        cursor.execute('''
        SELECT timestamp, service, container_id, error_type, system_state
        FROM failure_events
        WHERE timestamp > ?
        ORDER BY timestamp DESC
        ''', (time.time() - 3600,))
        
        recent_events = cursor.fetchall()
        
        if recent_events:
            # Prepare time series data
            df = pd.DataFrame(recent_events, columns=['timestamp', 'service', 'container_id', 'error_type', 'system_state'])
            
            # Group by service and container
            for (service, container_id), group in df.groupby(['service', 'container_id']):
                # Extract features from system states
                features = self._extract_prediction_features(group)
                
                if len(features) > 0:
                    # Predict anomalies
                    predictions = self.anomaly_detector.predict(features)
                    
                    # If anomaly detected, record prediction
                    if -1 in predictions:
                        confidence = self._calculate_prediction_confidence(features)
                        predicted_time = time.time() + (self.prediction_window * confidence)
                        
                        cursor.execute('''
                        INSERT INTO failure_predictions
                        (timestamp, service, container_id, predicted_error_type,
                         confidence, predicted_time, was_correct)
                        VALUES (?, ?, ?, ?, ?, ?, NULL)
                        ''', (
                            time.time(),
                            service,
                            container_id,
                            'predicted_failure',
                            confidence,
                            predicted_time
                        ))
                        
                        # Log prediction
                        extra = {
                            'status_code': StatusCodes.DEGRADED,
                            'metadata': {
                                'service': service,
                                'container_id': container_id,
                                'confidence': confidence,
                                'predicted_time': predicted_time
                            }
                        }
                        logging.warning(f"Potential failure predicted for {service} in container {container_id}", extra=extra)
        
        conn.commit()
        conn.close()

    def _calculate_prediction_confidence(self, features: np.ndarray) -> float:
        """Calculate confidence score for prediction."""
        # Use anomaly scores to determine confidence
        scores = self.anomaly_detector.score_samples(features)
        return 1 - (np.exp(scores.mean()) / 2)  # Transform to 0-1 range

    def _extract_prediction_features(self, group: pd.DataFrame) -> np.ndarray:
        """Extract relevant features for prediction."""
        features = []
        for _, row in group.iterrows():
            try:
                system_state = json.loads(row['system_state'])
                # Extract numerical features from system state
                memory_usage = float(system_state.get('memory_usage', '0').split('\n')[1].split()[2])
                load_avg = float(system_state.get('load_avg', [0])[0])
                features.append([memory_usage, load_avg])
            except (json.JSONDecodeError, IndexError, ValueError) as e:
                logging.error(f"Error extracting features: {e}")
                continue
        return np.array(features) if features else np.array([])

    def _calculate_confidence(self, features: List[float]) -> float:
        """Calculate confidence score for a solution."""
        # Normalize features
        normalized = np.array(features) / np.array(features).max()
        # Weight different aspects
        weights = [0.4, 0.2, 0.2, 0.1, 0.1]  # Prioritize success rate
        return float(np.dot(normalized, weights))

    def _predict_success_probability(self, service: str, error_type: str, container_id: str) -> float:
        """Predict probability of successful recovery."""
        pattern_key = f"{service}:{error_type}:{container_id}"
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get historical success rate
        cursor.execute('''
        SELECT success_count, fail_count, neural_weights
        FROM learned_patterns
        WHERE pattern_hash = ?
        ''', (pattern_key,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            success_count, fail_count, neural_weights = result
            if neural_weights:
                weights = json.loads(neural_weights)
                # Calculate probability using historical data and neural weights
                base_prob = success_count / (success_count + fail_count) if (success_count + fail_count) > 0 else 0.5
                confidence = self._calculate_confidence(weights)
                return (base_prob * 0.7) + (confidence * 0.3)  # Weighted combination
        
        return 0.5  # Default probability

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
        
        extra = {
            'status_code': StatusCodes.OPERATIONAL if success else StatusCodes.FAILED,
            'metadata': {
                'event_id': event_id,
                'success': success,
                'time_taken': time_taken,
                'attempt': attempt
            }
        }
        logging.info(f"Recorded recovery attempt for event {event_id}: {'Success' if success else 'Failed'}", extra=extra)

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
        
        extra = {
            'status_code': StatusCodes.OPERATIONAL,
            'metadata': {
                'pattern_key': pattern_key,
                'total_attempts': total,
                'successful_attempts': successes,
                'success_rate': success_rate
            }
        }
        logging.info(f"Success rate for {pattern_key}: {success_rate:.2%}", extra=extra)
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
    extra = {
        'status_code': StatusCodes.OPERATIONAL,
        'metadata': {
            'container_id': container_id,
            'check_type': 'status'
        }
    }
    logging.debug(f"Checking status for container {container_id}", extra=extra)
    
    try:
        # Get current status
        cmd = ['pvesh', 'get', f'/nodes/pve/lxc/{container_id}/status/current', '--output-format=json']
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        status_data = json.loads(result.stdout)
        
        # Log detailed status information
        extra['metadata']['status'] = status_data.get('status')
        extra['metadata']['cpu'] = status_data.get('cpu')
        extra['metadata']['memory'] = status_data.get('mem')
        logging.info(f"Container {container_id} status data:\n{json.dumps(status_data, indent=2)}", extra=extra)
        
        # Check if container is not running
        if not status_data.get('status', '').startswith('running'):
            extra['status_code'] = StatusCodes.DEGRADED
            logging.warning(f"Container {container_id} is not running. Status: {status_data.get('status', 'unknown')}", extra=extra)
        
        return status_data
    except subprocess.CalledProcessError as e:
        extra['status_code'] = StatusCodes.FAILED
        extra['metadata']['error'] = e.stderr
        logging.error(f"Failed to get container status: {e.stderr}", extra=extra)
        return {"status": "error", "error": e.stderr}
    except json.JSONDecodeError as e:
        extra['status_code'] = StatusCodes.FAILED
        extra['metadata']['error'] = str(e)
        logging.error(f"Failed to parse JSON from pvesh output: {e}", extra=extra)
        return {"status": "unknown", "error": str(e)}
    except Exception as e:
        extra['status_code'] = StatusCodes.FAILED
        extra['metadata']['error'] = str(e)
        logging.error(f"Error checking container status: {e}", extra=extra)
        return {"status": "error", "error": str(e)}

def monitor_system_health():
    """Example usage of the FailureLearningSystem."""
    learning_system = FailureLearningSystem()
    
    extra = {
        'status_code': StatusCodes.OPERATIONAL,
        'metadata': {
            'monitor_start_time': time.time(),
            'pid': os.getpid()
        }
    }
    logging.info("Starting system health monitoring", extra=extra)
    
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
                            
                            extra = {
                                'status_code': StatusCodes.RECOVERING,
                                'metadata': {
                                    'container_id': container_id,
                                    'service': service,
                                    'command': ' '.join(cmd)
                                }
                            }
                            logging.info(f"Attempting recovery with command: {' '.join(cmd)}", extra=extra)
                            
                            try:
                                result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                                success = True
                                extra['status_code'] = StatusCodes.OPERATIONAL
                                extra['metadata']['output'] = result.stdout
                                logging.info(f"Recovery command output: {result.stdout}", extra=extra)
                            except subprocess.CalledProcessError as e:
                                success = False
                                extra['status_code'] = StatusCodes.FAILED
                                extra['metadata']['error'] = e.stderr
                                logging.error(f"Recovery command failed: {e.stderr}", extra=extra)
                            
                            recovery_time = time.time() - start_time
                            
                            # Record recovery attempt
                            event.recovery_attempt = ' '.join(cmd)
                            event.recovery_success = success
                            event.recovery_time = recovery_time
                            learning_system.record_failure(event)
                            
                            extra = {
                                'status_code': StatusCodes.OPERATIONAL if success else StatusCodes.FAILED,
                                'metadata': {
                                    'success': success,
                                    'recovery_time': recovery_time,
                                    'container_id': container_id,
                                    'service': service
                                }
                            }
                            logging.info(f"Recovery attempt {'successful' if success else 'failed'}", extra=extra)

                except Exception as e:
                    extra = {
                        'status_code': StatusCodes.FAILED,
                        'metadata': {
                            'service': service,
                            'error': str(e)
                        }
                    }
                    logging.error(f"Error checking service {service}: {e}", extra=extra)

            # Sleep before next check (10 seconds for more responsive monitoring)
            time.sleep(10)

        except Exception as e:
            extra = {
                'status_code': StatusCodes.FAILED,
                'metadata': {
                    'error': str(e)
                }
            }
            logging.error(f"Error in health monitoring: {e}", extra=extra)
            time.sleep(10)

if __name__ == "__main__":
    # Configure JSON logging
    json_handler = logging.FileHandler('/var/log/ai-failure-learning.log')
    json_handler.setFormatter(JsonFormatter())
    
    # Keep a human-readable stream handler
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    
    # Setup root logger
    logging.basicConfig(
        level=logging.DEBUG,
        handlers=[json_handler, stream_handler]
    )

    # Initial startup log with status
    extra = {
        'status_code': StatusCodes.OPERATIONAL,
        'metadata': {
            'version': '1.0.3',
            'pid': os.getpid(),
            'host': os.uname().nodename
        }
    }
    logging.info("AI Platform Failure Learning System starting up...", extra=extra)
    
    monitor_system_health()
