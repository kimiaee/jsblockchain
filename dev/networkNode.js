const express = require('express');
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain.js');
const {v4: uuid} = require('uuid');
const rp = require('request-promise');

const port = process.argv[2];
const nodeAddress = uuid().split('-').join('');

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}))

const coin = new Blockchain();

app.get('/blockchain', function (req, res) {
    res.send(coin);
});

app.post('/transaction', function (req, res) {
    const newTransaction = req.body;
    const blockIndex = coin.addTransactionToPendingTransactions(newTransaction);
    res.json({note: `Transaction will be added to block ${blockIndex}.`})

});

app.post('/transaction/broadcast', function (req, res) {
    const newTransaction = coin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    coin.addTransactionToPendingTransactions(newTransaction);

    const requestPromises = [];
    coin.networkNodes.forEach((networkNodeUrl) => {
        const requestOptions = {
            uri: networkNodeUrl + '/transaction',
            method: 'POST',
            body: newTransaction,
            json: true
        };
        requestPromises.push(rp(requestOptions));
    });
    Promise.all(requestPromises).then(() => {
        res.json({note: 'Transaction created and broadcast successful.'});
    });
});


app.post('/register-and-broadcast-node', function (req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    if (coin.networkNodes.indexOf(newNodeUrl) == -1 && newNodeUrl != coin.currentNodeUrl) {
        coin.networkNodes.push(newNodeUrl);
    } else return res.json({note: 'this is the current node!'});
    const registerNodesPromises = [];

    coin.networkNodes.forEach((networkNodeUrl) => {
        const requestOptions = {
            uri: networkNodeUrl + '/register-node',
            method: 'POST',
            body: {newNodeUrl},
            json: true
        };

        registerNodesPromises.push(rp(requestOptions));
    });

    Promise.all(registerNodesPromises).then((data) => {
        const bulkRegisterOptions = {
            uri: newNodeUrl + '/register-nodes-bulk',
            method: 'post',
            body: {allNetworkNodes: [...coin.networkNodes, coin.currentNodeUrl]},
            json: true
        };
        return rp(bulkRegisterOptions)
    }).then((data) => {
        res.json('New node registered with network successfully.')
    });


});

app.post('/register-node', function (req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    if (coin.networkNodes.indexOf(newNodeUrl) == -1 && coin.currentNodeUrl !== newNodeUrl) {
        coin.networkNodes.push(newNodeUrl);
        res.json({note: 'New node registered successfully with node.'});
    } else {
        res.json({note: 'Node already exists!'})
    }
});

app.post('/register-nodes-bulk', function (req, res) {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach((networkNodeUrl) => {
        if (coin.networkNodes.indexOf(networkNodeUrl) == -1 && coin.currentNodeUrl !== networkNodeUrl) {
            coin.networkNodes.push(networkNodeUrl)
        }
    })
    res.json({note: 'Bulk registration successful.'})
});

app.get('/mine', function (req, res) {
    const lastBlock = coin.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    const currenBlockData = {
        transactions: coin.pendingTransactions,
        index: lastBlock['index'] + 1
    };

    const nonce = coin.proofOfWork(previousBlockHash, currenBlockData);
    const blockHash = coin.hashBlock(previousBlockHash, currenBlockData, nonce)
    coin.createNewTransaction(12.5, "00", nodeAddress)
    const newBlock = coin.createNewBlock(nonce, previousBlockHash, blockHash)
    res.json({
        note: 'New Block Mined Successfully',
        block: newBlock
    });
});

app.get('/', function (req, res) {
    res.send('welcome!!');
});

app.listen(port, function () {
    console.log(`Listening on port ${port}`)
});
