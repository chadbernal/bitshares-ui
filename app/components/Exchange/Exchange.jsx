import React from "react";
import PropTypes from "prop-types";
import MarketsActions from "actions/MarketsActions";
import {MyOpenOrders} from "./MyOpenOrders";
import {OrderBook, GroupOrderLimitSelector} from "./OrderBook";
import MarketHistory from "./MarketHistory";
import MyMarkets from "./MyMarkets";
import BuySell from "./BuySell";
import MarketPicker from "./MarketPicker";
import Settings from "./Settings";
import utils from "common/utils";
// import PriceChartD3 from "./PriceChartD3";
import TradingViewPriceChart from "./TradingViewPriceChart";
import assetUtils from "common/asset_utils";
import DepthHighChart from "./DepthHighChart";
import {debounce} from "lodash-es";
import BorrowModal from "../Modal/BorrowModal";
import notify from "actions/NotificationActions";
import AccountNotifications from "../Notifier/NotifierContainer";
import Ps from "perfect-scrollbar";
import {ChainStore, FetchChain} from "bitsharesjs";
import SettingsActions from "actions/SettingsActions";
import cnames from "classnames";
import market_utils from "common/market_utils";
import {Asset, Price, LimitOrderCreate} from "common/MarketClasses";
import ConfirmOrderModal from "./ConfirmOrderModal";
import ExchangeHeader from "./ExchangeHeader";
import Translate from "react-translate-component";
import TranslateWithLinks from "../Utility/TranslateWithLinks";
import {Apis} from "bitsharesjs-ws";
import {checkFeeStatusAsync} from "common/trxHelper";
import LoadingIndicator from "../LoadingIndicator";
import moment from "moment";
import guide from "intro.js";
import translator from "counterpart";
import {
    Tabs,
    Button,
    Collapse,
    Icon as AntIcon
} from "bitshares-ui-style-guide";
import Icon from "../Icon/Icon";
import classnames from "classnames";

class Exchange extends React.Component {
    static propTypes = {
        marketCallOrders: PropTypes.object.isRequired,
        activeMarketHistory: PropTypes.object.isRequired,
        viewSettings: PropTypes.object.isRequired
    };

    static defaultProps = {
        marketCallOrders: [],
        activeMarketHistory: {},
        viewSettings: {}
    };

    constructor(props) {
        super();
        this.state = {
            ...this._initialState(props),
            expirationType: {
                bid: props.exchange.getIn(["lastExpiration", "bid"]) || "YEAR",
                ask: props.exchange.getIn(["lastExpiration", "ask"]) || "YEAR"
            },
            expirationCustomTime: {
                bid: moment().add(1, "day"),
                ask: moment().add(1, "day")
            },
            feeStatus: {}
        };

        this._getWindowSize = debounce(this._getWindowSize.bind(this), 150);
        this._checkFeeStatus = this._checkFeeStatus.bind(this);

        this._handleExpirationChange = this._handleExpirationChange.bind(this);
        this._handleCustomExpirationChange = this._handleCustomExpirationChange.bind(
            this
        );

        this.psInit = true;
    }

    _handleExpirationChange(type, e) {
        let expirationType = {
            ...this.state.expirationType,
            [type]: e.target.value
        };

        if (e.target.value !== "SPECIFIC") {
            SettingsActions.setExchangeLastExpiration({
                ...((this.props.exchange.has("lastExpiration") &&
                    this.props.exchange.get("lastExpiration").toJS()) ||
                    {}),
                [type]: e.target.value
            });
        }

        this.setState({
            expirationType: expirationType
        });
    }

    _handleCustomExpirationChange(type, time) {
        let expirationCustomTime = {
            ...this.state.expirationCustomTime,
            [type]: time
        };

        this.setState({
            expirationCustomTime: expirationCustomTime
        });
    }

    EXPIRATIONS = {
        HOUR: {
            title: "1 hour",
            get: () =>
                moment()
                    .add(1, "hour")
                    .valueOf()
        },
        "12HOURS": {
            title: "12 hours",
            get: () =>
                moment()
                    .add(12, "hour")
                    .valueOf()
        },
        "24HOURS": {
            title: "24 hours",
            get: () =>
                moment()
                    .add(1, "day")
                    .valueOf()
        },
        "7DAYS": {
            title: "7 days",
            get: () =>
                moment()
                    .add(7, "day")
                    .valueOf()
        },
        MONTH: {
            title: "30 days",
            get: () =>
                moment()
                    .add(30, "day")
                    .valueOf()
        },
        YEAR: {
            title: "1 year",
            get: () =>
                moment()
                    .add(1, "year")
                    .valueOf()
        },
        SPECIFIC: {
            title: "Specific",
            get: type => {
                return this.state.expirationCustomTime[type].valueOf();
            }
        }
    };

    _initialState(props) {
        let ws = props.viewSettings;
        let bid = {
            forSaleText: "",
            toReceiveText: "",
            priceText: "",
            for_sale: new Asset({
                asset_id: props.baseAsset.get("id"),
                precision: props.baseAsset.get("precision")
            }),
            to_receive: new Asset({
                asset_id: props.quoteAsset.get("id"),
                precision: props.quoteAsset.get("precision")
            })
        };
        bid.price = new Price({base: bid.for_sale, quote: bid.to_receive});
        let ask = {
            forSaleText: "",
            toReceiveText: "",
            priceText: "",
            for_sale: new Asset({
                asset_id: props.quoteAsset.get("id"),
                precision: props.quoteAsset.get("precision")
            }),
            to_receive: new Asset({
                asset_id: props.baseAsset.get("id"),
                precision: props.baseAsset.get("precision")
            })
        };
        ask.price = new Price({base: ask.for_sale, quote: ask.to_receive});

        return {
            history: [],

            tabVerticalPanel: ws.get("tabVerticalPanel", "order_book"),
            tabTrades: ws.get("tabTrades", "history"),
            tabBuySell: ws.get("tabBuySell", "buy"),
            buySellOpen: ws.get("buySellOpen", true),
            bid,
            ask,
            flipBuySell: ws.get("flipBuySell", false),
            favorite: false,
            exchangeLayout: ws.get("exchangeLayout", 1),
            showDepthChart: ws.get("showDepthChart", false),
            buyDiff: false,
            sellDiff: false,
            buySellTop: ws.get("buySellTop", true),
            buyFeeAssetIdx: ws.get("buyFeeAssetIdx", 0),
            sellFeeAssetIdx: ws.get("sellFeeAssetIdx", 0),
            height: window.innerHeight,
            width: window.innerWidth,
            chartHeight: ws.get("chartHeight", 600),
            currentPeriod: ws.get("currentPeriod", 3600 * 24 * 30 * 3), // 3 months
            hidePanel: false,
            showMarketPicker: false
        };
    }

    _getLastMarketKey() {
        const chainID = Apis.instance().chain_id;
        return `lastMarket${chainID ? "_" + chainID.substr(0, 8) : ""}`;
    }

    componentWillMount() {
        window.addEventListener("resize", this._setDimensions, {
            capture: false,
            passive: true
        });

        this._checkFeeStatus();
    }

    componentDidMount() {
        MarketsActions.getTrackedGroupsConfig();

        SettingsActions.changeViewSetting.defer({
            [this._getLastMarketKey()]:
                this.props.quoteAsset.get("symbol") +
                "_" +
                this.props.baseAsset.get("symbol")
        });

        window.addEventListener("resize", this._getWindowSize, {
            capture: false,
            passive: true
        });
    }

    shouldComponentUpdate(np, ns) {
        if (!np.marketReady && !this.props.marketReady) {
            return false;
        }
        let propsChanged = false;
        for (let key in np) {
            if (np.hasOwnProperty(key)) {
                propsChanged =
                    propsChanged ||
                    !utils.are_equal_shallow(np[key], this.props[key]);
                if (propsChanged) break;
            }
        }
        return propsChanged || !utils.are_equal_shallow(ns, this.state);
    }

