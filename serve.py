"""Serve Jahiz on this Mac only (127.0.0.1:8766) with caching off, so Chrome always opens the latest page."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import subprocess,sys,threading,webbrowser
PORT=8766;URL=f'http://127.0.0.1:{PORT}/jahiz-studio.html'
class Handler(SimpleHTTPRequestHandler):
 def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
 def log_message(self,*args):pass
def open_app():
 if subprocess.run(['open','-a','Google Chrome',URL],capture_output=True).returncode:webbrowser.open(URL)
try:server=ThreadingHTTPServer(('127.0.0.1',PORT),partial(Handler,directory=str(Path(__file__).resolve().parent)))
except OSError:open_app();print('جاهز شغّال من قبل؛ فتحته لك.');sys.exit(0)
print('جاهز شغّال على جهازك فقط. خل هالنافذة مفتوحة؛ Ctrl+C يوقفه.',flush=True)
threading.Timer(.4,open_app).start()
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
