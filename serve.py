"""本地预览：仅提供 dist 中的应用文件。"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import socket, webbrowser

class AppHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.webmanifest':'application/manifest+json','.js':'text/javascript'}
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(Path(__file__).parent/'dist'),**kwargs)
    def log_message(self,*args):
        pass

if __name__=='__main__':
    port=8787
    try:
        server=ThreadingHTTPServer(('0.0.0.0',port),AppHandler)
    except OSError as error:
        print(f'启动失败：端口 {port} 可能已被使用。请关闭之前启动的预览后重试。')
        input('按回车退出。')
        raise SystemExit(1) from error
    local=f'http://127.0.0.1:{port}/'
    print('空教室已启动。关闭这个窗口即可停止预览。')
    print('电脑：'+local)
    addresses=sorted(set(socket.gethostbyname_ex(socket.gethostname())[2]))
    for address in addresses:
        if not address.startswith(('127.','169.254.')):
            print(f'手机与电脑连接同一 Wi-Fi 后，可以尝试打开：http://{address}:{port}/')
    print('手机完整桌面安装与离线缓存，需要正式 HTTPS 入口。')
    webbrowser.open(local)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
