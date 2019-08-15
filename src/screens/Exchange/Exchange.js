// @flow
/*
    Pillar Wallet: the personal data locker
    Copyright (C) 2019 Stiftung Pillar Project

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/
import * as React from 'react';
import { FlatList, View } from 'react-native';
import type { NavigationScreenProp } from 'react-navigation';
import styled from 'styled-components/native';
import { connect } from 'react-redux';
import debounce from 'lodash.debounce';
import { formatAmount, formatMoney, getCurrencySymbol, isValidNumber } from 'utils/common';
import t from 'tcomb-form-native';
import { CachedImage } from 'react-native-cached-image';
import { BigNumber } from 'bignumber.js';
import { createStructuredSelector } from 'reselect';
import Intercom from 'react-native-intercom';
import get from 'lodash.get';

import { baseColors, fontSizes, spacing, UIColors } from 'utils/variables';
import { getBalance, getRate } from 'utils/assets';
import { getProviderLogo, isFiatProvider, isFiatCurrency } from 'utils/exchange';
import { getSmartWalletStatus } from 'utils/smartWallet';

import ContainerWithHeader from 'components/Layout/ContainerWithHeader';
import { ScrollWrapper } from 'components/Layout';
import ShadowedCard from 'components/ShadowedCard';
import { BaseText, Paragraph } from 'components/Typography';
import SelectorInput from 'components/SelectorInput';
import Button from 'components/Button';
import Spinner from 'components/Spinner';
import { DeploymentView, getDeployErrorMessage } from 'components/DeploymentView';

import {
  searchOffersAction,
  takeOfferAction,
  authorizeWithShapeshiftAction,
  resetOffersAction,
  setExecutingTransactionAction,
  setTokenAllowanceAction,
  markNotificationAsSeenAction,
} from 'actions/exchangeActions';
import { deploySmartWalletAction } from 'actions/smartWalletActions';

import type { Offer, ExchangeSearchRequest, Allowance, ExchangeProvider } from 'models/Offer';
import type { Asset, Balances, Rates } from 'models/Asset';
import type { SmartWalletStatus } from 'models/SmartWalletStatus';
import type { Accounts } from 'models/Account';

import { EXCHANGE_CONFIRM, EXCHANGE_INFO, FIAT_EXCHANGE, SMART_WALLET_INTRO } from 'constants/navigationConstants';
import { defaultFiatCurrency, ETH } from 'constants/assetsConstants';
import { PROVIDER_SHAPESHIFT } from 'constants/exchangeConstants';
import { SMART_WALLET_UPGRADE_STATUSES } from 'constants/smartWalletConstants';
import { ACCOUNT_TYPES } from 'constants/accountsConstants';

import { accountBalancesSelector } from 'selectors/balances';
import { paymentNetworkAccountBalancesSelector } from 'selectors/paymentNetwork';

import { fiatCurrencies } from 'fixtures/assets';
import { getActiveAccountType } from 'utils/accounts';

// partials
import { ExchangeStatus } from './ExchangeStatus';

const CardWrapper = styled.TouchableOpacity`
  width: 100%;
`;

const CardRow = styled.View`
  flex: 1;
  flex-direction: row;
  justify-content: space-between;
  align-items: ${props => props.alignTop ? 'flex-start' : 'flex-end'};
  padding: 10px 0;
  ${props => props.withBorder
    ? `border-bottom-width: 1px;
      border-bottom-color: ${baseColors.mediumLightGray};`
    : ''}
`;

const CardInnerRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  padding-left: 10px;
  flex-wrap: wrap;
`;

const CardColumn = styled.View`
  flex-direction: column;
  align-items: ${props => props.alignRight ? 'flex-end' : 'flex-start'};
  justify-content: flex-start;
`;

const CardText = styled(BaseText)`
  line-height: 18px;
  font-size: ${fontSizes.extraSmall}px;
  letter-spacing: 0.18px;
  color: ${props => props.label ? baseColors.slateBlack : baseColors.darkGray};
  flex-wrap: wrap;
  width: 100%;
`;

const ListHeader = styled.View`
  width: 100%;
  align-items: center;
`;

const CardButton = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: 4px 0;
  margin-left: 10px;
`;

const ButtonLabel = styled(BaseText)`
  color: ${props => props.color ? props.color : baseColors.slateBlack};
  font-size: ${fontSizes.extraSmall}px;
`;

const FormWrapper = styled.View`
  padding: 0 ${spacing.large}px;
  margin-top: ${spacing.large}px;
`;

const ProviderIcon = styled(CachedImage)`
  width: 24px;
  height: 24px;
`;

const ESWrapper = styled.View`
  width: 100%;
  align-items: center;
`;

const CardNote = styled(BaseText)`
  flex-direction: row;
  align-items: center;
  padding: 4px 0;
  margin-left: 10px;
  color: ${props => props.color ? props.color : baseColors.slateBlack};
  font-size: ${fontSizes.extraSmall}px;
`;

type Props = {
  rates: Rates,
  navigation: NavigationScreenProp<*>,
  baseFiatCurrency: string,
  user: Object,
  searchOffers: (string, string, number) => void,
  offers: Offer[],
  takeOffer: (string, string, number, string, Function) => Object,
  authorizeWithShapeshift: Function,
  supportedAssets: Asset[],
  balances: Balances,
  resetOffers: Function,
  paymentNetworkBalances: Balances,
  exchangeSearchRequest: ExchangeSearchRequest,
  setExecutingTransaction: Function,
  setTokenAllowance: Function,
  exchangeAllowances: Allowance[],
  connectedProviders: ExchangeProvider[],
  hasUnreadExchangeNotification: boolean,
  markNotificationAsSeen: Function,
  oAuthAccessToken: string,
  exchangeWithFiatEnabled: boolean,
  accounts: Accounts,
  smartWalletState: Object,
  deploySmartWallet: Function,
  smartWalletFeatureEnabled: boolean,
};

type State = {
  value: Object,
  shapeshiftAuthPressed: boolean,
  formOptions: Object,
  // offer id will be passed to prevent double clicking
  pressedOfferId: string,
  pressedTokenAllowanceId: string,
};

const getAvailable = (_min, _max, rate) => {
  if (!_min && !_max) {
    return 'N/A';
  }
  let min = (new BigNumber(rate)).multipliedBy(_min);
  let max = (new BigNumber(rate)).multipliedBy(_max);
  if ((min.gte(0) && min.lt(0.01)) || (max.gte(0) && max.lt(0.01))) {
    if (max.isZero()) return '>0.01';
    const maxAvailable = max.lt(0.01)
      ? '<0.01'
      : formatMoney(max.toNumber(), 2);
    return min.eq(max) || min.isZero()
      // max available displayed if equal to min or min is zero
      ? maxAvailable
      : '<0.01 - <0.01';
  }
  min = min.toNumber();
  max = max.toNumber();
  if (!min || !max || min === max) {
    return `${formatMoney(min || max, 2)}`;
  }
  return `${formatMoney(min, 2)} - ${formatMoney(max, 2)}`;
};

const { Form } = t.form;

const MIN_TX_AMOUNT = 0.000000000000000001;

const settingsIcon = require('assets/icons/icon_key.png');

const calculateAmountToBuy = (askRate: number | string, amountToSell: number | string) => {
  return (new BigNumber(askRate)).multipliedBy(amountToSell).toFixed();
};

const generateFormStructure = () => {
  let amount;

  const FromOption = t.refinement(t.Object, ({ selector, input }) => {
    if (!selector || !Object.keys(selector).length) return false;
    // we allow validation if nothing is entered, but we want to validate the input to be number is something is present
    if (input && isValidNumber(input)) {
      const { symbol, decimals } = selector;
      const isFiat = isFiatCurrency(symbol);
      amount = parseFloat(input);
      if (decimals === 0 && amount.toString().indexOf('.') > -1 && !isFiat) {
        return false;
      } else if (isFiat) {
        return true;
      }
      return amount >= MIN_TX_AMOUNT;
    }
    return true;
  });

  FromOption.getValidationErrorMessage = ({ selector, input }) => {
    const { symbol, decimals } = selector;

    const isFiat = isFiatCurrency(symbol);

    if (!isValidNumber(input.toString())) {
      return 'Incorrect number entered.';
    } else if (parseFloat(input) < 0) {
      return 'Amount should be bigger than 0.';
    } else if (amount < MIN_TX_AMOUNT && !isFiat) {
      return 'Amount should be greater than 1 Wei (0.000000000000000001 ETH).';
    } else if (decimals === 0 && amount.toString().indexOf('.') > -1) {
      return 'Amount should not contain decimal places';
    }

    return true;
  };

  const ToOption = t.refinement(t.Object, ({ selector }) => {
    return !!Object.keys(selector).length;
  });

  ToOption.getValidationErrorMessage = () => {
    return false; // should still validate (to not trigger search if empty), yet error should not be visible to user
  };

  return t.struct({
    fromInput: FromOption,
    toInput: ToOption,
  });
};

function SelectorInputTemplate(locals) {
  const {
    config: {
      label,
      hasInput,
      wrapperStyle,
      placeholderSelector,
      placeholderInput,
      options,
      horizontalOptions = [],
      inputAddonText,
      inputRef,
      onSelectorOpen,
    },
  } = locals;
  const errorMessage = locals.error;
  const inputProps = {
    onChange: locals.onChange,
    onBlur: locals.onBlur,
    keyboardType: locals.keyboardType,
    autoCapitalize: locals.autoCapitalize,
    maxLength: 42,
    label,
    placeholderSelector,
    placeholder: placeholderInput,
    onSelectorOpen,
  };

  return (
    <SelectorInput
      inputProps={inputProps}
      options={options}
      horizontalOptions={horizontalOptions}
      showOptionsTitles={!!horizontalOptions.length}
      optionsTitle="CRYPTO"
      horizontalOptionsTitle="FIAT"
      errorMessage={errorMessage}
      hasInput={hasInput}
      wrapperStyle={wrapperStyle}
      value={locals.value}
      inputAddonText={inputAddonText}
      inputRef={inputRef}
    />
  );
}

/**
 * avoid text overlapping on many decimals,
 * full amount will be displayed n confirm screen
 * also show only 2 decimals for amounts above 1.00
 * to avoid same text overlapping in the other side
 */
