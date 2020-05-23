const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3 ( new Web3.providers.HttpProvider("HTTP://127.0.0.1:7545"));


//compiled contracts
const exchange = require('../deploy/exchange.js');

class AgentNationalGrid{
    constructor(){
        this.national_GridPrice = 0.1;
    }

    async getAccount(idx) {
        let accts = await web3.eth.getAccounts();
        this.ethereum_Address = accts[idx];
        return this.ethereum_Address;
    }
}

class Agent{
    constructor(batteryCapacity, batteryBool){
        this.timeRow = 0;
        this.balance =0;
        this.householdAddress = 0;
        this.household = 0;
        this.nationalGridAddress = 0;
        this.hasBattery = batteryBool;
        this.priceOfEther = 250; // 1 ether = 250 dollars
        this.WEI_IN_ETHER = 1000000000000000000;
        this.balanceHistory = new Array();

        this.batteryCapacity = batteryCapacity;
        this.amountOfCharge = batteryCapacity;                        //batteryCapacity
        this.excessEnergy = 0;
        this.shortageEnergy = 0;
        this.currentDemand = 0;
        this.currentSupply = 0; 
        this.historicalDemand = new Array(); // load smart meter data
        this.historicalSupply = new Array();
        this.historicalPrices =  new Array(); // we store the price at which the exchange happens between ask and bid i.e. merchant and customer
        this.successfulBidHistory = new Array();
        this.successfulAskHistory = new Array();
        this.nationalGridPurchases = new Array();
        this.bidHistory = new Array();
        this.askHistory = new Array();
        this.householdID = 0;
        this.nationalGridPrice = 0.1; // it is reassigned in setNationalGrid function where it is converted to WEI
        
    }

    async loadSmartMeterData(historicData, householdID){ // pushing the data from file into two arrays of previous demand and supply
        this.householdID = householdID;
        
        for (i=1; i<historicData.length-1; i++){           // use = demand & gen = supply from csv
            let currentDemand = {
                time: historicData[i][0], 
                demand: parseFloat(historicData[i][1]) * 1000 // converting kWh to Wh
            }

            let currentSupply = {
                time: historicData[i][0], 
                supply: parseFloat(historicData[i][2]) * 1000
            }
            this.historicalDemand.push(currentDemand);
            this.historicalSupply.push(currentSupply);
        }

        return true;
    }

    async getAccount(index) {
        let accounts = await web3.eth.getAccounts();
        this.ethereumAddress = accounts[index];
        return this.ethereumAddress;
    }

    async getAgentBalance() {
        let balance = await web3.eth.getBalance(this.ethereumAddress);
        
        this.balance = balance;
        return balance;
    }

    async setAgentBalance() {
        let balance = 0;
        balance = await web3.eth.getBalance(this.ethereumAddress);
        this.balanceHistory.push(balance);
    }

    async setNationalGrid(nationalGridPrice, nationalGridAddress ) {
        let nationalGridPriceEther = nationalGridPrice / 250; // converting dollar to ether
        let nationalGridPriceWei = await web3.utils.toWei(`${nationalGridPriceEther}`, 'ether');
        this.nationalGridPrice = nationalGridPriceWei; // ngp is in wei
        this.nationalGridAddress = nationalGridAddress;
    }

    addSuccessfulAsk(amount) {
        let date = (new Date).getTime();
        let newReceivedTransaction = {
            amount: amount,  // doubt i.e. unit = Wh
            date: date,
            timeRow: this.timeRow
        }
        this.successfulAskHistory.push(newReceivedTransaction);
    }
    
    // perform the transaction in try block and prepare a transaction receipt and store in array
    // amount is the energy in Watt
    async buyFromNationalGrid(amount) { 
        let amountTransaction = this.nationalGridPrice * (amount/1000);

        console.log("amount in wei = " + amountTransaction);

        amountTransaction = parseInt( + amountTransaction.toFixed(18));
        let transactionReceipt = 0;
        try{
            transactionReceipt = await web3.eth.sendTransaction({to: this.nationalGridAddress, from: this.ethereumAddress, value: amountTransaction, gas: '500000'});
        }catch(err){console.log('buying from national grid error', err)}; 

        let date = (new Date).getTime();
  
        let newTransactionReceipt = {
            transactionReceipt: transactionReceipt,
            transactionCost: transactionReceipt.gasUsed,
            transactionAmount: amountTransaction,
            date: date,
            quantity: amount,
            timeRow: this.timeRow
        }

        this.nationalGridPurchases.push(newTransactionReceipt);
        this.charge(amount);
        return transactionReceipt;
    }

