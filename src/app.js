const http = require('http');
const socketio = require('socket.io');
// MVC server to host all these files
const express = require('express');
const path = require('path');
const ink = require('./ink.js');

const port = process.env.PORT || process.env.NODE_PORT || 3127;

const app = express();

app.use('/assets', express.static(path.resolve(`${__dirname}/../hosted/`)));

app.get('/', (req, res) => {
  res.sendFile(path.resolve(`${__dirname}/../hosted/index.html`));
});

// start http server and get HTTP server instance
const server = http.createServer(app);

// pass in the http server into socketio and grab the webscoket server as io
const io = socketio(server);

// give socket io to other files
ink.connectSocketServer(io);

server.listen(port, (err) => {
  if (err) {
    throw err;
  }
  console.log(`Listening on port ${port}`);
});