function formatAmountDisplay(value: number | string) {
  if (!value) return 0;
  const amount = parseFloat(value);
  if (amount > 1) {
    return formatMoney(amount, 2);
  }
  return amount > 0.00001 ? formatMoney(amount, 5) : '<0.00001';
}

class ExchangeScreen extends React.Component<Props, State> {
  exchangeForm: t.form;
  fromInputRef: ?Object;

  constructor(props: Props) {
    super(props);
    this.state = {
      shapeshiftAuthPressed: false,
      pressedOfferId: '',
      pressedTokenAllowanceId: '',
      value: {
        fromInput: {
          selector: {},
          input: '',
        },
        toInput: {
          selector: {},
          input: '',
        },
      },
      formOptions: {
        fields: {
          fromInput: {
            keyboardType: 'decimal-pad',
            autoCapitalize: 'words',
            template: SelectorInputTemplate,
            config: {
              label: 'Selling',
              hasInput: true,
              options: [],
              horizontalOptions: [],
              placeholderSelector: 'select',
              placeholderInput: '0',
              inputRef: (ref) => { this.fromInputRef = ref; },
            },
            transformer: {
              parse: (value) => {
                let formattedAmount = value.input;
                if (value.input) formattedAmount = value.input.toString().replace(/,/g, '.');
                return { ...value, input: formattedAmount };
              },
              format: (value) => {
                let formattedAmount = value.input;
                if (value.input) formattedAmount = value.input.toString().replace(/,/g, '.');
                return { ...value, input: formattedAmount };
              },
            },
          },
          toInput: {
            template: SelectorInputTemplate,
            config: {
              label: 'Buying',
              options: [],
              wrapperStyle: { marginTop: spacing.mediumLarge },
              placeholderSelector: 'select asset',
              onSelectorOpen: () => {
                if (this.fromInputRef) this.fromInputRef.blur();
              },
            },
          },
        },
      },
    };
    this.fromInputRef = React.createRef();
    this.triggerSearch = debounce(this.triggerSearch, 500);
  }

