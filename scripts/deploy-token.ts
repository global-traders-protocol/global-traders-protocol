import hre, { ethers, network } from "hardhat";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const GTPFactory = await ethers.getContractFactory("GTP");
    const gtp = await GTPFactory.deploy();
    await gtp.deployed();

    console.log("GTP deployed to:", gtp.address);

    if (network.name !== "localhost" && network.name !== "hardhat") {
        console.log("Sleeping before verification...");
        await sleep(20000);

        await hre.run("verify:verify", {
            address: gtp.address,
            contract: "contracts/GTP.sol:GTP",
        });
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
