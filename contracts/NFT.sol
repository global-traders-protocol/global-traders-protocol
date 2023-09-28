// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./mixins/RoleControl.sol";
import "./mixins/cryptography.sol";

contract NFT is ERC721, RoleControl, SignatureControl {
    uint256 supply;
    uint256 public totalSupply;

    IERC20 public paymentToken;
    IERC20 public feeToken;

    uint256 refPayId;

    bool public feeIsActive;
    uint256 public nestingFee;

    mapping(uint256 => bool) usedNonces;
    mapping(address => address[]) userToReferrers;
    mapping(uint256 => string) tokenIdToMetadata;
    mapping(uint256 => bool) nestingStatus;
    mapping(address => uint256) public userToCurrentlyNestedToken;
    mapping(uint256 => uint256) public tokenIdToPlan;
    mapping(uint256 => uint256) public tokenIdToPrice;
    mapping(uint256 => ReferralPayment) referralPayments;

    uint256[] planPrices = [0.01 ether, 0.02 ether, 0.03 ether, 0.04 ether];
    string[] planMetadata = [
        "ipfs://QmYcR8piEwoSNUAksgeNq6Pjv8wTHygv8VDWE84ywx6YfG",
        "ipfs://QmVPQ4c1xoFHbB1iZnnvqvfFqTLhPzjbTKWk5FCffuDS8i",
        "ipfs://QmNZCW4ZrKDWGFCUxZK8AHgyhECwwGh3fonnM3uY365rdR",
        "ipfs://QmdZx1UW19GUdjcA3uR8qtzoYnmrtH3EqjWDJsTx1MuLD2"
    ];
    uint256[] refPercentsBasisPoints = [500, 250, 100];

    struct ReferralPayment {
        address[] referrers;
        uint256[] amounts;
    }

    event NestingToggled(address user, uint256 tokenId, bool state, string metadata);

    event PlanBought(
        address buyer,
        uint256 tokenId,
        uint256 plan
    );

    event PlanBought(
        address buyer,
        uint256 tokenId,
        uint256 plan,
        uint256 refId,
        address[] referrers,
        uint256[] amounts
    );

    event ReferralPaymentMade(
        uint256 paymentId
    );

    modifier isValidNesting(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            userToCurrentlyNestedToken[msg.sender] == tokenId ||
                userToCurrentlyNestedToken[msg.sender] == 0,
            "Can't toggle nesting when another token is nested"
        );
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        IERC20 _paymentToken,
        address admin,
        address operator
    ) ERC721(_name, _symbol) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(OPERATOR_ROLE, operator);
        paymentToken = _paymentToken;
    }

    function _writeRefs(address referrer) internal {
        if (userToReferrers[msg.sender].length == 0) {
            if (referrer != address(0)) {
                userToReferrers[msg.sender].push(referrer);
                if (
                    userToReferrers[referrer].length > 0 &&
                    userToReferrers[referrer][0] != address(0)
                ) {
                    userToReferrers[msg.sender].push(
                        userToReferrers[referrer][0]
                    );
                    if (userToReferrers[referrer].length > 1) {
                        userToReferrers[msg.sender].push(
                            userToReferrers[referrer][1]
                        );
                    }
                }
            } else {
                userToReferrers[msg.sender].push(address(0));
            }
        }
    }

    function mint(uint256 plan, address referrer) public {
        require(plan <= planPrices.length - 1, "Non-existant plan selected");
        _writeRefs(referrer);
        supply++;
        totalSupply++;
        _safeMint(msg.sender, supply);
        tokenIdToMetadata[supply] = planMetadata[plan];
        paymentToken.transferFrom(msg.sender, address(this), planPrices[plan]);
        tokenIdToPlan[supply] = plan;
        tokenIdToPrice[supply] = planPrices[plan];
        if(userToReferrers[msg.sender][0] != address(0)) {
            refPayId++;
            ReferralPayment memory payment = referralPayments[refPayId];
            payment.referrers = userToReferrers[msg.sender];
            payment.amounts = new uint256[](userToReferrers[msg.sender].length);
            for (uint256 i = 0; i < userToReferrers[msg.sender].length; i++) {
                if (userToReferrers[msg.sender][i] != address(0)) {
                    payment.amounts[i] = (planPrices[plan] *
                        refPercentsBasisPoints[i]) / 10000;
                }
            }
            emit PlanBought(msg.sender, supply, plan, refPayId, userToReferrers[msg.sender], payment.amounts);
        } else {
            emit PlanBought(msg.sender, supply, plan);
        }
        if (userToCurrentlyNestedToken[msg.sender] == 0) {
            _toggleNesting(supply);
        }
    }


    function _toggleNesting(uint256 tokenId) internal {
        if (isCurrentlyNested(tokenId)) {
            userToCurrentlyNestedToken[ownerOf(tokenId)] = 0;
        } else {
            userToCurrentlyNestedToken[ownerOf(tokenId)] = tokenId;
        }
        nestingStatus[tokenId] = !nestingStatus[tokenId];
        emit NestingToggled(msg.sender, tokenId, nestingStatus[tokenId], tokenURI(tokenId));
    }

    function enableNesting(uint256 tokenId) public isValidNesting(tokenId) {
        require(!isCurrentlyNested(tokenId), "Token is already nested");
        _toggleNesting(tokenId);
    }

    function disableNesting(
        bytes memory signature,
        uint256 nonce,
        uint256 timestamp,
        uint256 tokenId,
        string memory metadata
    ) public isValidNesting(tokenId) {
        if(feeIsActive) {
            feeToken.transferFrom(msg.sender, address(this), nestingFee);
        }
        require(isCurrentlyNested(tokenId), "Token is not nested");
        require(!usedNonces[nonce], "Nonce already used");
        require(
            block.timestamp <= timestamp + 20,
            "Must call function within 20 seconds"
        );

        address signer = getSigner(signature, nonce, timestamp, tokenId, metadata);
        require(isOperator(signer), "Signer must be operator");
        usedNonces[nonce] = true;
        tokenIdToMetadata[tokenId] = metadata;
        _toggleNesting(tokenId);
    }
    
    function payReferrers(uint256[] memory refIds)
        public
        onlyAdmin
    {
        for (uint256 i = 0; i < refIds.length; i++) {
            ReferralPayment memory payment = referralPayments[refIds[i]];
            for (uint256 j = 0; j < payment.referrers.length; j++) {
                if (payment.referrers[j] != address(0)) {
                    paymentToken.transfer(
                        payment.referrers[j],
                        payment.amounts[j]
                    );
                }
            }
            emit ReferralPaymentMade(refIds[i]);
        }
    }

    function withdraw(address to, uint256 amount, IERC20 token)
        public
        onlyAdmin
    {
        token.transfer(to, amount);
    }

    function updatePrices(uint256[] memory newPrices) public onlyAdmin {
        require(newPrices.length == planPrices.length, "Invalid array length");
        planPrices = newPrices;
    }

    function changePaymentToken(IERC20 newPaymentToken) public onlyAdmin {
        paymentToken = newPaymentToken;
    }

    function enableFee(IERC20 _feeToken) public onlyAdmin {
        feeToken = _feeToken;
        feeIsActive = true;
    }

    function disableFee() public onlyAdmin {
        feeIsActive = false;
        delete feeToken;
    }

    function changeFee(uint256 newFee) public onlyAdmin {
        nestingFee = newFee;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        require(!nestingStatus[tokenId], "Can't transfer nested tokens");
    }

    function getPrices() public view returns (uint256[] memory) {
        return planPrices;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        return tokenIdToMetadata[tokenId];
    }

    function isCurrentlyNested(uint256 tokenId) public view returns (bool) {
        return nestingStatus[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl, ERC721)
        returns (bool)
    {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(AccessControl).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function changeRefPercents(uint256[] memory newPercents)
        public
        onlyAdmin
    {
        require(
            newPercents.length == refPercentsBasisPoints.length,
            "Invalid array length"
        );
        refPercentsBasisPoints = newPercents;
    }

}