  componentDidMount() {
    const { exchangeSearchRequest = {}, baseFiatCurrency } = this.props;
    this.provideOptions();
    const fiatCurrency = baseFiatCurrency || defaultFiatCurrency;
    const defaultFrom = this.checkIfAssetsExchangeIsAllowed() ? ETH : fiatCurrency;
    const { fromAssetCode = defaultFrom, toAssetCode, fromAmount } = exchangeSearchRequest;
    this.setInitialSelection(fromAssetCode, toAssetCode, fromAmount);
  }

  componentDidUpdate(prevProps: Props) {
    const {
      supportedAssets,
      navigation,
      oAuthAccessToken,
      resetOffers,
    } = this.props;
    if (supportedAssets !== prevProps.supportedAssets) {
      this.provideOptions();
    }

    const fromAssetCode = navigation.getParam('fromAssetCode') || '';
    const toAssetCode = navigation.getParam('toAssetCode') || '';
    if (fromAssetCode || toAssetCode) {
      this.setInitialSelection(fromAssetCode, toAssetCode);
      // reset to prevent nav value change over newly selected
      navigation.setParams({ fromAssetCode: null, toAssetCode: null });
    }
    if (prevProps.oAuthAccessToken !== oAuthAccessToken) {
      // access token has changed, init search again
      resetOffers();
      this.triggerSearch();
    }
  }

