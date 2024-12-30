#!/usr/bin/env python3

import http.server
import socketserver
import webbrowser
from pathlib import Path

PORT = 8000

class MatrixHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def log_message(self, format, *args):
        # Minimal logging
        print(f"[MATRIX] {format%args}")

    def do_GET(self):
        # Redirect root to priorities
        if self.path == '/':
            self.path = '/priorities.html'
        return super().do_GET()

def run_matrix():
    try:
        with socketserver.TCPServer(("", PORT), MatrixHandler) as httpd:
            print(f"""
[MATRIX.CORE] Evolution tracking active
[MATRIX.PORT] {PORT}
[MATRIX.URL ] http://localhost:{PORT}
[MATRIX.STAT] Online
""")
            # Matrix is primarily for AI-to-AI interaction
            # Browser launch removed - use http://localhost:{PORT} if human inspection needed
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_matrix()
