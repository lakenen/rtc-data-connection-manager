var SimpleDataConnection = require('simple-rtc-data-connection'),
    EventEmitter = require('eemitter'),
    _ = require('lodash');

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

function Peer(dataConnection, id) {
    var peer = this;
    this.id = id;
    this.peers = [];
    this.location = null;
    this.dataConnection = dataConnection;
}
Peer.prototype = Object.create(EventEmitter.prototype);
Peer.prototype.contructor = Peer;
Peer.prototype.getRelay = function (toId) {
    return new DataConnectionRelay(this.dataConnection, toId);
};
Peer.prototype.isConnected = function () {
    return this.dataConnection.connected;
};
Peer.prototype.send = function () {
    this.dataConnection.send.apply(this.dataConnection, arguments);
};
Peer.prototype.serialize = function () {
    return {
        id: this.id,
        location: this.location,
        peers: this.peers
    };
};

function DataConnectionManager() {
    this.peers = {};
}

DataConnectionManager.prototype.broadcast = function () {
    var args = arguments;
    _.each(this.peers, function (peer) {
        peer.send.apply(peer, args);
    });
};

DataConnectionManager.prototype.getPeer = function (id) {
    return this.peers[id];
};

DataConnectionManager.prototype.getPeers = function () {
    return _.values(this.peers);
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
    peer = new Peer(sdc, id);
    peers[id] = peer;

    sdc.on('open', function () {
        log('-----------------CONNECTED TO', id);
        peer.send('message', 'HAI');
        peer.send('location', dm.location);
        dm.broadcast('peers', dm.getPeerInfo());
    });
    sdc.on('close', function () {
        log('disconnected from', id);
        delete peers[id];
    });
    sdc.on('message', function (data) {
        log('--------------------------------');
        log('message from', id, data);
        log('--------------------------------');
    });

    sdc.on('peers', function (peerList) {
        log('got updated peers from', id, peerList);
        var peerInfo = dm.getPeerInfo();
        if (_.difference(peerInfo.peers, peerList).length) {
            peer.peers = peerList;
            dm.broadcast('peers', dm.getPeerInfo());
        }
    });
    sdc.on('location', function (location) {
        log('got location from', id, location);
        peer.location = location;
        dm.broadcast('peers', dm.getPeerInfo());
    });



    sdc.on('__relay__:offer', function (offer, peerId) {
        log('got offer for', peerId, 'from', id);
        if (peers[peerId]) {
            log('forwarding offer to', peerId);
            peers[peerId].send('__relay__:offer', offer, id);
        } else {
            log('I don\'t know', peerId, ' FAIL');
        }
    });
    sdc.on('__relay__:answer', function (answer, peerId) {
        log('got answer for', peerId, 'from', id);
        if (peers[peerId]) {
            log('forwarding answer to', peerId);
            peers[peerId].send('__relay__:answer', answer, id);
        } else {
            log('I don\'t know', peerId, ' FAIL');
        }
    });
    sdc.on('__relay__:candidate', function (candidate, peerId) {
        log('got candidate for', peerId, 'from', id);
        if (peers[peerId]) {
            log('forwarding candidate to', peerId);
            peers[peerId].send('__relay__:candidate', candidate, id);
        } else {
            log('I don\'t know', peerId, ' FAIL');
        }
    });
};

module.exports = DataConnectionManager;
module.exports.relay = DataConnectionRelay;
