// ─── SSRF-guarded outbound fetch ──────────────────────────────────────────────
// Any outbound request whose URL originates from a user, a client-supplied
// metadata document, or model output MUST go through this. A plain fetch() here
// is a server-side request forgery primitive: it lets whoever controls the URL
// use this process's network position to reach things they cannot otherwise
// reach (cloud metadata on 169.254.169.254, Mongo on localhost, RFC1918 hosts).
//
// The core control is the custom `lookup` passed to https.request. Node calls it
// to resolve the hostname and then connects to exactly the address it returns,
// so validating inside lookup closes the DNS-rebinding window: an attacker
// cannot answer the first resolution with a public IP and the second with a
// private one, because there is only ever one resolution.
//
// Redirects are never followed — a public URL that 302s to 169.254.169.254 is
// the classic bypass, and re-validating every hop is more error-prone than not
// following them at all. Callers who genuinely need redirects must handle them
// themselves by re-calling safeFetch with an explicit, still-validated URL.

const dns = require('dns');
const https = require('https');
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Cloud metadata endpoints are the single highest-value SSRF target, so they
// get explicit aliases alongside the generic link-local block.
const BLOCKED_HOSTNAMES = new Set([
    '169.254.169.254',
    'metadata.google.internal',
    'metadata.goog',
    'metadata',
    'instance-data',
]);

const ipv4ToInt = (ip) =>
    ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;

// [network, prefixLength] pairs evaluated as (ip & mask) === network.
const BLOCKED_V4 = [
    ['0.0.0.0', 8], // "this" network
    ['10.0.0.0', 8], // RFC1918 private
    ['100.64.0.0', 10], // CGNAT
    ['127.0.0.0', 8], // loopback
    ['169.254.0.0', 16], // link-local + cloud metadata
    ['172.16.0.0', 12], // RFC1918 private
    ['192.0.0.0', 24], // IETF protocol assignments
    ['192.0.2.0', 24], // TEST-NET-1
    ['192.88.99.0', 24], // 6to4 relay anycast
    ['192.168.0.0', 16], // RFC1918 private
    ['198.18.0.0', 15], // benchmarking
    ['198.51.100.0', 24], // TEST-NET-2
    ['203.0.113.0', 24], // TEST-NET-3
    ['224.0.0.0', 4], // multicast
    ['240.0.0.0', 4], // reserved + broadcast
].map(([net, bits]) => ({
    mask: bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0,
    net: ipv4ToInt(net),
}));

const isBlockedIPv4 = (ip) => {
    const value = ipv4ToInt(ip);
    // `value & mask` yields a signed int32 — without >>> 0 every range at or
    // above 128.0.0.0 (10/8, 127/8, 172.16/12, 192.168/16) compares against a
    // negative number and silently fails to match.
    return BLOCKED_V4.some(({ net, mask }) => ((value & mask) >>> 0) === net);
};

const expandIPv6 = (ip) => {
    // Normalise to eight 16-bit groups, expanding "::" and a trailing IPv4 tail.
    let address = ip.split('%')[0]; // strip zone id
    const v4Tail = address.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    let tailGroups = [];
    if (v4Tail) {
        const [a, b, c, d] = v4Tail[1].split('.').map(Number);
        tailGroups = [(a << 8) | b, (c << 8) | d];
        address = address.slice(0, address.length - v4Tail[1].length) + '0:0';
    }
    const [head, rest] = address.split('::');
    const headParts = head ? head.split(':').filter(Boolean) : [];
    const restParts = rest ? rest.split(':').filter(Boolean) : [];
    const fill = 8 - headParts.length - restParts.length;
    const groups = address.includes('::')
        ? [...headParts, ...new Array(Math.max(0, fill)).fill('0'), ...restParts]
        : headParts;
    const parsed = groups.slice(0, 8).map((g) => parseInt(g || '0', 16) || 0);
    // The v4 tail was written as two literal "0" placeholders above purely to keep
    // eight slots; overwrite them with the real embedded value.
    if (tailGroups.length) {
        parsed[6] = tailGroups[0];
        parsed[7] = tailGroups[1];
    }
    return parsed;
};

const ipv6ToBytes = (ip) => {
    const groups = expandIPv6(ip);
    const bytes = [];
    for (const group of groups) {
        bytes.push((group >> 8) & 0xff, group & 0xff);
    }
    return bytes;
};

