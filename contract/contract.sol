pragma solidity ^0.4.17;

contract Exchange {

    struct Bid {
        address owner;
        uint price;
        uint amount;
        uint date;
    }
    
    Bid[] public Bids;
    Bid[] public Asks;


    function getBid(uint index) public view returns(address, uint, uint, uint){
        return (Bids[index].owner, Bids[index].price, Bids[index].amount, Bids[index].date);
    }

    function getAsk(uint index) public view returns(address, uint, uint, uint){
        return (Asks[index].owner, Asks[index].price, Asks[index].amount, Asks[index].date);
    }


    function placeBid(uint _price, uint _amount, uint timestamp) public returns (bool) {
        Bid memory b;
        b.owner = msg.sender;
        b.price = _price;
        b.amount = _amount;
        b.date = timestamp;

        Bids.push(b);
        return true;
    }

    function placeAsk(uint _price, uint _amount, uint timestamp) public returns (bool) {
        Bid memory a;
        a.owner = msg.sender;
        a.price = _price;
        a.amount = _amount;
        a.date = timestamp;

        Asks.push(a);
        return true;
    }
    

    function removeBid(uint index) public returns(uint){
        if (index >= Bids.length) return;
        
        for (uint i = index; i<Bids.length-1; i++){
            Bids[i] = Bids[i+1];
        }
        Bids.length--;
        return Bids.length;
    }

    function removeAsk(uint index) public returns(uint) {
        if (index >= Asks.length) return;
        
        for (uint i = index; i<Asks.length-1; i++){
            Asks[i] = Asks[i+1];
        }
        Asks.length--;
        return Asks.length;
    }

    function getBidsCount() public view returns(uint) {
        return Bids.length;
    }
    
    function getAsksCount() public view returns(uint) {
        return Asks.length;
    }
}


// pragma solidity ^0.4.17;

// contract Exchange {

//     struct Offer {
//         address owner;
//         uint price;
//         uint amt;
//         uint date;
//     }
    
//     Offer[] public Bid;
//     Offer[] public Ask;

//     function getBid(uint id) public returns(address, uint, uint, uint){
//         return (Bid[id].ownr, Bid[id].price, Bid[id].amt, Bid[id].date);
//     }

//     function getAsk(uint id) public  returns(address, uint, uint, uint){
//         return (Ask[id].ownr, Ask[id].price, Ask[id].amt, Ask[id].date);
//     }


//     function placeBid(uint _price, uint _amt, uint timestamp) public returns (bool) {
//         Offer memory b;
//         b.ownr = msg.sender;
//         b.price = _price;
//         b.amt = _amt;
//         b.date = timestamp;

//         Bid.push(b);
//         return true;
//     }

//     function placeAsk(uint _price, uint _amt, uint timestamp) public returns (bool) {
//         Offer memory a;
//         a.ownr = msg.sender;
//         a.price = _price;
//         a.amt = _amt;
//         a.date = timestamp;

//         Ask.push(a);
//         return true;
//     }
    

//     function removeBid(uint id) public returns(uint){
//         if (id >= Bid.length) return;
        
//         for (uint i = id; i<Bid.length-1; i++){
//             Bid[i] = Bid[i+1];
//         }
//         Bid.length--;
//         return Bid.length;
//     }

//     function removeAsk(uint id) public returns(uint) {
//         if (id >= Ask.length) return;
        
//         for (uint i = id; i<Ask.length-1; i++){
//             Ask[i] = Ask[i+1];
//         }
//         Ask.length--;
//         return Ask.length;
//     }

//     function getBidsCount() public view returns(uint) {
//         return Bid.length;
//     }
    
//     function getAsksCount() public view returns(uint) {
//         return Ask.length;
//     }
// }