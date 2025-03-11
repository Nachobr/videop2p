const https = require('https');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('./ssl/localhost.key'),
  cert: fs.readFileSync('./ssl/localhost.cert')
};

app.prepare().then(() => {
  https.createServer(httpsOptions, (req, res) => {
    handle(req, res);
  }).listen(3000, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log('> Ready on https://192.168.100.58:3000');
  });
});