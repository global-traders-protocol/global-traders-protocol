//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.11;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract GTPBase is ERC20, Ownable {
    bool private _paused;
    mapping(address => bool) private whitelist;
    event AddedToWhitelist(address indexed account);
    constructor() ERC20("GT-Protocol Token", "GTP") Ownable() {
        _mint(msg.sender, 100_000_000 * 10**18);
        _paused = true;
    }
    function addToWhitelist(address _address) public onlyOwner {
        whitelist[_address] = true;
        emit AddedToWhitelist(_address);
    }
    function start() public onlyOwner {
        _paused = false;
    }
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        if (_paused) {
            require(whitelist[msg.sender], "GTP: token transfer while paused");
        }
    }
}
