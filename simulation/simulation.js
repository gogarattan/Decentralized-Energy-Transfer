const Web3 = require('web3');
const ganache = require('ganache-cli');
const web3 = new Web3( new Web3.providers.HttpProvider("HTTP://127.0.0.1:7545") );
const {Agent,AgentNationalGrid} = require('./prosumer.js');

//compiled contracts
const exchange = require('../deploy/exchange');

// functions imports
const readCSV = require('../utils/readFile');
const {convertArrayGasToDollars, convertArrayWeiToDollars, convertWeiToDollars, convertGasToDollars} = require('../utils/conversion.js');
let fs = require('fs');
var csv = require("fast-csv");
let parse = require('csv-parse');
let async = require('async');
let calculateIntersection = require('../utils/inter.js');
let id = new Array();

let agentsNoBattery = new Array();
let agentsBattery = new Array();
let numberOfBids = new Array();

const outputFile = 'output.csv';
const GASPRICE = 20000000000; // 20 GWEI 
const PRICE_OF_ETHER = 250; 
const WEI_IN_ETHER = 1000000000000000000;
const NATIONAL_GRID_PRICE = 0.1; // dollars per kWh

async function init() {
    let unFilledBids = new Array(); // Bid = purchasing
    let unFilledAsks = new Array(); // Ask = selling
    let aggregatedDemand = new Array();
    let aggregatedSupply = new Array();
    let historicalPricesPlot = new Array();

    var accounts = await web3.eth.getAccounts();

    let { householdHistoricData } = await getFiles(); // imp 

    let { agents, agentNationalGrid } = await createAgents(householdHistoricData, 12000, false); //battery unit ??
    
    let agentsBattery = agents; 
    let nationalGridAddress = await agentNationalGrid.getAccount(accounts.length-1); 

    let timeArray= new Array();
    console.log(`using ${agentsBattery.length} amount of agents`);
    console.log('starting simulation');

    for (let i = 10 ; i < 15 ; i++) {
        timeArray.push(i);
        console.log('time', i);
        
        for (let j = 0; j < agentsBattery.length; j++){

            agentsBattery[j].agent.setCurrentTime(i);
           
            if( i == 0) {
                await agentsBattery[j].agent.setNationalGrid(NATIONAL_GRID_PRICE, nationalGridAddress);
            }
           
            try{
                await agentsBattery[j].agent.purchaseLogic();
            } catch(err){
                console.log('error from purchase logic', err);
            }
        }
        
        let { bids, asks } = await getExchangeBids();        
        // amountBidsPerT.push(bids.length);
        // amountAsksPerT.push(asks.length);

        if (bids.length >= 2  && asks.length  >= 2 ){

            let intersection = calculateIntersection(bids, asks); // calculate the price in wei
            let priceDollars = convertWeiToDollars(intersection[1], WEI_IN_ETHER, PRICE_OF_ETHER);
            console.log('price in Dollars', priceDollars);
            let paidBids = new Array();

            bids = bids.sort(sortByAmount); // descending order
            asks = asks.sort(sortByAmount); // descending order
            numberOfBids.push(bids.length);
            
            for (let j = 0; j < agentsBattery.length; j++) {
                agentsBattery[j].agent.historicalPrices[i] = intersection[1]; // this price will be used next day
                
            }

            let { bids: unfilledBids, asks: unfilledAsks, agentsBattery: agentsBattery2 } = await matchBids(bids.length - 1, asks.length - 1, bids, asks, agentsBattery, intersection);
            bids = unfilledBids;
            asks = unfilledAsks;
            agentsBattery = agentsBattery2;
           
            if(bids.length > 0) {
                for (let i = 0; i < bids.length; i++){
                    let obj = agentsBattery.find(function (obj) { return obj.agentAccount === bids[i].address; });
                    obj.agent.unfilledOrdersProcess(); // purchase energy from national grid
                    unFilledBids.push(bids[i]);
                }
            }
            if(asks.length > 0) {
                for (let i = 0; i < asks.length; i++){

                        let obj = agentsBattery.find(function (obj) { return obj.agentAccount === asks[i].address; });
                        obj.agent.charge(asks[i].amount);           
                        unFilledAsks.push(asks[i]);
                }
            }
            try{
                await clearMarket();
            }catch(err){
                console.log('error while trying to clear market', err);
            }
        }
        else if (bids.length < 2  || asks.length  < 2) {
            numberOfBids.push(bids.length);

           
            for (let i=0; i < bids.length; i++){
                unFilledBids.push(bids[i]);
                let obj = agentsBattery.find(function (obj) { return obj.agentAccount === bids[i].address; });
                obj.agent.unfilledOrdersProcess();
                
            }

            for (let i=0; i < asks.length; i++) {
                    unFilledAsks.push(asks[i]);
                    let obj = agentsBattery.find(function (obj) { return obj.agentAccount === asks[i].address; });
                    obj.agent.charge(asks[i].amount);
                
            }

            for (let j = 0; j < agentsBattery.length; j++) {
                agentsBattery[j].agent.historicalPrices[i] = 0; 
            }

            try{
                await clearMarket();
            }catch(err){
                console.log('error while trying to clear market', err);
            }
        }        
    }

    let agentBalanceAverage = new Array();

    
    let history = agentsBattery[0].agent.historicalPrices;
    
    let transactionCostBid = new Array();
    let transactionCostAsk = new Array();
    
    let totalNumberTransactions = new Array();
    
    //averages parameters (for each agent)
    
    let csvData = new Array();
    
    //Calculating Parameters from simulation to plot
    
    for (let i = 0 ; i < 6 ; i++) {
        let demand = new Array();
        let supply = new Array();
        let gasCostBids = new Array();
        let gasCostAsks = new Array();
        let nationalGridBidsGas = new Array();
        let successfulBidsGas = new Array();
      
        historicalPricesPlot[i] = convertWeiToDollars(agentsBattery[0].agent.historicalPrices[i], WEI_IN_ETHER, PRICE_OF_ETHER);


        for (let j = 0; j < agentsBattery.length; j++) {

            demand.push(agentsBattery[j].agent.historicalDemand[i].demand);
            if(j>=8)
                supply.push(agentsBattery[j].agent.historicalSupply[i].supply);


            
            for(let k = 0; k < agentsBattery[j].agent.bidHistory.length; k++ ) {

                if( agentsBattery[j].agent.bidHistory[k].timeRow == i){
                    gasCostBids.push(agentsBattery[j].agent.bidHistory[k].transactionCost);
                }
            }
            
          
            for(let z=0; z < agentsBattery[j].agent.askHistory.length; z++) {

                if( agentsBattery[j].agent.askHistory[z].timeRow == i){
                    gasCostAsks.push(agentsBattery[j].agent.askHistory[z].transactionCost);
                }
            }

            
            for(let k = 0; k < agentsBattery[j].agent.successfulBidHistory.length; k++) {
                if ( agentsBattery[j].agent.successfulBidHistory[k].timeRow == i) {
                    successfulBidsGas.push(agentsBattery[j].agent.successfulBidHistory[k].transactionCost);
                }
            }

            
             for(let k=0; k < agentsBattery[j].agent.nationalGridPurchases.length; k++) {
                 if ( agentsBattery[j].agent.nationalGridPurchases[k].timeRow == i) {
                     nationalGridBidsGas.push(agentsBattery[j].agent.nationalGridPurchases[k].transactionCost);
        
             }
         }
    }

    
        if(gasCostBids.length > 0) {
            let bidCostDollars = convertArrayGasToDollars(gasCostBids, GASPRICE, WEI_IN_ETHER, PRICE_OF_ETHER);
            transactionCostBid[i] = bidCostDollars;
        }
        else if(gasCostBids.length == 0) {
            transactionCostBid[i] = 0;
        }

        if(gasCostAsks.length > 0) {
            let askCostDollars = await convertArrayGasToDollars(gasCostAsks, GASPRICE, WEI_IN_ETHER, PRICE_OF_ETHER);
            transactionCostAsk[i] = askCostDollars;
        }
        else if(gasCostAsks.length == 0) {
            transactionCostAsk[i] = 0;
        }
        
       
        let sumTransactions = nationalGridBidsGas.length + gasCostAsks.length + gasCostBids.length + successfulBidsGas.length;
        totalNumberTransactions.push(sumTransactions);
        let numberMarketTransactions = gasCostAsks.length + gasCostBids.length + successfulBidsGas.length;
      
        const sumDemand = demand.reduce((a, b) => a + b, 0);
        const sumSupply = supply.reduce((a, b) => a + b, 0);
   
        
        aggregatedDemand[i] = sumDemand;
        aggregatedSupply[i] = sumSupply;

        let newCsvEntry = {
            time: i,
            agg_demand: aggregatedDemand[i],
            agg_supply: aggregatedSupply[i],
            historical_prices: historicalPricesPlot[i],
            no_total_transactions: totalNumberTransactions[i-2184],
            no_trades_market:  successfulBidsGas.length,
            no_market_transactions: numberMarketTransactions,
            no_nat_grid_transactions: nationalGridBidsGas.length,
           
        }
        csvData.push(newCsvEntry);
    }
    console.log(`writing results of simulation to csv file : ${outputFile}`);

    var csvStream = csv.format({ headers: true }),
    writableStream = fs.createWriteStream(outputFile);

    writableStream.on("finish", function () {
        console.log("DONE!");
    });
    
    csvStream.pipe(writableStream);
    for(let i = 0; i < csvData.length; i++){
    csvStream.write(csvData[i]);
    }
    csvStream.end();
};

