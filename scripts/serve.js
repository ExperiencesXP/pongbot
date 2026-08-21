// Static server that also lists /ai/*.js so dropping a file is enough.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const START_PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function listAiFiles() {
  const dir = path.join(ROOT, 'ai');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (f) {
    return f.endsWith('.js') && !f.startsWith('_');
  }).sort();
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

function handler(req, res) {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);

  if (url === '/ai/manifest.json') {
    send(res, 200, JSON.stringify({ files: listAiFiles() }), MIME['.json']);
    return;
  }

  let rel = url === '/' ? '/index.html' : url;
  if (rel.includes('..')) {
    send(res, 400, 'Bad path');
    return;
  }
  const file = path.join(ROOT, rel);
  fs.readFile(file, function (err, data) {
    if (err) {
      send(res, 404, 'Not found: ' + rel);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

function listen(port, attemptsLeft) {
  const ipv4 = http.createServer(handler);
  ipv4.on('error', function (err) {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log('Port ' + port + ' er optaget, prøver ' + (port + 1) + '…');
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    if (err.code === 'EADDRINUSE') {
      console.error('Kunne ikke binde en port fra ' + START_PORT + '.');
      console.error('Stop den anden proces, eller kør:  set PORT=9090&& npm start');
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  });

  // IPv4 so http://127.0.0.1:port always works (Firefox on Windows).
  ipv4.listen(port, '0.0.0.0', function () {
    const ipv6 = http.createServer(handler);
    ipv6.on('error', function () {
      // ::1 already taken is fine; 127.0.0.1 still works.
    });
    ipv6.listen(port, '::1', function () {});

    const files = listAiFiles();
    console.log('pongbot  http://127.0.0.1:' + port + '/');
    console.log('          http://localhost:' + port + '/');
    console.log('AIs (' + files.length + '): ' + files.join(', '));
    console.log('Læg en .js i /ai og genindlæs — ingen ekstra config.');
  });
}

listen(START_PORT, 15);
