import React, {Component} from "react";
import Translate from "react-translate-component";
import {Input, Card, Col, Row, Button} from "bitshares-ui-style-guide";
import AccountSelector from "../Account/AccountSelector";
import counterpart from "counterpart";
import AccountStore from "stores/AccountStore";
import {ChainStore} from "bitsharesjs";
import AmountSelector from "../Utility/AmountSelector";
import {Asset} from "common/MarketClasses";
import utils from "common/utils";
import {
    checkFeeStatusAsync,
    checkBalance,
    shouldPayFeeWithAssetAsync
} from "common/trxHelper";
import BalanceComponent from "../Utility/BalanceComponent";
import AccountActions from "actions/AccountActions";

export default class Barter extends Component {
    constructor() {
        super();
        this.state = {
            from_name: "",
            to_name: "",
            from_account: null,
            to_account: null,
            from_barter: [
                {
                    index: 0,
                    from_amount: "",
                    from_asset_id: null,
                    from_asset: null,
                    from_feeAmount: new Asset({amount: 0}),
                    from_feeAsset: null,
                    from_fee_asset_id: null,
                    from_hasPoolBalance: null,
                    from_balanceError: false
                }
            ],
            to_barter: [
                {
                    index: 0,
                    to_amount: "",
                    to_asset_id: null,
                    to_asset: null,
                    to_feeAmount: new Asset({amount: 0}),
                    to_feeAsset: null,
                    to_fee_asset_id: null,
                    to_hasPoolBalance: null,
                    to_balanceError: false
                }
            ],

            amount_counter: [],
            amount_index: 0,
            from_error: null,
            to_error: null,
            memo: "Barter"
        };
        this._checkBalance = this._checkBalance.bind(this);
        this.onTrxIncluded = this.onTrxIncluded.bind(this);
    }

    componentWillMount() {
        let currentAccount = AccountStore.getState().currentAccount;
        if (!this.state.from_name) this.setState({from_name: currentAccount});
    }

    fromChanged(from_name) {
        this.setState({from_name});
    }

    onFromAccountChanged(from_account) {
        this.setState({
            from_account,
            from_barter: [
                {
                    from_amount: "",
                    from_asset_id: null,
                    from_asset: null,
                    from_feeAmount: new Asset({amount: 0}),
                    from_feeAsset: null,
                    from_fee_asset_id: null,
                    from_hasPoolBalance: null,
                    from_balanceError: false
                }
            ]
        });
    }

    toChanged(to_name) {
        this.setState({to_name});
    }

    onToAccountChanged(to_account) {
        this.setState({
            to_account,
            to_barter: [
                {
                    to_amount: "",
                    to_asset_id: null,
                    to_asset: null,
                    to_feeAmount: new Asset({amount: 0}),
                    to_feeAsset: null,
                    to_fee_asset_id: null,
                    to_hasPoolBalance: null,
                    to_balanceError: false
                }
            ]
        });
    }
    onFromAmountChanged(index, e) {
        const asset = e.asset;
        const amount = e.amount;
        if (!asset) {
            return;
        }
        let from_barter = [...this.state.from_barter];

        from_barter[index] = {
            index,
            from_amount: amount,
            from_asset: asset,
            from_asset_id: asset.get("id"),
            from_feeAmount: new Asset({amount: 0}),
            from_feeAsset: asset,
            from_fee_asset_id: "1.3.0",
            from_balanceError: false
        };

        this.setState(
            {
                from_barter: from_barter,
                from_error: null
            },
            this._checkBalance(
                from_barter[index].from_feeAmount,
                amount,
                this.state.from_account,
                asset,
                index,
                true,
                from_barter[index].from_fee_asset_id,
                from_barter
            )
        );
    }
    onToAmountChanged(index, e) {
        const asset = e.asset;
        const amount = e.amount;
        if (!asset) {
            return;
        }
        let to_barter = [...this.state.to_barter];

        to_barter[index] = {
            index,
            to_amount: amount,
            to_asset: asset,
            to_asset_id: asset.get("id"),
            to_feeAmount: new Asset({amount: 0}),
            to_feeAsset: asset,
            to_fee_asset_id: "1.3.0",
            to_balanceError: false
        };

        this.setState(
            {
                to_barter: to_barter,
                to_error: null
            },
            this._checkBalance(
                to_barter[index].to_feeAmount,
                amount,
                this.state.to_account,
                asset,
                index,
                false,
                to_barter[index].to_fee_asset_id,
                to_barter
            )
        );
    }