    _checkFeeStatus(
        assets = [
            this.props.coreAsset,
            this.props.baseAsset,
            this.props.quoteAsset
        ],
        account = this.props.currentAccount
    ) {
        let feeStatus = {};
        let p = [];
        assets.forEach(a => {
            p.push(
                checkFeeStatusAsync({
                    accountID: account.get("id"),
                    feeID: a.get("id"),
                    type: "limit_order_create"
                })
            );
        });
        Promise.all(p)
            .then(status => {
                assets.forEach((a, idx) => {
                    feeStatus[a.get("id")] = status[idx];
                });
                if (!utils.are_equal_shallow(this.state.feeStatus, feeStatus)) {
                    this.setState({
                        feeStatus
                    });
                }
            })
            .catch(err => {
                console.log("checkFeeStatusAsync error", err);
                this.setState({feeStatus: {}});
            });
    }

    _getWindowSize() {
        let {innerHeight, innerWidth} = window;
        if (
            innerHeight !== this.state.height ||
            innerWidth !== this.state.width
        ) {
            this.setState({
                height: innerHeight,
                width: innerWidth
            });
            let centerContainer = this.refs.center;
            if (centerContainer) {
                Ps.update(centerContainer);
            }
        }
    }

    componentDidUpdate(prevProps, prevState) {
        this._initPsContainer();
        if (
            !this.props.exchange.get("tutorialShown") &&
            prevProps.coreAsset &&
            prevState.feeStatus
        ) {
            if (!this.tutorialShown) {
                this.tutorialShown = true;
                const theme = this.props.settings.get("themes");

                guide
                    .introJs()
                    .setOptions({
                        tooltipClass: theme,
                        highlightClass: theme,
                        showBullets: false,
                        hideNext: true,
                        hidePrev: true,
                        nextLabel: translator.translate(
                            "walkthrough.next_label"
                        ),
                        prevLabel: translator.translate(
                            "walkthrough.prev_label"
                        ),
                        skipLabel: translator.translate(
                            "walkthrough.skip_label"
                        ),
                        doneLabel: translator.translate(
                            "walkthrough.done_label"
                        )
                    })
                    .start();

                SettingsActions.setExchangeTutorialShown.defer(true);
            }
        }
    }

    _initPsContainer() {
        if (this.refs.center && this.psInit) {
            let centerContainer = this.refs.center;
            if (centerContainer) {
                Ps.initialize(centerContainer);
                this.psInit = false;
            }
        }
    }

    componentWillReceiveProps(nextProps) {
        this._initPsContainer();
        if (
            nextProps.quoteAsset !== this.props.quoteAsset ||
            nextProps.baseAsset !== this.props.baseAsset ||
            nextProps.currentAccount !== this.props.currentAccount
        ) {
            this._checkFeeStatus(
                [
                    nextProps.coreAsset,
                    nextProps.baseAsset,
                    nextProps.quoteAsset
                ],
                nextProps.currentAccount
            );
        }
        if (
            nextProps.quoteAsset.get("symbol") !==
                this.props.quoteAsset.get("symbol") ||
            nextProps.baseAsset.get("symbol") !==
                this.props.baseAsset.get("symbol")
        ) {
            this.setState(this._initialState(nextProps));

            return SettingsActions.changeViewSetting({
                [this._getLastMarketKey()]:
                    nextProps.quoteAsset.get("symbol") +
                    "_" +
                    nextProps.baseAsset.get("symbol")
            });
        }

        // if (this.props.sub && nextProps.bucketSize !== this.props.bucketSize) {
        //     return this._changeBucketSize(nextProps.bucketSize);
        // }
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this._getWindowSize);
    }

    _getFeeAssets(quote, base, coreAsset) {
        let {currentAccount} = this.props;
        const {feeStatus} = this.state;

        function addMissingAsset(target, asset) {
            if (target.indexOf(asset) === -1) {
                target.push(asset);
            }
        }

        function hasFeePoolBalance(id) {
            return feeStatus[id] && feeStatus[id].hasPoolBalance;
        }

        function hasBalance(id) {
            return feeStatus[id] && feeStatus[id].hasBalance;
        }

        let sellAssets = [coreAsset, quote === coreAsset ? base : quote];
        addMissingAsset(sellAssets, quote);
        addMissingAsset(sellAssets, base);
        // let sellFeeAsset;

        let buyAssets = [coreAsset, base === coreAsset ? quote : base];
        addMissingAsset(buyAssets, quote);
        addMissingAsset(buyAssets, base);
        // let buyFeeAsset;

        let balances = {};

        currentAccount
            .get("balances", [])
            .filter((balance, id) => {
                return (
                    ["1.3.0", quote.get("id"), base.get("id")].indexOf(id) >= 0
                );
            })
            .forEach((balance, id) => {
                let balanceObject = ChainStore.getObject(balance);
                balances[id] = {
                    balance: balanceObject
                        ? parseInt(balanceObject.get("balance"), 10)
                        : 0,
                    fee: this._getFee(ChainStore.getAsset(id))
                };
            });

        function filterAndDefault(assets, balances, idx) {
            let asset;
            /* Only keep assets for which the user has a balance larger than the fee, and for which the fee pool is valid */
            assets = assets.filter(a => {
                if (!balances[a.get("id")]) {
                    return false;
                }
                return (
                    hasFeePoolBalance(a.get("id")) && hasBalance(a.get("id"))
                );
            });

            /* If the user has no valid balances, default to core fee */
            if (!assets.length) {
                asset = coreAsset;
                assets.push(coreAsset);
                /* If the user has balances, use the stored idx value unless that asset is no longer available*/
            } else {
                asset = assets[Math.min(assets.length - 1, idx)];
            }

            return {assets, asset};
        }

        let {assets: sellFeeAssets, asset: sellFeeAsset} = filterAndDefault(
            sellAssets,
            balances,
            this.state.sellFeeAssetIdx
        );
        let {assets: buyFeeAssets, asset: buyFeeAsset} = filterAndDefault(
            buyAssets,
            balances,
            this.state.buyFeeAssetIdx
        );

        let sellFee = this._getFee(sellFeeAsset);
        let buyFee = this._getFee(buyFeeAsset);

        return {
            sellFeeAsset,
            sellFeeAssets,
            sellFee,
            buyFeeAsset,
            buyFeeAssets,
            buyFee
        };
    }

    _getFee(asset = this.props.coreAsset) {
        return (
            this.state.feeStatus[asset.get("id")] &&
            this.state.feeStatus[asset.get("id")].fee
        );
    }

    _verifyFee(fee, sell, sellBalance, coreBalance) {
        let coreFee = this._getFee();

        if (fee.asset_id === "1.3.0") {
            if (coreFee.getAmount() <= coreBalance) {
                return "1.3.0";
            } else {
                return null;
            }
        } else {
            let sellSum =
                sell.asset_id === fee.asset_id
                    ? fee.getAmount() + sell.getAmount()
                    : sell.getAmount();
            if (sellSum <= sellBalance) {
                // Sufficient balance in asset to pay fee
                return fee.asset_id;
            } else if (
                coreFee.getAmount() <= coreBalance &&
                fee.asset_id !== "1.3.0"
            ) {
                // Sufficient balance in core asset to pay fee
                return "1.3.0";
            } else {
                return null; // Unable to pay fee
            }
        }
    }

    _createLimitOrderConfirm(
        buyAsset,
        sellAsset,
        sellBalance,
        coreBalance,
        feeAsset,
        type,
        short = true,
        e
    ) {
        e.preventDefault();
        let {highestBid, lowestAsk} = this.props.marketData;
        let current = this.state[type === "sell" ? "ask" : "bid"];

        sellBalance = current.for_sale.clone(
            sellBalance
                ? parseInt(ChainStore.getObject(sellBalance).toJS().balance, 10)
                : 0
        );
        coreBalance = new Asset({
            amount: coreBalance
                ? parseInt(ChainStore.getObject(coreBalance).toJS().balance, 10)
                : 0
        });

        let fee = this._getFee(feeAsset);
        let feeID = this._verifyFee(
            fee,
            current.for_sale,
            sellBalance.getAmount(),
            coreBalance.getAmount()
        );
        if (!feeID) {
            return notify.addNotification({
                message: "Insufficient funds to pay fees",
                level: "error"
            });
        }

        if (type === "buy" && lowestAsk) {
            let diff = this.state.bid.price.toReal() / lowestAsk.getPrice();
            if (diff > 1.2) {
                this.refs.buy.show();
                return this.setState({
                    buyDiff: diff
                });
            }
        } else if (type === "sell" && highestBid) {
            let diff =
                1 / (this.state.ask.price.toReal() / highestBid.getPrice());
            if (diff > 1.2) {
                this.refs.sell.show();
                return this.setState({
                    sellDiff: diff
                });
            }
        }

        let isPredictionMarket = sellAsset.getIn([
            "bitasset",
            "is_prediction_market"
        ]);

        if (current.for_sale.gt(sellBalance) && !isPredictionMarket) {
            return notify.addNotification({
                message:
                    "Insufficient funds to place order, you need at least " +
                    current.for_sale.getAmount({real: true}) +
                    " " +
                    sellAsset.get("symbol"),
                level: "error"
            });
        }
        //
        if (
            !(
                current.for_sale.getAmount() > 0 &&
                current.to_receive.getAmount() > 0
            )
        ) {
            return notify.addNotification({
                message: "Please enter a valid amount and price",
                level: "error"
            });
        }
        //
        if (type === "sell" && isPredictionMarket && short) {
            return this._createPredictionShort(feeID);
        }

        this._createLimitOrder(type, feeID);
    }

    _createLimitOrder(type, feeID) {
        let actionType = type === "sell" ? "ask" : "bid";

        let current = this.state[actionType];

        let expirationTime = null;
        if (this.state.expirationType[actionType] === "SPECIFIC") {
            expirationTime = this.EXPIRATIONS[
                this.state.expirationType[actionType]
            ].get(actionType);
        } else {
            expirationTime = this.EXPIRATIONS[
                this.state.expirationType[actionType]
            ].get();
        }

        const order = new LimitOrderCreate({
            for_sale: current.for_sale,
            expiration: new Date(expirationTime || false),
            to_receive: current.to_receive,
            seller: this.props.currentAccount.get("id"),
            fee: {
                asset_id: feeID,
                amount: 0
            }
        });
        const {marketName, first} = market_utils.getMarketName(
            this.props.baseAsset,
            this.props.quoteAsset
        );
        const inverted = this.props.marketDirections.get(marketName);
        const shouldFlip =
            (inverted && first.get("id") !== this.props.baseAsset.get("id")) ||
            (!inverted && first.get("id") !== this.props.baseAsset.get("id"));
        if (shouldFlip) {
            let setting = {};
            setting[marketName] = !inverted;
            SettingsActions.changeMarketDirection(setting);
        }
        console.log("order:", JSON.stringify(order.toObject()));
        return MarketsActions.createLimitOrder2(order)
            .then(result => {
                if (result.error) {
                    if (result.error.message !== "wallet locked")
                        notify.addNotification({
                            message:
                                "Unknown error. Failed to place order for " +
                                current.to_receive.getAmount({real: true}) +
                                " " +
                                current.to_receive.asset_id,
                            level: "error"
                        });
                }
                // console.log("order success");
            })
            .catch(e => {
                console.log("order failed:", e);
            });
    }

    _createPredictionShort(feeID) {
        let current = this.state.ask;
        const order = new LimitOrderCreate({
            for_sale: current.for_sale,
            to_receive: current.to_receive,
            seller: this.props.currentAccount.get("id"),
            fee: {
                asset_id: feeID,
                amount: 0
            }
        });

        Promise.all([
            FetchChain(
                "getAsset",
                this.props.quoteAsset.getIn([
                    "bitasset",
                    "options",
                    "short_backing_asset"
                ])
            )
        ]).then(assets => {
            let [backingAsset] = assets;
            let collateral = new Asset({
                amount: order.amount_for_sale.getAmount(),
                asset_id: backingAsset.get("id"),
                precision: backingAsset.get("precision")
            });

            MarketsActions.createPredictionShort(order, collateral).then(
                result => {
                    if (result.error) {
                        if (result.error.message !== "wallet locked")
                            notify.addNotification({
                                message:
                                    "Unknown error. Failed to place order for " +
                                    buyAssetAmount +
                                    " " +
                                    buyAsset.symbol,
                                level: "error"
                            });
                    }
                }
            );
        });
    }

    _forceBuy(type, feeAsset, sellBalance, coreBalance) {
        let current = this.state[type === "sell" ? "ask" : "bid"];
        // Convert fee to relevant asset fee and check if user has sufficient balance
        sellBalance = current.for_sale.clone(
            sellBalance
                ? parseInt(ChainStore.getObject(sellBalance).get("balance"), 10)
                : 0
        );
        coreBalance = new Asset({
            amount: coreBalance
                ? parseInt(ChainStore.getObject(coreBalance).toJS().balance, 10)
                : 0
        });
        let fee = this._getFee(feeAsset);
        let feeID = this._verifyFee(
            fee,
            current.for_sale,
            sellBalance.getAmount(),
            coreBalance.getAmount()
        );

        if (feeID) {
            this._createLimitOrder(type, feeID);
        } else {
            console.error("Unable to pay fees, aborting limit order creation");
        }
    }

    _forceSell(type, feeAsset, sellBalance, coreBalance) {
        let current = this.state[type === "sell" ? "ask" : "bid"];
        // Convert fee to relevant asset fee and check if user has sufficient balance
        sellBalance = current.for_sale.clone(
            sellBalance
                ? parseInt(ChainStore.getObject(sellBalance).get("balance"), 10)
                : 0
        );
        coreBalance = new Asset({
            amount: coreBalance
                ? parseInt(ChainStore.getObject(coreBalance).toJS().balance, 10)
                : 0
        });
        let fee = this._getFee(feeAsset);
        let feeID = this._verifyFee(
            fee,
            current.for_sale,
            sellBalance.getAmount(),
            coreBalance.getAmount()
        );

        if (feeID) {
            this._createLimitOrder(type, feeID);
        } else {
            console.error("Unable to pay fees, aborting limit order creation");
        }
    }

    _cancelLimitOrder(orderID, e) {
        e.preventDefault();
        let {currentAccount} = this.props;
        MarketsActions.cancelLimitOrder(
            currentAccount.get("id"),
            orderID // order id to cancel
        );
    }

    // _changeBucketSize(size, e) {
    //     if (e) e.preventDefault();
    //     if (size !== this.props.bucketSize) {
    //         MarketsActions.changeBucketSize.defer(size);
    //         let currentSub = this.props.sub.split("_");
    //         MarketsActions.unSubscribeMarket(currentSub[0], currentSub[1]).then(
    //             () => {
    //                 this.props.subToMarket(this.props, size);
    //             }
    //         );
    //     }
    // }

    _changeZoomPeriod(size, e) {
        e.preventDefault();
        if (size !== this.state.currentPeriod) {
            this.setState({
                currentPeriod: size
            });
            SettingsActions.changeViewSetting({
                currentPeriod: size
            });
        }
    }

    _depthChartClick(base, quote, e) {
        e.preventDefault();
        let {bid, ask} = this.state;

        bid.price = new Price({
            base: this.state.bid.for_sale,
            quote: this.state.bid.to_receive,
            real: e.xAxis[0].value
        });
        bid.priceText = bid.price.toReal();

        ask.price = new Price({
            base: this.state.ask.to_receive,
            quote: this.state.ask.for_sale,
            real: e.xAxis[0].value
        });
        ask.priceText = ask.price.toReal();
        let newState = {
            bid,
            ask,
            depthLine: bid.price.toReal()
        };

        this._setForSale(bid, true) || this._setReceive(bid, true);
        this._setReceive(ask) || this._setForSale(ask);

        this._setPriceText(bid, true);
        this._setPriceText(ask, false);
        // if (bid.for_sale.)
        this.setState(newState);
    }

    _togglePanel() {
        this.setState({
            hidePanel: !this.state.hidePanel
        });
    }

    _flipBuySell() {
        this.setState({
            flipBuySell: !this.state.flipBuySell
        });

        SettingsActions.changeViewSetting({
            flipBuySell: !this.state.flipBuySell
        });
    }

    _toggleOpenBuySell() {
        SettingsActions.changeViewSetting({
            buySellOpen: !this.state.buySellOpen
        });

        this.setState({buySellOpen: !this.state.buySellOpen});
    }

    _toggleCharts() {
        SettingsActions.changeViewSetting({
            showDepthChart: !this.state.showDepthChart
        });

        this.refs.settingsModal.onClose();

        this.setState({showDepthChart: !this.state.showDepthChart});
    }

    _toggleMarketPicker(asset) {
        let showMarketPicker = !!asset ? true : false;
        
        if(showMarketPicker) {
            this.refs.marketPicker.show();
        }

        this.setState({
            showMarketPicker,
            marketPickerAsset: asset
        });
    }

    _toggleSettings() {
        if(!this.state.showSettings)
            { this.refs.settingsModal.show(); }

        this.setState({showSettings: !this.state.showSettings});
    }

    _setExchangeLayout(value) {
        SettingsActions.changeViewSetting({
            exchangeLayout: value
        });

        this.refs.settingsModal.onClose();

        this.setState({exchangeLayout: value});
    }

    _currentPriceClick(type, price) {
        const isBid = type === "bid";
        let current = this.state[type];
        current.price = price[isBid ? "invert" : "clone"]();
        current.priceText = current.price.toReal();
        if (isBid) {
            this._setForSale(current, isBid) ||
                this._setReceive(current, isBid);
        } else {
            this._setReceive(current, isBid) ||
                this._setForSale(current, isBid);
        }
        this.forceUpdate();
    }

    _orderbookClick(order) {
        const isBid = order.isBid();
        /*
        * Because we are using a bid order to construct an ask and vice versa,
        * totalToReceive becomes forSale, and totalForSale becomes toReceive
        */
        let forSale = order.totalToReceive({noCache: true});
        // let toReceive = order.totalForSale({noCache: true});
        let toReceive = forSale.times(order.sellPrice());

        let newPrice = new Price({
            base: isBid ? toReceive : forSale,
            quote: isBid ? forSale : toReceive
        });

        let current = this.state[isBid ? "bid" : "ask"];
        current.price = newPrice;
        current.priceText = newPrice.toReal();

        let newState = {
            // If isBid is true, newState defines a new ask order and vice versa
            [isBid ? "ask" : "bid"]: {
                for_sale: forSale,
                forSaleText: forSale.getAmount({real: true}),
                to_receive: toReceive,
                toReceiveText: toReceive.getAmount({real: true}),
                price: newPrice,
                priceText: newPrice.toReal()
            }
        };

        if (isBid) {
            this._setForSale(current, isBid) ||
                this._setReceive(current, isBid);
        } else {
            this._setReceive(current, isBid) ||
                this._setForSale(current, isBid);
        }
        this.setState(newState);
    }

    _borrowQuote() {
        this.refs.borrowQuote.show();
    }

    _borrowBase() {
        this.refs.borrowBase.show();
    }

    _getSettlementInfo() {
        let {lowestCallPrice, feedPrice, quoteAsset} = this.props;

        let showCallLimit = false;
        if (feedPrice) {
            if (feedPrice.inverted) {
                showCallLimit = lowestCallPrice <= feedPrice.toReal();
            } else {
                showCallLimit = lowestCallPrice >= feedPrice.toReal();
            }
        }
        return !!(
            showCallLimit &&
            lowestCallPrice &&
            !quoteAsset.getIn(["bitasset", "is_prediction_market"])
        );
    }

    _setTabVerticalPanel(tab) {
        this.setState({
            tabVerticalPanel: tab
        });
        SettingsActions.changeViewSetting({
            tabVerticalPanel: tab
        });
    }

    _setTabTrades(tab) {
        this.setState({
            tabTrades: tab
        });
        SettingsActions.changeViewSetting({
            tabTrades: tab
        });
    }

    _setTabBuySell(tab) {
        this.setState({
            tabBuySell: tab
        });
        SettingsActions.changeViewSetting({
            tabBuySell: tab
        });
    }

    onChangeFeeAsset(type, value) {
        if (type === "buy") {
            this.setState({
                buyFeeAssetIdx: value
            });

            SettingsActions.changeViewSetting({
                buyFeeAssetIdx: value
            });
        } else {
            this.setState({
                sellFeeAssetIdx: value
            });

            SettingsActions.changeViewSetting({
                sellFeeAssetIdx: value
            });
        }
    }

    onChangeChartHeight({value, increase}) {
        const newHeight = value
            ? value
            : this.state.chartHeight + (increase ? 20 : -20);
        this.setState({
            chartHeight: newHeight
        });

        SettingsActions.changeViewSetting({
            chartHeight: newHeight
        });
    }

    _toggleBuySellPosition() {
        this.setState({
            buySellTop: !this.state.buySellTop
        });

        SettingsActions.changeViewSetting({
            buySellTop: !this.state.buySellTop
        });
    }

    _setReceive(state, isBid) {
        if (state.price.isValid() && state.for_sale.hasAmount()) {
            state.to_receive = state.for_sale.times(state.price);
            state.toReceiveText = state.to_receive
                .getAmount({real: true})
                .toString();
            return true;
        }
        return false;
    }

    _setForSale(state, isBid) {
        if (state.price.isValid() && state.to_receive.hasAmount()) {
            state.for_sale = state.to_receive.times(state.price, true);
            state.forSaleText = state.for_sale
                .getAmount({real: true})
                .toString();
            return true;
        }
        return false;
    }

    _setPrice(state) {
        if (state.for_sale.hasAmount() && state.to_receive.hasAmount()) {
            state.price = new Price({
                base: state.for_sale,
                quote: state.to_receive
            });
            state.priceText = state.price.toReal().toString();
            return true;
        }
        return false;
    }

    _setPriceText(state, isBid) {
        const currentBase = state[isBid ? "for_sale" : "to_receive"];
        const currentQuote = state[isBid ? "to_receive" : "for_sale"];
        if (currentBase.hasAmount() && currentQuote.hasAmount()) {
            state.priceText = new Price({
                base: currentBase,
                quote: currentQuote
            })
                .toReal()
                .toString();
        }
    }

    _onInputPrice(type, e) {
        let current = this.state[type];
        const isBid = type === "bid";
        current.price = new Price({
            base: current[isBid ? "for_sale" : "to_receive"],
            quote: current[isBid ? "to_receive" : "for_sale"],
            real: parseFloat(e.target.value) || 0
        });

        if (isBid) {
            this._setForSale(current, isBid) ||
                this._setReceive(current, isBid);
        } else {
            this._setReceive(current, isBid) ||
                this._setForSale(current, isBid);
        }

        current.priceText = e.target.value;
        this.forceUpdate();
    }

    _onInputSell(type, isBid, e) {
        let current = this.state[type];
        // const isBid = type === "bid";
        current.for_sale.setAmount({real: parseFloat(e.target.value) || 0});
        if (current.price.isValid()) {
            this._setReceive(current, isBid);
        } else {
            this._setPrice(current);
        }

        current.forSaleText = e.target.value;
        this._setPriceText(current, type === "bid");

        this.forceUpdate();
    }

    _onInputReceive(type, isBid, e) {
        let current = this.state[type];
        // const isBid = type === "bid";
        current.to_receive.setAmount({real: parseFloat(e.target.value) || 0});

        if (current.price.isValid()) {
            this._setForSale(current, isBid);
        } else {
            this._setPrice(current);
        }

        current.toReceiveText = e.target.value;
        this._setPriceText(current, type === "bid");
        this.forceUpdate();
    }

    isMarketFrozen() {
        let {baseAsset, quoteAsset} = this.props;

        let baseWhiteList = baseAsset
            .getIn(["options", "whitelist_markets"])
            .toJS();
        let quoteWhiteList = quoteAsset
            .getIn(["options", "whitelist_markets"])
            .toJS();
        let baseBlackList = baseAsset
            .getIn(["options", "blacklist_markets"])
            .toJS();
        let quoteBlackList = quoteAsset
            .getIn(["options", "blacklist_markets"])
            .toJS();

        if (
            quoteWhiteList.length &&
            quoteWhiteList.indexOf(baseAsset.get("id")) === -1
        ) {
            return {isFrozen: true, frozenAsset: quoteAsset.get("symbol")};
        }
        if (
            baseWhiteList.length &&
            baseWhiteList.indexOf(quoteAsset.get("id")) === -1
        ) {
            return {isFrozen: true, frozenAsset: baseAsset.get("symbol")};
        }

        if (
            quoteBlackList.length &&
            quoteBlackList.indexOf(baseAsset.get("id")) !== -1
        ) {
            return {isFrozen: true, frozenAsset: quoteAsset.get("symbol")};
        }
        if (
            baseBlackList.length &&
            baseBlackList.indexOf(quoteAsset.get("id")) !== -1
        ) {
            return {isFrozen: true, frozenAsset: baseAsset.get("symbol")};
        }

        return {isFrozen: false};
    }

    _toggleMiniChart() {
        SettingsActions.changeViewSetting({
            miniDepthChart: !this.props.miniDepthChart
        });
    }

    _onGroupOrderLimitChange(e) {
        if (e) e.preventDefault();
        let groupLimit = parseInt(e.target.value);
        MarketsActions.changeCurrentGroupLimit(groupLimit);
        if (groupLimit !== this.props.currentGroupOrderLimit) {
            MarketsActions.changeCurrentGroupLimit(groupLimit);
            let currentSub = this.props.sub.split("_");
            MarketsActions.unSubscribeMarket(currentSub[0], currentSub[1]).then(
                () => {
                    this.props.subToMarket(
                        this.props,
                        this.props.bucketSize,
                        groupLimit
                    );
                }
            );
        }
    }

    render() {
        let {
            currentAccount,
            marketLimitOrders,
            marketCallOrders,
            marketData,
            activeMarketHistory,
            invertedCalls,
            starredMarkets,
            quoteAsset,
            baseAsset,
            lowestCallPrice,
            marketStats,
            marketReady,
            marketSettleOrders,
            bucketSize,
            totals,
            feedPrice,
            buckets,
            coreAsset,
            trackedGroupsConfig,
            currentGroupOrderLimit
        } = this.props;

        const {
            combinedBids,
            combinedAsks,
            lowestAsk,
            highestBid,
            flatBids,
            flatAsks,
            flatCalls,
            flatSettles,
            groupedBids,
            groupedAsks
        } = marketData;

        let {
            exchangeLayout,
            bid,
            ask,
            showDepthChart,
            chartHeight,
            buyDiff,
            sellDiff,
            width,
            buySellTop,
            tabBuySell,
            tabVerticalPanel,
            tabTrades,
            hidePanel
        } = this.state;
        const {isFrozen, frozenAsset} = this.isMarketFrozen();

        /* Layout Definitions
        *
        * 1: Vertical Order Book A
        * 2: Vertical Order Book B
        * 3: Horizontal Order Book A
        * 4: Horizontal Order Book B
        */

        let base = null,
            quote = null,
            accountBalance = null,
            quoteBalance = null,
            baseBalance = null,
            coreBalance = null,
            quoteSymbol,
            baseSymbol,
            showCallLimit = false,
            latest,
            changeClass;

        const showVolumeChart = this.props.viewSettings.get(
            "showVolumeChart",
            true
        );

        if (quoteAsset.size && baseAsset.size && currentAccount.size) {
            base = baseAsset;
            quote = quoteAsset;
            baseSymbol = base.get("symbol");
            quoteSymbol = quote.get("symbol");

            accountBalance = currentAccount.get("balances").toJS();

            if (accountBalance) {
                for (let id in accountBalance) {
                    if (id === quote.get("id")) {
                        quoteBalance = accountBalance[id];
                    }
                    if (id === base.get("id")) {
                        baseBalance = accountBalance[id];
                    }
                    if (id === "1.3.0") {
                        coreBalance = accountBalance[id];
                    }
                }
            }

            showCallLimit = this._getSettlementInfo();
        }

        let quoteIsBitAsset = quoteAsset.get("bitasset_data_id") ? true : false;
        let baseIsBitAsset = baseAsset.get("bitasset_data_id") ? true : false;

        let spread =
            lowestAsk && highestBid
                ? lowestAsk.getPrice() - highestBid.getPrice()
                : 0;

        // Latest price
        if (activeMarketHistory.size) {
            let latest_two = activeMarketHistory.take(2);
            latest = latest_two.first();
            let second_latest = latest_two.last();

            changeClass =
                latest.getPrice() === second_latest.getPrice()
                    ? ""
                    : latest.getPrice() - second_latest.getPrice() > 0
                        ? "change-up"
                        : "change-down";
        }

        // Fees
        if (!coreAsset || !Object.keys(this.state.feeStatus).length) {
            return null;
        }

        let {
            sellFeeAsset,
            sellFeeAssets,
            sellFee,
            buyFeeAsset,
            buyFeeAssets,
            buyFee
        } = this._getFeeAssets(quote, base, coreAsset);

        // Decimals
        let hasPrediction =
            base.getIn(["bitasset", "is_prediction_market"]) ||
            quote.getIn(["bitasset", "is_prediction_market"]);

        let description = null;

        if (hasPrediction) {
            description = quoteAsset.getIn(["options", "description"]);
            description = assetUtils.parseDescription(description).main;
        }

        let smallScreen = false;
        if (width < 850) {
            smallScreen = true;
        }

        let orderMultiplier = exchangeLayout <= 2 ? 2 : 1;
        const minChartHeight = 300;
        const height = Math.max(
            this.state.height > 1100 ? chartHeight : chartHeight - 125,
            minChartHeight
        );

        let expirationType = this.state.expirationType;
        let expirationCustomTime = this.state.expirationCustomTime;

        // Reset TabBuySell
        tabBuySell =
            !tabBuySell ||
            (exchangeLayout == 3 &&
                smallScreen &&
                (tabBuySell != "buy" && tabBuySell != "sell"))
                ? "buy"
                : tabBuySell;

        let isPanelActive = !hidePanel && !smallScreen ? true : false;
        let isPredictionMarket = base.getIn([
            "bitasset",
            "is_prediction_market"
        ]);

        let actionCardIndex = 0;

        let buyForm = isFrozen ? null : (
            <BuySell
                key={`actionCard_${actionCardIndex++}`}
                onBorrow={baseIsBitAsset ? this._borrowBase.bind(this) : null}
                currentAccount={currentAccount}
                backedCoin={this.props.backedCoins.find(
                    a => a.symbol === base.get("symbol")
                )}
                currentBridges={
                    this.props.bridgeCoins.get(base.get("symbol")) || null
                }
                isOpen={this.state.buySellOpen}
                onToggleOpen={this._toggleOpenBuySell.bind(this)}
                className={cnames(
                    "small-12 no-padding middle-content",
                    exchangeLayout >= 2 || smallScreen
                        ? "medium-12"
                        : "medium-12 xlarge-12",
                    this.state.flipBuySell
                        ? `order-${
                              buySellTop ? 2 : 5 * orderMultiplier
                          } sell-form`
                        : `order-${
                              buySellTop ? 1 : 4 * orderMultiplier
                          } buy-form`
                )}
                type="bid"
                hideHeader={true}
                expirationType={expirationType["bid"]}
                expirations={this.EXPIRATIONS}
                expirationCustomTime={expirationCustomTime["bid"]}
                onExpirationTypeChange={this._handleExpirationChange.bind(
                    this,
                    "bid"
                )}
                onExpirationCustomChange={this._handleCustomExpirationChange.bind(
                    this,
                    "bid"
                )}
                amount={bid.toReceiveText}
                price={bid.priceText}
                total={bid.forSaleText}
                quote={quote}
                base={base}
                amountChange={this._onInputReceive.bind(this, "bid", true)}
                priceChange={this._onInputPrice.bind(this, "bid")}
                setPrice={this._currentPriceClick.bind(this)}
                totalChange={this._onInputSell.bind(this, "bid", false)}
                balance={baseBalance}
                balanceId={base.get("id")}
                onSubmit={this._createLimitOrderConfirm.bind(
                    this,
                    quote,
                    base,
                    baseBalance,
                    coreBalance,
                    buyFeeAsset,
                    "buy"
                )}
                balancePrecision={base.get("precision")}
                quotePrecision={quote.get("precision")}
                totalPrecision={base.get("precision")}
                currentPrice={lowestAsk.getPrice()}
                currentPriceObject={lowestAsk}
                account={currentAccount.get("name")}
                fee={buyFee}
                hasFeeBalance={this.state.feeStatus[buyFee.asset_id].hasBalance}
                feeAssets={buyFeeAssets}
                feeAsset={buyFeeAsset}
                onChangeFeeAsset={this.onChangeFeeAsset.bind(this, "buy")}
                isPredictionMarket={base.getIn([
                    "bitasset",
                    "is_prediction_market"
                ])}
                onFlip={
                    this.state._flipBuySell
                        ? null
                        : this._flipBuySell.bind(this)
                }
                onTogglePosition={
                    !this.state._toggleBuySellPosition
                        ? this._toggleBuySellPosition.bind(this)
                        : null
                }
                exchangeLayout={exchangeLayout}
                isPanelActive={isPanelActive}
            />
        );

        let sellForm = isFrozen ? null : (
            <BuySell
                key={`actionCard_${actionCardIndex++}`}
                onBorrow={quoteIsBitAsset ? this._borrowQuote.bind(this) : null}
                currentAccount={currentAccount}
                backedCoin={this.props.backedCoins.find(
                    a => a.symbol === quote.get("symbol")
                )}
                currentBridges={
                    this.props.bridgeCoins.get(quote.get("symbol")) || null
                }
                isOpen={this.state.buySellOpen}
                onToggleOpen={this._toggleOpenBuySell.bind(this)}
                className={cnames(
                    "small-12 no-padding middle-content",
                    exchangeLayout >= 2 || smallScreen
                        ? "medium-12"
                        : "medium-12 xlarge-12",
                    this.state.flipBuySell
                        ? `order-${
                              buySellTop ? 1 : 4 * orderMultiplier
                          } buy-form`
                        : `order-${
                              buySellTop ? 2 : 5 * orderMultiplier
                          } sell-form`
                )}
                type="ask"
                hideHeader={true}
                amount={ask.forSaleText}
                price={ask.priceText}
                total={ask.toReceiveText}
                quote={quote}
                base={base}
                expirationType={expirationType["ask"]}
                expirations={this.EXPIRATIONS}
                expirationCustomTime={expirationCustomTime["ask"]}
                onExpirationTypeChange={this._handleExpirationChange.bind(
                    this,
                    "ask"
                )}
                onExpirationCustomChange={this._handleCustomExpirationChange.bind(
                    this,
                    "ask"
                )}
                amountChange={this._onInputSell.bind(this, "ask", false)}
                priceChange={this._onInputPrice.bind(this, "ask")}
                setPrice={this._currentPriceClick.bind(this)}
                totalChange={this._onInputReceive.bind(this, "ask", true)}
                balance={quoteBalance}
                balanceId={quote.get("id")}
                onSubmit={this._createLimitOrderConfirm.bind(
                    this,
                    base,
                    quote,
                    quoteBalance,
                    coreBalance,
                    sellFeeAsset,
                    "sell"
                )}
                balancePrecision={quote.get("precision")}
                quotePrecision={quote.get("precision")}
                totalPrecision={base.get("precision")}
                currentPrice={highestBid.getPrice()}
                currentPriceObject={highestBid}
                account={currentAccount.get("name")}
                fee={sellFee}
                hasFeeBalance={
                    this.state.feeStatus[sellFee.asset_id].hasBalance
                }
                feeAssets={sellFeeAssets}
                feeAsset={sellFeeAsset}
                onChangeFeeAsset={this.onChangeFeeAsset.bind(this, "sell")}
                isPredictionMarket={quote.getIn([
                    "bitasset",
                    "is_prediction_market"
                ])}
                onFlip={
                    !this.state._flipBuySell
                        ? this._flipBuySell.bind(this)
                        : null
                }
                onTogglePosition={
                    !this.state._toggleBuySellPosition
                        ? this._toggleBuySellPosition.bind(this)
                        : null
                }
                exchangeLayout={exchangeLayout}
                isPanelActive={isPanelActive}
            />
        );

        let myMarkets = (
            <MyMarkets
                key={`actionCard_${actionCardIndex++}`}
                className="left-order-book no-overflow order-9"
                style={{height: smallScreen ? 420 : "auto", padding: smallScreen ? 10 : 0}}
                headerStyle={{paddingTop: 0, display: !smallScreen ? "display: none" : ""}}
                listHeight={
                    this.state.height
                        ? tabBuySell == "my-market"
                            ? this.state.height - 325
                            : this.state.height - 450
                        : null
                }
                columns={[
                    {name: "star", index: 1},
                    {name: "market", index: 2},
                    {name: "vol", index: 3},
                    {name: "price", index: 4},
                    {name: "change", index: 5}
                ]}
                findColumns={[
                    {name: "market", index: 1},
                    {name: "issuer", index: 2},
                    {name: "vol", index: 3},
                    {name: "add", index: 4}
                ]}
                current={`${quoteSymbol}_${baseSymbol}`}
                location={this.props.location}
                history={this.props.history}
                activeTab={smallScreen ? "my-market" : exchangeLayout < 3 ? tabVerticalPanel : tabBuySell}
            />
        );

        let orderBook = (
            <OrderBook
                key={`actionCard_${actionCardIndex++}`}
                latest={latest && latest.getPrice()}
                changeClass={changeClass}
                orders={marketLimitOrders}
                calls={marketCallOrders}
                invertedCalls={invertedCalls}
                combinedBids={combinedBids}
                combinedAsks={combinedAsks}
                highestBid={highestBid}
                lowestAsk={lowestAsk}
                totalBids={totals.bid}
                totalAsks={totals.ask}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                onClick={this._orderbookClick.bind(this)}
                horizontal={exchangeLayout >= 3 || smallScreen ? true : false}
                flipOrderBook={this.props.viewSettings.get("flipOrderBook")}
                orderBookReversed={this.props.viewSettings.get(
                    "orderBookReversed"
                )}
                marketReady={marketReady}
                wrapperClass={`order-${buySellTop ? 1 : 1} xlarge-order-${
                    buySellTop ? 1 : 1
                }`}
                currentAccount={this.props.currentAccount.get("id")}
                handleGroupOrderLimitChange={this._onGroupOrderLimitChange.bind(
                    this
                )}
                trackedGroupsConfig={trackedGroupsConfig}
                currentGroupOrderLimit={currentGroupOrderLimit}
                groupedBids={groupedBids}
                groupedAsks={groupedAsks}
                exchangeLayout={exchangeLayout}
                isPanelActive={isPanelActive}
            />
        );

        let buySellTab = (
            <div
                key={`actionCard_${actionCardIndex++}`}
                className={classnames(
                    "small-12 ",
                    exchangeLayout <= 2
                        ? "medium-12 large-6 xlarge-6"
                        : "medium-12 xlarge-12 no-padding"
                )}
                style={{paddingLeft: 5, paddingRight: 5}}
            >
                <Tabs
                    defaultActiveKey="buy"
                    activeKey={tabBuySell}
                    onChange={this._setTabBuySell.bind(this)}
                >
                    <Tabs.TabPane
                        tab={
                            <TranslateWithLinks
                                string="exchange.buysell_formatter"
                                noLink
                                noTip={false}
                                keys={[
                                    {
                                        type: "asset",
                                        value: quote.get("symbol"),
                                        arg: "asset"
                                    },
                                    {
                                        type: "translate",
                                        value: isPredictionMarket
                                            ? "exchange.short"
                                            : "exchange.buy",
                                        arg: "direction"
                                    }
                                ]}
                            />
                        }
                        key="buy"
                    >
                        {buyForm}
                    </Tabs.TabPane>
                    <Tabs.TabPane
                        tab={
                            <TranslateWithLinks
                                string="exchange.buysell_formatter"
                                noLink
                                noTip={false}
                                keys={[
                                    {
                                        type: "asset",
                                        value: quote.get("symbol"),
                                        arg: "asset"
                                    },
                                    {
                                        type: "translate",
                                        value: isPredictionMarket
                                            ? "exchange.short"
                                            : "exchange.sell",
                                        arg: "direction"
                                    }
                                ]}
                            />
                        }
                        key="sell"
                    >
                        {sellForm}
                    </Tabs.TabPane>
                    {exchangeLayout >= 3 && !smallScreen ? (
                        <Tabs.TabPane tab="My Markets" key="my-market" />
                    ) : null}
                    {exchangeLayout >= 3 && !smallScreen ? (
                        <Tabs.TabPane tab="Find Market" key="find-market" />
                    ) : null}
                </Tabs>
            </div>
        );

        let verticalPanel;

        if (smallScreen || hidePanel) {
            verticalPanel = null;
        } else if (exchangeLayout <= 2) {
            verticalPanel = (
                <div
                    className="left-order-book no-padding no-overflow"
                    style={{display: "block"}}
                    key={`actionCard_${actionCardIndex++}`}
                >
                    <div className="v-align no-padding align-center grid-block footer shrink column">
                        <Tabs
                            defaultActiveKey="order_book"
                            activeKey={tabVerticalPanel}
                            onChange={this._setTabVerticalPanel.bind(this)}
                        >
                            <Tabs.TabPane tab="Order Book" key="order_book" />
                            <Tabs.TabPane tab="My Markets" key="my-market" />
                            <Tabs.TabPane tab="Find Market" key="find-market" />
                        </Tabs>
                    </div>
                    {tabVerticalPanel == "order_book" ? orderBook : null}
                    {tabVerticalPanel == "order_book" ? (
                        <div className="v-align no-padding align-center grid-block footer shrink column">
                            <div className="v-align grid-block align-center grouped_order">
                                {trackedGroupsConfig ? (
                                    <GroupOrderLimitSelector
                                        trackedGroupsConfig={
                                            trackedGroupsConfig
                                        }
                                        handleGroupOrderLimitChange={this._onGroupOrderLimitChange.bind(
                                            this
                                        )}
                                        currentGroupOrderLimit={
                                            currentGroupOrderLimit
                                        }
                                    />
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                    {tabVerticalPanel == "my-market" ||
                    tabVerticalPanel == "find-market"
                        ? myMarkets
                        : null}
                </div>
            );
        } else if (exchangeLayout >= 3) {
            verticalPanel = (
                <div
                    className="left-order-book no-padding no-overflow"
                    style={{display: "block"}}
                >
                    {buySellTab}
                    {tabBuySell == "my-market" || tabBuySell == "find-market"
                        ? myMarkets
                        : null}
                </div>
            );
        }

        let verticalPanelToggle = !smallScreen ? (
            <div
                style={{width: "auto", paddingTop: "calc(50vh - 120px)"}}
                onClick={this._togglePanel.bind(this)}
            >
                <AntIcon
                    type={
                        (exchangeLayout == 1 && !hidePanel) ||
                        (exchangeLayout != 1 && hidePanel)
                            ? "caret-left"
                            : "caret-right"
                    }
                />
            </div>
        ) : null;

        let marketHistory = (
            <MarketHistory
                key={`actionCard_${actionCardIndex++}`}
                className={cnames(
                    exchangeLayout == 4
                        ? isPanelActive
                            ? "medium-6 large-6 xlarge-6"
                            : "medium-6 xlarge-4"
                        : "medium-12 xlarge-12",
                    "no-padding no-overflow middle-content small-12 order-3"
                )}
                noHeader={exchangeLayout == 4 ? false : true}
                headerStyle={{paddingTop: 0}}
                history={activeMarketHistory}
                currentAccount={currentAccount}
                myHistory={currentAccount.get("history")}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                activeTab={"history"}
                isPanelActive={isPanelActive}
                exchangeLayout={exchangeLayout}
            />
        );

        let myMarketHistory = (
            <MarketHistory
                key={`actionCard_${actionCardIndex++}`}
                className={cnames(
                    exchangeLayout == 4
                        ? isPanelActive
                            ? "medium-6 xlarge-6"
                            : "medium-6 xlarge-4"
                        : "medium-12 xlarge-12",
                    "no-padding no-overflow middle-content small-12 order-6"
                )}
                noHeader={exchangeLayout == 4 ? false : true}
                headerStyle={{paddingTop: 0}}
                history={activeMarketHistory}
                currentAccount={currentAccount}
                myHistory={currentAccount.get("history")}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                activeTab={"my_history"}
                isPanelActive={isPanelActive}
                exchangeLayout={exchangeLayout}
            />
        );

        let myOpenOrders = (
            <MyOpenOrders
                smallScreen={this.props.smallScreen}
                className={classnames(
                    exchangeLayout == 4
                        ? isPanelActive
                            ? "medium-6 xlarge-6"
                            : "medium-6 xlarge-4"
                        : "medium-12 xlarge-12",
                    `small-12 no-padding align-spaced ps-container middle-content order-5
                    }`
                )}
                key={`actionCard_${actionCardIndex++}`}
                headerStyle={{paddingTop: 0}}
                noHeader={exchangeLayout == 4 ? false : true}
                orders={marketLimitOrders}
                settleOrders={marketSettleOrders}
                currentAccount={currentAccount}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                activeTab={"my_orders"}
                onCancel={this._cancelLimitOrder.bind(this)}
                flipMyOrders={this.props.viewSettings.get("flipMyOrders")}
                feedPrice={this.props.feedPrice}
                exchangeLayout={exchangeLayout}
                hidePanel={hidePanel}
                isPanelActive={isPanelActive}
            />
        );

        let settlementOrders = (
            <MyOpenOrders
                smallScreen={this.props.smallScreen}
                className={classnames(
                    exchangeLayout == 4
                        ? isPanelActive
                            ? "medium-6 xlarge-6"
                            : "medium-6 xlarge-4"
                        : "medium-12 xlarge-12",
                    `small-12 no-padding align-spaced ps-container middle-content order-4
                    }`
                )}
                key={`actionCard_${actionCardIndex++}`}
                headerStyle={{paddingTop: 0}}
                noHeader={exchangeLayout != 4 ? true : false}
                orders={marketLimitOrders}
                settleOrders={marketSettleOrders}
                currentAccount={currentAccount}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                activeTab={"open_settlement"}
                onCancel={this._cancelLimitOrder.bind(this)}
                flipMyOrders={this.props.viewSettings.get("flipMyOrders")}
                feedPrice={this.props.feedPrice}
                exchangeLayout={exchangeLayout}
                smallScreen={smallScreen}
                hidePanel={hidePanel}
                isPanelActive={isPanelActive}
            />
        );

        let marketsTab = (
            <div
                key={`actionCard_${actionCardIndex++}`}
                className={cnames(
                    exchangeLayout == 3
                        ? hidePanel
                            ? "order-2 small-12 medium-12 large-6 xlarge-4"
                            : "order-2 small-12 medium-12 large-12 xlarge-7"
                        : exchangeLayout <= 2
                            ? hidePanel
                                ? "small-12 medium-12 large-6 xlarge-6"
                                : "small-12 medium-12 large-6 xlarge-6"
                            : "small-12 medium-12 xlarge-6"
                )}
                style={{paddingLeft: 5, paddingRight: 5}}
            >
                <Tabs
                    defaultActiveKey="history"
                    activeKey={tabTrades}
                    onChange={this._setTabTrades.bind(this)}
                >
                    <Tabs.TabPane tab="Market Trades" key="history">
                        {marketHistory}
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="My Trades" key="my_history">
                        {myMarketHistory}
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="My Open Orders" key="my_orders">
                        {myOpenOrders}
                    </Tabs.TabPane>
                    {marketSettleOrders.size > 0 ? (
                        <Tabs.TabPane tab="Settle Orders" key="open_settlement">
                            {settlementOrders}
                        </Tabs.TabPane>
                    ) : null}
                </Tabs>
            </div>
        );

        let actionCards = [];
        if (!smallScreen) {
            if (exchangeLayout >= 3) {
                actionCards.push(orderBook);
            }

            if (exchangeLayout == 4) {
                actionCards.push(marketHistory);
                actionCards.push(settlementOrders);
                actionCards.push(myMarketHistory);
                actionCards.push(myOpenOrders);
            }

            if (exchangeLayout <= 3) {
                actionCards.push(marketsTab);
            }

            if (exchangeLayout <= 2) {
                actionCards.push(buySellTab);
            }
        } else {
            actionCards.push(buySellTab);
            actionCards.push(orderBook);

            if (exchangeLayout == 4) {
                actionCards.push(marketHistory);
                actionCards.push(settlementOrders);
                actionCards.push(myMarketHistory);
                actionCards.push(myOpenOrders);
            }

            if (exchangeLayout <= 3) {
                actionCards.push(marketsTab);
            }

            if (exchangeLayout == 3) {
                actionCards.push(buySellTab);
            }

            if (exchangeLayout <= 2) {
                actionCards.push(buySellTab);
            }

            actionCards.push(myMarkets);
        }

        return (
            <div className="grid-block vertical">
                {!this.props.marketReady ? <LoadingIndicator /> : null}
                <ExchangeHeader
                    account={this.props.currentAccount}
                    quoteAsset={quoteAsset}
                    baseAsset={baseAsset}
                    hasPrediction={hasPrediction}
                    starredMarkets={starredMarkets}
                    lowestAsk={lowestAsk}
                    highestBid={highestBid}
                    lowestCallPrice={lowestCallPrice}
                    showCallLimit={showCallLimit}
                    feedPrice={feedPrice}
                    marketReady={marketReady}
                    latestPrice={latest && latest.getPrice()}
                    showDepthChart={showDepthChart}
                    marketStats={marketStats}
                    selectedMarketPickerAsset={this.state.marketPickerAsset}
                    onToggleMarketPicker={this._toggleMarketPicker.bind(this)}
                    onToggleSettings={this._toggleSettings.bind(this)}
                    showVolumeChart={showVolumeChart}
                />

                <div className="grid-block page-layout market-layout">
                    <MarketPicker
                        ref="marketPicker"
                        modalId="marketPicker"
                        marketPickerAsset={this.state.marketPickerAsset}
                        onToggleMarketPicker={this._toggleMarketPicker.bind(
                            this
                        )}
                        {...this.props}
                    />
                    <Settings 
                        ref="settingsModal"
                        modalId="settingsModal"
                        exchangeLayout={exchangeLayout}    
                        showDepthChart={showDepthChart}
                        chartHeight={chartHeight}
                        onToggleSettings={this._toggleSettings.bind(this)}
                        onChangeChartHeight={this.onChangeChartHeight.bind(this)}
                        onChangeLayout={this._setExchangeLayout.bind(this)}
                        onToggleCharts={this._toggleCharts.bind(this)}
                    />

                    <AccountNotifications />
                    {/* Main vertical block with content */}

                    {/* Left Column - Open Orders */}
                    {exchangeLayout == 1 ? (
                        <div className="grid-block left-column shrink no-overflow">
                            {isPanelActive ? verticalPanel : null}
                            {verticalPanelToggle}
                        </div>
                    ) : null}

                    {/* Center Column */}
                    <div
                        style={{paddingTop: 0}}
                        className={cnames(
                            "grid-block main-content vertical no-overflow"
                        )}
                    >
                        <div
                            className="grid-block vertical no-padding ps-container"
                            id="CenterContent"
                            ref="center"
                        >
                            <div>
                                {!showDepthChart ? (
                                    <div
                                        className="grid-block shrink no-overflow"
                                        id="market-charts"
                                    >
                                        {/* Price history chart */}
                                        <TradingViewPriceChart
                                            locale={this.props.locale}
                                            dataFeed={this.props.dataFeed}
                                            baseSymbol={baseSymbol}
                                            quoteSymbol={quoteSymbol}
                                            marketReady={marketReady}
                                            theme={this.props.settings.get(
                                                "themes"
                                            )}
                                            buckets={buckets}
                                            bucketSize={bucketSize}
                                            currentPeriod={
                                                this.state.currentPeriod
                                            }
                                            chartHeight={
                                                this.state.height > 1100
                                                    ? chartHeight
                                                    : chartHeight - 150
                                            }
                                            mobile={width < 800}
                                        />
                                    </div>
                                ) : (
                                    <div className="grid-block vertical no-padding shrink">
                                        <DepthHighChart
                                            marketReady={marketReady}
                                            orders={marketLimitOrders}
                                            showCallLimit={showCallLimit}
                                            call_orders={marketCallOrders}
                                            flat_asks={flatAsks}
                                            flat_bids={flatBids}
                                            flat_calls={
                                                showCallLimit ? flatCalls : []
                                            }
                                            flat_settles={
                                                this.props.settings.get(
                                                    "showSettles"
                                                ) && flatSettles
                                            }
                                            settles={marketSettleOrders}
                                            invertedCalls={invertedCalls}
                                            totalBids={totals.bid}
                                            totalAsks={totals.ask}
                                            base={base}
                                            quote={quote}
                                            height={
                                                this.state.height > 1100
                                                    ? chartHeight
                                                    : chartHeight - 150
                                            }
                                            isPanelActive={isPanelActive}
                                            onClick={this._depthChartClick.bind(
                                                this,
                                                base,
                                                quote
                                            )}
                                            feedPrice={
                                                !hasPrediction &&
                                                feedPrice &&
                                                feedPrice.toReal()
                                            }
                                            spread={spread}
                                            LCP={
                                                showCallLimit
                                                    ? lowestCallPrice
                                                    : null
                                            }
                                            exchangeLayout={exchangeLayout}
                                            hasPrediction={hasPrediction}
                                            noFrame={false}
                                            theme={this.props.settings.get(
                                                "themes"
                                            )}
                                            centerRef={this.refs.center}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="grid-block no-overflow wrap shrink">
                                {actionCards}
                            </div>
                        </div>
                    </div>
                    {/* End of Main Content Column */}

                    {/* Right Column */}
                    {exchangeLayout > 1 ? (
                        <div
                            ref="wrapper"
                            className="grid-block right-column shrink no-overflow"
                            style={{maxWidth: 450}}
                        >
                            {verticalPanelToggle}
                            {isPanelActive ? verticalPanel : null}
                        </div>
                    ) : null}

                    {/* End of Second Vertical Block */}
                </div>

                {quoteIsBitAsset ? (
                    <BorrowModal
                        ref="borrowQuote"
                        modalId={"borrow_modal_quote_" + quoteAsset.get("id")}
                        quote_asset={quoteAsset.get("id")}
                        backing_asset={quoteAsset.getIn([
                            "bitasset",
                            "options",
                            "short_backing_asset"
                        ])}
                        account={currentAccount}
                    />
                ) : null}
                {baseIsBitAsset ? (
                    <BorrowModal
                        ref="borrowBase"
                        modalId={"borrow_modal_base_" + baseAsset.get("id")}
                        quote_asset={baseAsset.get("id")}
                        backing_asset={baseAsset.getIn([
                            "bitasset",
                            "options",
                            "short_backing_asset"
                        ])}
                        account={currentAccount}
                    />
                ) : null}
            </div>
        );
    }
}

export default Exchange;
