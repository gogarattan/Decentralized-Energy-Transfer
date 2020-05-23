const solc = require('solc');
const pth = require('path');
const fs = require('fs-extra');  

const build_Path = pth.resolve(__dirname + "/..", 'build'); //currentdirectoy __dirname; 


const household_Path = pth.resolve(__dirname + "/../contract", 'contract.sol'); // get path to the contracts directory
const src = fs.readFileSync(household_Path, 'utf8');
const op = solc.compile(src, 1).contracts

console.log(op)

fs.ensureDirSync(build_Path); 

for(let contr in op){
    fs.outputJsonSync(
        pth.resolve(build_Path, contr.replace(':','') + '.json'),
        op[contr]
    );
}

