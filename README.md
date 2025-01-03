# Trader Smart Contract

A Solidity smart contract project that enables users to purchase tokens using ETH, with price feeds powered by Chainlink. Based on [this repository](https://github.com/solangegueiros/chainlink-bootcamp-2024/blob/main/TokenShop.sol).

## Overview

The Trader contract is a token purchasing system that:
- Allows users to buy tokens by sending ETH directly to the contract
- Uses Chainlink price feeds to determine current ETH/USD prices
- Mints tokens to buyers based on current exchange rates
- Includes owner-controlled price updates and withdrawal functionality

## Features

- **Dynamic Pricing**: Uses Chainlink oracle for real-time ETH/USD price data
- **Purchase Limits**: Maximum purchase amount of 100 ETH per transaction
- **Configurable Token Price**: Owner can update the USD price per token
- **Automated Minting**: Tokens are minted directly to the buyer's address
- **Secure Withdrawals**: Owner can withdraw accumulated ETH

## Security Considerations

### External Dependencies
- Relies on Chainlink price feeds for ETH/USD pricing
- Interacts with an external token contract for minting
- Uses OpenZeppelin's Ownable contract for access control

If deployed to Sepolia testnet use this price feed:
- ETH/USD: 0x694AA1769357215DE4FAC081bf1f309aDC325306

### Safety Mechanisms
- Input validation for token and price feed addresses
- Maximum purchase limit of 100 ETH
- Price feed data validation
- Checks for zero addresses and invalid prices

## Technical Details

### Contract Parameters
- Solidity Version: 0.8.28
- Token Price: Initially set to 2 * 1e18 (2 USD)
- Maximum Purchase: 100 ETH

### Events
```solidity
TokensPurchased(address buyer, uint256 ethAmount, uint256 tokenAmount)
TokenPriceUpdated(uint256 oldPrice, uint256 newPrice)
WithdrawalMade(address owner, uint256 amount)
```

### Key Functions

#### `constructor(address tokenAddress, address priceFeedAddress)`
Initializes the contract with token and price feed addresses.

#### `updateTokenPrice(uint256 newPrice)`
Allows owner to update the token price in USD cents.

#### `tokenAmount(uint256 amountETH)`
Calculates token amount based on ETH input and current prices.

#### `receive()`
Handles incoming ETH payments and mints tokens to buyers.

#### `withdraw()`
Allows owner to withdraw accumulated ETH.

## Setup and Deployment

1. Deploy token contract that implements `TokenInterface`
2. Deploy Trader contract with:
   - Token contract address
   - Chainlink ETH/USD price feed address
3. Set initial token price if different from default

To deploy the Token and the Trader contract, configure the `.env` file and run:

```bash
npx hardhat clean
npx hardhat compile
npx hardhat run scripts/deploy.ts --network sepolia
```
In case you want to verify the contracts on Etherscan, add the ETHERSCAN_API_KEY to the .env file and run:

```bash
npx hardhat verify --network sepolia --contract contracts/Token.sol:Token <DEPLOYED_CONTRACT_ADDRESS>
```

```bash
npx hardhat verify --network sepolia --contract contracts/Trader.sol:Trader <DEPLOYED_CONTRACT_ADDRESS> <CONSTRUCTOR_ARG_1> <CONSTRUCTOR_ARG_2>
```
Note that constructor arguments are the addresses of:
1. Token contract
2. Price feed contract

## License
This project is licensed under the MIT License - see the LICENSE file for details.