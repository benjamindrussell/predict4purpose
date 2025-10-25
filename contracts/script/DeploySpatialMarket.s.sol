// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {SpatialMarketFactory} from "../src/SpatialMarketFactory.sol";

contract DeploySpatialMarket is Script {
  function run() external {
    uint256 pk = vm.envUint("PRIVATE_KEY");
    address treasury = vm.envAddress("TREASURY");
    uint256 defaultFeeBps = vm.envUint("DEFAULT_FEE_BPS");

    address owner = vm.envAddress("OWNER");
    address resolver = vm.envAddress("RESOLVER");
    int256 cellSize = vm.envInt("CELL_SIZE_E6");
    string memory marketURI = vm.envString("MARKET_URI");

    require(cellSize > 0 && cellSize <= type(int32).max, "CELL_SIZE");

    vm.startBroadcast(pk);
    SpatialMarketFactory factory = new SpatialMarketFactory(treasury, defaultFeeBps);
    address market = factory.deployMarket(owner, resolver, int32(cellSize), marketURI);
    vm.stopBroadcast();

    // Logs for convenience
    console2.log("Factory", address(factory));
    console2.log("Market", market);
  }
}


