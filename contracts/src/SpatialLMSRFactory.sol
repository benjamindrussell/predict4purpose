// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SpatialLMSRMarket} from "./SpatialLMSRMarket.sol";

contract SpatialLMSRFactory {
  event MarketDeployed(address indexed market, address indexed owner, string marketURI);

  address public immutable treasury;
  uint256 public immutable defaultFeeBps;
  uint256 public immutable defaultB;

  constructor(address _treasury, uint256 _defaultFeeBps, uint256 _defaultB) {
    require(_treasury != address(0), "ZERO_TREASURY");
    require(_defaultFeeBps <= 1_000, "FEE");
    require(_defaultB > 0, "B");
    treasury = _treasury;
    defaultFeeBps = _defaultFeeBps;
    defaultB = _defaultB;
  }

  function deployMarket(
    address owner,
    address resolver,
    int32 cellSizeE6,
    string memory marketURI
  ) external returns (address market) {
    market = address(new SpatialLMSRMarket(owner, resolver, treasury, defaultFeeBps, defaultB, cellSizeE6, marketURI));
    emit MarketDeployed(market, owner, marketURI);
  }
}