init();


async function getFiles() {
    console.log('reading files...');
    let householdHistoricData = new Array();
    
    for (i = 1; i <= 15; i++){
            householdHistoricData.push( await readCSV(`../data/house${i}.csv`));
    }

    return {householdHistoricData};
}

async function createAgents(householdHistoricData, batteryCapacity, batteryBool) {
    console.log('creating agents...');
    let agents = new Array();
    let agentNationalGrid = new AgentNationalGrid();

        for (var i = 1 ; i <= 15 ; i++){
            if(i>=8)
                batteryBool = true;
    
            agent = new Agent(batteryCapacity, batteryBool); 
            
            agentAccount = await agent.getAccount(i);
            
            // use = demand & gen = supply from csv

            await agent.loadSmartMeterData(householdHistoricData[i-1], i); // to create an array of household supply and demand from whole data
            let newAgent = {
                id: i,
                agent,
                agentAccount
            }
            agents.push(newAgent);      
            }
        
    return { agents, agentNationalGrid };
}

async function getExchangeBids() {
    let bids = new Array();
    let asks = new Array();
    let bid = 0;
    let ask = 0;


    let bidsCount= await exchange.methods.getBidsCount().call(); 
    let asksCount= await exchange.methods.getAsksCount().call();   

    console.log("Number of bids Placed: " + bidsCount);
    console.log("Number of Asks Placed: " + asksCount);

    for (let i = 0; i <= bidsCount - 1 ; i++){
        bid = await exchange.methods.getBid(i).call(); // owner price amount date

        let date = new Date(parseInt(bid[3]));
        date = date.toLocaleString();
        newBid = {
            price: parseInt(bid[1]),
            amount: parseInt(bid[2]),
            address: bid[0],
            date: date
        }
        bids.push(newBid); // price amount owner date
    }
    for (let j = 0; j <= asksCount - 1; j++){
        try {
            ask = await exchange.methods.getAsk(j).call();
        } catch(err){
            console.log('ERROR', err);
        }

        let date = new Date(parseInt(ask[3]));
        date = date.toLocaleString();

        newAsk = {
            price: parseInt(ask[1]),
            amount: parseInt(ask[2]),
            address: ask[0],
            date: date
        }
        asks.push(newAsk);
    }
    return { bids, asks };
}

