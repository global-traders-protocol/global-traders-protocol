import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { GTP } from "../typechain";

const parseUnits = ethers.utils.parseUnits;

describe("Test GTP", function () {
    let gtp: GTP;
    let owner: SignerWithAddress;
    let other: SignerWithAddress;

    this.beforeEach(async function () {
        [owner, other] = await ethers.getSigners();

        const GTPFactory = await ethers.getContractFactory("GTP");
        gtp = await GTPFactory.deploy();
    });

    it("Name, symbol, supply and decimals are correct", async function () {
        expect(await gtp.name()).to.equal("GT-Protocol Token");
        expect(await gtp.symbol()).to.equal("GTP");
        expect(await gtp.totalSupply()).to.equal(parseUnits("100000000"));
        expect(await gtp.decimals()).to.equal(18);
    });

    it("Initially deployer has all the supply", async function () {
        expect(await gtp.balanceOf(owner.address)).to.equal(
            await gtp.totalSupply()
        );
    });

    it("Can make a transfer after disable antisnipe", async function () {
        gtp.setAntisnipeDisable();
        gtp.setLiquidityRestrictorDisable();
        await expect(gtp.transfer(other.address, 1))
            .to.emit(gtp, "Transfer")
            .withArgs(owner.address, other.address, 1);
    });

    it("Can make a transfer after disable antisnipe", async function () {
        gtp.setAntisnipeDisable();
        gtp.setLiquidityRestrictorDisable();
        await expect(gtp.transfer(other.address, 1))
            .to.emit(gtp, "Transfer")
            .withArgs(owner.address, other.address, 1);
    });

    it("Can't make a transfer to zero address", async function () {
        gtp.setAntisnipeDisable();
        gtp.setLiquidityRestrictorDisable();
        await expect(gtp.transfer(ethers.constants.AddressZero, 1))
            .to.be.revertedWith("ERC20: transfer to the zero address");
    });

});
