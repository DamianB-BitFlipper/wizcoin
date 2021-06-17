const {
    executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run(runtimeEnv, deployer) {
    console.log('[wizcoin]: Modify ASA script execution has started!');

    const creatorAccount = deployer.accountsByName.get('alice');

    // Get the ASA information for `wizcoin`
    const asaInfo = await deployer.getASAInfo('wizcoin');
    const assetId = asaInfo.assetIndex;

    // Get logic Signature
    const lsig = await deployer.loadLogic(
        'token_issuer.py',
        {assetId: assetId},
    );

    const algoTxnParams = {
        type: types.TransactionType.ModifyAsset,
        sign: types.SignType.SecretKey,
        fromAccount: creatorAccount,
        assetID: assetId,
        fields: {"reserve": lsig.addr},
        payFlags: {}
    };
    // transfer some algos to creator account
    await executeTransaction(deployer, algoTxnParams);

    console.log('[wizcoin]: Modify ASA script execution has finished!');
}

module.exports = { default: run };
