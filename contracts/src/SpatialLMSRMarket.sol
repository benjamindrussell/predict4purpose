// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {MerkleProof} from "./utils/MerkleProof.sol";
import {SafeTransferLib} from "./utils/SafeTransferLib.sol";
import {ABDKMath64x64 as FP} from "./utils/ABDKMath64x64.sol";

/// @title SpatialLMSRMarket
/// @notice Spatial market with LMSR AMM for dynamic odds across grid cells. ETH collateral, ERC1155-like shares.
contract SpatialLMSRMarket is ReentrancyGuard {
  // ---------- ERC165 ----------
  function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
    return interfaceId == 0x01ffc9a7 || interfaceId == 0xd9b67a26 || interfaceId == 0x0e89341c;
  }

  // ---------- ERC1155 ----------
  event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
  event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
  event ApprovalForAll(address indexed account, address indexed operator, bool approved);
  event URI(string value, uint256 indexed id);

  mapping(uint256 => mapping(address => uint256)) private _balances;
  mapping(address => mapping(address => bool)) private _operatorApprovals;

  function balanceOf(address account, uint256 id) public view returns (uint256) {
    require(account != address(0), "ZERO_ADDR");
    return _balances[id][account];
  }

  function setApprovalForAll(address operator, bool approved) external {
    _operatorApprovals[msg.sender][operator] = approved;
    emit ApprovalForAll(msg.sender, operator, approved);
  }

  function isApprovedForAll(address account, address operator) public view returns (bool) {
    return _operatorApprovals[account][operator];
  }

  function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external {
    require(from == msg.sender || isApprovedForAll(from, msg.sender), "NOT_AUTH");
    _safeTransferFrom(from, to, id, value, data);
  }

  function _safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) internal {
    require(to != address(0), "ZERO_TO");
    uint256 fromBalance = _balances[id][from];
    require(fromBalance >= value, "BAL");
    unchecked { _balances[id][from] = fromBalance - value; }
    _balances[id][to] += value;
    emit TransferSingle(msg.sender, from, to, id, value);
    _doSafeTransferAcceptanceCheck(msg.sender, from, to, id, value, data);
  }

  function _mint(address to, uint256 id, uint256 value) internal {
    require(to != address(0), "ZERO_TO");
    _balances[id][to] += value;
    emit TransferSingle(msg.sender, address(0), to, id, value);
  }

  function _burn(address from, uint256 id, uint256 value) internal {
    uint256 fromBalance = _balances[id][from];
    require(fromBalance >= value, "BAL");
    unchecked { _balances[id][from] = fromBalance - value; }
    emit TransferSingle(msg.sender, from, address(0), id, value);
  }

  // ---------- ERC1155Receiver checks ----------
  bytes4 private constant _ERC1155_RECEIVED = 0xf23a6e61;

  function _doSafeTransferAcceptanceCheck(address operator, address from, address to, uint256 id, uint256 value, bytes calldata data) private {
    if (to.code.length > 0) {
      (bool ok, bytes memory resp) = to.call(
        abi.encodeWithSelector(_ERC1155_RECEIVED, operator, from, id, value, data)
      );
      require(ok && resp.length >= 4 && bytes4(resp) == _ERC1155_RECEIVED, "REJECT");
    }
  }

  // ---------- Market storage ----------
  address public immutable owner;
  address public immutable resolver;
  address public immutable treasury;
  uint256 public immutable feeBps; // 10_000 = 100%
  int32 public immutable cellSizeE6; // microdegrees
  string public marketURI;
  uint256 public tradingOpen;
  uint256 public tradingClose; // 0 if open
  uint256 public disputeEnd; // 0 if not set

  // LMSR parameter b (liquidity) in wei (currency units)
  uint256 public immutable b;

  // Outcome supplies and active set
  mapping(uint256 => uint256) public totalShares; // q_i in wei units (share pays 1 wei on unit payout)
  uint256[] public activeIds;
  mapping(uint256 => bool) public isActiveId;

  // Resolution
  bytes32 public resultMerkleRoot;
  uint256 public payoutDenominator;

  // Events
  event Buy(address indexed trader, uint256 indexed id, uint256 shares, uint256 cost);
  event Sell(address indexed trader, uint256 indexed id, uint256 shares, uint256 refund);
  event Close(uint256 when, uint256 disputeEnd);
  event Resolve(bytes32 merkleRoot, uint256 payoutDenominator);

  // Errors
  error NotResolver();
  error NotOwner();
  error TradingClosed();
  error TradingNotOpen();

  constructor(
    address _owner,
    address _resolver,
    address _treasury,
    uint256 _feeBps,
    uint256 _b,
    int32 _cellSizeE6,
    string memory _marketURI
  ) {
    require(_owner != address(0) && _resolver != address(0) && _treasury != address(0), "ZERO_ADDR");
    require(_feeBps <= 1_000, "FEE");
    require(_b > 0, "B");
    require(_cellSizeE6 > 0, "CELL");
    owner = _owner;
    resolver = _resolver;
    treasury = _treasury;
    feeBps = _feeBps;
    b = _b;
    cellSizeE6 = _cellSizeE6;
    marketURI = _marketURI;
    tradingOpen = block.timestamp;
  }

  // ---------- Trading ----------
  function buyToAmount(uint256 id, uint256 shares, uint256 maxCost) external payable nonReentrant returns (uint256 cost) {
    if (tradingClose != 0) revert TradingClosed();
    require(shares > 0, "SHARES");
    cost = _quoteBuyCost(id, shares);
    require(cost <= maxCost, "SLIPPAGE");
    require(msg.value >= cost, "VALUE");
    uint256 change = msg.value - cost;
    if (change > 0) SafeTransferLib.safeTransferETH(msg.sender, change);
    _increaseOutcome(id, shares);
    _mint(msg.sender, id, shares);
    emit Buy(msg.sender, id, shares, cost);
  }

  function sellAmount(uint256 id, uint256 shares, uint256 minRefund) external nonReentrant returns (uint256 refund) {
    if (tradingClose != 0) revert TradingClosed();
    require(shares > 0, "SHARES");
    refund = _quoteSellRefund(id, shares);
    require(refund >= minRefund, "SLIPPAGE");
    _burn(msg.sender, id, shares);
    _decreaseOutcome(id, shares);
    SafeTransferLib.safeTransferETH(msg.sender, refund);
    emit Sell(msg.sender, id, shares, refund);
  }

  // ---------- Resolution ----------
  function closeMarket() external {
    if (msg.sender != resolver) revert NotResolver();
    require(tradingClose == 0, "ALREADY_CLOSED");
    tradingClose = block.timestamp;
    disputeEnd = tradingClose + 7 days;
    emit Close(tradingClose, disputeEnd);
  }

  function setResolution(bytes32 merkleRoot, uint256 _payoutDenominator) external {
    if (msg.sender != resolver) revert NotResolver();
    require(tradingClose != 0 && block.timestamp >= tradingClose, "NOT_CLOSED");
    require(_payoutDenominator > 0, "DEN");
    resultMerkleRoot = merkleRoot;
    payoutDenominator = _payoutDenominator;
    emit Resolve(merkleRoot, _payoutDenominator);
  }

  function claim(uint256 id, uint256 payoutNumerator, bytes32[] calldata proof) external nonReentrant returns (uint256 payoutWei) {
    require(disputeEnd != 0 && block.timestamp >= disputeEnd, "DISPUTE");
    bytes32 root = resultMerkleRoot;
    require(root != bytes32(0) && payoutDenominator > 0, "NO_RES");
    uint256 bal = _balances[id][msg.sender];
    require(bal > 0, "NO_BAL");
    bytes32 leaf = keccak256(abi.encode(id, payoutNumerator));
    require(MerkleProof.verify(proof, root, leaf), "BAD_PROOF");
    _burn(msg.sender, id, bal);
    uint256 gross = (bal * payoutNumerator) / payoutDenominator;
    if (gross > 0) {
      uint256 fee = (gross * feeBps) / 10_000;
      unchecked { payoutWei = gross - fee; }
      if (fee > 0) SafeTransferLib.safeTransferETH(treasury, fee);
      SafeTransferLib.safeTransferETH(msg.sender, payoutWei);
    }
  }

  // ---------- Views ----------
  function activeOutcomeCount() external view returns (uint256) { return activeIds.length; }

  function price1e18(uint256 id) external view returns (uint256) {
    if (activeIds.length == 0) return 0;
    int128 invB = FP.div(FP.fromUInt(1), FP.fromUInt(b));
    int128 sumExp = 0;
    for (uint256 i = 0; i < activeIds.length; i++) {
      uint256 oid = activeIds[i];
      int128 qiDivB = FP.mul(FP.fromUInt(totalShares[oid]), invB);
      int128 term = FP.exp(qiDivB);
      sumExp = sumExp == 0 ? term : FP.add(sumExp, term);
    }
    int128 num = FP.exp(FP.mul(FP.fromUInt(totalShares[id]), invB));
    int128 ratio = FP.div(num, sumExp);
    // Convert to 1e18 scale: ratio in 64.64 * 1e18
    uint256 raw = uint256(uint128(ratio));
    uint256 whole = raw >> 64;
    uint256 frac = raw & 0xFFFFFFFFFFFFFFFF;
    return whole * 1e18 + (frac * 1e18 >> 64);
  }

  // ---------- Quotes ----------
  function quoteBuyCost(uint256 id, uint256 shares) external view returns (uint256) {
    require(shares > 0, "SHARES");
    return _quoteBuyCost(id, shares);
  }

  function quoteSellRefund(uint256 id, uint256 shares) external view returns (uint256) {
    require(shares > 0, "SHARES");
    uint256 q = totalShares[id];
    require(q >= shares, "Q");
    return _quoteSellRefund(id, shares);
  }

  // ---------- Internal LMSR ----------
  function _increaseOutcome(uint256 id, uint256 delta) internal {
    if (!isActiveId[id]) { isActiveId[id] = true; activeIds.push(id); }
    totalShares[id] += delta;
  }

  function _decreaseOutcome(uint256 id, uint256 delta) internal {
    uint256 q = totalShares[id];
    require(q >= delta, "Q");
    unchecked { totalShares[id] = q - delta; }
  }

  function _cost() internal view returns (uint256) {
    if (activeIds.length == 0) return 0;
    int128 invB = FP.div(FP.fromUInt(1), FP.fromUInt(b));
    int128 sumExp = 0;
    for (uint256 i = 0; i < activeIds.length; i++) {
      uint256 id = activeIds[i];
      int128 qiDivB = FP.mul(FP.fromUInt(totalShares[id]), invB);
      int128 term = FP.exp(qiDivB);
      sumExp = sumExp == 0 ? term : FP.add(sumExp, term);
    }
    int128 lnSum = FP.ln(sumExp);
    int128 bFixed = FP.fromUInt(b);
    int128 c = FP.mul(bFixed, lnSum);
    // ceil to avoid insolvency from truncation
    uint256 raw = uint256(uint128(c));
    uint256 whole = raw >> 64;
    uint256 frac = raw & 0xFFFFFFFFFFFFFFFF;
    return whole + (frac > 0 ? 1 : 0);
  }

  function _quoteBuyCost(uint256 id, uint256 shares) internal view returns (uint256) {
    // cost = C(q + delta) - C(q)
    uint256 beforeCost = _cost();
    // simulate increase
    int128 invB = FP.div(FP.fromUInt(1), FP.fromUInt(b));
    int128 sumExp = 0;
    bool seen = false;
    for (uint256 i = 0; i < activeIds.length; i++) {
      uint256 oid = activeIds[i];
      uint256 q = totalShares[oid];
      if (oid == id) { q += shares; seen = true; }
      int128 qiDivB = FP.mul(FP.fromUInt(q), invB);
      int128 term = FP.exp(qiDivB);
      sumExp = sumExp == 0 ? term : FP.add(sumExp, term);
    }
    if (!seen) {
      // adding a new outcome
      int128 qiDivB = FP.mul(FP.fromUInt(shares), invB);
      int128 term = FP.exp(qiDivB);
      sumExp = sumExp == 0 ? term : FP.add(sumExp, term);
    }
    int128 lnSum = FP.ln(sumExp);
    int128 bFixed = FP.fromUInt(b);
    int128 c = FP.mul(bFixed, lnSum);
    uint256 raw = uint256(uint128(c));
    uint256 whole = raw >> 64;
    uint256 frac = raw & 0xFFFFFFFFFFFFFFFF;
    uint256 afterCost = whole + (frac > 0 ? 1 : 0);
    return afterCost - beforeCost;
  }

  function _quoteSellRefund(uint256 id, uint256 shares) internal view returns (uint256) {
    // refund = C(q) - C(q - delta)
    uint256 beforeCost = _cost();
    int128 invB = FP.div(FP.fromUInt(1), FP.fromUInt(b));
    int128 sumExp = 0;
    for (uint256 i = 0; i < activeIds.length; i++) {
      uint256 oid = activeIds[i];
      uint256 q = totalShares[oid];
      if (oid == id) { q -= shares; }
      int128 qiDivB = FP.mul(FP.fromUInt(q), invB);
      int128 term = FP.exp(qiDivB);
      sumExp = sumExp == 0 ? term : FP.add(sumExp, term);
    }
    int128 lnSum = FP.ln(sumExp);
    int128 bFixed = FP.fromUInt(b);
    int128 c = FP.mul(bFixed, lnSum);
    uint256 raw = uint256(uint128(c));
    uint256 whole = raw >> 64;
    // round down for sell to avoid overpaying
    uint256 afterCost = whole;
    return beforeCost - afterCost;
  }

  // ---------- Cell math ----------
  function cellIdFor(int32 latE6, int32 lonE6) public view returns (uint256 id) {
    int32 cs = cellSizeE6;
    int64 latShifted = int64(latE6) + 90_000_000; // shift to positive
    int64 lonShifted = int64(lonE6) + 180_000_000;
    require(latShifted >= 0 && latShifted <= 180_000_000, "LAT");
    require(lonShifted >= 0 && lonShifted <= 360_000_000, "LON");
    uint64 latIndex = uint64(int64(latShifted) / int64(cs));
    uint64 lonIndex = uint64(int64(lonShifted) / int64(cs));
    id = (uint256(latIndex) << 64) | uint256(lonIndex);
  }
}


