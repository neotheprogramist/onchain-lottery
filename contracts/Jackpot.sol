// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IntervalTree.sol";

contract Jackpot is Context, Ownable, IntervalTree {
    event Deposit(uint amount);
    event Withdrawal(uint amount);
    event Winner(address winner);
    event FeeChanged(uint256 feeNumer, uint256 feeDenum);

    uint256 seed;

    uint256 devBalance;

    uint256 public threshold;
    uint256 public minAmount;
    address public token;
    uint256 public feeNumer;
    uint256 public feeDenum;
    mapping(address => uint) _balances;

    constructor(
        uint _threshold,
        uint256 _minAmount,
        address _token,
        uint256 _feeNumer,
        uint256 _feeDenum
    ) Ownable(_msgSender()) {
        seed = 0;
        devBalance = 0;
        threshold = _threshold;
        minAmount = _minAmount;
        token = _token;
        feeNumer = _feeNumer;
        feeDenum = _feeDenum;
        nodes[root] = Node({
            value: 0,
            left: address(0),
            leftSum: 0,
            right: address(0),
            rightSum: 0
        });
    }

    function setfee(uint256 _feeNumer, uint256 _feeDenum) external onlyOwner {
        feeNumer = _feeNumer;
        feeDenum = _feeDenum;
        emit FeeChanged(feeNumer, feeDenum);
    }

    function devWithdraw(address[] calldata accounts) external onlyOwner {
        uint256 amount = devBalance / accounts.length;
        for (uint256 i = 0; i < accounts.length; ++i) {
            IERC20(token).transfer(accounts[i], min(amount, devBalance));
            devBalance -= amount;
        }
    }

    function getUserBet(address account) external view returns (uint256) {
        return get(account);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function getTotalSum() external view returns (uint256) {
        return totalSum;
    }

    function withdraw(uint256 amount) external {
        require(_balances[_msgSender()] >= amount, "INSUFFICIENT_BALANCE");
        _balances[_msgSender()] -= amount;
        IERC20(token).transfer(_msgSender(), amount);
        emit Withdrawal(amount);
    }

    function deposit(uint256 amount) external {
        IERC20(token).transferFrom(_msgSender(), address(this), amount);
        _balances[_msgSender()] += amount;
    }

    function bet(uint256 amount) public {
        require(_balances[_msgSender()] >= amount, "INSUFFICIENT_BALANCE");
        uint256 reducedAmount = min(threshold - totalSum, amount);
        require(reducedAmount > 0, "PHASE_FULL");
        _balances[_msgSender()] -= reducedAmount;
        insert(_msgSender(), reducedAmount);

        if (totalSum == threshold) {
            uint256 rand = getRandomNumber(totalSum);
            address winner = getByPointOnInterval(rand);
            uint256 devPrize = (totalSum * feeNumer) / feeDenum;
            uint256 winnerPrize = totalSum - devPrize;
            clear();
            _balances[winner] += winnerPrize;
            devBalance += devPrize;
            emit Winner(winner);
            if (reducedAmount < amount) {
                bet(amount - reducedAmount);
            }
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function getRandomNumber(uint256 m) internal returns (uint256) {
        seed += 1;
        uint256 result = seed;
        uint256 max = ~uint256(0) - (~uint256(0) % totalSum);
        while (result >= max) {
            result = uint256(
                keccak256(
                    abi.encodePacked(
                        result,
                        _msgSender(),
                        block.prevrandao,
                        block.timestamp
                    )
                )
            );
        }
        return result % m;
    }
}
