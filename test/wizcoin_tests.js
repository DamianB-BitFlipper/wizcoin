const { getProgram } = require('@algo-builder/algob');
const { Runtime, AccountStore, types } = require('@algo-builder/runtime');
const { assert } = require('chai');

const masterBalance = 10000e6; //10000 ALGO's
const minBalance = 100e6; // 100 ALGO's
const aliceAddr = 'EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY';
const bobAddr = '2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ';
const initialCreatorBalance = minBalance + 0.01e6;

const WZC_total = 69n;

describe('WizCoin Tests', function () {
  let master;
  let alice;
  let bob;
  let token_issuer;
  let tokenIssuerLsig;

  let runtime;
  let assetId;
  let applicationId;

  // Update account state
  function syncAccounts() {
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);

    if (token_issuer) {
      token_issuer = runtime.getAccount(token_issuer.address);
    }
  }

  const getTokenIssuerProg = assetId =>
    getProgram('token_issuer.py', { assetId: assetId });

  this.beforeEach(async function () {
    master = new AccountStore(masterBalance);
    alice = new AccountStore(minBalance, {
      addr: aliceAddr,
      sk: new Uint8Array(0),
    });
    bob = new AccountStore(minBalance, {
      addr: bobAddr,
      sk: new Uint8Array(0),
    });
    runtime = new Runtime([master, alice, bob]);

    // Create new ASA
    assetId = runtime.addAsset('wizcoin', {
      creator: { ...alice.account, name: 'alice' },
    });
    let assetDef = runtime.getAssetDef(assetId);

    syncAccounts();
    assert.equal(assetDef.creator, alice.address);
    assert.equal(assetDef.defaultFrozen, false);
    assert.equal(assetDef.total, WZC_total);
    assert.equal(assetDef.unitName, 'WZC');
    assert.equal(assetDef.manager, alice.address);
    assert.equal(assetDef.reserve, alice.address);
    assert.equal(assetDef.freeze, alice.address);
    assert.equal(assetDef.clawback, alice.address);

    // Create the `token_issuer` stateless smart contract
    tokenIssuerLsig = runtime.getLogicSig(getTokenIssuerProg(assetId), []);
    token_issuer = runtime.getAccount(tokenIssuerLsig.address());

    // Fund the `token_issuer` to `minBalance`
    const fund_token_issuer = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: token_issuer.address,
      amountMicroAlgos: minBalance,
      payFlags: {},
    };
    runtime.executeTx(fund_token_issuer);

    syncAccounts();
    assert.equal(token_issuer.balance(), minBalance);

    // Opt-in to ASA
    runtime.optIntoASA(assetId, bob.address, {});
    runtime.optIntoASA(assetId, token_issuer.address, {});

    const aliceAssetHolding = alice.getAssetHolding(assetId);
    const bobAssetHolding = bob.getAssetHolding(assetId);
    assert.isDefined(aliceAssetHolding);
    assert.isDefined(bobAssetHolding);

    // Re-assign the reserve address to be the `token_issuer`
    const setReserveAddressTxn = {
      type: types.TransactionType.ModifyAsset,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      assetID: assetId,
      fields: { reserve: token_issuer.address },
      payFlags: {},
    };
    runtime.executeTx(setReserveAddressTxn);

    // Transfer the tokens from `alice` to the `token_issuer`
    const transferToReserveAddressTxn = {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      assetID: assetId,
      fromAccount: alice.account,
      toAccountAddr: token_issuer.address,
      amount: WZC_total,
      payFlags: {},
    };
    runtime.executeTx(transferToReserveAddressTxn);
  });

  this.afterEach(async function () {
    // Reset all of the accounts
    master = undefined;
    alice = undefined;
    bob = undefined;
    token_issuer = undefined;
  });

  it('Init ASA and Token Issuer', () => {
    syncAccounts();

    let assetDef = runtime.getAssetDef(assetId);

    // Check that the `token_issuer` is the reserve address
    assert.equal(assetDef.reserve, token_issuer.address);

    // Check that the `token_issuer` reverse initially holds the entire supply
    const tokenIssuerAssetHolding = token_issuer.getAssetHolding(assetId);
    assert.isDefined(tokenIssuerAssetHolding);
    assert.equal(tokenIssuerAssetHolding.amount, assetDef.total);
  });

  it('Valid Purchase WizCoin', () => {
    const txGroup = [
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: token_issuer.address,
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 },
      },
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.LogicSignature,
        lsig: tokenIssuerLsig,
        assetID: assetId,
        fromAccountAddr: token_issuer.address,
        toAccountAddr: alice.address,
        amount: 1,
        payFlags: { totalFee: 1000 },
      },
    ];

    // Does the transaction go through
    assert.doesNotThrow(() => runtime.executeTx(txGroup));

    syncAccounts();

    // Does `alice` own a single WizCoin
    const aliceAssetHolding = alice.getAssetHolding(assetId);
    assert.isDefined(aliceAssetHolding);
    assert.equal(aliceAssetHolding.amount, 1n);
  });
});