    _checkBalance(
        feeAmount,
        amount,
        account,
        asset,
        index,
        from,
        fee_asset_id,
        barter
    ) {
        if (!asset || !account) return;

        this._updateFee(
            fee_asset_id,
            account,
            asset.get("id"),
            index,
            from,
            barter
        );
        const balanceID = account.getIn(["balances", asset.get("id")]);
        const feeBalanceID = account.getIn(["balances", feeAmount.asset_id]);
        if (!asset || !account) return;
        if (!balanceID)
            if (from) {
                barter[index].from_balanceError = true;
                return this.setState({from_barter: barter});
            } else {
                barter[index].to_balanceError = true;
                return this.setState({to_barter: barter});
            }
        let balanceObject = ChainStore.getObject(balanceID);
        let feeBalanceObject = feeBalanceID
            ? ChainStore.getObject(feeBalanceID)
            : null;
        if (!feeBalanceObject || feeBalanceObject.get("balance") === 0) {
            if (from) {
                barter[index].from_fee_asset_id = "1.3.0";
                this.setState(
                    {from_barter: barter},
                    this._updateFee(
                        barter[index].from_fee_asset_id,
                        account,
                        asset.get("id"),
                        index,
                        from,
                        barter
                    )
                );
            } else {
                barter[index].to_fee_asset_id = "1.3.0";
                this.setState(
                    {to_barter: barter},
                    this._updateFee(
                        barter[index].to_fee_asset_id,
                        account,
                        asset.get("id"),
                        index,
                        from,
                        barter
                    )
                );
            }
        }
        if (!balanceObject || !feeAmount) return;
        if (!amount)
            if (from) {
                barter[index].from_balanceError = false;
                return this.setState({from_barter: barter});
            } else {
                barter[index].to_balanceError = false;
                return this.setState({to_barter: barter});
            }
        const hasBalance = checkBalance(
            amount,
            asset,
            feeAmount,
            balanceObject
        );
        if (hasBalance === null) return;
        if (from) {
            barter[index].from_balanceError = !hasBalance;
            return this.setState({from_barter: barter});
        } else {
            barter[index].to_balanceError = !hasBalance;
            return this.setState({to_barter: barter});
        }
    }

    _updateFee(fee_asset_id, account, asset_id, index, from, barter) {
        const {
            from_fee_asset_types,
            to_fee_asset_types
        } = this._getAvailableAssets(this.state);
        const fee_asset_types = from
            ? from_fee_asset_types
            : to_fee_asset_types;
        if (
            fee_asset_types.length === 1 &&
            fee_asset_types[0] !== fee_asset_id
        ) {
            fee_asset_id = fee_asset_types[0];
        }
        if (!account) return null;

        checkFeeStatusAsync({
            accountID: account.get("id"),
            feeID: fee_asset_id,
            options: ["price_per_kbyte"],
            data: {
                type: "memo",
                content: ""
            }
        })
            .then(({fee, hasBalance, hasPoolBalance}) =>
                shouldPayFeeWithAssetAsync(account, fee).then(should => {
                    if (from) {
                        if (should) {
                            barter[index].from_fee_asset_id = asset_id;
                            this.setState({from_barter: barter});
                        } else {
                            barter[index].from_feeAmount = fee;
                            barter[index].from_fee_asset_id = fee.asset_id;
                            barter[index].from_hasPoolBalance = hasPoolBalance;
                            this.setState({
                                from_barter: barter,
                                from_error: !hasBalance || !hasPoolBalance
                            });
                        }
                    } else {
                        if (should) {
                            barter[index].to_fee_asset_id = asset_id;
                            this.setState({to_barter: _to_barter});
                        } else {
                            barter[index].to_feeAmount = fee;
                            barter[index].to_fee_asset_id = fee.asset_id;
                            barter[index].to_hasPoolBalance = hasPoolBalance;
                            this.setState({
                                to_barter: barter,
                                to_error: !hasBalance || !hasPoolBalance
                            });
                        }
                    }
                })
            )
            .catch(err => {
                console.error(err);
            });
    }

