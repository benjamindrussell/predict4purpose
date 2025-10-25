// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SafeTransferLib
/// @notice Minimal ETH and ERC20 safe transfer helpers
library SafeTransferLib {
  function safeTransferETH(address to, uint256 amount) internal {
    (bool success, ) = to.call{value: amount}(new bytes(0));
    require(success, "ETH_TRANSFER_FAIL");
  }
}


