#!/usr/bin/env python3
"""
간단한 HTTP 서버로 게임을 로컬에서 테스트합니다.
사용법: python serve.py
"""

import http.server
import socketserver
import webbrowser
import os

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"🎮 게임 서버가 http://localhost:{PORT} 에서 실행 중...")
        print("Ctrl+C로 서버를 종료할 수 있습니다.")
        
        # 브라우저 자동 열기
        webbrowser.open(f'http://localhost:{PORT}')
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")
            httpd.shutdown() 