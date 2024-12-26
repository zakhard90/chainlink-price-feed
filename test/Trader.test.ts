import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Trader Contract", function () {
  async function deployFixture() {
    const Trader = await ethers.getContractFactory("Trader");
    const Token = await ethers.getContractFactory("Token");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const token = await Token.deploy();
    const mockPriceFeed = await MockPriceFeed.deploy();
    const trader = await Trader.deploy(token.getAddress(), mockPriceFeed.getAddress());
    let owner: SignerWithAddress;
    let buyer: SignerWithAddress;
    let addr2: SignerWithAddress;
  
    const INITIAL_TOKEN_PRICE = 200; // $2.00 with 2 decimals
    const ETH_PRICE = ethers.parseUnits("3800", 8); // $3800 USD/ETH with 8 decimals
    const MAX_PURCHASE = ethers.parseEther("100"); // 1 ETH

    [owner, buyer, addr2] = await ethers.getSigners();

    await token.allowMintTo(trader.getAddress());

    // Set initial ETH price
    await mockPriceFeed.setPrice(ETH_PRICE);
    await mockPriceFeed.setUpdateTime(await time.latest());
    await mockPriceFeed.setAnsweredInRound(1);
    await mockPriceFeed.setRoundId(1);

    return {
      ethers,
      Trader,
      trader,
      owner,
      mockPriceFeed,
      Token,
      token,
      buyer,
      INITIAL_TOKEN_PRICE,
      ETH_PRICE,
      MAX_PURCHASE
    }
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const {trader, owner} = await loadFixture(deployFixture);
      expect(await trader.owner()).to.equal(owner.address);
    });

    it("Should set the initial token price", async function () {
      const {trader, INITIAL_TOKEN_PRICE} = await loadFixture(deployFixture);
      expect(await trader.tokenPrice()).to.equal(INITIAL_TOKEN_PRICE);
    });

    it("Should return correct token decimals", async function() {
      const {token} = await loadFixture(deployFixture);
      expect(await token.decimals()).to.equal(2);
    });

    it("Should revert if token address is zero", async function () {
      const {Trader, trader, mockPriceFeed} = await loadFixture(deployFixture);
      await expect(
        Trader.deploy(ethers.ZeroAddress, mockPriceFeed.getAddress())
      ).to.be.revertedWithCustomError(trader, "InvalidTokenAddress");
    });

    it("Should revert if price feed address is zero", async function () {
      const {Trader, trader, ethers, token} = await loadFixture(deployFixture);
      await expect(
        Trader.deploy(token.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(trader, "InvalidFeedAddress");
    });
  });

  describe("Price Feed", function () {
    it("Should get correct price feed data", async function () {
      const {trader, ETH_PRICE} = await loadFixture(deployFixture);
      const price = await trader.getPriceFeedData();
      expect(price).to.equal(ETH_PRICE);
    });
    
    it("Should revert on stale price", async function () {      
      const {trader, mockPriceFeed} = await loadFixture(deployFixture);
      await mockPriceFeed.setUpdateTime(0);
      await expect(trader.getPriceFeedData()).to.be.revertedWithCustomError(
        trader,
        "InvalidPriceFeedResponse"
      );
    });

    it("Should revert on invalid round", async function () {
      const {trader, mockPriceFeed} = await loadFixture(deployFixture);
      await mockPriceFeed.setAnsweredInRound(0);
      await expect(trader.getPriceFeedData()).to.be.revertedWithCustomError(
        trader,
        "InvalidPriceFeedResponse"
      );
    });

    it("Should revert on negative price", async function () {
      const {trader, mockPriceFeed} = await loadFixture(deployFixture);
      await mockPriceFeed.setPrice(-1);
      await expect(trader.getPriceFeedData()).to.be.revertedWithCustomError(
        trader,
        "InvalidPriceFeedResponse"
      );
    });
  });

  describe("Token Price Updates", function () {
    it("Should update token price", async function () {
      const {trader, INITIAL_TOKEN_PRICE} = await loadFixture(deployFixture);
      const newPrice = 300; // $3.00
      await expect(trader.updateTokenPrice(newPrice))
        .to.emit(trader, "TokenPriceUpdated")
        .withArgs(INITIAL_TOKEN_PRICE, newPrice);
      expect(await trader.tokenPrice()).to.equal(newPrice);
    });

    it("Should revert if new price is zero", async function () {
      const {trader} = await loadFixture(deployFixture);
      await expect(trader.updateTokenPrice(0)).to.be.revertedWithCustomError(
        trader,
        "InvalidPrice"
      );
    });

    it("Should revert if caller is not owner", async function () {
      const {trader, buyer} = await loadFixture(deployFixture);
      await expect(
        trader.connect(buyer).updateTokenPrice(300)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Token Amount Calculation", function () {
    it("Should calculate correct token amount", async function () {
      const {trader} = await loadFixture(deployFixture);
      const ethAmount = ethers.parseEther("1"); // 1 ETH
      // 1 ETH * $3800 = $3800 USD
      // $3800 * 100 / 200 = 1900 tokens with 8 decimals
      const expectedTokens = 1900 * 1e8;
      expect(await trader.tokenAmount(ethAmount)).to.equal(expectedTokens);
    });

    it("Should handle small ETH amounts", async function () {
      const {trader} = await loadFixture(deployFixture);
      const ethAmount = ethers.parseEther("0.0001");
      const tokenAmount = await trader.tokenAmount(ethAmount);
      expect(tokenAmount).to.be.gt(0);
    });

    it("Should handle price updates correctly", async function () {
      const {trader, buyer} = await loadFixture(deployFixture);
      const ethAmount = ethers.parseEther("1");
      const newPrice = 400; // $4.00
      await trader.updateTokenPrice(newPrice);
      // 1 ETH * $3800 = $3800 USD
      // $3800 * 100 / 400 = 950 tokens with 8 decimals
      const expectedTokens = 950 * 1e8;
      expect(await trader.tokenAmount(ethAmount)).to.equal(expectedTokens);
    });
  });

  describe("Token Purchase", function () {
    it("Should mint tokens when receiving ETH", async function () {
      const {trader, buyer} = await loadFixture(deployFixture);
      const ethAmount = ethers.parseEther("0.5");
      const expectedTokens = await trader.tokenAmount(ethAmount);

      await expect(
        buyer.sendTransaction({
          to: trader.getAddress(),
          value: ethAmount,
        })
      )
        .to.emit(trader, "TokensPurchased")
        .withArgs(buyer.address, ethAmount, expectedTokens);
    });

    it("Should revert if purchase exceeds max amount", async function () {
      const {trader, buyer, MAX_PURCHASE} = await loadFixture(deployFixture);
      const ethAmount = MAX_PURCHASE + 1n;
      await expect(
        buyer.sendTransaction({
          to: trader.getAddress(),
          value: ethAmount,
        })
      ).to.be.revertedWithCustomError(trader, "ValueExceedesMaxPurchase");
    });

    it("Should handle exact max purchase amount", async function () {
      const {trader, buyer, MAX_PURCHASE} = await loadFixture(deployFixture);
      const ethAmount = MAX_PURCHASE;
      const expectedTokens = await trader.tokenAmount(ethAmount);

      await expect(
        buyer.sendTransaction({
          to: trader.getAddress(),
          value: ethAmount,
        })
      )
        .to.emit(trader, "TokensPurchased")
        .withArgs(buyer.address, ethAmount, expectedTokens);
    });

    it("Should handle ETH price updates", async function () {
      const {trader, mockPriceFeed} = await loadFixture(deployFixture);
      const newEthPrice = ethers.parseUnits("2000", 8); // $2000 USD/ETH
      await mockPriceFeed.setPrice(newEthPrice);
      
      const ethAmount = ethers.parseEther("1");
      // 1 ETH * $2000 = $2000 USD
      // $2000 * 100 / 200 = 1000 tokens
      const expectedTokens = 1000 * 1e8;
      expect(await trader.tokenAmount(ethAmount)).to.equal(expectedTokens);
    });
  });

  describe("Withdrawal", function () {
    it("Should allow owner to withdraw", async function () {
      const {trader, buyer, owner} = await loadFixture(deployFixture);
      const ethAmount = ethers.parseEther("0.5");
      
      // Send ETH to contract
      await buyer.sendTransaction({
        to: trader.getAddress(),
        value: ethAmount,
      });

      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      // Withdraw
      const tx = await trader.withdraw();
      const receipt = await tx.wait();
      
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const finalBalance = await ethers.provider.getBalance(owner.address);
      
      expect(finalBalance - initialBalance).to.equal(ethAmount - BigInt(gasCost));
    });

    it("Should emit withdrawal event", async function () {
      const {trader, buyer, owner} = await loadFixture(deployFixture);
      const ethAmount = ethers.parseEther("0.5");
      
      await buyer.sendTransaction({
        to: trader.getAddress(),
        value: ethAmount,
      });

      await expect(trader.withdraw())
        .to.emit(trader, "WithdrawalMade")
        .withArgs(owner.address, ethAmount);
    });

    it("Should revert if caller is not owner", async function () {
      const {trader, buyer} = await loadFixture(deployFixture);
      await expect(trader.connect(buyer).withdraw()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should revert if contract has no balance", async function () {
      const {trader, owner} = await loadFixture(deployFixture);
      await expect(trader.withdraw())
        .to.emit(trader, "WithdrawalMade")
        .withArgs(owner.address, 0);
    });
  });
});