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

app.post('/receive-new-block', (req, res) => {
    const newBlock = req.body.newBlock;
    const lastBlock = coin.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock.index + 1 === newBlock.index;
    if (correctHash && correctIndex) {
        coin.chain.push(newBlock);
        coin.pendingTransactions = [];
        res.json({note: "New block received and accepted!", newBlock})
    } else {
        res.json({note: "New block rejected!", newBlock})
    }
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

app.get('/consensus', function (req, res) {
    const requestPromises = [];
    coin.networkNodes.forEach((networkNodeUrl) => {
        const requestOptions = {
            uri: networkNodeUrl + '/blockchain',
            method: 'GET',
            json: true
        };
        requestPromises.push(rp(requestOptions));
    });
    Promise.all(requestPromises).then((blockchains) => {
        const currentChainLength = coin.chain.length;
        let maxChainLength = currentChainLength;
        let newLongestChain = null;
        let newPendingTransaction = null;

        blockchains.forEach((blockchain) => {
            if (blockchain.chain.length > maxChainLength) {
                maxChainLength = blockchain.chain.length;
                newLongestChain = blockchain.chain;
                newPendingTransaction = blockchain.pendingTransactions;
            }
        })
        if (!newLongestChain || (newLongestChain && !coin.chainIsValid(newLongestChain))) {
            return res.json({note: 'Current chain has not been replaced!', chain: coin.chain});
        } else { //else if (newLongestChain && coin.chainIsValid(newLongestChain))

            coin.chain = newLongestChain;
            coin.pendingTransactions = newPendingTransaction;
            res.json({
                note: "This chain has been replaced!",
                chain: coin.chain
            })

        }
    });
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

    const newBlock = coin.createNewBlock(nonce, previousBlockHash, blockHash)
    const requestPromises = [];
    coin.networkNodes.forEach((networkNodeUrl) => {
        const requestOption = {
            uri: networkNodeUrl + '/receive-new-block',
            method: 'POST',
            body: {newBlock},
            json: true
        };
        requestPromises.push(rp(requestOption));
    });
    Promise.all(requestPromises).then(() => {
        const requestOption = {
            uri: coin.currentNodeUrl + '/transaction/broadcast',
            method: "POST",
            body: {
                amount: 12.5,
                sender: "00",
                recipient: nodeAddress
            },
            json: true
        };
        return rp(requestOption);
    }).then(() => {
        res.json({
            note: 'New block mined and broadcast successfully',
            block: newBlock
        });
    });
});

app.get('/', function (req, res) {
    res.send('welcome!!');
});


app.get('/block/:blockHash', function (req, res) {
    // return res.json({hash: req.params.blockHash});

    res.json({
        block: coin.getBlock(req.params.blockHash)
    });
});

app.get('/transaction/:transactionId', function (req, res) {
    const transactionId = req.params.transactionId;
    const transaction = coin.getTransaction(transactionId);
    res.json({
        transaction: transaction.transaction,
        block: transaction.block,
    })
});

app.get('/address/:address', function (req, res) {
    const address = req.params.address;
    const transactions = coin.getAddressData(address);
    res.json({
        addressData:transactions
    })
});

app.get('/block-explorer', function (req, res) {
    res.sendFile('./block-explorer/index.html', {root: __dirname});
});

app.listen(port, function () {
    console.log(`Listening on port ${port}`)
});
