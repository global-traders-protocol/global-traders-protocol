import hre, { ethers, network } from "hardhat";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const args: [string] = [process.env.GTP!];

    const VestingFactory = await ethers.getContractFactory("Vesting");
    const vesting = await VestingFactory.deploy(...args);
    await vesting.deployed();

    console.log("Vesting deployed to:", vesting.address);

    if (network.name !== "localhost" && network.name !== "hardhat") {
        console.log("Sleeping before verification...");
        await sleep(20000);

        await hre.run("verify:verify", {
            address: vesting.address,
            constructorArguments: args,
        });
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
