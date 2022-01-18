import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
const { mnemonic, bscscanApiKey } = require('./secrets.json');

dotenv.config();

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

const ethereumConfig = {
    url: process.env.RPC_URL || "",
    accounts: {mnemonic: mnemonic}
};

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.11",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        mainnet: ethereumConfig,
        ropsten: ethereumConfig,
        rinkeby: ethereumConfig,
        kovan: ethereumConfig,
        BSCTest: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            accounts: {mnemonic: mnemonic},
        },
        BSC: {
            url: "https://bsc-dataseed.binance.org/",
            accounts: {mnemonic: mnemonic}
        },
        mumbai: {
            url: "https://rpc-mumbai.maticvigil.com/",
            accounts: {mnemonic: mnemonic}  
        },
        polygon: {
            url: "https://rpc-mainnet.maticvigil.com/",
            accounts: {mnemonic: mnemonic}
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
    },
    etherscan: {
        apiKey: bscscanApiKey
    },
};

export default config;
