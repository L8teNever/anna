import http.server
import socketserver
import os
import sys

PORT = 8080
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Redirect legacy /games/<game> to /<game>
        if self.path.startswith('/games/'):
            new_path = self.path.replace('/games/', '/', 1)
            self.send_response(301)
            self.send_header('Location', new_path)
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        # Set headers to prevent service worker and manifest from caching
        if self.path.endswith('sw.js') or self.path.endswith('manifest.json'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        else:
            # Let browsers cache static assets, but allow validation
            self.send_header('Cache-Control', 'public, max-age=3600')
        
        # Add security headers needed for PWAs & screen wake lock
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        super().end_headers()

if __name__ == '__main__':
    # Make sure public directory exists
    if not os.path.exists(DIRECTORY):
        os.makedirs(DIRECTORY)
        print(f"Created public directory at: {DIRECTORY}")

    # Set up server with threading to prevent requests from blocking each other
    class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True

    try:
        with ThreadingHTTPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
            print(f"Serving HTTP on port {PORT} (serving directory: {DIRECTORY})...")
            print(f"Access it locally at http://localhost:{PORT}")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nKeyboard interrupt received, exiting.")
        sys.exit(0)
