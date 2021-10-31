const express = require('express');
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain.js');
const { v4: uuid } = require('uuid');

const nodeAddress = uuid().split('-').join('');

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}))

const coin = new Blockchain();

app.get('/blockchain', function (req, res) {
    res.send(coin);
})

app.post('/transaction', function (req, res) {

    res.send(JSON.stringify(coin.createNewTransaction(req.body.amount, req.body.sender, req.body.receiver)))
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
    coin.createNewTransaction(12.5, "00",nodeAddress)
    const newBlock = coin.createNewBlock(nonce, previousBlockHash, blockHash)
    res.json({
        note: 'New Block Mined Successfully',
        block: newBlock
    });
});

app.get('/', function (req, res) {
    res.send('welcome!!');
});

app.listen(3000);
