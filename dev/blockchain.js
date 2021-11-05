const sha256 = new require('sha256')
const currentNodeUrl = process.argv[3]
const {v4: uuid} = require('uuid');


class Blockchain {

    constructor() {
        this.chain = [];
        this.pendingTransactions = []
        this.currentNodeUrl = currentNodeUrl;

        this.networkNodes = [];
        this.createNewBlock(100, '0', '0');
    }

    createNewBlock(nonce, previousBlockHash, hash) {

        const newBlock = {
            index: this.chain.length + 1,
            timestamp: Date.now(),
            transactions: this.pendingTransactions,
            nonce,
            hash,
            previousBlockHash
        }
        this.pendingTransactions = [];
        this.chain.push(newBlock);
        return newBlock;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    createNewTransaction(amount, sender, recipient) {
        return {
            amount, sender, recipient, transactionId: uuid().split('-').join('')
        };
    }

    addTransactionToPendingTransactions(transactionObj) {
        this.pendingTransactions.push(transactionObj);
        return this.getLastBlock()['index'] + 1;

    }

    hashBlock(previousBlockHash, currentBlockData, nonce) {
        const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
        return sha256(dataAsString);

    }

    proofOfWork(previousBlockHash, currentBlockData) {
        let nonce = 0;
        let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        while (hash.substring(0, 4) != '0000') {
            nonce++;
            hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        }
        return nonce;
    }

    chainIsValid(blockchain) {
        let validChain = true;
        for (let i = 1; i < blockchain.length; i++) {
            const currentBlock = blockchain[i];
            const previousBlock = blockchain[i - 1];
            const blockHash = this.hashBlock(previousBlock['hash'], {
                transactions: currentBlock['transactions'],
                index: currentBlock['index'],
            }, currentBlock['nonce']);

            if (currentBlock.previousBlockHash !== previousBlock.hash || blockHash.substring(0, 4) !== '0000')
                validChain = false;
        }

        const genesisBlock = blockchain[0];
        const correctNonce = genesisBlock['nonce'] === 100;
        const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === '0';
        const correctHash = genesisBlock['hash'] === '0';
        const correctTransactions = genesisBlock['transactions'].length === 0;

        if (!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) validChain = false;

        return validChain;
    }

    getBlock(blockHash) {
        let correctBlock = null;
        this.chain.forEach((block) => {
            console.log(block.hash)
            console.log(blockHash)
            if (block.hash === blockHash) {
                correctBlock = block
            }
            ;
        })
        return correctBlock;
    }

    getTransaction(transactionId) {
        let correctTransaction = null;
        let correctBlock = null;
        this.chain.forEach((block) => {
            block.transactions.forEach((transaction) => {
                if (transaction.transactionId === transactionId) {
                    correctTransaction = transaction;
                    correctBlock = block;
                }
            })
        })
        return {
            transaction: correctTransaction, block: correctBlock
        };
    }

    getAddressData(address) {
        const addressTransactions = [];
        this.chain.forEach((block) => {
            block.transactions.forEach((transaction) => {
                if (transaction.sender === address || transaction.recipient === address) {
                    addressTransactions.push(transaction);
                }
            })
        })

        let balance = 0;
        addressTransactions.forEach((transaction) => {
            if (transaction.recipient === address) balance += transaction.amount;
            else if (transaction.sender === address) balance -= transaction.amount;
        })
        return {
            addressTransactions, addressBalance:balance
        };
    }
}

module.exports = Blockchain;