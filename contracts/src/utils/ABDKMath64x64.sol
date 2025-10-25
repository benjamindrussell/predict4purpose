// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ABDKMath64x64
/// @notice 64.64-bit fixed point math (subset) from ABDK Consulting, MIT License
/// @dev Source: https://github.com/abdk-consulting/abdk-libraries-solidity (trimmed)
library ABDKMath64x64 {
  int128 private constant MIN_64x64 = -0x80000000000000000000000000000000;
  int128 private constant MAX_64x64 =  0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  function fromUInt(uint256 x) internal pure returns (int128) {
    require(x <= uint256(type(uint64).max));
    return int128(int256(x << 64));
  }

  function toUInt(int128 x) internal pure returns (uint256) {
    require(x >= 0);
    return uint256(uint128(x >> 64));
  }

  function add(int128 x, int128 y) internal pure returns (int128) {
    int256 z = int256(x) + y;
    require (z >= MIN_64x64 && z <= MAX_64x64);
    return int128(z);
  }

  function sub(int128 x, int128 y) internal pure returns (int128) {
    int256 z = int256(x) - y;
    require (z >= MIN_64x64 && z <= MAX_64x64);
    return int128(z);
  }

  function mul(int128 x, int128 y) internal pure returns (int128) {
    int256 z = (int256(x) * y) >> 64;
    require (z >= MIN_64x64 && z <= MAX_64x64);
    return int128(z);
  }

  function div(int128 x, int128 y) internal pure returns (int128) {
    require (y != 0);
    int256 z = (int256(x) << 64) / y;
    require (z >= MIN_64x64 && z <= MAX_64x64);
    return int128(z);
  }

  function ln(int128 x) internal pure returns (int128) {
    require (x > 0);
    return mul(log_2(x), 0xB17217F7D1CF79AB); // ln(2) in 64.64
  }

  function exp(int128 x) internal pure returns (int128) {
    if (x == 0) return 0x10000000000000000; // 1.0
    if (x < -0x40000000000000000000000000000000) return 0; // underflow
    if (x >  0x40000000000000000000000000000000) revert(); // overflow
    int128 result = exp_2(div(x, 0xB17217F7D1CF79AB)); // x/ln2
    return result;
  }

  function log_2 (int128 x) internal pure returns (int128) {
    require (x > 0);

    int256 msb = 0;
    int256 xc = x;
    if (xc >= 0x10000000000000000) { xc >>= 64; msb += 64; }
    if (xc >= 0x100000000) { xc >>= 32; msb += 32; }
    if (xc >= 0x10000) { xc >>= 16; msb += 16; }
    if (xc >= 0x100) { xc >>= 8; msb += 8; }
    if (xc >= 0x10) { xc >>= 4; msb += 4; }
    if (xc >= 0x4) { xc >>= 2; msb += 2; }
    if (xc >= 0x2) msb += 1; // no shift, we only need msb index

    int256 result = (msb - 64) << 64;
    uint256 ux = uint256(int256(x)) << uint256(127 - msb);

    for (int256 bit = 0; bit < 64; bit++) {
      ux = ux * ux >> 127;
      uint256 b = ux >> 127;
      ux >>= b;
      result += int256(b) << (63 - uint256(bit));
    }

    return int128(int256(result));
  }

  function exp_2 (int128 x) internal pure returns (int128) {
    require (x < 0x400000000000000000);
    if (x < -0x400000000000000000) return 0;

    uint256 result = 0x80000000000000000000000000000000;

    if ((x & 0x8000000000000000) > 0)
      result = result * 0x16A09E667F3BCC909 >> 64;
    if ((x & 0x4000000000000000) > 0)
      result = result * 0x1306FE0A31B7152DF >> 64;
    if ((x & 0x2000000000000000) > 0)
      result = result * 0x1172B83C7D517ADCE >> 64;
    if ((x & 0x1000000000000000) > 0)
      result = result * 0x10B5586CF9890F62A >> 64;
    if ((x & 0x800000000000000) > 0)
      result = result * 0x1059B0D31585743AE >> 64;
    if ((x & 0x400000000000000) > 0)
      result = result * 0x102C9A3E778060EE7 >> 64;
    if ((x & 0x200000000000000) > 0)
      result = result * 0x10163DA9FB33356D8 >> 64;
    if ((x & 0x100000000000000) > 0)
      result = result * 0x100B1AFA5ABCBED61 >> 64;
    if ((x & 0x80000000000000) > 0)
      result = result * 0x10058C86DA1C09EA2 >> 64;
    if ((x & 0x40000000000000) > 0)
      result = result * 0x1002C605E2E8CEC50 >> 64;
    if ((x & 0x20000000000000) > 0)
      result = result * 0x100162F3904051FA1 >> 64;
    if ((x & 0x10000000000000) > 0)
      result = result * 0x1000B175EFFDC76BA >> 64;
    if ((x & 0x8000000000000) > 0)
      result = result * 0x100058BA01FB9F96D >> 64;
    if ((x & 0x4000000000000) > 0)
      result = result * 0x10002C5CC37DA9492 >> 64;
    if ((x & 0x2000000000000) > 0)
      result = result * 0x1000162E525EE0547 >> 64;
    if ((x & 0x1000000000000) > 0)
      result = result * 0x10000B17255775C04 >> 64;
    if ((x & 0x800000000000) > 0)
      result = result * 0x1000058B91B5BC9AE >> 64;
    if ((x & 0x400000000000) > 0)
      result = result * 0x100002C5C89D5EC6D >> 64;
    if ((x & 0x200000000000) > 0)
      result = result * 0x10000162E43F4F831 >> 64;
    if ((x & 0x100000000000) > 0)
      result = result * 0x100000B1721BCFC9A >> 64;
    if ((x & 0x80000000000) > 0)
      result = result * 0x10000058B90CF1E6E >> 64;
    if ((x & 0x40000000000) > 0)
      result = result * 0x1000002C5C863B73F >> 64;
    if ((x & 0x20000000000) > 0)
      result = result * 0x100000162E430E5A2 >> 64;
    if ((x & 0x10000000000) > 0)
      result = result * 0x1000000B172183551 >> 64;
    if ((x & 0x8000000000) > 0)
      result = result * 0x100000058B90C0B49 >> 64;
    if ((x & 0x4000000000) > 0)
      result = result * 0x10000002C5C8601CC >> 64;
    if ((x & 0x2000000000) > 0)
      result = result * 0x1000000162E42FFF0 >> 64;
    if ((x & 0x1000000000) > 0)
      result = result * 0x10000000B17217FBA >> 64;
    if ((x & 0x800000000) > 0)
      result = result * 0x1000000058B90BFCE >> 64;
    if ((x & 0x400000000) > 0)
      result = result * 0x100000002C5C85FE3 >> 64;
    if ((x & 0x200000000) > 0)
      result = result * 0x10000000162E42FF1 >> 64;
    if ((x & 0x100000000) > 0)
      result = result * 0x100000000B17217F8 >> 64;
    if ((x & 0x80000000) > 0)
      result = result * 0x10000000058B90BFC >> 64;
    if ((x & 0x40000000) > 0)
      result = result * 0x1000000002C5C85FE >> 64;
    if ((x & 0x20000000) > 0)
      result = result * 0x100000000162E42FF >> 64;
    if ((x & 0x10000000) > 0)
      result = result * 0x1000000000B17217F >> 64;
    if ((x & 0x8000000) > 0)
      result = result * 0x100000000058B90C0 >> 64;
    if ((x & 0x4000000) > 0)
      result = result * 0x10000000002C5C860 >> 64;
    if ((x & 0x2000000) > 0)
      result = result * 0x1000000000162E430 >> 64;
    if ((x & 0x1000000) > 0)
      result = result * 0x10000000000B17218 >> 64;
    if ((x & 0x800000) > 0)
      result = result * 0x1000000000058B90 >> 64;
    if ((x & 0x400000) > 0)
      result = result * 0x100000000002C5C8 >> 64;
    if ((x & 0x200000) > 0)
      result = result * 0x10000000000162E4 >> 64;
    if ((x & 0x100000) > 0)
      result = result * 0x100000000000B172 >> 64;
    if ((x & 0x80000) > 0)
      result = result * 0x10000000000058B9 >> 64;
    if ((x & 0x40000) > 0)
      result = result * 0x1000000000002C5C >> 64;
    if ((x & 0x20000) > 0)
      result = result * 0x100000000000162E >> 64;
    if ((x & 0x10000) > 0)
      result = result * 0x1000000000000B17 >> 64;
    if ((x & 0x8000) > 0)
      result = result * 0x100000000000058C >> 64;
    if ((x & 0x4000) > 0)
      result = result * 0x10000000000002C6 >> 64;
    if ((x & 0x2000) > 0)
      result = result * 0x1000000000000163 >> 64;
    if ((x & 0x1000) > 0)
      result = result * 0x10000000000000B1 >> 64;
    if ((x & 0x800) > 0)
      result = result * 0x1000000000000058 >> 64;
    if ((x & 0x400) > 0)
      result = result * 0x100000000000002C >> 64;
    if ((x & 0x200) > 0)
      result = result * 0x1000000000000016 >> 64;
    if ((x & 0x100) > 0)
      result = result * 0x100000000000000B >> 64;
    if ((x & 0x80) > 0)
      result = result * 0x1000000000000006 >> 64;
    if ((x & 0x40) > 0)
      result = result * 0x1000000000000003 >> 64;
    if ((x & 0x20) > 0)
      result = result * 0x1000000000000001 >> 64;

    int256 shift = (x >> 64);
    require (shift < 63);
    if (shift >= 0) result <<= uint256(shift);
    else result >>= uint256(-shift);

    return int128(int256(result));
  }
}


