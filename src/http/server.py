__version__ = "0.1"

__all__ = ["GzHandler"]

import os
import posixpath
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib
import urllib.request
from optparse import OptionParser
import mimetypes
import json
import logging

SERVER_PORT = 80
UserHeader = "x-forwarded-user"


def parse_options():
    # Option parsing logic.
    parser = OptionParser()
    global SERVER_PORT
    parser.add_option("-p", "--port", dest="port",
                      default=SERVER_PORT, help="http port")

    (options, args) = parser.parse_args()
    print('Run with number of args: {0}'.format(len(args)))
    SERVER_PORT = int(options.port)

    # setup logging
    logging.basicConfig(filename='/var/log/oc/oc.log',
                        filemode='a',
                        format='%(asctime)s,%(msecs)d %(name)s %(levelname)s %(message)s',
                        level=logging.INFO)


class GzHandler(BaseHTTPRequestHandler):
    server_version = "http/" + __version__

    def do_GET(self):
        """Serve a GET request."""
        self.user = None
        if UserHeader in self.headers:
            u = self.headers[UserHeader]
            self.user = {"user": u}
            logging.info('serve user={0}'.format(u))

        content = self.prepare()
        if content:
            self.wfile.write(content)

    def prepare(self):
        path = self.normalize(self.path)
        print("'{0}' - {1}".format(self.path, path))
        if path == '/user':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            return json.dumps(self.user).encode()

        if path == '/json':
            query = urllib.parse.splitquery(self.path)[1]
            ps = {}
            if query is not None:
                ps = dict(qc.split("=") for qc in query.split("&"))

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin',
                             'http://localhost:3000')
            self.end_headers()

            # special url handling
            if ps['req'] == "apiget":
                url = '{url}'
                with urllib.request.urlopen(url.format(**ps)) as response:
                    return response.read()

            # request request parameters
            return json.dumps(ps).encode()
        elif os.path.isdir(path):
            if not self.path.endswith('/'):
                self.send_response(404)
                return None

            # rewrite root
            if path == '/':
                path = "/index.html"

        # open the file for transfering
        mt = mimetypes.guess_type(path)[0]
        print("Serving path '{0}' in type {1}".format(path, mt))
        f = None
        try:
            f = open("." + path, 'rb')
        except IOError:
            self.send_error(404, "File not found")
            return None

        self.send_response(200)
        if path.endswith('.gz'):
            self.send_header("Content-Encoding", "gzip")

        content = f.read()
        f.close()
        self.send_header("Content-Type", mt)
        self.send_header("Content-Length", len(content))
        self.end_headers()
        return content

    def normalize(self, path):
        # abandon query parameters
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        return posixpath.normpath(urllib.parse.unquote(path))


def run(HandlerClass=GzHandler, ServerClass=HTTPServer):
    parse_options()
    server_address = ('127.0.0.1', SERVER_PORT)

    GzHandler.protocol_version = "HTTP/1.0"
    httpd = HTTPServer(server_address, GzHandler)

    sa = httpd.socket.getsockname()
    print("Serving HTTP on", sa[0], "port", sa[1], "...")
    httpd.serve_forever()


if __name__ == '__main__':
    run()
