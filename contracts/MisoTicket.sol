// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

// One MisoTicket contract is deployed per event. The backend wallet
// receives all four roles in the constructor and is the only signer of
// any on-chain action. Users never sign. Document this in CONTEXT.md.
contract MisoTicket is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant METADATA_ROLE = keccak256("METADATA_ROLE");
    bytes32 public constant ADMIN_TRANSFER_ROLE = keccak256("ADMIN_TRANSFER_ROLE");

    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => mapping(string => string)) public attributes;

    event AttributeSet(uint256 indexed tokenId, string key, string value);
    event AdminTransfer(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor(string memory name_, string memory symbol_, address admin)
        ERC721(name_, symbol_)
    {
        require(admin != address(0), "admin zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(METADATA_ROLE, admin);
        _grantRole(ADMIN_TRANSFER_ROLE, admin);
    }

    function mintTo(address to, uint256 tokenId, string calldata uri)
        external onlyRole(MINTER_ROLE)
    {
        _tokenURIs[tokenId] = uri;
        _safeMint(to, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    function setAttribute(uint256 tokenId, string calldata key, string calldata value)
        external onlyRole(METADATA_ROLE)
    {
        _requireOwned(tokenId);
        attributes[tokenId][key] = value;
        emit AttributeSet(tokenId, key, value);
    }

    function adminTransfer(address from, address to, uint256 tokenId)
        external onlyRole(ADMIN_TRANSFER_ROLE)
    {
        require(ownerOf(tokenId) == from, "wrong owner");
        _safeTransfer(from, to, tokenId);
        emit AdminTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
