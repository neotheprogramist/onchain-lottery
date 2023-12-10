// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract IntervalTree {
    event Bet(address account, uint256 amount);
    event Clear();

    struct Node {
        uint256 value;
        address left;
        uint256 leftSum;
        address right;
        uint256 rightSum;
    }

    address root = address(0x7fFFfFfFFFfFFFFfFffFfFfFfffFFfFfFffFFFFf);
    uint256 totalSum;

    mapping(address => Node) nodes;
    address[] keys;

    constructor() {
        totalSum = 0;
    }

    function insert(address account, uint256 amount) public {
        address parent = address(0);
        address key = root;
        while (key != address(0)) {
            parent = key;

            if (parent == account) {
                break;
            } else if (parent > account) {
                nodes[parent].leftSum += amount;
                key = nodes[parent].left;
                if (key == address(0)) {
                    nodes[parent].left = account;
                }
            } else {
                nodes[parent].rightSum += amount;
                key = nodes[parent].right;
                if (key == address(0)) {
                    nodes[parent].right = account;
                }
            }
        }
        if (key == address(0)) {
            nodes[account].value = amount;
            keys.push(account);
        } else {
            nodes[key].value += amount;
        }
        totalSum += amount;
        emit Bet(account, amount);
    }

    function get(address account) public view returns (uint256) {
        address parent = address(0);
        address key = root;
        while (key != address(0)) {
            parent = key;

            if (parent == account) {
                break;
            } else if (parent > account) {
                key = nodes[parent].left;
            } else {
                key = nodes[parent].right;
            }
        }
        return nodes[key].value;
    }

    function getByPointOnInterval(uint256 value) public view returns (address) {
        address key = root;
        while (key != address(0)) {
            if (value < nodes[key].leftSum) {
                key = nodes[key].left;
            } else if (value < nodes[key].leftSum + nodes[key].value) {
                break;
            } else {
                value -= nodes[key].leftSum + nodes[key].value;
                key = nodes[key].right;
            }
        }
        return key;
    }

    function clear() public {
        for (uint256 i = 0; i < keys.length; ++i) {
            delete nodes[keys[i]];
        }
        delete keys;
        nodes[root].left = address(0);
        nodes[root].leftSum = 0;
        nodes[root].right = address(0);
        nodes[root].rightSum = 0;
        totalSum = 0;
        emit Clear();
    }
}
