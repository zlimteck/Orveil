const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { Client } = require('ssh2');
const https = require('https');
const http = require('http');
const tls = require('tls');

function sshConnect(sshConfig, targetHost, targetPort, callback) {
  const conn = new Client();
  conn.once('ready', () => {
    conn.forwardOut('127.0.0.1', 0, targetHost, targetPort, (err, stream) => {
      if (err) { conn.end(); return callback(err); }
      stream.once('close', () => conn.end());
      callback(null, stream);
    });
  });
  conn.once('error', callback);
  conn.connect({
    host: sshConfig.host,
    port: parseInt(sshConfig.port) || 22,
    username: sshConfig.username,
    readyTimeout: 10000,
    ...(sshConfig.privateKey
      ? { privateKey: sshConfig.privateKey }
      : { password: sshConfig.password }),
  });
}

class SshAgent extends https.Agent {
  constructor(sshConfig) {
    super();
    this.sshConfig = sshConfig;
  }
  createConnection(options, callback) {
    sshConnect(this.sshConfig, options.host, options.port || 443, (err, stream) => {
      if (err) return callback(err);
      // Wrap the SSH channel in TLS so axios can do the HTTPS handshake
      const tlsSocket = tls.connect({
        socket: stream,
        host: options.host,
        servername: options.servername || options.host,
        rejectUnauthorized: options.rejectUnauthorized !== false,
      });
      tlsSocket.once('error', callback);
      tlsSocket.once('secureConnect', () => callback(null, tlsSocket));
    });
  }
}

class SshHttpAgent extends http.Agent {
  constructor(sshConfig) {
    super();
    this.sshConfig = sshConfig;
  }
  createConnection(options, callback) {
    sshConnect(this.sshConfig, options.host, options.port || 80, callback);
  }
}

function getProxyAgents(proxy) {
  if (!proxy?.host) return null;

  if (proxy.type === 'ssh') {
    if (!proxy.username) return null;
    return {
      httpAgent:  new SshHttpAgent(proxy),
      httpsAgent: new SshAgent(proxy),
    };
  }

  if (!proxy.port) return null;

  const user = proxy.username ? encodeURIComponent(proxy.username) : '';
  const pass = proxy.password ? encodeURIComponent(proxy.password) : '';
  const auth = user ? `${user}:${pass}@` : '';
  const addr = `${proxy.host}:${proxy.port}`;

  if (proxy.type === 'socks5') {
    const agent = new SocksProxyAgent(`socks5://${auth}${addr}`);
    return { httpAgent: agent, httpsAgent: agent };
  } else if (proxy.type === 'https') {
    const agent = new HttpsProxyAgent(`https://${auth}${addr}`);
    return { httpAgent: agent, httpsAgent: agent };
  } else {
    // http (default)
    const agent = new HttpsProxyAgent(`http://${auth}${addr}`);
    return { httpAgent: agent, httpsAgent: agent };
  }
}

module.exports = { getProxyAgents };
