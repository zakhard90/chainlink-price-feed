// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface TokenInterface {
    function mint(address account, uint256 amount) external;
}

contract Trader is Ownable {
    uint256 public constant MAX_PURCHASE = 100 ether;
    AggregatorV3Interface immutable priceFeed;
    TokenInterface public minter;
    uint256 public tokenPrice = 200;

    error InvalidTokenAddress(address);
    error InvalidFeedAddress(address);
    error InvalidPriceFeedResponse();
    error InvalidPrice(uint256);
    error ValueExceedesMaxPurchase(uint256);

    event TokensPurchased(
        address buyer,
        uint256 ethAmount,
        uint256 tokenAmount
    );
    event TokenPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event WithdrawalMade(address owner, uint256 amount);

    constructor(address tokenAddress, address priceFeedAddress) {
        if (tokenAddress == address(0))
            revert InvalidTokenAddress(tokenAddress);
        if (priceFeedAddress == address(0))
            revert InvalidFeedAddress(priceFeedAddress);

        minter = TokenInterface(tokenAddress);
        priceFeed = AggregatorV3Interface(priceFeedAddress);
    }

    function updateTokenPrice(uint256 newPrice) external onlyOwner {
        if (newPrice <= 0) {
            revert InvalidPrice(newPrice);
        }
        emit TokenPriceUpdated(tokenPrice, newPrice);
        tokenPrice = newPrice;
    }

    function getPriceFeedData() public view returns (int) {
        (
            uint80 roundID,
            int price,
            ,
            uint timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        if (timeStamp <= 0 || answeredInRound < roundID || price <= 0) {
            revert InvalidPriceFeedResponse();
        }
        return price;
    }

    function tokenAmount(uint256 amountETH) public view returns (uint256) {
        uint256 ethUsd = uint256(getPriceFeedData());
        uint256 amountUSD = (amountETH * ethUsd) / 1e18;
        return (amountUSD * 1e2) / tokenPrice;
    }

    receive() external payable {
        if (msg.value > MAX_PURCHASE) {
            revert ValueExceedesMaxPurchase(MAX_PURCHASE);
        }
        uint256 amountToken = tokenAmount(msg.value);
        minter.mint(msg.sender, amountToken);
        emit TokensPurchased(msg.sender, msg.value, amountToken);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        address ownerAddress = owner();
        payable(ownerAddress).transfer(balance);
        emit WithdrawalMade(ownerAddress, balance);
    }
}
