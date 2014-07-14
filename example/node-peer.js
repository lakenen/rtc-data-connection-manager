var DataConnectionManager = require('..');
var dm = new DataConnectionManager();

function handleServerPeer(socket, id, offer) {
    var relay = new DataConnectionManager.relays.WebSocketRelay(socket, id);
    dm.createPeer(relay, id, offer);
}

function init(location) {
    dm.location = location;

    var socket = require('socket.io-client').connect('http://localhost:9990/');

    socket.on('connect', function () {
        console.log('connected');
    })
    socket.on('id', function (id) {
        dm.id = id;
        console.log('myid', id);
    });
    socket.on('peer', function (id) {
        console.log('got peer', id);
        handleServerPeer(socket, id);
    });
    socket.on('__relay__:offer', function (offer, id) {
        handleServerPeer(socket, id, offer);
    });

    dm.on('peerupdate', function (peers) {

    });

    dm.on('connect', function (peer) {
        console.log('connected', peer.id);
    });

    dm.on('disconnect', function (id) {
        console.log('disconnected', id);
        console.log(dm.peers);
    });

    dm.on('message', function (data) {
        console.log('message', data);
    });
}
init({ foo: 'node' });