  checkIfAssetsExchangeIsAllowed = () => {
    const { accounts, smartWalletState, smartWalletFeatureEnabled } = this.props;
    const activeAccountType = getActiveAccountType(accounts);
    const smartWalletStatus: SmartWalletStatus = getSmartWalletStatus(accounts, smartWalletState);
    const isSmartWallet = smartWalletFeatureEnabled && activeAccountType === ACCOUNT_TYPES.SMART_WALLET;
    return !isSmartWallet
      || (isSmartWallet && smartWalletStatus.status === SMART_WALLET_UPGRADE_STATUSES.DEPLOYMENT_COMPLETE);
  };

  provideOptions = () => {
    const { supportedAssets, exchangeWithFiatEnabled } = this.props;
    const fiatOptionsFrom = this.generateFiatOptions();
    const assetsOptions = this.generateAssetsOptions(supportedAssets);
    const assetsOptionsTo = assetsOptions.filter((option) => option.value !== ETH);
    const thisStateFormOptionsCopy = { ...this.state.formOptions };
    thisStateFormOptionsCopy.fields.fromInput.config.options = assetsOptions;
    if (exchangeWithFiatEnabled) {
      thisStateFormOptionsCopy.fields.fromInput.config.horizontalOptions = fiatOptionsFrom;
    }
    thisStateFormOptionsCopy.fields.toInput.config.options = assetsOptionsTo;

    this.setState({
      formOptions: thisStateFormOptionsCopy,
    });
  };

  setInitialSelection = (fromAssetCode: string, toAssetCode?: string, fromAmount?: number) => {
    const { supportedAssets } = this.props;
    let fromAssetOption;
    if (isFiatCurrency(fromAssetCode)) {
      fromAssetOption = this.generateFiatOptions().find(({ symbol }) => symbol === fromAssetCode);
    } else {
      const fromAsset = supportedAssets.find(({ symbol }) => symbol === fromAssetCode);
      // $FlowFixMe
      ([fromAssetOption] = this.generateAssetsOptions([fromAsset])); // take first
    }

    const initialFormState = {
      ...this.state.value,
      fromInput: {
        selector: fromAssetOption,
        input: fromAmount ? fromAmount.toString() : '',
      },
    };
    if (toAssetCode) {
      const toAsset = supportedAssets.find(({ symbol }) => symbol === toAssetCode);
      if (toAsset) {
        const [toAssetOption] = this.generateAssetsOptions([toAsset]); // take first
        initialFormState.toInput = {
          selector: toAssetOption,
        };
      }
    }
    this.setState({ value: initialFormState });
  };

  triggerSearch = () => {
    const {
      searchOffers,
    } = this.props;
    const {
      value: {
        fromInput: {
          selector: { value: from },
          input: amountString = 1, // 1 is default quantity in exchange back-end
        } = {},
        toInput: {
          selector: {
            value: to,
          },
        } = {},
      } = {},
    } = this.state;
    // if value is empty string set it to 1 as default quantity in exchange back-end
    const amount = parseFloat(amountString === '' ? 1 : amountString);
    if (!from || !to || !amount) return;
    searchOffers(from, to, amount);
  };

  onShapeshiftAuthPress = () => {
    const { authorizeWithShapeshift } = this.props;
    this.setState({ shapeshiftAuthPressed: true }, async () => {
      await authorizeWithShapeshift();
      this.setState({ shapeshiftAuthPressed: false });
    });
  };

  onFiatOfferPress = (offer: Offer) => {
    const {
      navigation,
    } = this.props;
    const {
      value: {
        fromInput: {
          input: selectedSellAmount,
        },
      },
    } = this.state;

    navigation.navigate(FIAT_EXCHANGE, {
      fiatOfferOrder: {
        ...offer,
        amount: selectedSellAmount,
      },
    });
  };

