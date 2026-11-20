const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy');

const app = express();
const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true });

// Only allow official Shell Shockers domains
const ALLOWED_HOST = /^([a-z0-9-]+\.)*shellshock\.io$/i;

function parseTarget(url) {
  const match = url.match(/^\/([^/?#]+)(.*)$/);
  if (!match || !ALLOWED_HOST.test(match[1])) return null;
  return { host: match[1], path: match[2] || '/' };
}

// Spoof Origin so Shell Shockers' matchmaker & game servers allow the connection
proxy.on('proxyReq', (proxyReq) => {
  proxyReq.setHeader('Origin', 'https://shellshock.io');
});
proxy.on('proxyReqWs', (proxyReq) => {
  proxyReq.setHeader('Origin', 'https://shellshock.io');
});

// Allow your GitHub Pages domain to read API responses
proxy.on('proxyRes', (proxyRes, req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
});

proxy.on('error', (err, req, res) => {
  if (res && res.writeHead) res.writeHead(502).end('Proxy error');
});

app.use((req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.sendStatus(204);
  }
  const target = parseTarget(req.url);
  if (!target) return res.status(400).send('Invalid target host');
  req.url = target.path;
  proxy.web(req, res, { target: `https://${target.host}` });
});

const server = http.createServer(app);
server.on('upgrade', (req, socket, head) => {
  const target = parseTarget(req.url);
  if (!target) return socket.destroy();
  req.url = target.path;
  proxy.ws(req, socket, head, { target: `wss://${target.host}` });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Shell Shockers proxy running');
});
