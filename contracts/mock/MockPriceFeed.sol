// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockPriceFeed {
    int256 private price;
    uint256 private updateTime;
    uint80 private roundId;
    uint80 private answeredInRound;
    
    function setPrice(int256 _price) external {
        price = _price;
    }
    
    function setUpdateTime(uint256 _updateTime) external {
        updateTime = _updateTime;
    }
    
    function setRoundId(uint80 _roundId) external {
        roundId = _roundId;
    }
    
    function setAnsweredInRound(uint80 _answeredInRound) external {
        answeredInRound = _answeredInRound;
    }
    
    function latestRoundData() external view returns (
        uint80 _roundId,
        int256 _price,
        uint256 _startedAt,
        uint256 _updatedAt,
        uint80 _answeredInRound
    ) {
        return (roundId, price, updateTime, updateTime, answeredInRound);
    }
}