const tknsFileMngr = require("./fileManager.js");
const ethers = require('ethers');

const addresses = {
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    USDT: "0x55d398326f99059ff775485246999027b3197955",
    router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    me: "0xc5cba577727CddA29Aa47342e7cAf235223225AE"
}

const mnemonic = ""

const provider = new ethers.providers.WebSocketProvider("wss://dark-omniscient-rain.bsc.discover.quiknode.pro/")
const wallet = ethers.Wallet.fromMnemonic(mnemonic)
const account = wallet.connect(provider)


//Contracts used
const factory = new ethers.Contract(
    addresses.factory,
    [
        'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
        'function getPair(address tokenA, address tokenB) external view returns (address pair)'
    ],
    account
);

const router = new ethers.Contract(
    addresses.router,
    [
        'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
        'function swapExactTokensForTokens( uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)'
    ],
    account
);

const pairABI = [
        'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
        'function factory() external view returns (address)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
];

// Will be used to fetch contract of newly created ERC20 tokens
const erc20ABI = [
    // Read-Only Functions
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",

    // Authenticated Functions
    "function allowance(address owner, address spender) public view returns (uint256)",
    "function approve(address spender, uint256 value) external returns (bool)",
    "function transfer(address to, uint amount) returns (bool)",

    // Events
    "event Transfer(address indexed from, address indexed to, uint amount)"
];


//////////////////HELPER FUNCTIONS

// Get prices function
async function getBnbPriceInUsdt() {
    const amountIn = ethers.utils.parseEther('1')
    try {
        amountsOut = await router.getAmountsOut(amountIn, [addresses.WBNB, addresses.USDT])
    } catch (error) {
        console.log(error);
    }

    return ethers.utils.formatEther(amountsOut[1])
}

async function getPriceForWbnbPairedToken(tokenAddress, decimals) {
    const amountIn = ethers.utils.parseUnits('1', decimals)
    try {
        amountsOut = await router.getAmountsOut(amountIn, [tokenAddress, addresses.WBNB, addresses.USDT])
    } catch (error) {
        console.log(error)
    }

    return {
        priceInUsdt: ethers.utils.formatEther(amountsOut[2]),
        priceInWbnb: ethers.utils.formatEther(amountsOut[1])
    }
}

// ERC20 functions
function getTknContract(tokenAddress) {
    return new ethers.Contract(tokenAddress, erc20ABI, account)
}

async function getTknDecimals(tokenAddress) {
    return await getTknContract(tokenAddress).decimals()
}

async function getTknSymbol(tokenAddress) {
    return await getTknContract(tokenAddress).symbol()
}

// Console.log functions
function logPrice(symbol, price, priceIn) {
    console.log(`
        -----------------------
        ${symbol} Price in ${priceIn}: ${price}
        -----------------------
    `)
}

// LP pair functions
function getPairContract(pairAddress) {
    return new ethers.Contract(pairAddress, pairABI, account);
}

async function getReserves(pairAddress) {
    return await getPairContract(pairAddress).getReserves(); //returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)
}

async function getToken0(pairAddress) {
    return await getPairContract(pairAddress).token0();
}

//Check Liquidity
async function isLiqudtyAtLeastXInWbnb(minLiqInWbnb, pairAddress) {
    // Because LP is always 50-50 at creation. If we want at least 5 WBNB in total liquidity, we just need to check if WBNB reserve is 2.5
    let minLiqInWbnbString = (minLiqInWbnb/2).toString();

    let minWbnbReserve = ethers.utils.parseEther(minLiqInWbnbString);
    let pairContract = getPairContract(pairAddress);
    let token0 = await pairContract.token0();
    let token1 = await pairContract.token1();
    let isWbnbToken0 = token0 == addresses.WBNB;

    let reserves = await pairContract.getReserves();
    console.log(`
        minLiqInWbnbString: ${minLiqInWbnbString}
        isWbnbToken0: ${isWbnbToken0}
        token0: ${token0}
        Wbnb: ${addresses.WBNB}
        token1: ${token1}
        reserves.reserve0: ${reserves.reserve0}///////${ethers.utils.formatEther(reserves.reserve0)}
        reserves.reserve1: ${reserves.reserve1}///////${ethers.utils.formatEther(reserves.reserve1)}
        minWbnbReserve: ${minWbnbReserve}///////${ethers.utils.formatEther(minWbnbReserve)}
        reserves.reserve0 >= minWbnbReserve: ${reserves.reserve0 >= minWbnbReserve}
        reserves.reserve1 >= minWbnbReserve: ${reserves.reserve1 >= minWbnbReserve}
        ethers.utils.formatEther(reserves.reserve0) >= minLiqInWbnbString: ${ethers.utils.formatEther(reserves.reserve0) >= minLiqInWbnbString}
        ethers.utils.formatEther(reserves.reserve0) >= minLiqInWbnbString: ${ethers.utils.formatEther(reserves.reserve1) >= minLiqInWbnbString}

    `)
    return isWbnbToken0 ? ethers.utils.formatEther(reserves.reserve0) >= minLiqInWbnbString : ethers.utils.formatEther(reserves.reserve1) >= minLiqInWbnbString;
}

