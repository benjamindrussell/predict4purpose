export const spatialMarketAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "stakeAt",
    stateMutability: "payable",
    inputs: [
      { name: "latE6", type: "int32" },
      { name: "lonE6", type: "int32" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "cellIdFor",
    stateMutability: "view",
    inputs: [
      { name: "latE6", type: "int32" },
      { name: "lonE6", type: "int32" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalStaked",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalStakedPerId",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tradingClose",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "disputeEnd",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "resolvedLatE6",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "int32" }],
  },
  {
    type: "function",
    name: "resolvedLonE6",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "int32" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "payoutNumerator", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [{ name: "payoutWei", type: "uint256" }],
  },
  {
    type: "event",
    name: "Stake",
    inputs: [
      { name: "staker", type: "address", indexed: true },
      { name: "id", type: "uint256", indexed: true },
      { name: "latE6", type: "int32", indexed: false },
      { name: "lonE6", type: "int32", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Resolve",
    inputs: [
      { name: "merkleRoot", type: "bytes32", indexed: false },
      { name: "payoutDenominator", type: "uint256", indexed: false },
      { name: "latE6", type: "int32", indexed: false },
      { name: "lonE6", type: "int32", indexed: false },
    ],
    anonymous: false,
  },
];