    // perform the transaction in try block and prepare a transaction receipt and store in array
    // amount is the energy in Watt hour
    async sendFunds(price, amount, receiver) {
        let amountTransaction = price * (amount/1000);
        amountTransaction = parseInt(amountTransaction);
        let transactionReceipt = 0 ;
        
        try{
            transactionReceipt = await web3.eth.sendTransaction({to: receiver, from: this.ethereumAddress, value: amountTransaction});
        }catch(err){
            console.log('error in sending funds', err);
        }
        let date = (new Date).getTime();
        let newTransactionReceipt = {
            transactionReceipt: transactionReceipt,
            transactionCost: transactionReceipt.gasUsed,
            transactionAmount: amountTransaction,
            timeRow: this.timeRow,
            quantity: amount,
            receiver: receiver,
            date: date
        }
        this.successfulBidHistory.push(newTransactionReceipt);
        this.charge(amount);
        return transactionReceipt;
    }

    convertWeiToDollars(weiValue) {
        let costEther = weiValue / this.WEI_IN_ETHER;
        let costDollars = costEther * ( + this.priceOfEther.toFixed(18));
        costDollars = + costDollars.toFixed(3);
        return costDollars;
    }

    // Requesting the energy from market
    async placeBuy(price, amount, date){
        let transactionReceipt = 0 ;
        try{
            transactionReceipt = await exchange.methods.placeBid(Math.floor(price), Math.floor(amount), date).send({
                from: this.ethereumAddress,
                gas: '3000000'
            });
        }catch(err){
            console.log('error in placeBuy', err);
        }
        
        let newBid = {
            address: this.ethereumAddress,
            price: price,
            amount: amount,
            date: date,
            timeRow: this.timeRow,
            transactionCost: transactionReceipt.gasUsed
        }
        this.bidHistory.push(newBid);
        return true;
    }

    // Putting the excess energy on sale
    async placeAsk(price, amount, date){
        let transactionReceipt = 0 ;
        try{
            transactionReceipt = await exchange.methods.placeAsk(Math.floor(price), Math.floor(amount), date).send({
                from: this.ethereumAddress,
                gas: '3000000'
            });
        }catch(err){
            console.log('error in placeAsk', err);
        }
        let newAsk = {
            address: this.ethereumAddress,
            price: price,
            amount: amount,
            date: date,
            timeRow: this.timeRow,
            transactionCost: transactionReceipt.gasUsed
        }
        this.askHistory.push(newAsk);
        return true;
    }

    // Charging the battery
    charge(amount){
        this.amountOfCharge += amount;
        if(this.amountOfCharge > this.batteryCapacity) {
            this.amountOfCharge = this.batteryCapacity;
        }
        let newObj = {
            timeRow: this.timeRow,
            charge: this.amountOfCharge
        }
    }
    
    // Discharging the battery
    discharge(amount){
        this.amountOfCharge -= amount;
        if(this.amountOfCharge <= 0) {
            this.amountOfCharge = 0;
        }
        let newObj = {
            timeRow: this.timeRow,
            charge: this.amountOfCharge
        }
    }

    setCurrentTime(row){
        this.timeRow = row;
    }

    async unfilledOrdersProcess(){
        let demand = this.historicalDemand[this.timeRow].demand;
        let supply = this.historicalSupply[this.timeRow].supply;
        
        let shortageOfEnergy = demand;
        if(this.hasBattery)
            shortageOfEnergy = demand - supply;

        await this.buyFromNationalGrid(shortageOfEnergy);
        
    }

    calculateYesterdayAverage() {
        if ( this.timeRow - 24 <= 0){
            return this.timeRow - 24;
        } 
        let scaledTime = (this.timeRow - 24)/24; // pichhle din ka start calculate krne k liye
        let startOfDay = Math.floor(scaledTime) * 24; 
        let endOfDay = startOfDay + 24;
        let sumPrices = 0;
        for (let i = startOfDay; i <= endOfDay; i++) {
            sumPrices += this.historicalPrices[i]
        }
        return sumPrices / 24; 

    }