// Check price change
async function checkPnL(newWbnbBlc, prevWbnbBlc) {
    return (newWbnbBlc - prevWbnbBlc) / prevWbnbBlc;
}

async function approveForRouterSwap(tokenToApprv, amountToApprv, tknDecimals) {
    console.log("++++++++++++++Approval in progress++++++++++++++");
    let tknContract = getTknContract(tokenToApprv);
    let allowance = ethers.utils.formatUnits(await tknContract.allowance(addresses.me, addresses.router), tknDecimals);
    
    if (allowance < amountToApprv) {
        await tknContract.approve(addresses.router, ethers.utils.parseUnits(amountToApprv, tknDecimals));
    } else console.log(`Allowance already enough: ${allowance}`);
}

async function swap(tokenIn, tokenOut, tokenInSwapAmnt, tokenInDecimals) {
    try {
        let amountIn = ethers.utils.parseUnits(tokenInSwapAmnt, tokenInDecimals);
        let amountsOut = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
        let amountOutMin = amountsOut[1].div(100).mul(97);
        console.log(`amountIn: ${amountIn}`);
        tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, [tokenIn, tokenOut], addresses.me, Date.now() + 1000*60);
        receipt = await tx.wait();
        console.log(`
            ---------Tx----------
            ${JSON.stringify(tx)}
        `);
        console.log(`
            ---------Tx receipt----------
            ${JSON.stringify(receipt)}
        `);
        return receipt;
    } catch (error) {
        console.log(error)
    }
}

async function buyInWbnb(tokenToBuy, buyAmntWbnb) {
    return await swap(addresses.WBNB, tokenToBuy, buyAmntWbnb, 18);
}

async function sellToWbnb(tokenToSell, tknAmntToSell, tknDecimals) {
    return await swap(tokenToSell, addresses.WBNB, tknAmntToSell, tknDecimals);
}

////////////Executions//////////////////

const pairInfo = {
    isWbnbPair: false,
    isUsdtPair: false,
    pairAddress: undefined,
    newTokenAddy: undefined,
    newTokenSymbol: "",
    newTokenDecimals: 18,
    newTknAmntRecvd: "0",
    spentWBNB: "0",
    boughtAt: Date.now(),
    wBNBAmntSoldFor: "0",
    realzdPnL: "0"
};

(async () => {

    await approveForRouterSwap(addresses.WBNB, '0.16', 18);
    // bnbPrice = await getBnbPriceInUsdt();
    // logPrice("WBNB", bnbPrice, "USDT");

    // tokenAddress = addresses.USDT;
    // tknSymbol = await getTknSymbol(tokenAddress);
    // tknDecimals = await getTknDecimals(tokenAddress);
    // tknPrices = await getPriceForWbnbPairedToken(tokenAddress, tknDecimals);

    // logPrice(tknSymbol, tknPrices.priceInUsdt, "USDT");
    // logPrice(tknSymbol, tknPrices.priceInWbnb, "WBNB");

    // let pairAddress = await factory.getPair(addresses.WBNB, tokenAddress);
    // console.log(pairAddress);
    //let hasEnoughLiqu = await isLiqudtyAtLeastXInWbnb(20, "0xd105C3e6c46C428b12bEbd6a577987145bbA27a4");//"0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE"
    // console.log(hasEnoughLiqu);
    // let priceCh = await checkPriceChange(tokenAddress, 0.0000000000215046289, tknDecimals);
    // console.log((0.0000000000215046289/2-0.0000000000215046289)/0.0000000000215046289)
    // console.log(priceCh);

    // console.log("----------Starting swap--------------");
    // tknBlce = ethers.utils.formatUnits(await getTknContract(addresses.WBNB).balanceOf(addresses.me), tknDecimals);
    // console.log(tknBlce);
    // console.log(typeof tknBlce);
    // console.log(tknBlce >= 0.252);
    // receipt = await sellToWbnb(tokenAddress, tknBlce);

    // console.log(`----------Swap Complete--------------
    //     ${receipt.toString()}
    // `);
    // tknsFileMngr.addNewTknBuyPairInfo(pairInfo);
    
})();

