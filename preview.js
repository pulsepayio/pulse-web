const http = require('http');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'src/views/checkout.html'), 'utf-8');

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}).listen(1000, () => console.log('Preview at http://localhost:1000'));