    async purchaseLogic() {
        let demand = this.historicalDemand[this.timeRow].demand;
        let supply = this.historicalSupply[this.timeRow].supply;

        let excessEnergy = 0;
        let shortageOfEnergy = 0;
        let time = (new Date()).getTime();
        let bidsCount = 0;
        let bid = 0;
        let price = 0;
        let asksCount = 0;
        let ask = 0;
        
        if(supply >= demand) {
            excessEnergy = supply - demand;
            //excessEnergy = excessEnergy; 
        }
        if(supply < demand) {
            shortageOfEnergy = demand - supply;
            //shortageOfEnergy = shortageOfEnergy; 
        }

        if(this.hasBattery == true) {

            if(excessEnergy > 0){
                
                if (this.amountOfCharge <= 0.5 * this.batteryCapacity){
                    this.charge(excessEnergy);
                }
                else if (0.5*this.batteryCapacity < this.amountOfCharge && this.amountOfCharge< 0.8*this.batteryCapacity ){
                    bidsCount = await exchange.methods.getBidsCount().call();
                    
                    if( bidsCount > 0) {
                        bid = await exchange.methods.getBid(bidsCount-1).call();
                        if(this.historicalPrices[this.timeRow - 24] != null || this.historicalPrices[this.timeRow - 24] != undefined){
                            let averagePrice = this.calculateYesterdayAverage();
                            
                            
                            if(bid[1] >= averagePrice){ // doubt !!!!!!!!!!!!!!!!!!!!!!!!!! why most recent bid price is used
                                
                                await this.placeAsk(bid[1], Math.floor(excessEnergy), time);
                            }
                            else if(bid[1] < averagePrice){
                                
                                if( this.amountOfCharge + excessEnergy <= this.batteryCapacity) {
                                    this.charge(excessEnergy);
                                }                           
                            }
                        }
                        else
                        {
                            await this.placeAsk(bid[1], Math.floor(excessEnergy), time);
                        }
                    }
                    else {
                        this.charge(excessEnergy);
                    }
                    
                    
                }
                else if (this.amountOfCharge >= this.batteryCapacity * 0.8 ){
                    excessEnergy *= 100;
                    price = Math.random()*0.03 + 0.04;
                    price = await this.convertToWei(price);
                    await this.placeAsk(price, Math.floor(excessEnergy), time);
                    
                }
            }
            else if (shortageOfEnergy > 0){

                if (this.amountOfCharge >= 0.5 * this.batteryCapacity){
                    this.discharge(shortageOfEnergy);
                    return true;
                }
                else if(this.amountOfCharge < 0.5 * this.batteryCapacity && this.amountOfCharge > 0.2 * this.batteryCapacity){
                    
                    let price = Math.random()*0.03 + 0.04;
                    let amount = this.formulateAmount();

                    if( amount === false) {
                        return;
                    }
                    
                    price = await this.convertToWei(price);
                    await this.placeBuy(Math.floor(price), Math.floor(amount), time); // Why Math.floor() is used
                }
                else if (this.amountOfCharge <= 0.2 * this.batteryCapacity){
                    await this.buyFromNationalGrid(0.5 * this.batteryCapacity);
                }   
            }  
        }

        if(this.hasBattery == false){
            shortageOfEnergy = demand;
            price = Math.random()*0.03 + 0.04;
            price = await this.convertToWei(price);
            await this.placeBuy(price, shortageOfEnergy, time); 
        }
    }

               
    // Not understood
    // understood
    
    formulateAmount() {
       
        let timeInterval = 10;
        let supplySum = 0;
        let demandSum = 0;
        let energyNeeded = 0
        for(let i = this.timeRow ; i < this.timeRow + timeInterval; i++) {
            supplySum += this.historicalSupply[i].supply;
            demandSum += this.historicalDemand[i].demand;
            
        }
        if(supplySum - demandSum >= 0) {
            return false;
        }
        if(supplySum - demandSum < 0) {
            energyNeeded = Math.abs(supplySum - demandSum);
        }
        if(this.amountOfCharge + energyNeeded >= this.batteryCapacity) {
            energyNeeded = this.batteryCapacity - this.amountOfCharge;
        }
        return energyNeeded;
    }

    async convertToWei(price) {
        let calcPrice = (price / this.priceOfEther);
        calcPrice = calcPrice.toFixed(18);
        try{
            price = await web3.utils.toWei(calcPrice, 'ether');
        }catch(err){console.log('error from conversion', err)};
        price = parseInt(price);
        return price;
    }

}


module.exports = {Agent,AgentNationalGrid};