factory.on("PairCreated", async (token0, token1, pairAddress) => {
    

    let hasEnoughLiqu = await isLiqudtyAtLeastXInWbnb(20, pairAddress);
    let wbnbBlce = ethers.utils.formatEther(await getTknContract(addresses.WBNB).balanceOf(addresses.me));
    pairInfo.isWbnbPair = token0 == addresses.WBNB || token1 == addresses.WBNB;
    pairInfo.isUsdtPair = token0 == addresses.USDT || token1 == addresses.USDT;
    console.log(`has enough liqu: ${hasEnoughLiqu}`);
    let p420Ca = "0x475fF948688AB846cA4455a6Eee0b756D3fbcBca";
    let isP20Ca = token0 == p420Ca || token1 == p420Ca;

    //hasEnoughLiqu && wbnbBlce >= 0.04 && pairInfo.isWbnbPair
    if (isP20Ca) { 

        pairInfo.newTokenAddy = token0 == addresses.WBNB ? token1 : token0;
        let newTknCtrct = getTknContract(pairInfo.newTokenAddy);
        pairInfo.newTokenSymbol = await newTknCtrct.symbol();
        pairInfo.newTokenDecimals = await newTknCtrct.decimals();
        
        console.log(`
            ----------------
            New pair created
            ----------------
            ${pairInfo.newTokenSymbol}: ${pairInfo.newTokenAddy}
            WBNB: ${addresses.WBNB}
            pairAddress: ${pairAddress}
        `)

        receipt = await buyInWbnb(pairInfo.newTokenAddy, '0.04');

        pairInfo.newTknAmntRecvd = ethers.utils.formatUnits(await newTknCtrct.balanceOf(addresses.me), pairInfo.newTokenDecimals);
        pairInfo.boughtAt = Date.now();
        pairInfo.pairAddress = pairAddress;
        pairInfo.spentWBNB = 0.04;
        await tknsFileMngr.addNewTknBuyPairInfo(pairInfo);
        console.log(pairInfo);
    }
})

async function sellTknsBouhgtAtLeast15mnAgo() {
    console.log("Hello World!");
    let pairsInfo = await tknsFileMngr.getBoughtTknsFileAsArray();
    console.log(pairsInfo);
    for (const pairInfo of pairsInfo) {
        if (Date.now() - pairInfo.boughtAt >= 900000) { // 15mn in miliseconds
            let prevWbnbBlc = ethers.utils.formatEther(await getTknContract(addresses.WBNB).balanceOf(addresses.me));
            console.log("selling starting");
            await sellToWbnb(pairInfo.newTokenAddy, pairInfo.newTknAmntRecvd, pairInfo.newTokenDecimals);
            console.log("selling ended");
            let newWbnbBlc = ethers.utils.formatEther(await getTknContract(addresses.WBNB).balanceOf(addresses.me));
            pairInfo.wBNBAmntSoldFor = newWbnbBlc - prevWbnbBlc;
            pairInfo.realzdPnL = await checkPnL(newWbnbBlc, prevWbnbBlc);
            await tknsFileMngr.addNewTknSellPairInfo(pairInfo);
            console.log(pairInfo);
        } 
    }
 }
//  sellTknsBouhgtAtLeast15mnAgo();
//  setInterval(sellTknsBouhgtAtLeast15mnAgo, 1000*60);//run every 15mn


////////////////////File CRUD functions for pairInfo////////////////////

// fs = require('fs');
