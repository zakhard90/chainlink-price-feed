// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  // Sepolia Chainlink ETH/USD Price Feed address
  const CHAINLINK_PRICE_FEED = process.env.PRICE_FEED_ADDRESS || "";
  
  console.log("Deploying Token contract...");
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("Token deployed to:", tokenAddress);

  // Wait a few block confirmations to ensure deployment
  await token.deploymentTransaction()?.wait(5);
  
  console.log("Deploying Trader contract...");
  const Trader = await ethers.getContractFactory("Trader");
  const trader = await Trader.deploy(tokenAddress, CHAINLINK_PRICE_FEED);
  await trader.waitForDeployment();
  const traderAddress = await trader.getAddress();
  console.log("Trader deployed to:", traderAddress);

  // Wait for deployment confirmation
  await trader.deploymentTransaction()?.wait(5);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });