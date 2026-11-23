#!/usr/bin/env python3
"""Let TattleTale NYC on your phone use a model running on your own computer.

The app runs on https://samueljwebber.github.io, so the browser will only talk to an HTTPS
server that allows that origin. This relay adds those headers, checks a token so strangers
can't use your computer, and forwards requests to a Jev-compatible server such as llm2jev
serving the open JPT-4B model. Standard library only.

  1. Start the model server (needs a GPU or an Apple Silicon Mac; JPT-4B is non-commercial):
       pip install "llm2jev[hf,vision]"
       llm2jev --model kirp/jpt-4b --backend hf --port 8080 --temperature 1.036
  2. Start this relay; it prints a token:
       python3 tattletale_relay.py
  3. Give it an HTTPS address your phone can reach (free, no account):
       cloudflared tunnel --url http://localhost:8787
  4. In the app: About > AI assist > Model: Your computer. Paste the https address and the token.
"""
import argparse, http.server, json, secrets, sys, time, urllib.error, urllib.request

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--upstream', default='http://127.0.0.1:8080', help='the Jev-compatible server (default: llm2jev on port 8080)')
    ap.add_argument('--port', type=int, default=8787)
    ap.add_argument('--origin', default='https://samueljwebber.github.io', help='the web app allowed to call this relay')
    ap.add_argument('--token', default='', help='a token to require (default: a new random one, printed below)')
    a = ap.parse_args()
    token = a.token or secrets.token_urlsafe(18)
    max_body = 20 * 1024 * 1024

    class Relay(http.server.BaseHTTPRequestHandler):
        def cors(self):
            self.send_header('Access-Control-Allow-Origin', a.origin)
            self.send_header('Access-Control-Allow-Headers', 'authorization, content-type')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Max-Age', '600')
            self.send_header('Vary', 'Origin')

        def reply(self, status, obj):
            body = json.dumps(obj).encode()
            self.send_response(status); self.cors()
            self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body)))
            self.end_headers(); self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204); self.cors(); self.send_header('Content-Length', '0'); self.end_headers()

        def do_POST(self):
            t0 = time.time()
            if self.path.rstrip('/') != '/v1/systemone':
                return self.reply(404, {'error': {'message': 'only /v1/systemone is relayed'}})
            if self.headers.get('Authorization', '') != f'Bearer {token}':
                return self.reply(401, {'error': {'message': 'wrong or missing token'}})
            n = int(self.headers.get('Content-Length') or 0)
            if n <= 0 or n > max_body:
                return self.reply(413, {'error': {'message': 'request too large'}})
            data = self.rfile.read(n)
            req = urllib.request.Request(a.upstream.rstrip('/') + '/v1/systemone', data=data, headers={'Content-Type': 'application/json'}, method='POST')
            try:
                with urllib.request.urlopen(req, timeout=180) as r:
                    status, body = r.status, r.read()
            except urllib.error.HTTPError as e:
                status, body = e.code, e.read()
            except Exception as e:
                return self.reply(502, {'error': {'message': f'model server not reachable: {e}'}})
            self.send_response(status); self.cors()
            self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body)))
            self.end_headers(); self.wfile.write(body)
            print(f'{time.strftime("%H:%M:%S")} {status} {len(data) // 1024} KB in, {time.time() - t0:.1f} s', flush=True)

        def log_message(self, *args):
            pass

    print(f'TattleTale relay on http://localhost:{a.port} -> {a.upstream}')
    print(f'Allowed web app: {a.origin}')
    print(f'Token (paste into the app): {token}', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', a.port), Relay).serve_forever()

if __name__ == '__main__':
    sys.exit(main())