  onOfferPress = (offer: Offer) => {
    const {
      navigation,
      takeOffer,
      setExecutingTransaction,
    } = this.props;
    const {
      value: {
        fromInput: {
          input: selectedSellAmount,
        },
      },
    } = this.state;
    const {
      _id,
      provider,
      fromAssetCode,
      toAssetCode,
      askRate,
    } = offer;
    const amountToSell = parseFloat(selectedSellAmount);
    const amountToBuy = calculateAmountToBuy(askRate, amountToSell);
    this.setState({ pressedOfferId: _id }, () => {
      takeOffer(fromAssetCode, toAssetCode, amountToSell, provider, order => {
        this.setState({ pressedOfferId: '' }); // reset offer card button loading spinner
        if (!order || !Object.keys(order).length) return;
        setExecutingTransaction();
        navigation.navigate(EXCHANGE_CONFIRM, {
          offerOrder: {
            ...order,
            receiveAmount: amountToBuy,
            provider,
          },
        });
      });
    });
  };

  onSetTokenAllowancePress = (offer: Offer) => {
    const {
      navigation,
      setTokenAllowance,
      setExecutingTransaction,
    } = this.props;
    const {
      _id,
      provider,
      fromAssetCode,
    } = offer;
    this.setState({ pressedTokenAllowanceId: _id }, () => {
      setTokenAllowance(fromAssetCode, provider, (response) => {
        this.setState({ pressedTokenAllowanceId: '' }); // reset set allowance button to be enabled
        if (!response || !Object.keys(response).length) return;
        setExecutingTransaction();
        navigation.navigate(EXCHANGE_CONFIRM, {
          offerOrder: {
            ...response,
            provider,
            fromAssetCode,
            setTokenAllowance: true,
          },
        });
      });
    });
  };

  setFromAmount = amount => {
    this.props.resetOffers(); // reset all cards before they change according to input values
    this.setState(prevState => ({
      value: {
        ...prevState.value,
        fromInput: {
          ...prevState.value.fromInput,
          input: amount,
        },
      },
    }), () => {
      const validation = this.exchangeForm.validate();
      const { errors = [] } = validation;
      if (errors.length) return;
      this.triggerSearch();
    });
  };

