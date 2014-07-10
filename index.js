var SimpleDataConnection = require('simple-rtc-data-connection'),
    EventEmitter = require('eemitter'),
    _ = require('lodash'),
    equal = require('deep-equal');

function DataConnectionRelay(dc, toId) {
    this.on = function (name, handler) {
        dc.on.call(dc, '__relay__:' + name, handler);
    };
    this.emit = function (name, data) {
        dc.send('__relay__:' + name, data, toId);
    };
}

function log() {
    console.log.apply(console, arguments);
}

function Peer(dataConnectionManager, dataConnection, id) {
    var peer = this;
    this.id = id;
    this.peers = [];
    this.location = null;
    this.dataConnectionManager = dataConnectionManager;
    this.dataConnection = dataConnection;
    this.connected = false;
}
Peer.prototype = Object.create(EventEmitter.prototype);
Peer.prototype.contructor = Peer;
Peer.prototype.getRelay = function (toId) {
    return new DataConnectionRelay(this.dataConnection, toId);
};
Peer.prototype.isConnected = function () {
    return this.dataConnection.connected;
};
Peer.prototype.disconnect = function () {
    return this.dataConnection.close();
};
Peer.prototype.send = function () {
    this.dataConnection.send.apply(this.dataConnection, arguments);
};
Peer.prototype.serialize = function () {
    return {
        id: this.id,
        location: this.location,
        initiated: this.initiated,
        peers: this.peers.map(function (peer) {
            return  {
                id: peer.id,
                location: peer.location,
                peers: peer.peers.map(function (peer) {
                    return peer.id;
                })
            };
        })
    };
};
Peer.prototype.createBridge = function (id) {
    var relay;
    if (_.contains(_.pluck(this.peers, 'id'), id)) {
        if (this.dataConnectionManager.getPeer(id)) {
            console.log('already have a connection to', id);
            return;
        }
        relay = new DataConnectionRelay(this.dataConnection, id);
        this.dataConnectionManager.createPeer(relay, id);
    } else {
        console.error('no peer with id', id);
    }
};

function DataConnectionManager() {
    this.peers = {};
    this.location = {};
}

DataConnectionManager.prototype = Object.create(EventEmitter.prototype);
DataConnectionManager.prototype.contructor = DataConnectionManager;
DataConnectionManager.prototype.broadcast = function () {
    var args = arguments;
    _.each(this.peers, function (peer) {
        peer.send.apply(peer, args);
    });
};
DataConnectionManager.prototype.send = function () {
    var peerId = arguments[0],
        peer = this.peers[peerId],
        args = arguments.slice(1);
    if (peer) {
        peer.send.apply(peer, args);
    }
};

DataConnectionManager.prototype.getPeer = function (id) {
    return this.peers[id];
};

DataConnectionManager.prototype.getPeers = function () {
    return _.values(this.peers).filter(function (peer) {
        return peer.connected;
    });
};

DataConnectionManager.prototype.getPeerInfo = function () {
    return _.map(this.peers, function (peer) {
        return peer.serialize();
    });
};

DataConnectionManager.prototype.createPeer = function (relay, id, offer) {
    var dm = this,
        peer,
        peers = this.peers;
    if (!id) {
        log('bad id', id);
        return;
    }
    if (id in peers) {
        log('already have id', id);
        return;
    }

    log('making connection to peer', id, 'with offer =', !!offer);
    var sdc = new SimpleDataConnection(relay, offer);
    peer = new Peer(this, sdc, id);
    peer.initiated = !offer;
    peers[id] = peer;

    function updatePeers() {
        var peerInfo = dm.getPeerInfo();
        dm.emit('peerupdate', peerInfo);
        dm.broadcast('peers', peerInfo);
    }

    sdc.on('open', function () {
        log('CONNECTED TO', id);
        peer.connected = true;
        // peer.send('message', 'HAI');
        peer.send('location', dm.location);
        dm.emit('connect', peer);
        updatePeers();
    });
    sdc.on('close', function () {
        log('disconnected from', id);
        dm.emit('disconnect', id);
        peer.connected = false;
        peer = sdc = null;
        delete peers[id];
    });
    sdc.on('message', function (data) {
        log('--------------------------------');
        log('message from', id, data);
        log('--------------------------------');
        dm.emit('message', data);
    });

    sdc.on('peers', function (peerList) {
        if (!equal(peer.peers, peerList)) {
            // console.log('new peer info found');
            peer.peers = peerList;
            updatePeers();
        }
    });

    sdc.on('location', function (location) {
        // log('got location from', id, location);
        peer.location = location;
        updatePeers();
    });

    sdc.on('offer', function (offer, peerId) {
        var relay;
        log('got offer for', peerId, 'through', id);
        relay = new DataConnectionRelay(sdc, peerId);
        dm.createPeer(relay, peerId, offer);
    });


    // Relay stuff --------

    sdc.on('__relay__:offer', function (offer, peerId) {
        // log('got offer for', peerId, 'from', id);
        if (peers[peerId]) {
            // log('forwarding offer to', peerId);
            peers[peerId].send('offer', offer, id);
        } else {
            log('I don\'t know', peerId, ' FAIL');
        }
    });
    sdc.on('__relay__:answer', function (answer, peerId) {
        // log('got answer for', peerId, 'from', id);
        if (peers[peerId]) {
            // log('forwarding answer to', peerId);
            peers[peerId].send('__relay__:answer', answer, id);
        } else {
            log('I don\'t know', peerId, ' FAIL');
        }
    });
    sdc.on('__relay__:candidate', function (candidate, peerId) {
        // log('got candidate for', peerId, 'from', id);
        if (peers[peerId]) {
            // log('forwarding candidate to', peerId);
            peers[peerId].send('__relay__:candidate', candidate, id);
        } else {
            log('I don\'t know', peerId, ' FAIL');
        }
    });
};

module.exports = DataConnectionManager;
module.exports.relay = DataConnectionRelay;
