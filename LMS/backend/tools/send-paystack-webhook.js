/*
  send-paystack-webhook.js
  Simple script to POST a simulated Paystack webhook event to local webhook endpoint.
  Usage: node tools/send-paystack-webhook.js <reference> <email> [amount]

  It signs the raw JSON with HMAC-SHA512 using PAYSTACK_SECRET_KEY from env.
*/

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const url = require('url');

if (!process.env.PAYSTACK_SECRET_KEY) {
  console.error('Please set PAYSTACK_SECRET_KEY in environment before running this script.');
  process.exit(1);
}

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node tools/send-paystack-webhook.js <reference> <email> [amount]');
  process.exit(1);
}

const reference = args[0];
const email = args[1];
const amount = args[2] ? Number(args[2]) : 1000; // default NGN 1000

const payload = {
  event: 'charge.success',
  data: {
    reference,
    amount: amount * 100, // simulate kobo for NGN
    currency: 'NGN',
    status: 'success',
    metadata: {
      userId: null,
      type: 'class_enrollment',
      classroomId: null
    },
    customer: {
      email
    }
  }
};

const raw = JSON.stringify(payload);
const signature = crypto.createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');

const localWebhook = process.env.LOCAL_PAYSTACK_WEBHOOK || 'http://localhost:5000/api/payments/paystack/webhook';
const parsed = url.parse(localWebhook);

const options = {
  hostname: parsed.hostname,
  port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
  path: parsed.path,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(raw),
    'x-paystack-signature': signature
  }
};

const client = parsed.protocol === 'https:' ? https : http;

const req = client.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Webhook POST response status:', res.statusCode);
    console.log('Response body:', body);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(raw);
req.end();