//decreasing amount
function sortByAmount(a, b) {
    if (a.amount === b.amount) {
        return 0;
    }
    else {
        return (a.amount > b.amount) ? -1 : 1;
    }
}

async function clearMarket() {                                     // clearMarket is called after each hour to clear all the bids & asks from market
    let bidsCount = await exchange.methods.getBidsCount().call();  // fresh bids & asks are added after each hour
    let asksCount = await exchange.methods.getAsksCount().call();
    let accounts = await web3.eth.getAccounts();

    for (let i = bidsCount - 1; i >= 0; i--) { 
        await exchange.methods.removeBid(i).send({
            from: accounts[accounts.length-3],
            gas: '2000000'
        });
        bidsCount = await exchange.methods.getBidsCount().call();
    }
    for (let i = asksCount - 1; i >= 0; i--) {
        await exchange.methods.removeAsk(i).send({
            from: accounts[accounts.length-3],
            gas: '2000000'
        });
        asksCount = await exchange.methods.getAsksCount().call();
    }
    
    bidsCount = await exchange.methods.getBidsCount().call();
    asksCount = await exchange.methods.getAsksCount().call();

}


async function matchBids(bid_index, ask_index, bids, asks, agentsBattery, intersection) {

    if (bids.length == 0 || asks.length == 0) {
        return { bids, asks, agentsBattery};
    }

    let obj = agentsBattery.find(function (obj) { return obj.agentAccount === bids[bid_index].address; });

    if(bids[bid_index].amount - asks[ask_index].amount >= 0) { // amount = total battery energy
        
        let remainder = bids[bid_index].amount - asks[ask_index].amount;
        let calcAmount = bids[bid_index].amount - remainder; // calcAmount = asks[ask_index].amount

        await obj.agent.sendFunds(intersection[1], calcAmount, asks[ask_index].address );

        let objSeller = agentsBattery.find(function (obj) { return obj.agentAccount === asks[ask_index].address; });
        //objSeller.agent.discharge(calcAmount); // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        objSeller.agent.addSuccessfulAsk(calcAmount);

        bids[bid_index].amount = remainder;

        if(remainder==0){
            bids.splice(bid_index, 1);
        }
        asks.splice(ask_index, 1);
        
        return (matchBids(bids.length-1, asks.length-1, bids, asks, agentsBattery, intersection));
    }

    if(bids[bid_index].amount - asks[ask_index].amount < 0){

        let remainder = asks[ask_index].amount - bids[bid_index].amount;
        let calcAmount = asks[ask_index].amount - remainder;
        
        await obj.agent.sendFunds(intersection[1], calcAmount, asks[ask_index].address );

        let objSeller = agentsBattery.find(function (obj) { return obj.agentAccount === asks[ask_index].address; });
        //objSeller.agent.discharge(calcAmount); // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        objSeller.agent.addSuccessfulAsk(calcAmount);

        asks[ask_index].amount = remainder;

        if(remainder == 0){
            asks.splice(ask_index, 1);
        }
        bids.splice(bid_index, 1);
        
        return (matchBids(bids.length-1, asks.length-1, bids, asks, agentsBattery, intersection)); 
    }
}