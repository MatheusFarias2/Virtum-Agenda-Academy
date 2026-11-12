#!/usr/bin/env python3
"""Servidor local do Virtum Agenda: SQLite somente leitura, sem publicar o BD."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import sys
from pathlib import Path
import threading
import time
from urllib.parse import urlsplit
sys.path.insert(0, str(Path(__file__).resolve().parent))
from exportar_agenda import carregar_agenda

ROOT = Path(__file__).resolve().parent
class AgendaServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    def __init__(self, address, handler, db, interval):
        super().__init__(address, handler)
        self.db = db
        self.interval = interval
        self.last_check = 0.0
        self.cache = None
        self.lock = threading.Lock()
    def agenda(self):
        with self.lock:
            if self.cache is None or time.monotonic() - self.last_check >= self.interval:
                # Nunca servir dados antigos como se fossem atuais após erro de leitura.
                self.cache = None
                self.last_check = time.monotonic()
                self.cache = carregar_agenda(str(self.db))
            return self.cache

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self):
        # Evita que o navegador reutilize HTML/JS antigo da versao demonstrativa.
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def do_GET(self):
        route = urlsplit(self.path).path
        if route in ('/api/agenda', '/agenda.json'):
            try:
                payload = json.dumps(self.server.agenda(), ensure_ascii=False).encode('utf-8')
                status = 200
            except Exception as exc:
                print(f'Erro ao consultar BD: {exc}', flush=True)
                payload = json.dumps({'erro':'Não foi possível consultar o banco. Verifique o terminal.'}, ensure_ascii=False).encode('utf-8')
                status = 503
            self.send_response(status)
            self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        # Somente arquivos públicos explicitamente permitidos.
        allowed = {'/','/index.html','/assets/app.js','/assets/app.css'}
        if route not in allowed:
            self.send_error(404)
            return
        self.path = '/index.html' if route == '/' else route
        return super().do_GET()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--banco', required=True)
    parser.add_argument('--porta',type=int,default=8080)
    parser.add_argument('--intervalo',type=int,default=30)
    args = parser.parse_args()
    db=Path(args.banco).expanduser().resolve()
    if not db.is_file(): parser.error(f'Banco não encontrado: {db}')
    preview=carregar_agenda(str(db))
    print(f'Banco validado: {db} | {len(preview["eventos"])} atividades | {len(preview["cursos"])} cursos', flush=True)
    with AgendaServer(('127.0.0.1',args.porta),Handler,db,max(5,args.intervalo)) as srv:
        print(f'Virtum Agenda: http://127.0.0.1:{args.porta}/ | Atualização a cada {max(5,args.intervalo)}s',flush=True)
        try: srv.serve_forever()
        except KeyboardInterrupt: pass

if __name__ == '__main__': main()
