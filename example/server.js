var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server);

app.use(express.static(__dirname));

server.listen(9990);

io.sockets.on('connection', function (socket) {
    if (io.sockets.clients().length > 1) {
        socket.emit('peer', getRandomClientId(socket));
    }
    socket.on('msg', function (to, name, data) {
        var client = io.sockets.sockets[to];
        if (client) {
            client.emit(name, data, socket.id);
        }
    });
});

function getRandomClientId(me) {
    var clients = io.sockets.clients().filter(function (s) {
        return s !== me;
    });
    return clients[Math.floor(Math.random() * clients.length)].id;
}
