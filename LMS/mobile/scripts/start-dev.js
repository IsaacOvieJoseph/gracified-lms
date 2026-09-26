const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const VIRTUAL_ADAPTER = /virtual|vmware|vbox|hyper-?v|vethernet|docker|wsl|loopback|pseudo|bluetooth|tap|tun|npcap|zerotier/i;

function privateRangeRank(address) {
  if (address.startsWith('10.')) return 0;
  if (address.startsWith('192.168.')) return 1;
  const match = address.match(/^172\.(\d{1,3})\./);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return 2;
  }
  return 3;
}

function detectLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const entry of addresses || []) {
      const isIPv4 = entry.family === 'IPv4' || entry.family === 4;
      if (!isIPv4 || entry.internal) continue;
      if (entry.address.startsWith('127.')) continue;
      if (entry.address.startsWith('169.254.')) continue;

      candidates.push({
        name,
        address: entry.address,
        rank: privateRangeRank(entry.address) + (VIRTUAL_ADAPTER.test(name) ? 10 : 0),
      });
    }
  }

  candidates.sort((a, b) => a.rank - b.rank || a.address.localeCompare(b.address));
  return candidates[0] || null;
}

function resolveExpoCli() {
  try {
    return require.resolve('expo/bin/cli', { paths: [__dirname, path.join(__dirname, '..')] });
  } catch {
    return path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli');
  }
}

function main() {
  const args = process.argv.slice(2);
  const wantsLocalhost = args.includes('--localhost');
  const env = { ...process.env };

  if (wantsLocalhost) {
    console.log('[start-dev] --localhost requested, skipping LAN host detection.');
  } else {
    const lan = detectLanIp();
    if (lan) {
      env.REACT_NATIVE_PACKAGER_HOSTNAME = lan.address;
      console.log(`[start-dev] Using LAN host ${lan.address} (${lan.name}) for the dev server.`);
    } else {
      console.log('[start-dev] No usable LAN address found, starting Expo with its own detection.');
    }
  }

  const child = spawn(process.execPath, [resolveExpoCli(), 'start', ...args], {
    stdio: 'inherit',
    env,
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }

  child.on('error', (error) => {
    console.error(`[start-dev] Failed to start Expo: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main();
