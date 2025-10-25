## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

## Spatial Prediction Market (MVP)

Contracts for a spatial pari-mutuel market where traders stake ETH on geographic grid cells representing likely wildfire origins. Shares are ERC1155-like positions per cell. After trading closes, a resolver publishes a Merkle root mapping cell IDs to payout weights; after the dispute window, users claim proportional ETH.

### Key contracts

- `SpatialMarket`: Minimal ERC1155 share ledger, ETH staking, timeboxes, Merkle-based resolution and claims. Grid cells are derived from latitude/longitude microdegrees and a `cellSizeE6` step.
- `SpatialMarketFactory`: Deploys markets with a protocol fee paid on claims to `treasury`.

### Timeboxes

- `tradingOpen` → staking and transfers enabled
- `tradingClose` → staking disabled; resolver can set Merkle root and denominator
- `disputeEnd` → claims enabled; owner can skim dust after all claims

### Payouts

Resolver posts a Merkle root over leaves: `keccak256(abi.encode(id, payoutNumerator))` with a shared `payoutDenominator`. For a holder with `shares` on `id`, the gross payout equals `shares * payoutNumerator / payoutDenominator`. A protocol fee `feeBps` is applied on gross at claim.

### Cell encoding

- Inputs: `latE6` in [-90_000_000, 90_000_000], `lonE6` in [-180_000_000, 180_000_000]
- `cellSizeE6` is the grid step in microdegrees
- Cell ID: `(latIndex << 64) | lonIndex`, where indices are computed from shifted coords divided by `cellSizeE6`

### Build & Deploy

```bash
forge build

export PRIVATE_KEY=...
export TREASURY=0xYourTreasury
export DEFAULT_FEE_BPS=50 # 0.5%

export OWNER=0xOwner
export RESOLVER=0xResolver
export TRADING_OPEN=...
export TRADING_CLOSE=...
export DISPUTE_END=...
export CELL_SIZE_E6=1000000             # 1 degree = 1_000_000 microdegrees
export MARKET_URI='{"name":"Where will the next California wildfire originate?","details":"..."}'

forge script script/DeploySpatialMarket.s.sol:DeploySpatialMarket \
  --rpc-url $RPC_URL --broadcast -vvvv
```

### LMSR AMM (dynamic odds)

An alternative market with continuous pricing like Polymarket, using LMSR:

- `SpatialLMSRMarket`: buys/sells shares against an on-chain LMSR book with parameter `b`.
- `SpatialLMSRFactory`: deploys LMSR markets.

Env and deploy:

```bash
export DEFAULT_FEE_BPS=10       # 0.1%
export DEFAULT_B=100000000000000000 # 0.1 ETH liquidity parameter, tune per market size
export RESOLVER=0x60098e0e20bBfF8B4D864a77411D9E635De29648

forge script script/DeploySpatialLMSR.s.sol:DeploySpatialLMSR \
  --rpc-url $RPC_URL --broadcast -vvvv
```

Trade examples:

```bash
# Buy 1e16 shares of cell id 0x..., paying up to 0.05 ETH
cast send $LMSR_MARKET "buyToAmount(uint256,uint256,uint256)" $CELL_ID 10000000000000000 50000000000000000 --value 50000000000000000 --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Sell 1e16 shares of a cell, requiring at least 0.03 ETH refund
cast send $LMSR_MARKET "sellAmount(uint256,uint256,uint256)" $CELL_ID 10000000000000000 30000000000000000 --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

Close and resolve are identical to the simple market: call `closeMarket()` (resolver), then `setResolution(root, denom)`, then holders `claim` after `disputeEnd`.

### Resolving a market

1. Choose radius R km around epicenter coordinates.
2. Compute winning cells and their payout numerators proportional to overlap/weighting; choose a common `payoutDenominator`.
3. Build Merkle leaves `keccak256(abi.encode(id, payoutNumerator))` for every cell with non-zero payouts; compute root.
4. Call `setResolution(merkleRoot, payoutDenominator)` from `resolver` after `tradingClose`.
5. After `disputeEnd`, users call `claim(id, payoutNumerator, proof)` or `batchClaim`.

Helper script to set resolution:

```bash
export PRIVATE_KEY=...
export MARKET=0xMarketAddress
export MERKLE_ROOT=0x...
export PAYOUT_DENOM=10000

forge script script/Resolve.s.sol:ResolveMarket \
  --rpc-url $RPC_URL --broadcast -vvvv
```

Note: This MVP does not implement on-chain geometry or AMMs; the resolver supplies the Merkle root. To add continuous trading with on-chain pricing, extend with an AMM (e.g., LMSR or kernel-based bonding) that mints/burns ERC1155 shares per cell.
