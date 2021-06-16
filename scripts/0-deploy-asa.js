const { executeTransaction } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
/*
  Create "gold" Algorand Standard Asset (ASA).
  Accounts are loaded from config.
  To use ASA, accounts have to opt-in. Owner is opt-in by default.
*/

function mkParam(senderAccount, receiverAddr, amount, payFlags) {
    return {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: senderAccount,
        toAccountAddr: receiverAddr,
        amountMicroAlgos: amount,
        payFlags: payFlags,
    };
}

async function run(runtimeEnv, deployer) {
    console.log('[wizcoin]: ASA deploy script has started!');

    const masterAccount = deployer.accountsByName.get('master-account');
    const alice = deployer.accountsByName.get('alice');
    const john = deployer.accountsByName.get('john');
    const bob = deployer.accountsByName.get('bob');

    // Accounts can only be active if they possess minimum amont of ALGOs.
    // Here we fund the accounts with 5e6, 5e6 and 1e6 micro AlGOs.
    const message = 'funding account';
    const promises = [
        executeTransaction(
            deployer,
            mkParam(masterAccount, alice.addr, 5e6, { note: message })
        ),
        executeTransaction(
            deployer,
            mkParam(masterAccount, john.addr, 5e6, { note: message })
        ),
        executeTransaction(
            deployer,
            mkParam(masterAccount, bob.addr, 1e6, { note: message })
        ),
    ];
    await Promise.all(promises);

    // Let's deploy ASA. The following commnad will open the `assets/asa.yaml` file and search for
    // the `wizcoin` ASA. The transaction can specify standard transaction parameters. If skipped
    // node suggested values will be used.
    const asaInfo = await deployer.deployASA('wizcoin', {
        creator: alice,
    });
    console.log(asaInfo);

    // Opt-in to the ASA
    await deployer.optInAcountToASA('wizcoin', 'alice', {});
    await deployer.optInAcountToASA('wizcoin', 'bob', {});

    // To interact with an asset we need asset ID. We can get it from the returned object:
    const assetID = asaInfo.assetIndex;

    console.log('Asset ID: %d', assetID);
    console.log('[wizcoin]: ASA script execution has finished!');
}

module.exports = { default: run };
