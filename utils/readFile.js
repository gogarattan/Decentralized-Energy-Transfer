var fs = require('fs');
let csv = require('fast-csv');
let parse = require('csv-parse');

//fast csv method
async function readCSV(inputFile){
    return new Promise((resolve, reject) =>{
        let csvData=[];

        csv
        .parseFile(inputFile)
        .on("data", function(data){
            csvData.push(data);
        })
        .on("end", function(){
            resolve(csvData);
            //console.log("done");
        });
    });   
}
  
module.exports = readCSV;