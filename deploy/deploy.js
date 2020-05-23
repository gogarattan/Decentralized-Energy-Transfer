const Web3 = require('web3');
const ganache = require('ganache-cli');
const webThree = new Web3(new Web3.providers.HttpProvider("HTTP://127.0.0.1:7545"));
const compiledContract = require('../build/Exchange.json');


const deploy_Exchange = async () => {
    const account = await webThree.eth.getAccounts();

    console.log('Attempting to deploy from account', account[0]);

    const res = await new webThree.eth.Contract(JSON.parse(compiledContract.interface))
        .deploy({ data: '0x' + compiledContract.bytecode })
        .send({ gas: '1999999',from: account[0]});
    
    console.log('Contract Exchange deployed to', res.options.address);
};

deploy_Exchange();