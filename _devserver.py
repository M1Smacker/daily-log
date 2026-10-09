#!/usr/bin/env python3
"""
Canonical no-cache dev server for client website projects.

Copy this file into the project root and point the project's
.claude/launch.json at it. Do not hand-roll a new one per project —
three things below are easy to get wrong and all three have cost real time.

1. NO-CACHE HEADERS. A stock `python -m http.server` sends zero cache
   headers, which means the browser falls back to its own aggressive
   heuristic caching, per browser profile (not per tab). You fix a bug,
   reload, and get served the old broken version.

2. THREADING. `http.server.test()` defaults to the single-threaded
   HTTPServer, which handles exactly one request at a time. On a page
   with many images, the browser opens several parallel connections;
   the extras queue, some time out, and the browser reports them as
   broken images — a different random handful on each reload. This
   looks exactly like a caching problem and will be misdiagnosed as one.

3. IPv4/IPv6. `http.server.test()` binds to `::` and on Windows the
   socket is IPv6-ONLY by default, so the server is reachable on
   http://[::1]:PORT but *connection-refused* on http://127.0.0.1:PORT.
   A dead-looking server that is actually running and serving fine is a
   genuinely confusing hour to lose. DualStackServer below fixes it so
   both loopback addresses work.

Do NOT "improve" this by setting protocol_version = 'HTTP/1.1' to get
keep-alive. Python's http.server family has documented hang/reset bugs
under keep-alive (see Werkzeug issue #2397); it was tried on Nexo and
made things measurably worse. Threading alone is the supported fix.
"""
import http.server
import os
import socket
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


class DualStackServer(http.server.ThreadingHTTPServer):
    """Threaded, and reachable on both 127.0.0.1 and [::1]."""
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass  # platform without IPv6, or already dual-stack
        return super().server_bind()


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

    try:
        server_class, bind = DualStackServer, '::'
    except Exception:  # pragma: no cover
        server_class, bind = http.server.ThreadingHTTPServer, '0.0.0.0'

    http.server.test(
        HandlerClass=NoCacheHandler,
        ServerClass=server_class,
        port=port,
        bind=bind,
    )
