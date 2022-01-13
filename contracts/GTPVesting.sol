// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vesting is Ownable {
    using SafeERC20 for IERC20;

    /// @notice GTP token contract
    IERC20 public immutable gtp;

    struct VestingParams {
        uint256 amount;
        uint256 vestingBegin;
        uint256 vestingEnd;
        uint256 lastUpdate;
        uint256 claimed;
    }

    /// @notice Mapping of IDs to vesting params
    mapping(uint256 => VestingParams) public vestings;

    /// @notice Mapping of addresses to lists of their vesting IDs
    mapping(address => uint256[]) public vestingIds;

    /// @notice Total amount of vested tokens
    uint256 public totalVest;

    /// @notice Next vesting object ID
    uint256 private _nextVestingId;

    struct HoldParams {
        address recipient;
        uint256 amount;
        uint256 unlocked;
        uint256 vestingBegin;
        uint256 vestingEnd;
    }

    // CONSTRUCTOR

    /**
     * @notice Contract constructor
     * @param gtp_ Address of the GTP token contract
     */
    constructor(IERC20 gtp_) Ownable() {
        gtp = gtp_;
    }

    /**
     * @notice Function to claim tokens
     * @param account Address to claim tokens for
     */
    function claim(address account) external {
        uint256 totalAmount;
        for (uint8 i = 0; i < vestingIds[account].length; i++) {
            uint256 amount = getAvailableBalance(vestingIds[account][i]);
            if (amount > 0) {
                totalAmount += amount;
                vestings[vestingIds[account][i]].claimed += amount;
                vestings[vestingIds[account][i]].lastUpdate = block.timestamp;
            }
        }
        gtp.safeTransfer(account, totalAmount);
    }

    // RESTRICTED FUNCTIONS

    /**
     * @notice Owner function to hold tokens to a batch of accounts
     * @param params List of HoldParams objects with vesting params
     */
    function holdTokens(HoldParams[] memory params) external onlyOwner {
        uint256 totalAmount;
        for (uint8 i = 0; i < params.length; i++) {
            totalAmount += params[i].amount;
        }
        gtp.safeTransferFrom(msg.sender, address(this), totalAmount);
        totalVest += totalAmount;
        for (uint8 i = 0; i < params.length; i++) {
            _holdTokens(params[i]);
        }
    }

    /**
     * @notice Function gets total amount of available for claim tokens for account
     * @param account Account to calculate amount for
     * @return amount Total amount of available tokens
     */
    function getAvailableBalanceOf(address account)
        external
        view
        returns (uint256 amount)
    {
        for (uint8 i = 0; i < vestingIds[account].length; i++) {
            amount += getAvailableBalance(vestingIds[account][i]);
        }
    }

    /**
     * @notice Function gets amount of available for claim tokens in exact vesting object
     * @param id ID of the vesting object
     * @return Amount of available tokens
     */
    function getAvailableBalance(uint256 id) public view returns (uint256) {
        VestingParams memory vestParams = vestings[id];
        uint256 amount;
        if (block.timestamp >= vestParams.vestingEnd) {
            amount = vestParams.amount - vestParams.claimed;
        } else {
            amount =
                (vestParams.amount *
                    (block.timestamp - vestParams.lastUpdate)) /
                (vestParams.vestingEnd - vestParams.vestingBegin);
        }
        return amount;
    }

    /**
     * @notice Function gets amount of vesting objects for account
     * @param account Address of account
     * @return Amount of vesting objects
     */
    function vestingCountOf(address account) external view returns (uint256) {
        return vestingIds[account].length;
    }

    // PRIVATE FUNCTIONS

    /**
     * @notice Private function to hold tokens for one account
     * @param params HoldParams object with vesting params
     */
    function _holdTokens(HoldParams memory params) private {
        require(
            params.amount > 0,
            "Vesting::holdTokens: can not hold zero amount"
        );
        require(
            params.vestingEnd > params.vestingBegin,
            "Vesting::holdTokens: end earlier than begin"
        );
        require(
            params.unlocked <= params.amount,
            "Vesting::holdTokens: unlocked can not be greater than amount"
        );

        if (params.unlocked > 0) {
            gtp.transfer(params.recipient, params.unlocked);
        }
        if (params.unlocked < params.amount) {
            vestings[_nextVestingId] = VestingParams({
                amount: params.amount - params.unlocked,
                vestingBegin: params.vestingBegin,
                vestingEnd: params.vestingEnd,
                lastUpdate: params.vestingBegin,
                claimed: 0
            });
            vestingIds[params.recipient].push(_nextVestingId);
            _nextVestingId++;
        }
    }
}
