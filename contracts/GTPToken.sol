//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract GTP is ERC20 {
    constructor() ERC20("GT-Protocol Token", "GTP") {
        _mint(msg.sender, 100_000_000 * 10**18);
    }
}
