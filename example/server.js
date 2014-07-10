var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server);

app.use(express.static(__dirname));

server.listen(9990);

io.sockets.on('connection', function (socket) {
    socket.emit('id', socket.id);
    if (io.sockets.clients().length > 1) {
        sendPeer(socket);
    }
    socket.on('msg', function (to, name, data) {
        var client = io.sockets.sockets[to];
        if (client) {
            client.emit(name, data, socket.id);
        }
    });
    socket.on('need-peer', function () {
        sendPeer(socket);
    });
});

function sendPeer(socket) {
    socket.emit('peer', getRandomClientId(socket));
}

function getRandomClientId(me) {
    var clients = io.sockets.clients().filter(function (s) {
        return s !== me;
    });
    return clients[Math.floor(Math.random() * clients.length)].id;
}
