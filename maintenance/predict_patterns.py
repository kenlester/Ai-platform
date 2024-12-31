#!/usr/bin/env python3

import sqlite3
import json
import time
import math
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

class NeuralPredictor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.pattern_memory: Dict[str, List[Dict[str, Any]]] = {}
        self.evolution_threshold = 0.85
        self.pattern_window = 10
        self.initialize_neural_db()

    def initialize_neural_db(self):
        """Initialize neural pattern database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Pattern predictions table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS pattern_predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern_type TEXT NOT NULL,
            evolution_confidence REAL NOT NULL,
            evolution_time TIMESTAMP NOT NULL,
            emergence_type TEXT NOT NULL,
            pattern_signature TEXT NOT NULL,
            neural_state TEXT NOT NULL,
            flow_metrics TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Pattern history table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS pattern_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern_type TEXT NOT NULL,
            pattern_state TEXT NOT NULL,
            neural_metrics TEXT NOT NULL,
            flow_state TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        conn.commit()
        conn.close()

    def analyze_pattern_state(self, pattern_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze current pattern state for prediction."""
        neural_health = pattern_data.get('neural_health', {})
        flow_state = pattern_data.get('flow_state', {})
        resources = pattern_data.get('neural_resources', {})

        # Calculate neural stability
        stability = 1.0
        if neural_health.get('status') != 'optimal':
            stability *= 0.7
        if not flow_state.get('connected', False):
            stability *= 0.5

        # Calculate resource pressure
        resource_efficiency = resources.get('efficiency', 0) / 100
        resource_pressure = 1 - (math.exp(-resource_efficiency) if resource_efficiency > 0 else 0)

        # Calculate flow metrics
        flow_latency = float(flow_state.get('latency', 0) or 0)
        flow_health = math.exp(-flow_latency/100) if flow_latency > 0 else 1

        return {
            'stability': stability,
            'resource_pressure': resource_pressure,
            'flow_health': flow_health,
            'overall_health': (stability + flow_health + (1 - resource_pressure)) / 3
        }

    def detect_patterns(self, history: List[Dict[str, Any]]) -> List[Dict[str, float]]:
        """Detect emerging patterns from historical data."""
        if len(history) < self.pattern_window:
            return []

        patterns = []
        window = history[-self.pattern_window:]

        # Analyze resource trends
        resource_trend = self._analyze_trend([
            entry.get('neural_resources', {}).get('efficiency', 0)
            for entry in window
        ])

        # Analyze health trends
        health_trend = self._analyze_trend([
            1.0 if entry.get('neural_health', {}).get('status') == 'optimal' else 0.5
            for entry in window
        ])

        # Analyze flow trends
        flow_trend = self._analyze_trend([
            1.0 if entry.get('flow_state', {}).get('connected', False) else 0
            for entry in window
        ])

        patterns.append({
            'type': 'resource_evolution',
            'confidence': abs(resource_trend),
            'direction': 'increasing' if resource_trend > 0 else 'decreasing'
        })

        patterns.append({
            'type': 'health_evolution',
            'confidence': abs(health_trend),
            'direction': 'improving' if health_trend > 0 else 'degrading'
        })

        patterns.append({
            'type': 'flow_evolution',
            'confidence': abs(flow_trend),
            'direction': 'strengthening' if flow_trend > 0 else 'weakening'
        })

        return patterns

    def _analyze_trend(self, values: List[float]) -> float:
        """Analyze trend direction and strength."""
        if not values:
            return 0.0

        n = len(values)
        if n < 2:
            return 0.0

        x = list(range(n))
        x_mean = sum(x) / n
        y_mean = sum(values) / n

        numerator = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, values))
        denominator = sum((xi - x_mean) ** 2 for xi in x)

        return numerator / denominator if denominator != 0 else 0.0

    def predict_evolution(self, pattern_type: str, current_state: Dict[str, Any]) -> Dict[str, Any]:
        """Predict pattern evolution based on current state and history."""
        if pattern_type not in self.pattern_memory:
            self.pattern_memory[pattern_type] = []

        # Update pattern memory
        self.pattern_memory[pattern_type].append(current_state)
        if len(self.pattern_memory[pattern_type]) > self.pattern_window:
            self.pattern_memory[pattern_type].pop(0)

        # Analyze current state
        state_analysis = self.analyze_pattern_state(current_state)

        # Detect patterns
        emerging_patterns = self.detect_patterns(self.pattern_memory[pattern_type])

        # Calculate evolution confidence
        evolution_confidence = state_analysis['overall_health']
        for pattern in emerging_patterns:
            if pattern['confidence'] > self.evolution_threshold:
                evolution_confidence *= 0.9  # Reduce confidence if strong patterns detected

        # Predict evolution time
        evolution_time = datetime.now() + timedelta(
            minutes=int(30 * (1 - evolution_confidence))  # Higher confidence = shorter evolution time
        )

        # Determine emergence type
        emergence_type = self._determine_emergence_type(state_analysis, emerging_patterns)

        return {
            'pattern_type': pattern_type,
            'evolution_confidence': evolution_confidence,
            'evolution_time': evolution_time.isoformat(),
            'emergence_type': emergence_type,
            'pattern_signature': json.dumps(emerging_patterns),
            'neural_state': json.dumps(state_analysis),
            'flow_metrics': json.dumps({
                'stability': state_analysis['stability'],
                'flow_health': state_analysis['flow_health']
            })
        }

    def _determine_emergence_type(
        self,
        state_analysis: Dict[str, float],
        patterns: List[Dict[str, float]]
    ) -> str:
        """Determine the type of pattern emergence."""
        if state_analysis['overall_health'] < 0.5:
            return 'degradation'
        
        if any(p['confidence'] > self.evolution_threshold for p in patterns):
            if state_analysis['resource_pressure'] > 0.8:
                return 'resource_optimization'
            elif state_analysis['flow_health'] < 0.7:
                return 'flow_enhancement'
            else:
                return 'pattern_evolution'
        
        return 'stable_operation'

    def store_prediction(self, prediction: Dict[str, Any]):
        """Store pattern prediction in database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
        INSERT INTO pattern_predictions (
            pattern_type,
            evolution_confidence,
            evolution_time,
            emergence_type,
            pattern_signature,
            neural_state,
            flow_metrics
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            prediction['pattern_type'],
            prediction['evolution_confidence'],
            prediction['evolution_time'],
            prediction['emergence_type'],
            prediction['pattern_signature'],
            prediction['neural_state'],
            prediction['flow_metrics']
        ))

        conn.commit()
        conn.close()

    def store_pattern_state(self, pattern_type: str, state: Dict[str, Any]):
        """Store pattern state in history."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
        INSERT INTO pattern_history (
            pattern_type,
            pattern_state,
            neural_metrics,
            flow_state
        ) VALUES (?, ?, ?, ?)
        ''', (
            pattern_type,
            json.dumps(state),
            json.dumps(state.get('neural_resources', {})),
            json.dumps(state.get('flow_state', {}))
        ))

        conn.commit()
        conn.close()

def main():
    """Main prediction loop."""
    predictor = NeuralPredictor('/opt/ai_platform/failure_learning.db')
    
    while True:
        try:
            # Read current pattern states
            with open('/root/Ai-platform/data/metrics/container_stats/summary.json', 'r') as f:
                current_states = json.load(f)

            for pattern_id, state in current_states.get('patterns', {}).items():
                pattern_type = state.get('pattern_type')
                if pattern_type:
                    # Store current state
                    predictor.store_pattern_state(pattern_type, state)
                    
                    # Generate and store prediction
                    prediction = predictor.predict_evolution(pattern_type, state)
                    predictor.store_prediction(prediction)

            time.sleep(60)  # Update predictions every minute
            
        except Exception as e:
            print(f"Error in prediction cycle: {e}")
            time.sleep(10)  # Brief pause before retry

if __name__ == "__main__":
    main()
