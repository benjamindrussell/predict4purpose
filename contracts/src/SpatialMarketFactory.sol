// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SpatialMarket} from "./SpatialMarket.sol";

/// @title SpatialMarketFactory
/// @notice Deploys SpatialMarket instances
contract SpatialMarketFactory {
  event MarketDeployed(address indexed market, address indexed owner, string marketURI);

  address public immutable treasury;
  uint256 public immutable defaultFeeBps;

  constructor(address _treasury, uint256 _defaultFeeBps) {
    require(_treasury != address(0), "ZERO_TREASURY");
    require(_defaultFeeBps <= 1_000, "FEE");
    treasury = _treasury;
    defaultFeeBps = _defaultFeeBps;
  }

  function deployMarket(
    address owner,
    address resolver,
    int32 cellSizeE6,
    string memory marketURI
  ) external returns (address market) {
    market = address(new SpatialMarket(owner, resolver, treasury, defaultFeeBps, cellSizeE6, marketURI));
    emit MarketDeployed(market, owner, marketURI);
  }
}