  renderOffers = ({ item: offer }, disableNonFiatExchange: boolean) => {
    const {
      value: { fromInput },
      pressedOfferId,
      shapeshiftAuthPressed,
      pressedTokenAllowanceId,
    } = this.state;
    const { exchangeAllowances, connectedProviders } = this.props;
    const { input: selectedSellAmount } = fromInput;
    const {
      _id: offerId,
      minQuantity,
      maxQuantity,
      askRate,
      fromAssetCode,
      toAssetCode,
      provider: offerProvider,
      feeAmount,
      extraFeeAmount,
      quoteCurrencyAmount,
      offerRestricted,
    } = offer;
    let { allowanceSet = true } = offer;

    let storedAllowance;
    if (!allowanceSet) {
      storedAllowance = exchangeAllowances.find(
        ({ provider, assetCode }) => fromAssetCode === assetCode && provider === offerProvider,
      );
      allowanceSet = storedAllowance && storedAllowance.enabled;
    }

    const available = getAvailable(minQuantity, maxQuantity, askRate);
    const amountToBuy = calculateAmountToBuy(askRate, selectedSellAmount);
    const isTakeOfferPressed = pressedOfferId === offerId;
    const isSetAllowancePressed = pressedTokenAllowanceId === offerId;
    const isShapeShift = offerProvider === PROVIDER_SHAPESHIFT;
    const providerLogo = getProviderLogo(offerProvider);

    const amountToBuyString = formatAmountDisplay(amountToBuy);

    let shapeshiftAccessToken;
    if (isShapeShift) {
      ({ extra: shapeshiftAccessToken } = connectedProviders
        .find(({ id: providerId }) => providerId === PROVIDER_SHAPESHIFT) || {});
    }

    const askRateBn = new BigNumber(askRate);

    const amountToSell = parseFloat(selectedSellAmount);
    const minQuantityNumeric = parseFloat(minQuantity);
    const maxQuantityNumeric = parseFloat(maxQuantity);
    const isBelowMin = minQuantityNumeric !== 0 && amountToSell < minQuantityNumeric;
    const isAboveMax = maxQuantityNumeric !== 0 && amountToSell > maxQuantityNumeric;

    const minOrMaxNeeded = isBelowMin || isAboveMax;
    const minOrMaxAmount = formatAmountDisplay(isBelowMin ? minQuantity : maxQuantity);

    const isTakeButtonDisabled = !!minOrMaxNeeded
      || isTakeOfferPressed
      || !allowanceSet
      || (isShapeShift && !shapeshiftAccessToken);

    const isFiat = isFiatProvider(offerProvider);

    return (
      <ShadowedCard
        wrapperStyle={{ marginBottom: 10 }}
        contentWrapperStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}
      >
        <CardWrapper
          disabled={isTakeButtonDisabled || disableNonFiatExchange}
          onPress={() => isFiat ? this.onFiatOfferPress(offer) : this.onOfferPress(offer)}
        >
          <CardRow withBorder alignTop>
            {!!isFiat &&
            <CardColumn>
              <CardText label>Amount total</CardText>
              <CardText>{`${askRate} ${fromAssetCode}`}</CardText>
            </CardColumn>
            }
            {!isFiat &&
            <CardColumn>
              <CardText label>Exchange rate</CardText>
              <CardText>{`${askRateBn.toFixed()}`}</CardText>
            </CardColumn>
            }
            <CardInnerRow style={{ flexShrink: 1 }}>
              {!!providerLogo && <ProviderIcon source={providerLogo} resizeMode="contain" />}
              {minOrMaxNeeded &&
              <CardButton onPress={() => this.setFromAmount(isBelowMin ? minQuantity : maxQuantity)}>
                <ButtonLabel color={baseColors.electricBlue}>
                  {`${minOrMaxAmount} ${fromAssetCode} ${isBelowMin ? 'min' : 'max'}`}
                </ButtonLabel>
              </CardButton>
              }
              {!minOrMaxNeeded && isShapeShift && !shapeshiftAccessToken &&
              <CardButton disabled={shapeshiftAuthPressed} onPress={this.onShapeshiftAuthPress}>
                <ButtonLabel color={baseColors.electricBlue}>Connect</ButtonLabel>
              </CardButton>
              }
              {!minOrMaxNeeded && !allowanceSet &&
              <CardButton disabled={isSetAllowancePressed} onPress={() => this.onSetTokenAllowancePress(offer)}>
                <ButtonLabel color={storedAllowance ? baseColors.darkGray : baseColors.electricBlue} >
                  {storedAllowance
                    ? 'Pending'
                    : 'Enable'
                  }
                </ButtonLabel>
              </CardButton>
              }
              {!!isFiat && !!offerRestricted &&
                <CardNote color={baseColors.electricBlue}>{offerRestricted}</CardNote>
              }
            </CardInnerRow>
          </CardRow>
          <CardRow>
            {!!isFiat &&
            <CardColumn style={{ flex: 1 }}>
              <CardText label>Fees total</CardText>
              <View style={{ flexDirection: 'row' }}>
                <CardText>
                  {
                    feeAmount !== ''
                      ? `${formatAmountDisplay(feeAmount + extraFeeAmount)} ${fromAssetCode}`
                      : 'Will be calculated'
                  }
                </CardText>
              </View>
            </CardColumn>
            }
            {!isFiat &&
            <CardColumn style={{ flex: 1 }}>
              <CardText label>Available</CardText>
              <View style={{ flexDirection: 'row' }}>
                <CardText>{available}</CardText>
              </View>
            </CardColumn>
            }
            {!!isFiat &&
            <CardColumn>
              <Button
                title={isTakeOfferPressed ? '' : `${formatAmountDisplay(quoteCurrencyAmount)} ${toAssetCode}`}
                small
                onPress={() => this.onFiatOfferPress(offer)}
              >
                {isTakeOfferPressed && <Spinner width={20} height={20} />}
              </Button>
            </CardColumn>
            }
            {!isFiat &&
            <CardColumn>
              <Button
                disabled={isTakeButtonDisabled || disableNonFiatExchange}
                title={isTakeOfferPressed ? '' : `${amountToBuyString} ${toAssetCode}`}
                small
                onPress={() => this.onOfferPress(offer)}
              >
                {isTakeOfferPressed && <Spinner width={20} height={20} />}
              </Button>
            </CardColumn>
            }
          </CardRow>
        </CardWrapper>
      </ShadowedCard>
    );
  };

  generateAssetsOptions = (assets: Asset[]) => {
    const { balances, paymentNetworkBalances } = this.props;
    const alphabeticalAssets = assets.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return alphabeticalAssets.map(({ symbol, iconUrl, ...rest }) => {
      const rawAssetBalance = getBalance(balances, symbol);
      const assetBalance = rawAssetBalance ? formatAmount(rawAssetBalance) : null;
      const paymentNetworkBalance = getBalance(paymentNetworkBalances, symbol);

      return ({
        key: symbol,
        value: symbol,
        icon: iconUrl,
        iconUrl,
        symbol,
        ...rest,
        assetBalance,
        paymentNetworkBalance,
      });
    });
  };

  generateFiatOptions = () => fiatCurrencies.map(({ symbol, iconUrl, ...rest }) => ({
    key: symbol,
    value: symbol,
    icon: iconUrl,
    iconUrl,
    symbol,
    ...rest,
    assetBalance: null,
    paymentNetworkBalance: null,
  }));

  handleFormChange = (value: Object) => {
    this.props.resetOffers(); // reset all cards before they change according to input values
    this.setState({ value });
    this.updateOptions(value);
    if (!this.exchangeForm.getValue()) return; // this validates form!
    this.triggerSearch();
  };

  updateOptions = (value) => {
    const {
      supportedAssets,
      rates,
      baseFiatCurrency,
    } = this.props;
    const { fromInput, toInput } = value;
    const { selector: selectedFromOption, input: amount } = fromInput;
    const { selector: selectedToOption } = toInput;
    let amountValueInFiat;
    let fiatSymbol;
    let valueInFiatToShow;
    if (amount && Object.keys(selectedFromOption).length) {
      const { symbol: token } = selectedFromOption;
      const fiatCurrency = baseFiatCurrency || defaultFiatCurrency;
      const totalInFiat = parseFloat(amount) * getRate(rates, token, fiatCurrency);
      amountValueInFiat = formatMoney(totalInFiat);
      fiatSymbol = getCurrencySymbol(fiatCurrency);
      valueInFiatToShow = totalInFiat > 0 ? `${fiatSymbol}${amountValueInFiat}` : null;
    }

    const assetsOptions = this.generateAssetsOptions(supportedAssets);

    const optionsFrom = Object.keys(selectedToOption).length
      ? assetsOptions.filter((option) => option.value !== selectedToOption.value)
      : assetsOptions;

    const optionsTo = Object.keys(selectedFromOption).length
      ? assetsOptions.filter((option) => option.value !== selectedFromOption.value)
      : assetsOptions;

    const formOptions = t.update(this.state.formOptions, {
      fields: {
        fromInput: {
          config: {
            options: { $set: optionsFrom },
            inputAddonText: { $set: valueInFiatToShow },
          },
        },
        toInput: {
          config: { options: { $set: optionsTo } },
        },
      },
    });

    this.setState({ formOptions });
  };

  render() {
    const {
      offers,
      navigation,
      exchangeAllowances,
      connectedProviders,
      hasUnreadExchangeNotification,
      markNotificationAsSeen,
      accounts,
      smartWalletState,
      deploySmartWallet,
    } = this.props;
    const {
      value,
      formOptions,
    } = this.state;

    const { fromInput } = value;
    const { selector: selectedFromOption } = fromInput;

    const formStructure = generateFormStructure();
    const reorderedOffers = offers.sort((a, b) => (new BigNumber(b.askRate)).minus(a.askRate).toNumber());
    const rightItems = [{ label: 'Get help', onPress: () => Intercom.displayMessenger(), key: 'getHelp' }];
    if ((!!exchangeAllowances.length || !!connectedProviders.length)
      && !rightItems.find(({ key }) => key === 'exchangeSettings')) {
      rightItems.push({
        iconSource: settingsIcon,
        indicator: !!hasUnreadExchangeNotification,
        key: 'exchangeSettings',
        onPress: () => {
          navigation.navigate(EXCHANGE_INFO);
          if (hasUnreadExchangeNotification) markNotificationAsSeen();
        },
      });
    }

    const smartWalletStatus: SmartWalletStatus = getSmartWalletStatus(accounts, smartWalletState);
    const sendingBlockedMessage = smartWalletStatus.sendingBlockedMessage || {};
    const blockView = !!Object.keys(sendingBlockedMessage).length
      && smartWalletStatus.status !== SMART_WALLET_UPGRADE_STATUSES.ACCOUNT_CREATED;
    const deploymentData = get(smartWalletState, 'upgrade.deploymentData', {});
    const isSelectedFiat = !!(Object.keys(fiatCurrencies.find(
      (currency) => currency.symbol === selectedFromOption.symbol,
    ) || {}).length);

    const disableNonFiatExchange = !this.checkIfAssetsExchangeIsAllowed() && !isSelectedFiat;

    return (
      <ContainerWithHeader
        backgroundColor={baseColors.white}
        headerProps={{
          leftItems: [{ user: true }],
          rightItems,
        }}
        inset={{ bottom: 'never' }}
      >
        {!!blockView &&
        <DeploymentView
          isDeploying={!deploymentData.error}
          message={deploymentData.error ? getDeployErrorMessage(deploymentData.error) : sendingBlockedMessage}
          buttonAction={deploymentData.error ? () => deploySmartWallet() : null}
        />}
        {!blockView &&
        <ScrollWrapper
          keyboardShouldPersistTaps="handled"
          color={UIColors.defaultBackgroundColor}
        >
          <FormWrapper>
            <Form
              ref={node => { this.exchangeForm = node; }}
              type={formStructure}
              options={formOptions}
              value={value}
              onChange={this.handleFormChange}
            />
          </FormWrapper>
          {!!disableNonFiatExchange &&
          <DeploymentView
            message={{
              title: 'To exchange assets, deploy Smart Wallet first',
              message: 'You will have to pay a small fee',
            }}
            buttonAction={() => navigation.navigate(SMART_WALLET_INTRO, { deploy: true })}
            buttonLabel="Deploy Smart Wallet"
          />
          }
          <FlatList
            data={reorderedOffers}
            keyExtractor={(item) => item._id}
            style={{ width: '100%' }}
            contentContainerStyle={{ width: '100%', paddingHorizontal: 20, paddingVertical: 10 }}
            renderItem={(props) => this.renderOffers(props, disableNonFiatExchange)}
            ListHeaderComponent={reorderedOffers.length
              ? (
                <ListHeader>
                  <ExchangeStatus />
                </ListHeader>)
              : null
            }
            ListEmptyComponent={(
              <ESWrapper style={{ marginTop: '15%' }}>
                <ExchangeStatus />
                <Paragraph small style={{ textAlign: 'center' }}>
                  {'If there are any matching offers\nthey will appear live here'}
                </Paragraph>
              </ESWrapper>
            )}
          />
        </ScrollWrapper>}
      </ContainerWithHeader>
    );
  }
}

