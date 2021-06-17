const { getProgram } = require('@algo-builder/algob');
const {
  Runtime, AccountStore, types
} = require('@algo-builder/runtime');
const { assert } = require('chai');

const minBalance = 10e6; // 10 ALGO's
const aliceAddr = 'EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY';
const bobAddr = '2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ';
const initialCreatorBalance = minBalance + 0.01e6;

const WZC_total = 69n;

describe('WizCoin Tests', function() {
    let alice;
    let bob;
    let token_issuer;

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

    const getTokenIssuerProg = (assetId) =>
          getProgram('token_issuer.py', { assetId: assetId });

    this.beforeEach(async function (){
        alice = new AccountStore(minBalance, { addr: aliceAddr, sk: new Uint8Array(0) });
        bob = new AccountStore(minBalance, { addr: bobAddr, sk: new Uint8Array(0) });
        runtime = new Runtime([alice, bob]);

        // Create new ASA
        assetId = runtime.addAsset('wizcoin', { creator: { ...alice.account, name: 'alice' } });
        let assetDef = runtime.getAssetDef(assetId);

        syncAccounts()
        assert.equal(assetDef.creator, alice.address);
        assert.equal(assetDef['default-frozen'], false);
        assert.equal(assetDef.total, WZC_total);
        assert.equal(assetDef['unit-name'], 'WZC');
        assert.equal(assetDef.manager, alice.address);
        assert.equal(assetDef.reserve, alice.address);
        assert.equal(assetDef.freeze, alice.address);
        assert.equal(assetDef.clawback, alice.address);

        // Create the `token_issuer` stateless smart contract
        const tokenIssuerLsig = runtime.getLogicSig(getTokenIssuerProg(assetId), []);
        token_issuer = runtime.getAccount(tokenIssuerLsig.address());

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
            fields: {"reserve": token_issuer.address},
            payFlags: {}
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
            payFlags: {}
        };
        runtime.executeTx(transferToReserveAddressTxn);
    });

    it('Init ASA and Token Issuer', () => {
        syncAccounts();

        let assetDef = runtime.getAssetDef(assetId);
        assert.equal(assetDef.reserve, token_issuer.address);

        const tokenIssueAssetHolding = token_issuer.getAssetHolding(assetId);
        assert.isDefined(tokenIssueAssetHolding);
        assert.equal(tokenIssueAssetHolding.amount, WZC_total);
    });
});
