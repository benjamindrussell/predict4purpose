// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MerkleProof
/// @notice Minimal Merkle proof verification utilities (single-branch)
library MerkleProof {
  /// @notice Verifies that a leaf is part of a Merkle tree defined by `root`.
  /// @param proof The Merkle proof containing sibling hashes on the branch from the leaf to the root of the tree
  /// @param root The Merkle root
  /// @param leaf The leaf to verify (already hashed to bytes32)
  /// @return True if the proof is valid and the leaf is part of the tree defined by `root`
  function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
    return processProof(proof, leaf) == root;
  }

  /// @notice Rebuilds hash obtained by traversing a Merkle tree up from `leaf` using `proof`.
  function processProof(bytes32[] memory proof, bytes32 leaf) internal pure returns (bytes32 computedHash) {
    computedHash = leaf;
    for (uint256 i = 0; i < proof.length; i++) {
      bytes32 proofElement = proof[i];
      if (computedHash <= proofElement) {
        // Hash(current computed hash + current element of the proof)
        computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
      } else {
        // Hash(current element of the proof + current computed hash)
        computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
      }
    }
  }
}


