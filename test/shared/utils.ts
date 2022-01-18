import { ethers } from "hardhat";
import { expect } from "chai";

import { Contract } from "@ethersproject/contracts";
import { ContractReceipt } from "ethers";

const getKeyValue = (key: any) => (obj: any) => obj[key];

export function expectEvent(
    receipt: ContractReceipt,
    contractAddress: string,
    eventName: string,
    args: object
) {
    const event = receipt.events!.find(
        (e) => e.address == contractAddress && e.event == eventName
    );
    expect(event).not.to.be.undefined;
    expect(event).not.to.be.null;
    if (args) {
        expect(event!.args).not.to.be.null;
        for (const arg in args) {
            expect(getKeyValue(arg)(event!.args)).to.equal(
                getKeyValue(arg)(args)
            );
        }
    }
    return event ? event?.args : null;
}

export function expectObject(real: object, expected: object) {
    for (const key in expected) {
        expect(getKeyValue(key)(real)).to.equal(getKeyValue(key)(expected));
    }
}

export function decimal(value: number) {
    return Math.floor(value * 10000000000);
}

export async function mineBlock(count = 1) {
    for (var i = 0; i < count; i++) {
        await ethers.provider.send("evm_mine", []);
    }
}

export async function stopMining() {
    await ethers.provider.send("evm_setAutomine", [false]);
    await ethers.provider.send("evm_setIntervalMining", [1e9]);
}

export async function startMining(mineNow = true) {
    await ethers.provider.send("evm_setAutomine", [true]);
    await ethers.provider.send("evm_setIntervalMining", [0]);
    if (mineNow) {
        await ethers.provider.send("evm_mine", []);
    }
}

export async function increaseTime(seconds: number, mineNow = true) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    if (mineNow) {
        await ethers.provider.send("evm_mine", []);
    }
}

export async function both(
    contract: Contract,
    method: string,
    args: Array<any> = []
) {
    const reply = await contract.callStatic[method](...args);
    const receipt = await contract[method](...args);
    return { reply, receipt };
}
