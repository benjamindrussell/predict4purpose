// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {SpatialLMSRFactory} from "../src/SpatialLMSRFactory.sol";

contract DeploySpatialLMSR is Script {
  function run() external {
    uint256 pk = vm.envUint("PRIVATE_KEY");
    address treasury = vm.envAddress("TREASURY");
    uint256 defaultFeeBps = vm.envUint("DEFAULT_FEE_BPS");
    uint256 defaultB = vm.envUint("DEFAULT_B");

    address owner = vm.envAddress("OWNER");
    address resolver = vm.envAddress("RESOLVER");
    int256 cellSize = vm.envInt("CELL_SIZE_E6");
    string memory marketURI = vm.envString("MARKET_URI");

    require(cellSize > 0 && cellSize <= type(int32).max, "CELL_SIZE");

    vm.startBroadcast(pk);
    SpatialLMSRFactory factory = new SpatialLMSRFactory(treasury, defaultFeeBps, defaultB);
    address market = factory.deployMarket(owner, resolver, int32(cellSize), marketURI);
    vm.stopBroadcast();

    console2.log("LMSR Factory", address(factory));
    console2.log("LMSR Market", market);
  }
}


