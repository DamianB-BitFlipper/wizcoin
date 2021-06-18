# Add a path to algobpy
import sys
sys.path.insert(0, '.')

from algobpy.parse import parse_params
from pyteal import *

def token_issuer(assetId):
    """
    This smart contract implements a stateful counter
    """
    # Perform the transaction group checks
    group_size_check = Global.group_size() == Int(2)
    first_pay_check = Gtxn[0].type_enum() == TxnType.Payment
    second_asset_check = Gtxn[1].type_enum() == TxnType.AssetTransfer

    # Check that this is the stateless transaction
    index_check = Txn.group_index() == Int(1)

    group_checks = And(
        group_size_check,
        first_pay_check,
        second_asset_check,
        index_check,
    )

    # Check the first transaction

    # The first transaction pays for the txn fee of the stateless contract
    first_amount_check = Gtxn[0].amount() == Txn.fee()
    first_receiver_check = Gtxn[0].receiver() == Txn.sender()

    # No rekey or close to transactions
    first_rekey_check = Gtxn[0].rekey_to() == Global.zero_address()
    first_close_to_check = Gtxn[0].close_remainder_to() == Global.zero_address()
    first_asset_close_to_check = Gtxn[0].asset_close_to() == Global.zero_address()

    first_checks = And(
        first_amount_check,
        first_receiver_check,

        first_rekey_check,
        first_close_to_check,
        first_asset_close_to_check,
    )

    # Check the second transaction (this stateless contract)

    # Check that the fee is not extreme
    fee_check = Txn.fee() < Int(10000)

    # Check that this is an asset transfer
    amount_check = Txn.amount() == Int(0)
    asset_amount_check = Txn.asset_amount() == Int(1)
    asset_id_check = Txn.xfer_asset() == assetId # Passed in parameter
    asset_receiver_check = Txn.asset_receiver() == Gtxn[0].sender()

    # No rekey or close to transactions
    rekey_check = Txn.rekey_to() == Global.zero_address()
    close_to_check = Txn.close_remainder_to() == Global.zero_address()
    asset_close_to_check = Txn.asset_close_to() == Global.zero_address()

    # Aggregate all of the common checks together
    second_checks = And(
        fee_check,
        amount_check,
        asset_amount_check,
        asset_id_check,
        asset_receiver_check,

        rekey_check,
        close_to_check,
        asset_close_to_check,
    )

    return And(
        group_checks,
        first_checks,
        second_checks,
    )

if __name__ == "__main__":
    # Default parameters
    params = {
        "assetId": 1,
    }

    # Overwrite `params` if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    print(compileTeal(
        token_issuer(Int(params["assetId"])), 
        Mode.Signature))
