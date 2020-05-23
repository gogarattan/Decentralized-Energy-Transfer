const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("HTTP://127.0.0.1:7545"));
const Exchange = require ('../build/Exchange.json');

const instance = new web3.eth.Contract(
    JSON.parse(Exchange.interface),
    '0x179B4eEd36ECe6bd659Ec7aeE6fdB8525098342d'
);

// new web3.eth.Contract(interface, address)
module.exports = instance;