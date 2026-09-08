// Original assets downloaded from official exchange websites; see art/cex-sources.json.
export const EXCHANGES=[
 {id:'binance',name:'Binance',color:'#f0b90b',file:'binance.ico'},
 {id:'mexc',name:'MEXC',color:'#1768ff',file:'mexc.png',crop:[140,127,200,150]},
 {id:'kraken',name:'Kraken',color:'#7950e8',file:'kraken.png'},
 {id:'coinbase',name:'Coinbase',color:'#1752f0',file:'coinbase.png'},
 {id:'okx',name:'OKX',color:'#becbce',file:'okx.png'},
 {id:'bybit',name:'Bybit',color:'#efa329',file:'bybit.jpg',crop:[790,275,1410,505]},
 {id:'kucoin',name:'KuCoin',color:'#24ac8b',file:'kucoin.png'},
 {id:'bitget',name:'Bitget',color:'#40d3d4',file:'bitget.png'},
 {id:'crypto-com',name:'Crypto.com',color:'#2467bb',file:'crypto-com.ico'},
 {id:'gemini',name:'Gemini',color:'#ff681c',file:'gemini.png'},
 {id:'bitfinex',name:'Bitfinex',color:'#85be49',file:'bitfinex.ico'}
];
export const exchangeFor=o=>EXCHANGES[(o.exchange??0)%EXCHANGES.length];
export async function loadExchangeLogos(){
 const images=new Map();await Promise.all(EXCHANGES.map(async e=>{const img=new Image();img.src=new URL('../assets/cex/'+e.file,import.meta.url).href;try{await img.decode();images.set(e.id,img);}catch{console.warn('Exchange logo unavailable:',e.name);}}));return images;
}
