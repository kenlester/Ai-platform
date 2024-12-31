#!/usr/bin/env python3
import time
import redis
import json
from pathlib import Path

STATS_DIR = Path('/root/Ai-platform/data/metrics/pattern_stats')

def update_stats():
    r = redis.Redis(host='localhost', port=6379, db=0)
    
    # Update cache stats
    hit_rate = float(r.info()['keyspace_hits']) / (float(r.info()['keyspace_hits']) + float(r.info()['keyspace_misses']))
    with open(STATS_DIR / 'cache_stats.txt', 'w') as f:
        f.write(f"cache_hit_rate:{hit_rate:.2f}")
    
    # Update token stats
    token_savings = int(r.hget('token_stats', 'total_savings') or 0)
    with open(STATS_DIR / 'token_stats.txt', 'a') as f:
        f.write(f"{int(time.time())} {token_savings}\n")
    
    # Update pattern stats
    pattern_success = float(r.get('pattern_success_rate') or 0)
    with open(STATS_DIR / 'pattern_stats.txt', 'a') as f:
        f.write(f"{int(time.time())} {pattern_success:.2f}\n")

def main():
    while True:
        try:
            update_stats()
        except Exception as e:
            print(f"Error updating stats: {e}")
        time.sleep(60)

if __name__ == '__main__':
    main()
