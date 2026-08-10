// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title IntentRegistry
/// @notice Anchors intent commitments and verifier attestations. Full documents live on 0G Storage.
/// @dev Immutable in Wave 3 — no proxy. Trust model: VERIFIER_ROLE is a known oracle key.
contract IntentRegistry is AccessControl, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    bytes32 public constant INTENT_TYPEHASH =
        keccak256(
            "IntentRegistration(bytes32 intentHash,address principal,bytes32 agentId,uint64 createdAt,uint64 expiresAt,uint256 nonce)"
        );

    bytes32 public constant VERIFICATION_TYPEHASH =
        keccak256(
            "VerificationAttestation(bytes32 intentId,bytes32 intentHash,bytes32 agentId,bytes32 actionHash,bytes32 evidenceRoot,uint8 verdict,uint16 alignmentBps,uint16 confidenceBps,uint256 nonce,uint64 expiry,bytes32 settlementBinding)"
        );

    uint8 public constant STATUS_NONE = 0;
    uint8 public constant STATUS_ACTIVE = 1;
    uint8 public constant STATUS_INVALIDATED = 2;

    uint8 public constant VERDICT_NONE = 0;
    uint8 public constant VERDICT_APPROVE = 1;
    uint8 public constant VERDICT_REJECT = 2;
    uint8 public constant VERDICT_CHALLENGE = 3;

    struct IntentRecord {
        bytes32 intentHash;
        address principal;
        bytes32 agentId;
        uint64 createdAt;
        uint64 expiresAt;
        uint8 status;
    }

    struct Verification {
        bytes32 actionHash;
        bytes32 evidenceRoot;
        uint8 verdict;
        uint16 alignmentBps;
        uint16 confidenceBps;
        uint64 timestamp;
        bytes32 settlementBinding;
    }

    mapping(bytes32 => IntentRecord) public intents;
    mapping(bytes32 => mapping(bytes32 => Verification)) public verifications;
    mapping(address => uint256) public principalNonce;
    mapping(bytes32 => uint256) public intentNonce;

    event IntentRegistered(
        bytes32 indexed intentId,
        bytes32 intentHash,
        address indexed principal,
        bytes32 agentId,
        uint64 expiresAt
    );
    event VerificationRecorded(
        bytes32 indexed intentId,
        bytes32 indexed actionHash,
        uint8 verdict,
        bytes32 evidenceRoot,
        bytes32 settlementBinding
    );
    event IntentInvalidated(bytes32 indexed intentId, address indexed principal);

    error IntentExists();
    error IntentMissing();
    error IntentNotActive();
    error IntentExpired();
    error InvalidSigner();
    error InvalidNonce();
    error AttestationExpired();
    error ZeroAddress();
    error HashMismatch();

    constructor(address admin, address oracle) EIP712("INTENTOS IntentRegistry", "1") {
        if (admin == address(0) || oracle == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, oracle);
    }

    function registerIntent(
        IntentRecord calldata record,
        uint256 nonce,
        bytes calldata principalSig
    ) external {
        bytes32 intentId = record.intentHash;
        if (intents[intentId].status != STATUS_NONE) revert IntentExists();
        if (record.principal == address(0)) revert ZeroAddress();
        if (record.expiresAt <= block.timestamp) revert IntentExpired();
        if (nonce != principalNonce[record.principal]) revert InvalidNonce();

        bytes32 structHash = keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                record.intentHash,
                record.principal,
                record.agentId,
                record.createdAt,
                record.expiresAt,
                nonce
            )
        );
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), principalSig);
        if (signer != record.principal) revert InvalidSigner();

        principalNonce[record.principal] = nonce + 1;
        intents[intentId] = IntentRecord({
            intentHash: record.intentHash,
            principal: record.principal,
            agentId: record.agentId,
            createdAt: record.createdAt,
            expiresAt: record.expiresAt,
            status: STATUS_ACTIVE
        });

        emit IntentRegistered(intentId, record.intentHash, record.principal, record.agentId, record.expiresAt);
    }

    function recordVerification(
        bytes32 intentId,
        Verification calldata v,
        uint256 nonce,
        uint64 expiry,
        bytes32 intentHash,
        bytes32 agentId,
        bytes calldata oracleSig
    ) external onlyRole(VERIFIER_ROLE) {
        IntentRecord storage rec = intents[intentId];
        if (rec.status == STATUS_NONE) revert IntentMissing();
        if (rec.status != STATUS_ACTIVE) revert IntentNotActive();
        if (block.timestamp > rec.expiresAt) revert IntentExpired();
        if (block.timestamp > expiry) revert AttestationExpired();
        if (nonce != intentNonce[intentId]) revert InvalidNonce();
        if (rec.intentHash != intentHash) revert HashMismatch();
        if (rec.agentId != agentId) revert HashMismatch();

        bytes32 structHash = keccak256(
            abi.encode(
                VERIFICATION_TYPEHASH,
                intentId,
                intentHash,
                agentId,
                v.actionHash,
                v.evidenceRoot,
                v.verdict,
                v.alignmentBps,
                v.confidenceBps,
                nonce,
                expiry,
                v.settlementBinding
            )
        );
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), oracleSig);
        if (!hasRole(VERIFIER_ROLE, signer)) revert InvalidSigner();

        intentNonce[intentId] = nonce + 1;
        verifications[intentId][v.actionHash] = Verification({
            actionHash: v.actionHash,
            evidenceRoot: v.evidenceRoot,
            verdict: v.verdict,
            alignmentBps: v.alignmentBps,
            confidenceBps: v.confidenceBps,
            timestamp: uint64(block.timestamp),
            settlementBinding: v.settlementBinding
        });

        emit VerificationRecorded(intentId, v.actionHash, v.verdict, v.evidenceRoot, v.settlementBinding);
    }

    function invalidateIntent(bytes32 intentId) external {
        IntentRecord storage rec = intents[intentId];
        if (rec.status == STATUS_NONE) revert IntentMissing();
        if (msg.sender != rec.principal && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert InvalidSigner();
        rec.status = STATUS_INVALIDATED;
        emit IntentInvalidated(intentId, rec.principal);
    }

    function isApproved(bytes32 intentId, bytes32 actionHash) public view returns (bool) {
        IntentRecord storage rec = intents[intentId];
        if (rec.status != STATUS_ACTIVE) return false;
        if (block.timestamp > rec.expiresAt) return false;
        return verifications[intentId][actionHash].verdict == VERDICT_APPROVE;
    }

    function getSettlementBinding(bytes32 intentId, bytes32 actionHash) external view returns (bytes32) {
        return verifications[intentId][actionHash].settlementBinding;
    }

    function getIntent(bytes32 intentId) external view returns (IntentRecord memory) {
        return intents[intentId];
    }

    function getVerification(bytes32 intentId, bytes32 actionHash) external view returns (Verification memory) {
        return verifications[intentId][actionHash];
    }
}