const mapStateToProps = ({
  oAuthTokens: { data: { accessToken: oAuthAccessToken } },
  appSettings: { data: { baseFiatCurrency } },
  exchange: {
    data: {
      offers,
      searchRequest: exchangeSearchRequest,
      allowances: exchangeAllowances,
      connectedProviders,
      hasNotification: hasUnreadExchangeNotification,
    },
  },
  assets: { supportedAssets },
  rates: { data: rates },
  featureFlags: {
    data: {
      EXCHANGE_WITH_FIAT_ENABLED: exchangeWithFiatEnabled,
      SMART_WALLET_ENABLED: smartWalletFeatureEnabled,
    },
  },
  accounts: { data: accounts },
  smartWallet: smartWalletState,
}) => ({
  baseFiatCurrency,
  offers,
  supportedAssets,
  rates,
  exchangeSearchRequest,
  exchangeAllowances,
  connectedProviders,
  hasUnreadExchangeNotification,
  oAuthAccessToken,
  exchangeWithFiatEnabled,
  smartWalletFeatureEnabled,
  accounts,
  smartWalletState,
});

const structuredSelector = createStructuredSelector({
  balances: accountBalancesSelector,
  paymentNetworkBalances: paymentNetworkAccountBalancesSelector,
});

const combinedMapStateToProps = (state) => ({
  ...structuredSelector(state),
  ...mapStateToProps(state),
});

const mapDispatchToProps = (dispatch: Function) => ({
  searchOffers: (fromAssetCode, toAssetCode, fromAmount) => dispatch(
    searchOffersAction(fromAssetCode, toAssetCode, fromAmount),
  ),
  takeOffer: (fromAssetCode, toAssetCode, fromAmount, provider, callback) => dispatch(
    takeOfferAction(fromAssetCode, toAssetCode, fromAmount, provider, callback),
  ),
  authorizeWithShapeshift: () => dispatch(authorizeWithShapeshiftAction()),
  resetOffers: () => dispatch(resetOffersAction()),
  setExecutingTransaction: () => dispatch(setExecutingTransactionAction()),
  setTokenAllowance: (assetCode, provider, callback) => dispatch(
    setTokenAllowanceAction(assetCode, provider, callback),
  ),
  markNotificationAsSeen: () => dispatch(markNotificationAsSeenAction()),
  deploySmartWallet: () => dispatch(deploySmartWalletAction()),
});

export default connect(combinedMapStateToProps, mapDispatchToProps)(ExchangeScreen);
