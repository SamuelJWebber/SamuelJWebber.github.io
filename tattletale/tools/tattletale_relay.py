#!/usr/bin/env python3
"""Let TattleTale NYC use a model running on your own computer.

This relay checks a token so strangers can't use your computer, adds the headers a browser
needs, and forwards requests to a Jev-compatible server such as llm2jev serving the open
JPT-4B model. Standard library only.

  1. Start the model server (needs a GPU or an Apple Silicon Mac; JPT-4B is non-commercial):
       pip install "llm2jev[hf,vision]"
       llm2jev --model kirp/jpt-4b --backend hf --port 8080 --temperature 1.036
  2. Start this relay. It prints a token, saved in ~/.tattletale-relay-token so it stays the
     same every time (--new-token makes a new one):
       python3 tattletale_relay.py
  3. Give it an HTTPS address. For a fixed one, use Tailscale Funnel (free); it lasts until you turn it off:
       tailscale funnel --bg 8787          -> https://<computer>.<tailnet>.ts.net
     or, for a quick test, a Cloudflare quick tunnel (a new address every time):
       cloudflared tunnel --url http://localhost:8787
  4a. For everyone, through TattleTale's AI (tools/worker): put the address in wrangler.toml as
      LOCAL_URL and the token in the Worker with: npx wrangler secret put LOCAL_TOKEN
  4b. Just for you: in the app, About > AI assist > Model: Your computer. Paste the address and token there.
"""
import argparse, http.server, json, os, secrets, sys, time, urllib.error, urllib.request

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--upstream', default='http://127.0.0.1:8080', help='the Jev-compatible server (default: llm2jev on port 8080)')
    ap.add_argument('--port', type=int, default=8787)
    ap.add_argument('--origin', default='https://samueljwebber.github.io', help='the web app allowed to call this relay')
    ap.add_argument('--token', default='', help='the token to require (default: the one saved in ~/.tattletale-relay-token, made on first run)')
    ap.add_argument('--new-token', action='store_true', help='make and save a new token (the old one stops working)')
    a = ap.parse_args()
    saved = os.path.expanduser('~/.tattletale-relay-token')
    token = a.token or ('' if a.new_token or not os.path.exists(saved) else open(saved).read().strip())
    if not token:
        token = secrets.token_urlsafe(24)
        fd = os.open(saved, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600); os.write(fd, token.encode()); os.close(fd)
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
    print(f'Token: {token}')
    print('  (for TattleTale\'s AI: npx wrangler secret put LOCAL_TOKEN, then paste it at the prompt; or paste it into the app)', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', a.port), Relay).serve_forever()

if __name__ == '__main__':
    sys.exit(main())
