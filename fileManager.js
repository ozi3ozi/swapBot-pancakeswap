fs = require('fs');


const boughtTknsFile = "TknsBuysPairsInfo.txt";
const soldTknsFile = "TknsSellsPairsInfo.txt";


// let pairInfo = {
//     isWbnbPair: false,
//     isUsdtPair: false,
//     newTokenAddy: undefined,
//     newTokenSymbol: "",
//     newTokenDecimals: 18,
//     buyPriceUSDT: 0,
//     buyPriceWBNB: 0,
//     sellPriceUSDT: 0,
//     sellPriceWBNB: 0,
//     realzdPnL: 0
// }
// jsonFile = "";

// for (let i = 0; i < 10; i++) {
//     pairInfo = {
//         isWbnbPair: false,
//         isUsdtPair: false,
//         newTokenAddy: undefined,
//         newTokenSymbol: "",
//         newTokenDecimals: 18,
//         buyPriceUSDT: i,
//         buyPriceWBNB: i,
//         sellPriceUSDT: i,
//         sellPriceWBNB: i,
//         realzdPnL: i
//     }

//     newLine = i != 0 ? ",\n" : "";
//     jsonFile += newLine + JSON.stringify(pairInfo);
// }

// fs.appendFile('pairsInfo.txt', jsonFile, function (err) {
//     if (err) throw err;
// });




// (async () => {
//     let newPairInfo = {
//             isWbnbPair: false,
//             isUsdtPair: false,
//             pairAddress: "0x31b646764327e9577CA15Bbaa9Ba81f0x31b646764327e9577CA15Bbaa9Ba81f",
//             newTokenAddy: undefined,
//             newTokenSymbol: "",
//             newTokenDecimals: 18,
//             buyPriceUSDT: 888,
//             buyPriceWBNB: 888,
//             sellPriceUSDT: 888,
//             sellPriceWBNB: 888,
//             realzdPnL: 888
//         };

//     // await addNewTknBuyPairInfo(newPairInfo);
//     await addNewTknSellPairInfo(newPairInfo);
//     // console.log(await getSoldTknsFileAsArray());
// })();

async function getJsonFileAsArray(fileName) {
    let jsonFile = fs.readFileSync(fileName, 'utf8');
    return JSON.parse(jsonFile.toString());
}

async function addNewPairInfo(pairInfo, fileName) {
    await fs.readFile(fileName, async function (err, data) {
        if (err) throw err;

        try {
            let updatedPairsInfo = [];
            let oldPairsInfo = JSON.parse(data.toString());

            await oldPairsInfo.forEach(pair => {
                updatedPairsInfo.push(pair);
            });
            updatedPairsInfo.push(pairInfo);

            await fs.writeFile(fileName, JSON.stringify(updatedPairsInfo), function (err) {
                if (err) throw err;
                console.log(fileName + " updated succesfully (ADD)")
            })
        } catch (error) {
            console.log('Error parsing JSON:', error, data.toString());
        }
    });
}

async function deleteSoldPairInfo(newPairInfo, fileName) {
    fs.readFile(fileName, async function (err, data) {
        if (err) throw err;

        try {
            let updatedPairsInfo = [];
            let oldPairsInfo = JSON.parse(data.toString());

            await oldPairsInfo.forEach(pairInfo => {
                if (pairInfo != null && pairInfo.pairAddress != newPairInfo.pairAddress) {
                    console.log(`
                        pairInfo.pairAddress: ${pairInfo.pairAddress}
                        pairAddress         : ${newPairInfo.pairAddress}
                        result: ${pairInfo.pairAddress != newPairInfo.pairAddress}
                    `)
                    updatedPairsInfo.push(pairInfo);
                } 
            });
                  
            await fs.writeFile(fileName, JSON.stringify(updatedPairsInfo), function (err) {
                if (err) throw err;
                console.log(fileName + " updated succesfully (DELETE)")
            })
        } catch (error) {
            console.log('Error parsing JSON:', error, data.toString());
        }
    });
    
}

async function addNewTknBuyPairInfo(pairInfo) {
    addNewPairInfo(pairInfo, boughtTknsFile);
}

async function addNewTknSellPairInfo(pairInfo) {
    addNewPairInfo(pairInfo, soldTknsFile);
    deleteSoldPairInfo(pairInfo, boughtTknsFile);
}

function getBoughtTknsFileAsArray() {
    return getJsonFileAsArray(boughtTknsFile);
}

function getSoldTknsFileAsArray() {
    return getJsonFileAsArray(soldTknsFile);
}

module.exports = {getBoughtTknsFileAsArray, getSoldTknsFileAsArray, addNewTknBuyPairInfo, addNewTknSellPairInfo};