// Compare prefixes at byte granularity. The partial trailing byte must mask the
// HIGH bits of that byte: a /7 consumes the top 7 bits of the first byte, so
// fc00::/7 covers fc.. through fd.. but must not match an unrelated address that
// merely has the same low bits.
const inIPv6Range = (ip, prefixHex, bits) => {
    const bytes = ipv6ToBytes(ip);
    const netBytes = ipv6ToBytes(prefixHex);
    const fullBytes = Math.floor(bits / 8);
    const remBits = bits % 8;
    for (let i = 0; i < fullBytes; i++) {
        if (bytes[i] !== netBytes[i]) return false;
    }
    if (remBits === 0) return true;
    const mask = (0xff << (8 - remBits)) & 0xff;
    return (bytes[fullBytes] & mask) === (netBytes[fullBytes] & mask);
};

const isBlockedIPv6 = (ip) => {
    const groups = expandIPv6(ip);
    const isZeroPrefix = groups.slice(0, 7).every((g) => g === 0);
    if (isZeroPrefix && (groups[7] === 0 || groups[7] === 1)) return true; // :: and ::1

    // IPv4-mapped (::ffff:a.b.c.d) and IPv4-translated (64:ff9b::/96) embed a
    // real IPv4 address in the low 32 bits. Check it against the v4 rules so a
    // mapped address cannot smuggle 127.0.0.1 or 169.254.169.254 past us.
    const isMapped =
        groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
    const isTranslated =
        groups[0] === 0x0064 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0);
    if (isMapped || isTranslated) {
        const embedded = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');
        return isBlockedIPv4(embedded);
    }

    return (
        inIPv6Range(ip, 'fc00::', 7) || // unique-local
        inIPv6Range(ip, 'fe80::', 10) || // link-local
        inIPv6Range(ip, 'ff00::', 8) || // multicast
        inIPv6Range(ip, '100::', 64) || // discard-only
        inIPv6Range(ip, '2001:db8::', 32) // documentation
    );
};

const isBlockedAddress = (address) => {
    if (!address) return true;
    // dns.lookup(..., { all: true }) yields { address, family } records. Extract
    // the fields before touching the value, or .toLowerCase() below would run on
    // the object and throw for every resolved hostname.
    const family = typeof address === 'object' ? address.family : null;
    const ip = typeof address === 'object' ? address.address : address;
    if (!ip) return true;
    if (BLOCKED_HOSTNAMES.has(String(ip).toLowerCase())) return true;
    // Node reports family 4 or 6; fall back to shape when it is absent.
    const v4 = family === 4 || (family == null && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip));
    return v4 ? isBlockedIPv4(ip) : isBlockedIPv6(ip);
};

/**
 * Throw unless the URL is safe to fetch: https, no credentials, no blocked host.
 * Kept separate so callers can validate before doing anything expensive.
 */
const assertSafeUrl = (rawUrl) => {
    let url;
    try {
        url = new URL(rawUrl);
    } catch (_) {
        throw Object.assign(new Error('Malformed URL'), { code: 'UNSAFE_URL' });
    }
    if (url.protocol !== 'https:') {
        throw Object.assign(new Error('Only https:// URLs are allowed'), { code: 'UNSAFE_URL' });
    }
    if (url.username || url.password) {
        throw Object.assign(new Error('URLs with embedded credentials are not allowed'), { code: 'UNSAFE_URL' });
    }
    const host = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(host) || host === 'localhost' || host.endsWith('.localhost')) {
        throw Object.assign(new Error('Blocked host'), { code: 'UNSAFE_URL' });
    }
    return url;
};

/**
 * Resolve a hostname and confirm every returned address is publicly routable.
 * Throws on the first blocked address — a hostname resolving to both a public
 * and a private address is exactly the rebinding pattern we refuse.
 */
const resolvePublicAddresses = async (hostname) => {
    const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    if (!records.length) {
        throw Object.assign(new Error('Host did not resolve'), { code: 'UNSAFE_HOST' });
    }
    for (const record of records) {
        if (isBlockedAddress(record)) {
            throw Object.assign(
                new Error(`Refusing to connect to non-public address (${record.address})`),
                { code: 'UNSAFE_HOST' }
            );
        }
    }
    return records;
};