    _getAvailableAssets(state = this.state) {
        const {from_account, from_error, to_account, to_error} = state;

        let getAssetTypes = (account, err) => {
            let asset_types = [],
                fee_asset_types = [];
            if (!(account && account.get("balances") && !err)) {
                return {asset_types, fee_asset_types};
            }
            let account_balances = account.get("balances").toJS();
            asset_types = Object.keys(account_balances).sort(utils.sortID);
            fee_asset_types = Object.keys(account_balances).sort(utils.sortID);

            for (let key in account_balances) {
                let balanceObject = ChainStore.getObject(account_balances[key]);
                if (balanceObject && balanceObject.get("balance") === 0) {
                    asset_types.splice(asset_types.indexOf(key), 1);
                    if (fee_asset_types.indexOf(key) !== -1) {
                        fee_asset_types.splice(fee_asset_types.indexOf(key), 1);
                    }
                }
            }

            return {asset_types, fee_asset_types};
        };

        let from = getAssetTypes(from_account, from_error);
        let to = getAssetTypes(to_account, to_error);

        return {
            from_asset_types: from.asset_types || [],
            to_asset_types: to.asset_types || [],
            from_fee_asset_types: from.fee_asset_types || [],
            to_fee_asset_types: to.fee_asset_types || []
        };
    }

    addFromAmount() {
        this.state.from_barter.push({
            from_amount: "",
            from_asset_id: null,
            from_asset: null,
            from_feeAmount: new Asset({amount: 0}),
            from_feeAsset: null,
            from_fee_asset_id: null
        });
        this.setState({from_barter: this.state.from_barter});
    }

    addToAmount() {
        this.state.to_barter.push({
            to_amount: "",
            to_asset_id: null,
            to_asset: null,
            to_feeAmount: new Asset({amount: 0}),
            to_feeAsset: null,
            to_fee_asset_id: null
        });
        this.setState({to_barter: this.state.to_barter});
    }

    onSubmit(e) {
        e.preventDefault();
        this.setState({from_error: null, to_error: null});
        let sendAmount;
        let transfer_list = [];

        this.state.from_barter.forEach(item => {
            const asset = item.from_asset;
            let amount = item.from_amount;
            sendAmount = new Asset({
                real: amount,
                asset_id: asset.get("id"),
                precision: asset.get("precision")
            });
            transfer_list.push({
                from_account: this.state.from_account.get("id"),
                to_account: this.state.to_account.get("id"),
                amount: sendAmount.getAmount(),
                asset_id: asset.get("id"),
                memo: this.state.memo
                    ? new Buffer(this.state.memo, "utf-8")
                    : this.state.memo,
                propose: this.state.from_account, //  propose
                feeAsset: item.from_feeAsset
                    ? item.from_feeAsset.get("id")
                    : "1.3.0"
            });
        });

        this.state.to_barter.forEach(item => {
            const asset = item.to_asset;
            let amount = item.to_amount;
            sendAmount = new Asset({
                real: amount,
                asset_id: asset.get("id"),
                precision: asset.get("precision")
            });
            transfer_list.push({
                from_account: this.state.to_account.get("id"),
                to_account: this.state.from_account.get("id"),
                amount: sendAmount.getAmount(),
                asset_id: asset.get("id"),
                memo: this.state.memo
                    ? new Buffer(this.state.memo, "utf-8")
                    : this.state.memo,
                propose: this.state.to_account, //  propose
                feeAsset: item.to_feeAsset
                    ? item.to_feeAsset.get("id")
                    : "1.3.0"
            });
        });
        console.log(transfer_list);
    }

    onTrxIncluded(confirm_store_state) {
        if (
            confirm_store_state.included &&
            confirm_store_state.broadcasted_transaction
        ) {
            // this.setState(Transfer.getInitialState());
            TransactionConfirmStore.unlisten(this.onTrxIncluded);
            TransactionConfirmStore.reset();
        } else if (confirm_store_state.closed) {
            TransactionConfirmStore.unlisten(this.onTrxIncluded);
            TransactionConfirmStore.reset();
        }
    }

