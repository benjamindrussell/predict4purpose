// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {SpatialMarket} from "../src/SpatialMarket.sol";

contract ResolveMarket is Script {
  function run() external {
    uint256 pk = vm.envUint("PRIVATE_KEY");
    address marketAddr = vm.envAddress("MARKET");
    bytes32 root = vm.envBytes32("MERKLE_ROOT");
    uint256 denom = vm.envUint("PAYOUT_DENOM");

    vm.startBroadcast(pk);
    SpatialMarket(marketAddr).setResolution(root, denom);
    vm.stopBroadcast();

    console2.log("Resolved market", marketAddr);
  }
}