/**
 * Fetch a URL with SSRF protections. Returns { status, headers, body }.
 * Never follows redirects — inspect status and re-call if you need to.
 *
 * `body` is a UTF-8 string by default, which is what every JSON and text caller
 * wants. Pass `responseType: 'buffer'` for binary payloads (images, files): the
 * body then comes back as a Buffer with the bytes untouched.
 *
 * That distinction matters. A caller needing bytes must not receive a string and
 * re-encode it — `Buffer.from(utf8String, 'binary')` mangles every byte above
 * 0x7F, which is most of a PNG. There is no lossless way to recover the original
 * bytes from the decoded string, so binary responses have to be collected as
 * Buffers in the first place.
 */
const safeFetch = async (rawUrl, options = {}) => {
    const {
        method = 'GET',
        headers = {},
        body,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        maxBytes = DEFAULT_MAX_BYTES,
        responseType = 'utf8',
    } = options;

    const url = assertSafeUrl(rawUrl);
    // Validate before opening a socket, then validate again inside lookup so the
    // address actually connected to is the one we checked.
    await resolvePublicAddresses(url.hostname);

    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                method,
                hostname: url.hostname,
                port: url.port || 443,
                path: `${url.pathname}${url.search}`,
                headers: { ...headers, host: url.host },
                lookup: (hostname, opts, callback) => {
                    dns.promises
                        .lookup(hostname, { all: true, verbatim: true })
                        .then((records) => {
                            for (const record of records) {
                                if (isBlockedAddress(record)) {
                                    throw Object.assign(
                                        new Error(`Refusing to connect to non-public address (${record.address})`),
                                        { code: 'UNSAFE_HOST' }
                                    );
                                }
                            }
                            if (!records.length) throw new Error('Host did not resolve');
                            // all=false callers expect a single {address, family}.
                            if (opts && opts.all) return callback(null, records);
                            return callback(null, records[0].address, records[0].family);
                        })
                        .catch((err) => callback(err));
                },
                timeout: timeoutMs,
            },
            (res) => {
                // Do not follow. Surface the location so the caller can decide.
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    return resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: '',
                        redirected: true,
                        location: res.headers.location,
                    });
                }

                const declared = parseInt(res.headers['content-length'] || '0', 10);
                if (declared && declared > maxBytes) {
                    res.destroy();
                    return reject(
                        Object.assign(new Error('Response too large'), { code: 'RESPONSE_TOO_LARGE' })
                    );
                }

                const chunks = [];
                let size = 0;
                res.on('data', (chunk) => {
                    size += chunk.length;
                    if (size > maxBytes) {
                        res.destroy();
                        return reject(
                            Object.assign(new Error('Response too large'), { code: 'RESPONSE_TOO_LARGE' })
                        );
                    }
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    const raw = Buffer.concat(chunks);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: responseType === 'buffer' ? raw : raw.toString('utf8'),
                    });
                });
                res.on('error', reject);
            }
        );

        req.on('timeout', () => {
            req.destroy();
            reject(Object.assign(new Error('Upstream request timed out'), { code: 'ETIMEDOUT' }));
        });
        req.on('error', reject);

        if (body !== undefined && body !== null) req.write(body);
        req.end();
    });
};

/** safeFetch + JSON.parse, with a size cap appropriate for metadata documents. */
const safeFetchJson = async (rawUrl, options = {}) => {
    const res = await safeFetch(rawUrl, {
        ...options,
        headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    if (res.redirected) {
        throw Object.assign(new Error('Refusing to follow redirect'), { code: 'UNSAFE_URL' });
    }
    if (res.status < 200 || res.status >= 300) {
        throw Object.assign(new Error(`Upstream responded ${res.status}`), { code: 'UPSTREAM_STATUS' });
    }
    try {
        return JSON.parse(res.body);
    } catch (_) {
        throw Object.assign(new Error('Upstream returned invalid JSON'), { code: 'UPSTREAM_INVALID' });
    }
};

module.exports = {
    safeFetch,
    safeFetchJson,
    assertSafeUrl,
    resolvePublicAddresses,
    isBlockedAddress,
    isBlockedIPv4,
    isBlockedIPv6,
    BLOCKED_HOSTNAMES,
};