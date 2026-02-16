import { ethers } from 'ethers';

const networks = {
    bsc: 'https://bsc-dataseed.binance.org/',
    eth: 'https://cloudflare-eth.com',
    arb: 'https://arb1.arbitrum.io/rpc',
    pol: 'https://polygon-rpc.com'
};

async function testRpc() {
    for (const [key, url] of Object.entries(networks)) {
        console.log(`Testing ${key} (${url})...`);
        try {
            const provider = new ethers.JsonRpcProvider(url);
            const network = await provider.getNetwork();
            const block = await provider.getBlockNumber();
            console.log(`✅ ${key}: Connected (ChainId: ${network.chainId}, Block: ${block})`);
        } catch (e) {
            console.error(`❌ ${key}: Failed - ${e.message}`);
        }
    }
}

testRpc();