    render() {
        let {
            from_name,
            to_name,
            from_account,
            to_account,
            from_barter,
            to_barter,
            amount_index,
            from_error,
            to_error
        } = this.state;
        let {from_asset_types, to_asset_types} = this._getAvailableAssets();
        let smallScreen = window.innerWidth < 850 ? true : false;
        let assetFromList = [];
        let assetToList = [];
        let assetFromSymbol = "";
        let assetToSymbol = "";

        const checkAmountValid = () => {
            for (let item of from_barter) {
                const amountValue = parseFloat(
                    String.prototype.replace.call(item.from_amount, /,/g, "")
                );
                if (isNaN(amountValue) || amountValue === 0) return false;
            }

            for (let item of to_barter) {
                const amountValue = parseFloat(
                    String.prototype.replace.call(item.to_amount, /,/g, "")
                );
                if (isNaN(amountValue) || amountValue === 0) return false;
            }
            return true;
        };
        const explictPrice = () => {
            let result = "";
            if (checkAmountValid()) {
                const fromAmount = parseFloat(from_barter[0].from_amount);
                const toAmount = parseFloat(to_barter[0].to_amount);
                result = fromAmount / toAmount;
            }
            return result;
        };

        const fee = from => {
            let fee = 0;
            if (from) {
                from_barter.forEach(item => {
                    fee += item.from_feeAmount.getAmount({real: true});
                });
            } else {
                to_barter.forEach(item => {
                    fee += item.to_feeAmount.getAmount({real: true});
                });
            }

            return fee;
        };
        const balanceError = () => {
            for (let item of from_barter) {
                if (item.from_balanceError) {
                    return true;
                }
            }
            for (let item of to_barter) {
                if (item.from_balanceError) {
                    return true;
                }
            }
            return false;
        };

        const isSubmitNotValid =
            !from_account ||
            !to_account ||
            from_account.get("id") == to_account.get("id") ||
            balanceError() ||
            to_error ||
            from_error ||
            !checkAmountValid();

        const balance = (account, balanceError, asset_types, asset) => {
            if (account && account.get("balances")) {
                let account_balances = account.get("balances").toJS();
                let _error = balanceError ? "has-error" : "";
                if (asset_types.length === 1)
                    asset = ChainStore.getAsset(asset_types[0]);
                if (asset_types.length > 0) {
                    let current_asset_id = asset
                        ? asset.get("id")
                        : asset_types[0];
                    return (
                        <span>
                            <Translate
                                component="span"
                                content="transfer.available"
                            />
                            :{" "}
                            <span
                                className={_error}
                                style={{
                                    borderBottom: "#A09F9F 1px dotted",
                                    cursor: "pointer"
                                }}
                            >
                                <BalanceComponent
                                    balance={account_balances[current_asset_id]}
                                />
                            </span>
                        </span>
                    );
                } else {
                    return (
                        <span>
                            <span className={_error}>
                                <Translate content="transfer.errors.noFunds" />
                            </span>
                        </span>
                    );
                }
            }
        };

        let fromAmountSelector = from_barter.map((item, index) => {
            let assetSymbol = "";
            if (item.from_asset) {
                assetSymbol = item.from_asset.get("symbol");
                assetFromList.push(
                    [assetSymbol, item.from_amount || 0].join(" ")
                );
            }

            if (index !== 0) {
                return (
                    <AmountSelector
                        label="showcases.barter.title"
                        key={amount_index++}
                        style={{
                            marginBottom: "1rem"
                        }}
                        amount={item.from_amount}
                        onChange={this.onFromAmountChanged.bind(this, index++)}
                        asset={
                            from_asset_types.length > 0 && item.from_asset
                                ? item.from_asset.get("id")
                                : item.from_asset_id
                                    ? item.from_asset_id
                                    : from_asset_types[0]
                        }
                        assets={from_asset_types}
                        display_balance={balance(
                            from_account,
                            item.from_balanceError,
                            from_asset_types,
                            item.from_asset
                        )}
                        allowNaN={true}
                    />
                );
            }
            assetFromSymbol = assetSymbol;
        });
        let toAmountSelector = to_barter.map((item, index) => {
            let assetSymbol = "";
            if (item.to_asset) {
                assetSymbol = item.to_asset.get("symbol");
                assetToList.push(
                    [item.to_asset.get("symbol"), item.to_amount || 0].join(" ")
                );
            }
            if (index !== 0) {
                return (
                    <AmountSelector
                        label="showcases.barter.title"
                        style={{
                            marginBottom: "1rem"
                        }}
                        key={amount_index++}
                        amount={item.to_amount}
                        onChange={this.onToAmountChanged.bind(this, index++)}
                        asset={
                            to_asset_types.length > 0 && item.to_asset
                                ? item.to_asset.get("id")
                                : item.to_asset_id
                                    ? item.to_asset_id
                                    : to_asset_types[0]
                        }
                        assets={to_asset_types}
                        display_balance={balance(
                            to_account,
                            item.to_balanceError,
                            to_asset_types,
                            item.to_asset
                        )}
                        allowNaN={true}
                    />
                );
            }
            assetToSymbol = assetSymbol;
        });

        let account_from = (
            <Card style={{borderRadius: "10px"}}>
                <AccountSelector
                    label="showcases.barter.account"
                    placeholder="placeholder"
                    style={{
                        marginBottom: "1rem"
                    }}
                    allowPubKey={true}
                    allowUppercase={true}
                    account={from_account}
                    accountName={from_name}
                    onChange={this.fromChanged.bind(this)}
                    onAccountChanged={this.onFromAccountChanged.bind(this)}
                    hideImage
                    typeahead={true}
                />
                {from_account ? (
                    <div>
                        <AmountSelector
                            label="showcases.barter.title"
                            key={amount_index}
                            style={{
                                marginBottom: "1rem"
                            }}
                            amount={
                                from_account
                                    ? this.state.from_barter[0].from_amount
                                    : ""
                            }
                            onChange={this.onFromAmountChanged.bind(this, 0)}
                            asset={
                                from_asset_types.length > 0 &&
                                from_barter[0].from_asset
                                    ? from_barter[0].from_asset.get("id")
                                    : from_barter[0].from_asset_id
                                        ? from_barter[0].rom_asset_id
                                        : from_asset_types[0]
                            }
                            assets={from_asset_types}
                            display_balance={balance(
                                from_account,
                                from_barter[0].from_balanceError,
                                from_asset_types,
                                from_barter[0].from_asset
                            )}
                            allowNaN={true}
                        />
                        {fromAmountSelector}
                        <div
                            style={{paddingTop: "10px", paddingBottom: "10px"}}
                        >
                            <Button
                                onClick={this.addFromAmount.bind(this)}
                                disabled={
                                    !from_account ||
                                    !this.state.from_barter[
                                        this.state.from_barter.length - 1
                                    ].from_amount
                                }
                            >
                                + Add asset
                            </Button>
                        </div>
                    </div>
                ) : (
                    "Please select account"
                )}
            </Card>
        );

        let account_to = (
            <Card style={{borderRadius: "10px"}}>
                <AccountSelector
                    label="showcases.barter.account"
                    placeholder="placeholder"
                    style={{
                        marginBottom: "1rem"
                    }}
                    allowPubKey={true}
                    allowUppercase={true}
                    account={to_account}
                    accountName={to_name}
                    onChange={this.toChanged.bind(this)}
                    onAccountChanged={this.onToAccountChanged.bind(this)}
                    hideImage
                    typeahead={true}
                />
                {to_account ? (
                    <div>
                        <AmountSelector
                            label="showcases.barter.title"
                            style={{
                                marginBottom: "1rem"
                            }}
                            amount={
                                to_account
                                    ? this.state.to_barter[0].to_amount
                                    : ""
                            }
                            onChange={this.onToAmountChanged.bind(this, 0)}
                            asset={
                                to_asset_types.length > 0 &&
                                to_barter[0].to_asset
                                    ? to_barter[0].to_asset.get("id")
                                    : to_barter[0].to_asset_id
                                        ? to_barter[0].to_asset_id
                                        : to_asset_types[0]
                            }
                            assets={to_asset_types}
                            display_balance={balance(
                                to_account,
                                to_barter[0].to_balanceError,
                                to_asset_types,
                                to_barter[0].to_asset
                            )}
                            allowNaN={true}
                        />
                        {toAmountSelector}
                        <div
                            style={{paddingTop: "10px", paddingBottom: "10px"}}
                        >
                            <Button
                                onClick={this.addToAmount.bind(this)}
                                disabled={
                                    !to_account ||
                                    !this.state.to_barter[
                                        this.state.to_barter.length - 1
                                    ].to_amount
                                }
                            >
                                + Add asset
                            </Button>
                        </div>
                    </div>
                ) : (
                    "Please select account"
                )}
            </Card>
        );

        let offers = (
            <Card style={{borderRadius: "10px"}}>
                {!isSubmitNotValid && (
                    <div className="left-label">
                        <strong>{from_name}</strong> offers to send{" "}
                        <strong>{assetFromList.join(", ")}</strong> to
                        <strong>{to_name} </strong>
                        and receives <strong>
                            {assetToList.join(", ")}
                        </strong>{" "}
                        in return
                    </div>
                )}
                {isSubmitNotValid && (
                    <div className="left-label">No valid barter yet.</div>
                )}
                {from_barter.length === 500 && to_barter.length === 500 ? ( // deactivate for now
                    <div className="amount-selector" style={this.props.style}>
                        <Translate
                            className="left-label"
                            component="label"
                            content="transfer.explict_price"
                        />
                        <div className="inline-label input-wrapper">
                            <input
                                disabled={false}
                                type="text"
                                value={explictPrice()}
                            />

                            <div className="form-label select floating-dropdown">
                                <div className="dropdown-wrapper inactive">
                                    <div>
                                        {`${assetFromSymbol}/${assetToSymbol}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    ""
                )}
            </Card>
        );
        let totalFeeFrom = (
            <Card style={{borderRadius: "10px"}}>
                <AmountSelector
                    label="transfer.fee"
                    disabled={false}
                    amount={fee(true)}
                    asset={"1.3.0"}
                    assets={["1.3.0"]}
                    error={
                        this.state.hasPoolBalance === false
                            ? "transfer.errors.insufficient"
                            : null
                    }
                    scroll_length={2}
                />
            </Card>
        );

        let totalFeeTo = (
            <Card style={{borderRadius: "10px"}}>
                <AmountSelector
                    label="transfer.fee"
                    disabled={false}
                    amount={fee(false)}
                    asset={"1.3.0"}
                    assets={["1.3.0"]}
                    error={
                        this.state.hasPoolBalance === false
                            ? "transfer.errors.insufficient"
                            : null
                    }
                    scroll_length={2}
                />
            </Card>
        );
        return (
            <div className="container wrap shrink" style={{padding: "10px"}}>
                <Card>
                    {smallScreen ? (
                        <div>
                            <Row>
                                <Col style={{padding: "10px"}}>
                                    {account_from}
                                </Col>
                            </Row>
                            <Row>
                                <Col style={{padding: "10px"}}>
                                    {account_to}
                                </Col>
                            </Row>
                            <Row>
                                <Col style={{padding: "10px"}}>{offers}</Col>
                            </Row>
                            <Row>
                                <Col style={{padding: "10px"}}>
                                    {totalFeeFrom}
                                </Col>
                            </Row>
                            <Row>
                                <Col style={{padding: "10px"}}>
                                    {totalFeeTo}
                                </Col>
                            </Row>
                        </div>
                    ) : (
                        <div>
                            <Row>
                                <Col span={12} style={{padding: "10px"}}>
                                    {account_from}
                                </Col>
                                <Col span={12} style={{padding: "10px"}}>
                                    {account_to}
                                </Col>
                            </Row>
                            <Row>
                                <Col style={{padding: "10px"}}>{offers}</Col>
                            </Row>
                            <Row>
                                <Col span={12} style={{padding: "10px"}}>
                                    {totalFeeFrom}
                                </Col>
                                <Col span={12} style={{padding: "10px"}}>
                                    {totalFeeTo}
                                </Col>
                            </Row>
                        </div>
                    )}
                    <Button
                        key={"send"}
                        disabled={isSubmitNotValid}
                        onClick={
                            !isSubmitNotValid ? this.onSubmit.bind(this) : null
                        }
                    >
                        {counterpart.translate("propose")}
                    </Button>
                </Card>
            </div>
        );
    }
}
