import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Jackpot", function () {
  async function deploy() {
    const MINT_AMOUNT = 1_000_000_000n * 10n ** 18n;
    const THRESHOLD = 1_000_000n * 10n ** 18n;
    const MIN_AMOUNT = 1_000n * 10n ** 18n;
    const accounts = await ethers.getSigners();
    const owner = accounts[0];

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.connect(owner).deploy("Test Token", "TST");

    const Jackpot = await ethers.getContractFactory("Jackpot");
    const jackpot = await Jackpot.connect(owner).deploy(
      THRESHOLD,
      MIN_AMOUNT,
      await token.getAddress(),
      1,
      100
    );
    await jackpot.waitForDeployment();

    for (let i = 0; i < accounts.length; i += 1) {
      const account = accounts[i];
      await token.connect(owner).mint(account, MINT_AMOUNT);
      await token.connect(account).approve(jackpot, MINT_AMOUNT);
    }

    return { MINT_AMOUNT, THRESHOLD, token, jackpot, owner, accounts };
  }

  function generateRandomPermutation(n: number) {
    let result = new Array<number>();
    for (let i = 0; i < n; i += 1) {
      result.push(i);
    }

    for (let i = 0; i < n; i += 1) {
      let j = i + Math.floor((n - i) * Math.random());

      let tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }

    return result;
  }

  describe("Deployment", function () {
    it("Basic Token deployment", async function () {
      const { MINT_AMOUNT, token, accounts } = await loadFixture(deploy);
      const perm = generateRandomPermutation(accounts.length);
      for (let i = 0; i < perm.length; i += 1) {
        const idx = perm[i];
        const account = accounts[idx];
        expect(await token.balanceOf(account)).to.equal(MINT_AMOUNT);
      }
    });
  });

  describe("Test tree", () => {
    it("Empty tree search", async () => {
      const { jackpot } = await loadFixture(deploy);
      let result = await jackpot.getByPointOnInterval(0);
      expect(result).to.be.equal("0x0000000000000000000000000000000000000000");
    });

    it("Tree insertion", async () => {
      const { jackpot, accounts } = await loadFixture(deploy);
      let account = accounts[1];
      await jackpot.insert(account, 100n * 10n ** 18n);
      let result = await jackpot.getByPointOnInterval(0);
      expect(result).to.be.equal(account.address);
    });

    it("Tree generative test many accounts", async () => {
      const { jackpot, accounts } = await loadFixture(deploy);
      let n = 10;
      let x = new Array();
      for (let i = 0; i < n; i += 1) {
        let v = BigInt(Math.floor(1 + 99 * Math.random()));
        x.push(v);
      }
      const sum = x.reduce((partialSum, a) => partialSum + BigInt(a), 0n);

      for (let i = 0; i < n; i += 1) {
        await jackpot.insert(accounts[i].address, x[i]);
      }
      let m = new Map<string, bigint>();
      for (let i = 0; i < n; i += 1) {
        m.set(accounts[i].address, 0n);
      }

      for (let i = 0; i < sum; i += 1) {
        let acc = await jackpot.getByPointOnInterval(i);
        m.set(acc, m.get(acc)! + 1n);
      }

      for (let i = 0; i < n; i += 1) {
        expect(m.get(accounts[i].address)).to.be.equal(x[i]);
      }
    });

    it("Complex generative test many accounts", async () => {
      const { jackpot, accounts } = await loadFixture(deploy);
      let n = 40;
      let vals = new Map<string, bigint>();
      let sum = 0n;
      let accs = new Array<string>();
      while (n--) {
        let acc = accounts[Math.floor(accounts.length * Math.random())].address;
        let val = BigInt(Math.floor(1 + 4 * Math.random()));
        sum += val;

        if (vals.get(acc)) {
          vals.set(acc, vals.get(acc)! + val);
        } else {
          vals.set(acc, val);
          accs.push(acc);
        }
        await jackpot.insert(acc, val);

        let x = new Map<string, bigint>();
        for (let i = 0; i < sum; i += 1) {
          let acc = await jackpot.getByPointOnInterval(i);

          if (x.get(acc)) {
            x.set(acc, x.get(acc)! + 1n);
          } else {
            x.set(acc, 1n);
          }
        }

        generateRandomPermutation(accs.length).forEach((i) => {
          expect(vals.get(accs[i])).to.be.equal(x.get(accs[i]));
        });
        expect(x.get("0x0000000000000000000000000000000000000000")).to.be
          .undefined;
      }
    });
  });

  describe("Jackpot", () => {
    it("Deposit", async () => {
      const value = 13n * 10n ** 18n;
      const { owner, jackpot } = await loadFixture(deploy);
      await jackpot.deposit(value);
      expect(await jackpot.balanceOf(owner.address)).to.equal(value);
    });
    it("Simple bet scenario instant execution", async () => {
      const { jackpot, THRESHOLD, owner } = await loadFixture(deploy);
      await jackpot.deposit(THRESHOLD);
      expect(await jackpot.balanceOf(owner.address)).to.be.equal(THRESHOLD);
      await expect(jackpot.bet(THRESHOLD))
        .to.emit(jackpot, "Bet")
        .withArgs(owner.address, THRESHOLD)
        .to.emit(jackpot, "Clear")
        .to.emit(jackpot, "Winner")
        .withArgs(owner.address);
      expect(await jackpot.balanceOf(owner.address)).to.be.equal(
        (THRESHOLD * 99n) / 100n
      );
    });

    it("Simple bet scenario no execution", async () => {
      const { jackpot, owner } = await loadFixture(deploy);
      const amount = 10n ** 18n;
      await jackpot.deposit(amount);
      expect(await jackpot.balanceOf(owner.address)).to.be.equal(amount);
      expect(await jackpot.getUserBet(owner.address)).to.be.equal(0n);
      await expect(jackpot.bet(amount))
        .to.emit(jackpot, "Bet")
        .withArgs(owner.address, amount);
      expect(await jackpot.balanceOf(owner.address)).to.be.equal(0n);
      expect(await jackpot.getUserBet(owner.address)).to.be.equal(amount);
    });

    it("Unusual scenario over THRESHOLD", async () => {
      const { jackpot, THRESHOLD, owner } = await loadFixture(deploy);
      const amount = 5n * THRESHOLD + 100n;

      await jackpot.deposit(amount);

      expect(await jackpot.balanceOf(owner.address)).to.be.equal(amount);
      await expect(jackpot.bet(amount))
        .to.emit(jackpot, "Bet")
        .withArgs(owner.address, THRESHOLD)
        .to.emit(jackpot, "Winner")
        .withArgs(owner.address)
        .to.emit(jackpot, "Bet")
        .withArgs(owner.address, 100n);
      expect(await jackpot.balanceOf(owner.address)).to.be.equal(
        ((amount / THRESHOLD) * THRESHOLD * 99n) / 100n
      );
    });

    it("Simple bet scenario 2 accounts", async () => {
      const { jackpot, THRESHOLD, accounts } = await loadFixture(deploy);
      const amount1 = THRESHOLD / 2n;
      const amount2 = THRESHOLD - amount1;

      await jackpot.connect(accounts[1]).deposit(amount1);
      await jackpot.connect(accounts[2]).deposit(amount2);

      expect(
        await jackpot.connect(accounts[1]).balanceOf(accounts[1].address)
      ).to.be.equal(amount1);
      expect(
        await jackpot.connect(accounts[2]).balanceOf(accounts[2].address)
      ).to.be.equal(amount2);

      await jackpot.connect(accounts[1]).bet(amount1);
      expect(
        await jackpot.connect(accounts[1]).balanceOf(accounts[1].address)
      ).to.be.equal(0n);
      expect(
        await jackpot.connect(accounts[2]).balanceOf(accounts[2].address)
      ).to.be.equal(amount2);

      await jackpot.connect(accounts[2]).bet(amount2);

      if (
        !(
          (await jackpot.connect(accounts[1]).balanceOf(accounts[1].address)) ==
            (THRESHOLD * 99n) / 100n ||
          (await jackpot.connect(accounts[2]).balanceOf(accounts[2].address)) ==
            (THRESHOLD * 99n) / 100n
        )
      ) {
        expect(true).to.be.false;
      }
    });
  });

  describe("Jackpot Balances", () => {
    it("Initial Balances", async () => {
      const { owner, jackpot, accounts } = await loadFixture(deploy);
      const perm = generateRandomPermutation(accounts.length);
      for (let i = 0; i < perm.length; i += 1) {
        const idx = perm[i];
        const account = accounts[idx];
        expect(
          await jackpot.connect(account).balanceOf(owner.address)
        ).to.equal(0n);
      }
    });

    it("Random Deposits", async () => {
      const { owner, jackpot, accounts } = await loadFixture(deploy);
      let n = 40;
      let vals = new Map<string, bigint>();
      let sum = 0n;
      while (n--) {
        const account = accounts[Math.floor(accounts.length * Math.random())];
        let val = BigInt(Math.floor(1 + 4 * Math.random())) * 10n ** 18n;
        sum += val;

        if (vals.get(account.address)) {
          vals.set(account.address, vals.get(account.address)! + val);
        } else {
          vals.set(account.address, val);
        }
        await jackpot.connect(account).deposit(val);

        const perm = generateRandomPermutation(accounts.length);
        for (let i = 0; i < perm.length; i += 1) {
          const idx = perm[i];
          const acc = accounts[idx];
          const balance = await jackpot.connect(acc).balanceOf(acc.address);
          expect(balance).to.be.equal(vals.get(acc.address) || 0n);
        }
      }
    });
  });
});
