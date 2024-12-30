#!/usr/bin/env python3
import json
import os
import sys
import argparse
from typing import Dict, Any
from pathlib import Path

DEFAULT_CONFIG_PATH = Path("/opt/dev_tools/ai_agent_config.json")

class ConfigManager:
    def __init__(self, config_path: Path = DEFAULT_CONFIG_PATH):
        self.config_path = config_path
        self.default_config = self._load_default_config()
        self.current_config = self._load_current_config()

    def _load_default_config(self) -> Dict[str, Any]:
        """Load the default configuration template."""
        default_config = {
            "agent_settings": {
                "model_settings": {
                    "llm_model": "mistral",
                    "temperature": 0.7,
                    "max_tokens": 2048,
                    "context_window": 4096
                },
                "analysis_settings": {
                    "min_code_block_size": 50,
                    "max_code_block_size": 1000,
                    "overlap_size": 200,
                    "similarity_threshold": 0.85
                }
            },
            "vector_db_settings": {
                "collection_settings": {
                    "vector_size": 384,
                    "distance_metric": "cosine",
                    "optimize_interval_sec": 300
                }
            }
        }
        return default_config

    def _load_current_config(self) -> Dict[str, Any]:
        """Load the current configuration from file."""
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"No configuration file found at {self.config_path}")
            return self.default_config
        except json.JSONDecodeError:
            print(f"Invalid JSON in configuration file {self.config_path}")
            return self.default_config

    def validate_config(self, config: Dict[str, Any] = None) -> bool:
        """Validate configuration structure and values."""
        if config is None:
            config = self.current_config

        try:
            # Validate model settings
            model_settings = config["agent_settings"]["model_settings"]
            assert isinstance(model_settings["temperature"], float)
            assert 0 <= model_settings["temperature"] <= 1
            assert isinstance(model_settings["max_tokens"], int)
            assert model_settings["max_tokens"] > 0

            # Validate analysis settings
            analysis_settings = config["agent_settings"]["analysis_settings"]
            assert isinstance(analysis_settings["min_code_block_size"], int)
            assert isinstance(analysis_settings["max_code_block_size"], int)
            assert analysis_settings["min_code_block_size"] < analysis_settings["max_code_block_size"]
            assert isinstance(analysis_settings["similarity_threshold"], float)
            assert 0 <= analysis_settings["similarity_threshold"] <= 1

            # Validate vector DB settings
            vector_settings = config["vector_db_settings"]["collection_settings"]
            assert isinstance(vector_settings["vector_size"], int)
            assert vector_settings["vector_size"] > 0
            assert vector_settings["distance_metric"] in ["cosine", "euclidean", "dot"]

            return True
        except (KeyError, AssertionError) as e:
            print(f"Configuration validation failed: {str(e)}")
            return False

    def update_config(self, new_config: Dict[str, Any]) -> bool:
        """Update configuration with new values."""
        if not self.validate_config(new_config):
            return False

        self.current_config = new_config
        try:
            with open(self.config_path, 'w') as f:
                json.dump(new_config, f, indent=4)
            return True
        except Exception as e:
            print(f"Failed to update configuration: {str(e)}")
            return False

    def reset_to_default(self) -> bool:
        """Reset configuration to default values."""
        return self.update_config(self.default_config)

    def get_config_diff(self) -> Dict[str, Any]:
        """Get differences between current and default configuration."""
        def dict_diff(d1: Dict[str, Any], d2: Dict[str, Any], path: str = "") -> Dict[str, Any]:
            diff = {}
            for k in d1.keys() | d2.keys():
                if k not in d1:
                    diff[f"{path}{k}"] = ("missing", d2[k])
                elif k not in d2:
                    diff[f"{path}{k}"] = ("extra", d1[k])
                elif isinstance(d1[k], dict) and isinstance(d2[k], dict):
                    nested_diff = dict_diff(d1[k], d2[k], f"{path}{k}.")
                    diff.update(nested_diff)
                elif d1[k] != d2[k]:
                    diff[f"{path}{k}"] = ("changed", d1[k], d2[k])
            return diff

        return dict_diff(self.current_config, self.default_config)

def main():
    parser = argparse.ArgumentParser(description="AI Agent Configuration Manager")
    parser.add_argument('action', choices=['validate', 'reset', 'diff', 'show'],
                       help='Action to perform on configuration')
    parser.add_argument('--config', type=str, default=str(DEFAULT_CONFIG_PATH),
                       help='Path to configuration file')

    args = parser.parse_args()
    manager = ConfigManager(Path(args.config))

    if args.action == 'validate':
        is_valid = manager.validate_config()
        print(f"Configuration is {'valid' if is_valid else 'invalid'}")
        sys.exit(0 if is_valid else 1)

    elif args.action == 'reset':
        success = manager.reset_to_default()
        print(f"Configuration reset {'successful' if success else 'failed'}")
        sys.exit(0 if success else 1)

    elif args.action == 'diff':
        diff = manager.get_config_diff()
        if diff:
            print("Configuration differences from default:")
            for path, values in diff.items():
                if values[0] == "changed":
                    print(f"{path}: current={values[1]}, default={values[2]}")
                else:
                    print(f"{path}: {values[0]}={values[1]}")
        else:
            print("No differences from default configuration")

    elif args.action == 'show':
        print(json.dumps(manager.current_config, indent=4))

if __name__ == "__main__":
    main()
