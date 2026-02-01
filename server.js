const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const WebSocket = require('ws');

const html = fs.readFileSync('./index.html');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end(html);
});

const wss = new WebSocket.Server({ server });

let logging = false;
let logStream = null;
let prevMap = new Map(); // key -> record

const timeStamp = () => new Date().toISOString();

function startLogging() {
  if (logging) return;
  const fname = `connections-log-${timeStamp().replace(/[:.]/g, '-')}.txt`;
  const fpath = path.join(__dirname, fname);
  logStream = fs.createWriteStream(fpath, { flags: 'a' });
  logStream.write(`# Connection log started ${timeStamp()}\n`);
  logging = true;
}

function stopLogging() {
  if (!logging) return;
  logStream.write(`# Connection log stopped ${timeStamp()}\n`);
  logStream.end();
  logStream = null;
  logging = false;
}

function logEvent(evt, rec) {
  if (!logging || !logStream) return;
  logStream.write(
    `${timeStamp()} ${evt} ${rec.proto} ${rec.local} -> ${rec.remote} pid=${rec.pid} state=${rec.state}\n`
  );
}

function splitHostPort(addr) {
  // Handles IPv6 [::]:port or ::1:port, IPv4, or hostname:port
  if (!addr) return { host: addr, port: '' };
  const mBracket = addr.match(/^\[(.*)\]:(\d+)$/);
  if (mBracket) return { host: mBracket[1], port: mBracket[2] };
  const lastColon = addr.lastIndexOf(':');
  if (lastColon === -1) return { host: addr, port: '' };
  return { host: addr.slice(0, lastColon), port: addr.slice(lastColon + 1) };
}

function pollNetstat() {
  // -f includes FQDN/hostname when resolvable
  exec('netstat -ano -f', { windowsHide: true }, (err, stdout) => {
    if (err) return;
    const lines = stdout.split(/\r?\n/).filter(l => l.includes('TCP'));
    const outbound = [], inbound = [];
    const nextMap = new Map();
    const events = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;
      const [proto, local, remote, state, pid] = parts;
      const { host: remoteHost, port: remotePort } = splitHostPort(remote);
      const isOutbound = !remote.startsWith('0.0.0.0') && !remote.startsWith('[::]');
      const rec = { proto, local, remote, remoteHost, remotePort, state, pid };
      const key = `${proto}|${local}|${remote}|${pid}`;
      nextMap.set(key, rec);
      if (!prevMap.has(key)) {
        logEvent('OPEN', rec);
        events.push({ type: 'OPEN', ts: timeStamp(), ...rec });
      }
      (isOutbound ? outbound : inbound).push(rec);
    }
    for (const [key, oldRec] of prevMap.entries()) {
      if (!nextMap.has(key)) {
        logEvent('CLOSE', oldRec);
        events.push({ type: 'CLOSE', ts: timeStamp(), ...oldRec });
      }
    }
    prevMap = nextMap;
    const payload = JSON.stringify({ ts: Date.now(), outbound, inbound, logging, events });
    wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(payload));
  });
}

setInterval(pollNetstat, 1000);

wss.on('connection', ws => {
  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      if (data.cmd === 'toggleLogging') {
        if (logging) stopLogging();
        else startLogging();
      }
    } catch (e) {
      // ignore
    }
  });
  ws.send(JSON.stringify({ ts: Date.now(), outbound: [], inbound: [], logging }));
});

server.listen(8080, () => console.log('Open http://localhost:8080'));
