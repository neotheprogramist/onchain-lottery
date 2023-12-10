import { ethers } from "hardhat";

async function main() {
  const TokenFactory = await ethers.getContractFactory("Token");
  const usdt = await TokenFactory.deploy("Tether USD", "USDT");
  const tokens = [usdt];

  const JackpotFactory = await ethers.getContractFactory("Jackpot");
  const threshold = 1_000n * 10n ** 18n;
  const minAnount = 10n * 10n ** 18n;
  const Jackpot = await JackpotFactory.deploy(
    threshold,
    minAnount,
    usdt,
    1,
    10
  );

  console.log("waiting for token contracts to be deployed...");
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    await token.waitForDeployment();
  }
  console.log("token contracts deployed");

  console.log("waiting for Jackpot contract to be deployed...");
  await Jackpot.waitForDeployment();
  console.log("Jackpot contract deployed");

  const accounts = await ethers.getSigners();
  const value = 1_000_000n * 10n ** 18n;
  let transactionResponses = [];

  console.log("minting tokens...");
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    for (let j = 0; j < accounts.length; j += 1) {
      const account = accounts[j];
      const contractTransactionResponse = await token.mint(
        account.address,
        value
      );
      transactionResponses.push(contractTransactionResponse);
    }
  }
  for (let i = 0; i < transactionResponses.length; i += 1) {
    const transactionResponse = transactionResponses[i];
    await transactionResponse.wait();
  }
  console.log("tokens minted");

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    console.log(`${await token.name()}: ${await token.getAddress()}`);
  }
  console.log(
    `Jackpot threshold: ${await Jackpot.threshold()} address: ${await Jackpot.getAddress()}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
