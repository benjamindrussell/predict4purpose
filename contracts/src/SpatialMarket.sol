// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {MerkleProof} from "./utils/MerkleProof.sol";
import {SafeTransferLib} from "./utils/SafeTransferLib.sol";

/// @title SpatialMarket
/// @notice Pari-mutuel spatial market with ETH staking, minimal ERC1155 share tokens, and Merkle-based resolution
contract SpatialMarket is ReentrancyGuard {
  // ---------- ERC165 ----------
  function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
    return interfaceId == 0x01ffc9a7 /* ERC165 */ || interfaceId == 0xd9b67a26 /* ERC1155 */ || interfaceId == 0x0e89341c /* ERC1155MetadataURI */;
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

  function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory batchBalances) {
    require(accounts.length == ids.length, "LEN");
    batchBalances = new uint256[](accounts.length);
    for (uint256 i = 0; i < accounts.length; i++) {
      batchBalances[i] = balanceOf(accounts[i], ids[i]);
    }
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

  function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external {
    require(from == msg.sender || isApprovedForAll(from, msg.sender), "NOT_AUTH");
    require(ids.length == values.length, "LEN");
    _safeBatchTransferFrom(from, to, ids, values, data);
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

  function _safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) internal {
    require(to != address(0), "ZERO_TO");
    for (uint256 i = 0; i < ids.length; i++) {
      uint256 id = ids[i];
      uint256 value = values[i];
      uint256 fromBalance = _balances[id][from];
      require(fromBalance >= value, "BAL");
      unchecked { _balances[id][from] = fromBalance - value; }
      _balances[id][to] += value;
    }
    emit TransferBatch(msg.sender, from, to, ids, values);
    _doSafeBatchTransferAcceptanceCheck(msg.sender, from, to, ids, values, data);
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
  bytes4 private constant _ERC1155_BATCH_RECEIVED = 0xbc197c81;

  function _doSafeTransferAcceptanceCheck(address operator, address from, address to, uint256 id, uint256 value, bytes calldata data) private {
    if (to.code.length > 0) {
      (bool ok, bytes memory resp) = to.call(
        abi.encodeWithSelector(_ERC1155_RECEIVED, operator, from, id, value, data)
      );
      require(ok && resp.length >= 4 && bytes4(resp) == _ERC1155_RECEIVED, "REJECT");
    }
  }

  function _doSafeBatchTransferAcceptanceCheck(address operator, address from, address to, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) private {
    if (to.code.length > 0) {
      (bool ok, bytes memory resp) = to.call(
        abi.encodeWithSelector(_ERC1155_BATCH_RECEIVED, operator, from, ids, values, data)
      );
      require(ok && resp.length >= 4 && bytes4(resp) == _ERC1155_BATCH_RECEIVED, "REJECT");
    }
  }

  // ---------- Market storage ----------
  address public immutable owner;
  address public immutable resolver;
  address public immutable treasury;
  uint256 public immutable feeBps; // protocol fee on claims, out of 10_000
  uint256 public constant WIN_RADIUS_METERS = 5_000; // fixed 5km radius

  uint256 public tradingOpen;
  uint256 public tradingClose;
  uint256 public disputeEnd;

  int32 public immutable cellSizeE6; // microdegrees per cell edge

  // Totals
  uint256 public totalStaked;
  mapping(uint256 => uint256) public totalStakedPerId;

  // Optional metadata
  string public marketURI; // off-chain metadata & question

  // Resolution (Merkle root of (id, payoutNumerator))
  bytes32 public resultMerkleRoot;
  uint256 public payoutDenominator; // common denominator for all ids
  uint256 public resolvedAt; // timestamp when last root set
  int32 public resolvedLatE6; // final resolution latitude (microdegrees)
  int32 public resolvedLonE6; // final resolution longitude (microdegrees)

  // ---------- Events ----------
  event Stake(address indexed staker, uint256 indexed id, int32 latE6, int32 lonE6, uint256 amount);
  event Resolve(bytes32 merkleRoot, uint256 payoutDenominator, int32 latE6, int32 lonE6);

  // ---------- Errors ----------
  error NotOwner();
  error NotResolver();
  error BadTimebox();
  error TradingClosed();
  error TradingNotOpen();
  error ClaimsLocked();

  constructor(
    address _owner,
    address _resolver,
    address _treasury,
    uint256 _feeBps,
    int32 _cellSizeE6,
    string memory _marketURI
  ) {
    require(_owner != address(0) && _resolver != address(0) && _treasury != address(0), "ZERO_ADDR");
    require(_feeBps <= 1_000, "FEE"); // cap at 10%
    require(_cellSizeE6 > 0, "CELL");
    owner = _owner;
    resolver = _resolver;
    treasury = _treasury;
    feeBps = _feeBps;
    tradingOpen = block.timestamp;
    tradingClose = 0; // open until closed by resolver
    disputeEnd = 0;
    cellSizeE6 = _cellSizeE6;
    marketURI = _marketURI;
  }

  // ---------- Staking ----------
  function stakeAt(int32 latE6, int32 lonE6) external payable nonReentrant returns (uint256 id) {
    uint256 amount = msg.value;
    require(amount > 0, "AMOUNT");
    uint256 nowTs = block.timestamp;
    if (nowTs < tradingOpen) revert TradingNotOpen();
    if (tradingClose != 0) revert TradingClosed();
    id = cellIdFor(latE6, lonE6);
    _mint(msg.sender, id, amount);
    totalStakedPerId[id] += amount;
    totalStaked += amount;
    emit Stake(msg.sender, id, latE6, lonE6, amount);
  }

  function stakeToCell(uint256 id) external payable nonReentrant {
    uint256 amount = msg.value;
    require(amount > 0, "AMOUNT");
    uint256 nowTs = block.timestamp;
    if (nowTs < tradingOpen) revert TradingNotOpen();
    if (tradingClose != 0) revert TradingClosed();
    _mint(msg.sender, id, amount);
    totalStakedPerId[id] += amount;
    totalStaked += amount;
    emit Stake(msg.sender, id, 0, 0, amount);
  }

  // ---------- Resolution ----------
  function setResolution(bytes32 merkleRoot, uint256 _payoutDenominator, int32 latE6, int32 lonE6) external {
    if (msg.sender != resolver) revert NotResolver();
    require(tradingClose != 0 && block.timestamp >= tradingClose, "NOT_CLOSED");
    require(_payoutDenominator > 0, "DEN");
    // basic bounds checks for coordinates
    require(latE6 >= -90_000_000 && latE6 <= 90_000_000, "LAT");
    require(lonE6 >= -180_000_000 && lonE6 <= 180_000_000, "LON");
    resultMerkleRoot = merkleRoot;
    payoutDenominator = _payoutDenominator;
    resolvedAt = block.timestamp;
    resolvedLatE6 = latE6;
    resolvedLonE6 = lonE6;
    emit Resolve(merkleRoot, _payoutDenominator, latE6, lonE6);
  }

  function claim(uint256 id, uint256 payoutNumerator, bytes32[] calldata proof) public nonReentrant returns (uint256 payoutWei) {
    bytes32 root = resultMerkleRoot;
    require(root != bytes32(0) && payoutDenominator > 0, "NO_RES");

    uint256 bal = _balances[id][msg.sender];
    require(bal > 0, "NO_BAL");

    bytes32 leaf = keccak256(abi.encode(id, payoutNumerator));
    require(MerkleProof.verify(proof, root, leaf), "BAD_PROOF");

    // burn shares and pay proportional payout
    _burn(msg.sender, id, bal);
    uint256 gross = (bal * payoutNumerator) / payoutDenominator;
    if (gross > 0) {
      uint256 fee = (gross * feeBps) / 10_000;
      unchecked { payoutWei = gross - fee; }
      if (fee > 0) SafeTransferLib.safeTransferETH(treasury, fee);
      SafeTransferLib.safeTransferETH(msg.sender, payoutWei);
    }
  }

  function batchClaim(uint256[] calldata ids, uint256[] calldata payoutNumerators, bytes32[][] calldata proofs) external returns (uint256 totalPayoutWei) {
    require(ids.length == payoutNumerators.length && ids.length == proofs.length, "LEN");
    for (uint256 i = 0; i < ids.length; i++) {
      totalPayoutWei += claim(ids[i], payoutNumerators[i], proofs[i]);
    }
  }

  // ---------- Admin ----------
  function skim(address to) external {
    if (msg.sender != owner) revert NotOwner();
    // Skim any unallocated ETH (e.g., rounding dust) after dispute.
    require(resultMerkleRoot != bytes32(0) && payoutDenominator > 0, "NO_RES");
    uint256 bal = address(this).balance;
    if (bal > 0) SafeTransferLib.safeTransferETH(to, bal);
  }

  // Close market: resolver can close at any time; sets dispute window to 1 week
  function closeMarket() external {
    if (msg.sender != resolver) revert NotResolver();
    require(tradingClose == 0, "ALREADY_CLOSED");
    tradingClose = block.timestamp;
    disputeEnd = 0; // dispute window removed for hackathon
  }

  // ---------- Cell math ----------
  // Encodes an integer grid cell id from lat/lon microdegrees. The grid is aligned so that (lat=0, lon=0) is a cell boundary.
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

  function cellCenterFor(uint256 id) public view returns (int32 latCenterE6, int32 lonCenterE6) {
    int32 cs = cellSizeE6;
    uint64 latIndex = uint64(id >> 64);
    uint64 lonIndex = uint64(uint128(id));
    int64 latStart = int64(int256(uint256(latIndex))) * int64(cs) - 90_000_000;
    int64 lonStart = int64(int256(uint256(lonIndex))) * int64(cs) - 180_000_000;
    latCenterE6 = int32(latStart + (cs / 2));
    lonCenterE6 = int32(lonStart + (cs / 2));
  }
}


