// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title IntentosAgenticId
/// @notice Minimal ERC-7857-shaped token: encrypted metadata URI + hash + usage authorization.
/// @dev Full TEE re-encryption on transfer is out of scope; mint + store + authorize is the Wave 4 slice.
contract IntentosAgenticId is ERC721, Ownable {
    uint256 private _nextTokenId = 1;

    mapping(uint256 => string) private _encryptedURIs;
    mapping(uint256 => bytes32) private _metadataHashes;
    mapping(uint256 => mapping(address => bytes)) private _authorizations;

    event MetadataSet(uint256 indexed tokenId, bytes32 metadataHash, string encryptedURI);
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor);

    constructor() ERC721("INTENTOS Agentic ID", "INTAID") {}

    function mint(address to, string calldata encryptedURI, bytes32 metadataHash) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _encryptedURIs[tokenId] = encryptedURI;
        _metadataHashes[tokenId] = metadataHash;
        emit MetadataSet(tokenId, metadataHash, encryptedURI);
        return tokenId;
    }

    function authorizeUsage(uint256 tokenId, address executor, bytes calldata permissions) external {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        _authorizations[tokenId][executor] = permissions;
        emit UsageAuthorized(tokenId, executor);
    }

    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "unknown token");
        return _encryptedURIs[tokenId];
    }

    function getMetadataHash(uint256 tokenId) external view returns (bytes32) {
        require(_exists(tokenId), "unknown token");
        return _metadataHashes[tokenId];
    }

    function authorizationOf(uint256 tokenId, address executor) external view returns (bytes memory) {
        return _authorizations[tokenId][executor];
    }
}
