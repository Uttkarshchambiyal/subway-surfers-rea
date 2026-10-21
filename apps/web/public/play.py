#!/usr/bin/env python3
"""Run the packaged game on localhost using only Python's standard library."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import argparse, webbrowser, threading
args=argparse.ArgumentParser(description='Play Subway Study locally.');args.add_argument('--port',type=int,default=8173);args.add_argument('--no-browser',action='store_true');opts=args.parse_args()
root=Path(__file__).resolve().parent
class GameHandler(SimpleHTTPRequestHandler):
 def end_headers(self):
  # Revalidate the shell and worker; hashed game assets remain cacheable.
  if self.path.split('?',1)[0].endswith(('/', '/index.html', '/sw.js')):
   self.send_header('Cache-Control','no-cache')
  super().end_headers()
class GameServer(ThreadingHTTPServer):
 # The original asset set and an offline-worker update can arrive together.
 request_queue_size=128
try: server=GameServer(('127.0.0.1',opts.port),partial(GameHandler,directory=str(root)))
except OSError as e:raise SystemExit(f'Port {opts.port} is unavailable. Close the other local server, or use --port 8174.\n{e}')
url=f'http://127.0.0.1:{opts.port}/'
print(f'Play: {url}\nKeep this window open. Press Ctrl+C to stop.\nYour progress and offline cache belong to this address.',flush=True)
if not opts.no_browser:threading.Timer(.5,lambda:webbrowser.open(url)).start()
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
