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
    int256 lat = vm.envInt("RESOLVED_LAT_E6");
    int256 lon = vm.envInt("RESOLVED_LON_E6");

    require(lat >= -90_000_000 && lat <= 90_000_000, "LAT");
    require(lon >= -180_000_000 && lon <= 180_000_000, "LON");

    vm.startBroadcast(pk);
    SpatialMarket(marketAddr).setResolution(root, denom, int32(lat), int32(lon));
    vm.stopBroadcast();

    console2.log("Resolved market", marketAddr);
    console2.logInt(lat);
    console2.logInt(lon);
  }
}


