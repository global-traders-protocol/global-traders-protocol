import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GTP, Vesting } from "../typechain";
import { expect } from "chai";
import { ethers } from "hardhat";
import { increaseTime } from "./shared/utils";

describe("Vesting Test", function () {
    let gtp: GTP, vesting: Vesting;
    let deployer: SignerWithAddress,
        adr1: SignerWithAddress,
        adr2: SignerWithAddress,
        adr3: SignerWithAddress;
    let vestingBegin: number, vestingCliff: number, vestingEnd: number;

    beforeEach(async function () {
        [deployer, adr1, adr2, adr3] = await ethers.getSigners();

        const GTPFactory = await ethers.getContractFactory("GTP");
        gtp = await GTPFactory.deploy();
        await gtp.setAntisnipeDisable();
        await gtp.setLiquidityRestrictorDisable();

        const VestingFactory = await ethers.getContractFactory("Vesting");
        vesting = await VestingFactory.deploy(gtp.address);

        const block = await ethers.provider.getBlock(
            await ethers.provider.getBlockNumber()
        );
        vestingBegin = block.timestamp + 100;
        vestingEnd = vestingBegin + 31536000;
    });

    describe("Hold", function () {
        it("Can't hold without approval", async function () {
            await expect(
                vesting.holdTokens([
                    {
                        recipient: adr1.address,
                        amount: 100000,
                        unlocked: 10000,
                        vestingBegin: vestingBegin,
                        vestingEnd: vestingEnd,
                    },
                ])
            ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
        });

        it("Can't hold with incorrect start and end", async function () {
            await gtp.approve(vesting.address, 100000);

            await expect(
                vesting.holdTokens([
                    {
                        recipient: adr1.address,
                        amount: 100000,
                        unlocked: 10000,
                        vestingBegin: vestingBegin,
                        vestingEnd: vestingBegin - 1,
                    },
                ])
            ).to.be.revertedWith("Vesting::holdTokens: end earlier than begin");
        });

        it("Can't hold with incorrect unlock amount", async function () {
            await gtp.approve(vesting.address, 100000);
            await expect(
                vesting.holdTokens([
                    {
                        recipient: adr1.address,
                        amount: 100000,
                        unlocked: 100001,
                        vestingBegin: vestingBegin,
                        vestingEnd: vestingEnd,
                    },
                ])
            ).to.be.revertedWith(
                "Vesting::holdTokens: unlocked can not be greater than amount"
            );
        });

        it("Can't hold zero amount", async function () {
            await expect(
                vesting.holdTokens([
                    {
                        recipient: adr1.address,
                        amount: 0,
                        unlocked: 0,
                        vestingBegin: vestingBegin,
                        vestingEnd: vestingEnd,
                    },
                ])
            ).to.be.revertedWith(
                "Vesting::holdTokens: can not hold zero amount"
            );
        });

        it("Can hold correct", async function () {
            await gtp.approve(vesting.address, 300000);
            await vesting.holdTokens([
                {
                    recipient: adr1.address,
                    amount: 100000,
                    unlocked: 10000,
                    vestingBegin: vestingBegin,
                    vestingEnd: vestingEnd,
                },
                {
                    recipient: adr2.address,
                    amount: 100000,
                    unlocked: 100000,
                    vestingBegin: vestingBegin,
                    vestingEnd: vestingEnd,
                },
                {
                    recipient: adr3.address,
                    amount: 100000,
                    unlocked: 0,
                    vestingBegin: vestingBegin,
                    vestingEnd: vestingEnd,
                },
            ]);

            expect(await gtp.balanceOf(adr1.address)).to.equal(0);
            expect(await gtp.balanceOf(adr2.address)).to.equal(0);
            expect(await gtp.balanceOf(adr3.address)).to.equal(0);

            expect(await vesting.vestingCountOf(adr1.address)).to.equal(1);
            expect(await vesting.vestingIds(adr1.address, 0)).to.equal(0);

            const vesting1 = await vesting.vestings(0);
            expect(vesting1.amount).to.equal(90000);
            expect(vesting1.unlocked).to.equal(10000);
            expect(vesting1.lastUpdate).to.equal(vestingBegin);
            expect(vesting1.claimed).to.equal(0);

            expect(await vesting.vestingCountOf(adr2.address)).to.equal(1);
            expect(await vesting.vestingIds(adr2.address, 0)).to.equal(1);
            const vesting2 = await vesting.vestings(1);
            expect(vesting2.amount).to.equal(0);
            expect(vesting2.unlocked).to.equal(100000);
            expect(vesting2.lastUpdate).to.equal(vestingBegin);
            expect(vesting2.claimed).to.equal(0);


            expect(await vesting.vestingCountOf(adr3.address)).to.equal(1);
            expect(await vesting.vestingIds(adr3.address, 0)).to.equal(2);
            const vesting3 = await vesting.vestings(2);
            expect(vesting3.amount).to.equal(100000);
            expect(vesting3.unlocked).to.equal(0);
            expect(vesting3.lastUpdate).to.equal(vestingBegin);
            expect(vesting3.claimed).to.equal(0);
        });
    });

    describe("Claim", function () {
        beforeEach(async function () {
            await gtp.approve(vesting.address, 100000);
            await vesting.holdTokens([
                {
                    recipient: adr1.address,
                    amount: 100000,
                    unlocked: 10000,
                    vestingBegin: vestingBegin,
                    vestingEnd: vestingEnd,
                },
            ]);
        });

        it("Claiming correct share before vesting end", async function () {
            await increaseTime(100000);
            const tx = await vesting.claim(adr1.address);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            expect(await gtp.balanceOf(adr1.address)).to.equal(
                Math.floor(
                    10000 +
                        (90000 * (block.timestamp - vestingBegin)) /
                            (vestingEnd - vestingBegin)
                )
            );
        });

        it("Claiming in parts works correct", async function () {
            await increaseTime(100000);
            await vesting.claim(adr1.address);
            await increaseTime(100000);
            const tx = await vesting.claim(adr1.address);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            expect(await gtp.balanceOf(adr1.address)).to.equal(
                Math.floor(
                    10000 +
                        (90000 * (block.timestamp - vestingBegin)) /
                            (vestingEnd - vestingBegin)
                )
            );
        });

        it("Claiming full share after vesting end", async function () {
            await increaseTime(50000000);
            await vesting.claim(adr1.address);
            expect(await gtp.balanceOf(adr1.address)).to.equal(100000);
        });

        it("Can claim 0 if lastUpdate in future", async function () {
            expect(await vesting.getAvailableBalanceOf(adr1.address)).to.equal(0);
            await vesting.claim(adr1.address)
            expect(await gtp.balanceOf(adr1.address)).to.equal(0);
        })

        it("Can claim unlocked if lastUpdate now", async function () {
            await increaseTime(100);
            expect(await vesting.getAvailableBalanceOf(adr1.address)).to.equal(10000);

            const vesting1 = await vesting.vestings(0);
            expect(vesting1.amount).to.equal(90000);
            expect(vesting1.unlocked).to.equal(10000);
            expect(vesting1.lastUpdate).to.equal(vestingBegin);
            expect(vesting1.claimed).to.equal(0);

            await vesting.claim(adr1.address)
            const current_block = await ethers.provider.getBlock(
                await ethers.provider.getBlockNumber()
            );

            const vesting_after = await vesting.vestings(0);
            expect(vesting_after.amount).to.equal(90000);
            expect(vesting_after.unlocked).to.equal(0);
            expect(vesting_after.lastUpdate).to.equal(current_block.timestamp);
            expect(vesting_after.claimed).to.equal(0);
            
            expect(await gtp.balanceOf(adr1.address)).to.equal(10000);

            await increaseTime(50000000);
            await vesting.claim(adr1.address);
            expect(await gtp.balanceOf(adr1.address)).to.equal(100000);

            const vesting_finish = await vesting.vestings(0);
            expect(vesting_finish.amount).to.equal(90000);
            expect(vesting_finish.unlocked).to.equal(0);
            expect(vesting_finish.claimed).to.equal(90000);
        })
    });
});
