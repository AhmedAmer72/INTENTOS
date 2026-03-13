// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title IntentosAgenticIdV2
/// @notice ERC-7857-shaped minter with oracle-gated transfer/clone. v1 on Galileo is left as-is.
contract IntentosAgenticIdV2 is ERC721, Ownable, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant TRANSFER_TYPEHASH =
        keccak256(
            "TransferAttestation(uint256 tokenId,address from,address to,bytes32 newMetadataHash,bytes32 uriHash)"
        );
    bytes32 public constant CLONE_TYPEHASH =
        keccak256(
            "CloneAttestation(uint256 tokenId,address from,address to,bytes32 newMetadataHash,bytes32 uriHash)"
        );

    uint256 private _nextTokenId = 1;
    address public immutable oracle;

    mapping(uint256 => string) private _encryptedURIs;
    mapping(uint256 => bytes32) private _metadataHashes;
    mapping(uint256 => bytes) private _sealedKeys;
    mapping(uint256 => mapping(address => bytes)) private _authorizations;

    event MetadataSet(uint256 indexed tokenId, bytes32 metadataHash, string encryptedURI);
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor);
    event SealedKeySet(uint256 indexed tokenId);

    error ZeroAddress();
    error NotOwner();
    error BadProof();
    error UnknownToken();

    constructor(address oracle_) ERC721("INTENTOS Agentic ID v2", "INTAID2") EIP712("INTENTOS AgenticId", "1") {
        if (oracle_ == address(0)) revert ZeroAddress();
        oracle = oracle_;
    }

    function mint(address to, string calldata encryptedURI, bytes32 metadataHash) external onlyOwner returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _encryptedURIs[tokenId] = encryptedURI;
        _metadataHashes[tokenId] = metadataHash;
        emit MetadataSet(tokenId, metadataHash, encryptedURI);
        return tokenId;
    }

    function authorizeUsage(uint256 tokenId, address executor, bytes calldata permissions) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        _authorizations[tokenId][executor] = permissions;
        emit UsageAuthorized(tokenId, executor);
    }

    /// @dev proof = abi.encode(newMetadataHash, newEncryptedURI, oracleSig)
    function transfer(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external {
        if (ownerOf(tokenId) != from) revert NotOwner();
        if (msg.sender != from) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();
        (bytes32 newHash, string memory newURI) = _verify(TRANSFER_TYPEHASH, tokenId, from, to, proof);
        _encryptedURIs[tokenId] = newURI;
        _metadataHashes[tokenId] = newHash;
        _sealedKeys[tokenId] = sealedKey;
        _transfer(from, to, tokenId);
        emit MetadataSet(tokenId, newHash, newURI);
        emit SealedKeySet(tokenId);
    }

    function clone(
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external returns (uint256) {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();
        (bytes32 newHash, string memory newURI) = _verify(CLONE_TYPEHASH, tokenId, msg.sender, to, proof);
        uint256 newId = _nextTokenId++;
        _safeMint(to, newId);
        _encryptedURIs[newId] = newURI;
        _metadataHashes[newId] = newHash;
        _sealedKeys[newId] = sealedKey;
        emit MetadataSet(newId, newHash, newURI);
        emit SealedKeySet(newId);
        return newId;
    }

    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
        if (!_exists(tokenId)) revert UnknownToken();
        return _encryptedURIs[tokenId];
    }

    function getMetadataHash(uint256 tokenId) external view returns (bytes32) {
        if (!_exists(tokenId)) revert UnknownToken();
        return _metadataHashes[tokenId];
    }

    function sealedKeyOf(uint256 tokenId) external view returns (bytes memory) {
        if (!_exists(tokenId)) revert UnknownToken();
        return _sealedKeys[tokenId];
    }

    function authorizationOf(uint256 tokenId, address executor) external view returns (bytes memory) {
        return _authorizations[tokenId][executor];
    }

    function _verify(
        bytes32 typehash,
        uint256 tokenId,
        address from,
        address to,
        bytes calldata proof
    ) internal view returns (bytes32 newHash, string memory newURI) {
        bytes memory sig;
        (newHash, newURI, sig) = abi.decode(proof, (bytes32, string, bytes));
        bytes32 structHash = keccak256(
            abi.encode(typehash, tokenId, from, to, newHash, keccak256(bytes(newURI)))
        );
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), sig);
        if (signer != oracle) revert BadProof();
    }
}
