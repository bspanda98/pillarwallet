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
import get from 'lodash.get';
import {
  SdkEnvironmentNames,
  getSdkEnvironment,
  createSdk,
  Sdk,
  sdkConstants,
} from '@smartwallet/sdk';
import { toChecksumAddress } from '@netgum/utils';
import { BigNumber } from 'bignumber.js';
import { utils } from 'ethers';
import { NETWORK_PROVIDER } from 'react-native-dotenv';
import { Sentry } from 'react-native-sentry';
import { onSmartWalletSdkEventAction } from 'actions/smartWalletActions';
import { addressesEqual } from 'utils/assets';
import type { GasInfo } from 'models/GasInfo';
import type { SmartWalletAccount } from 'models/SmartWalletAccount';
import type SDKWrapper from 'services/api';
import { DEFAULT_GAS_LIMIT } from 'services/assets';
import { SPEED_TYPES } from 'constants/assetsConstants';

const {
  GasPriceStrategies: {
    Avg: AVG,
    Fast: FAST,
  },
} = sdkConstants;

const TransactionSpeeds = {
  [AVG]: AVG,
  [FAST]: FAST,
};

const PAYMENT_COMPLETED = get(sdkConstants, 'AccountPaymentStates.Completed', '');

const DEFAULT_DEPLOYMENT_GAS_LIMIT = 790000;

export type AccountTransaction = {
  recipient: string,
  value: number | string | BigNumber,
  data?: string | Buffer,
  transactionSpeed?: $Keys<typeof TransactionSpeeds>,
};

type EstimatePayload = {
  gasFee: BigNumber,
  signedGasPrice: {
    gasPrice: BigNumber,
  },
};

type ParsedEstimate = {
  gasAmount: ?BigNumber,
  gasPrice: ?BigNumber,
  totalCost: ?BigNumber,
};

let subscribedToEvents = false;

export const parseEstimatePayload = (estimatePayload: EstimatePayload): ParsedEstimate => {
  const gasAmount = get(estimatePayload, 'gasFee');
  const gasPrice = get(estimatePayload, 'signedGasPrice.gasPrice');
  return {
    gasAmount,
    gasPrice,
    totalCost: gasAmount && gasPrice && gasPrice.mul(gasAmount),
  };
};

const calculateEstimate = (
  estimate,
  gasInfo?: GasInfo,
  speed?: string = SPEED_TYPES.NORMAL,
  defaultGasAmount?: number = DEFAULT_GAS_LIMIT,
): BigNumber => {
  let { gasAmount, gasPrice } = parseEstimatePayload(estimate);

  // NOTE: change all numbers to app used `BigNumber` lib as it is different between SDK and ethers

  gasAmount = new BigNumber(gasAmount
    ? gasAmount.toString()
    : defaultGasAmount,
  );

  if (!gasPrice) {
    const defaultGasPrice = get(gasInfo, `gasPrice.${speed}`, 0);
    gasPrice = utils.parseUnits(defaultGasPrice.toString(), 'gwei');
  }

  return new BigNumber(gasPrice.toString()).multipliedBy(gasAmount);
};

class SmartWallet {
  sdk: Sdk;
  sdkInitialized: boolean = false;

  constructor() {
    const environmentNetwork = this.getEnvironmentNetwork(NETWORK_PROVIDER);
    const sdkOptions = getSdkEnvironment(environmentNetwork);

    try {
      this.sdk = createSdk(sdkOptions);
    } catch (err) {
      this.handleError(err);
    }
  }

  getEnvironmentNetwork(networkName: string) {
    switch (networkName) {
      case 'rinkeby': return SdkEnvironmentNames.Rinkeby;
      case 'ropsten': return SdkEnvironmentNames.Ropsten;
      case 'homestead': return SdkEnvironmentNames.Main;
      default: return SdkEnvironmentNames.Ropsten;
    }
  }

  async init(privateKey: string, dispatch?: Function, dispatchAction?: Function) {
    if (this.sdkInitialized) return;

    await this.sdk
      .initialize({ device: { privateKey } })
      .then(() => { this.sdkInitialized = true; })
      .catch(() => {
        console.log('Error initiating sdk.');
      });

    if (this.sdkInitialized) {
      this.subscribeToEvents(dispatch, dispatchAction);
    }
    // TODO: remove private key from smart wallet sdk
  }

  subscribeToEvents(dispatch?: Function, dispatchAction?: Function) {
    if (subscribedToEvents || !dispatch) return;
    this.sdk.event$.subscribe(event => {
      if (!dispatch) return;
      if (!dispatchAction) dispatchAction = onSmartWalletSdkEventAction;
      dispatch(dispatchAction(event));
    });
    subscribedToEvents = true;
  }

  async getAccounts(): Promise<SmartWalletAccount[]> {
    const accounts = await this.sdk.getConnectedAccounts()
      .then(({ items = [] }) => items)
      .catch(() => []);

    if (!accounts) {
      return [];
    }

    return accounts;
  }

  createAccount() {
    return this.sdk.createAccount().catch(() => null);
  }

  async getAccountDeviceData() {
    const devices = await this.sdk.getConnectedAccountDevices()
      .then(({ items = [] }) => items)
      .catch(this.handleError);
    const activeDeviceAddress = get(this.sdk, 'state.accountDevice.device.address');
    return { devices, activeDeviceAddress };
  }

  async connectAccount(address: string) {
    if (!this.sdk.state.account) {
      await this.sdk.connectAccount(address).catch(this.handleError);
    }

    /* if (!account.ensName && account.state === sdkConstants.AccountStates.Created) {
      account = await this.sdk.updateAccount(account.address).catch(this.handleError);
    } */

    return this.fetchConnectedAccount();
  }

  async syncSmartAccountsWithBackend(
    api: SDKWrapper,
    smartAccounts: SmartWalletAccount[],
    walletId: string,
    privateKey: string,
    fcmToken: string,
  ) {
    const backendAccounts = await api.listAccounts(walletId);
    const registerOnBackendPromises = smartAccounts.map(async account => {
      const backendAccount = backendAccounts.some(({ ethAddress }) => addressesEqual(ethAddress, account.address));
      if (!backendAccount) {
        return api.registerSmartWallet({
          walletId,
          privateKey,
          ethAddress: account.address,
          fcmToken,
        });
      }
      return Promise.resolve();
    });
    return Promise
      .all(registerOnBackendPromises)
      .catch(e => this.reportError('Unable to sync smart wallets', { e }));
  }

  async deployAccount() {
    const deployEstimate = await this.sdk.estimateAccountDeployment().catch(this.handleError);

    const accountBalance = this.getAccountRealBalance();
    const { totalCost } = parseEstimatePayload(deployEstimate);

    if (totalCost && accountBalance.gte(totalCost)) {
      return this.sdk.deployAccount(deployEstimate);
    }

    console.log('insufficient balance: ', deployEstimate, accountBalance);
    return null;
  }

  async deployAccountDevice(deviceAddress: string) {
    const deployEstimate = await this.sdk.estimateAccountDeviceDeployment(deviceAddress).catch(this.handleError);

    const accountBalance = this.getAccountRealBalance();
    const { totalCost } = parseEstimatePayload(deployEstimate);

    if (totalCost && accountBalance.gte(totalCost)) {
      return this.sdk.submitAccountTransaction(deployEstimate);
    }

    console.log('insufficient balance: ', deployEstimate, accountBalance);
    return null;
  }

  async unDeployAccountDevice(deviceAddress: string) {
    const unDeployEstimate = await this.sdk.estimateAccountDeviceUnDeployment(deviceAddress).catch(this.handleError);

    const accountBalance = this.getAccountRealBalance();
    const { totalCost } = parseEstimatePayload(unDeployEstimate);

    if (totalCost && accountBalance.gte(totalCost)) {
      return this.sdk.submitAccountTransaction(unDeployEstimate);
    }

    console.log('insufficient balance: ', unDeployEstimate, accountBalance);
    return null;
  }

  getAccountRealBalance() {
    return get(this.sdk, 'state.account.balance.real', new BigNumber(0));
  }

  getAccountVirtualBalance() {
    return get(this.sdk, 'state.account.balance.virtual', new BigNumber(0));
  }

  getAccountStakedAmount(tokenAddress: ?string): BigNumber {
    return this.sdk.getConnectedAccountVirtualBalance(tokenAddress)
      .then(data => {
        let value;
        if (data.items) { // NOTE: we're getting the data.items response when tokenAddress is null
          value = get(data, 'items[0].value');
        } else {
          value = get(data, 'value');
        }
        return value || new BigNumber(0);
      })
      .catch((e) => {
        this.handleError(e);
        return new BigNumber(0);
      });
  }

  getAccountPendingBalances() {
    return this.sdk.getConnectedAccountVirtualPendingBalances()
      .catch((e) => {
        this.handleError(e);
        return [];
      });
  }

  async fetchConnectedAccount() {
    const { state: { account: accountData } } = this.sdk;
    const accountDeviceData = await this.getAccountDeviceData();
    return { ...accountData, ...accountDeviceData };
  }

  async transferAsset(transaction: AccountTransaction) {
    let estimateError;
    const {
      recipient,
      value,
      data,
      transactionSpeed = TransactionSpeeds[AVG],
    } = transaction;
    const estimatedTransaction = await this.sdk.estimateAccountTransaction(
      recipient,
      value,
      data,
      transactionSpeed,
    ).catch((e) => { estimateError = e; });

    if (!estimatedTransaction) {
      return Promise.reject(new Error(estimateError));
    }

    return this.sdk.submitAccountTransaction(estimatedTransaction);
  }

  createAccountPayment(recipient: string, token: ?string, value: BigNumber, paymentType?: string, reference?: string) {
    token = toChecksumAddress(token);
    return this.sdk.createAccountPayment(recipient, token, value.toHexString(), paymentType, reference);
  }

  getConnectedAccountTransaction(txHash: string) {
    return this.sdk.getConnectedAccountTransaction(txHash);
  }

  estimateTopUpAccountVirtualBalance(value: BigNumber, tokenAddress: ?string) {
    return this.sdk.estimateTopUpAccountVirtualBalance(value.toHexString(), toChecksumAddress(tokenAddress));
  }

  estimateWithdrawFromVirtualAccount(value: BigNumber, tokenAddress: ?string) {
    return this.sdk.estimateWithdrawFromAccountVirtualBalance(value.toHexString(), toChecksumAddress(tokenAddress));
  }

  estimatePaymentSettlement(hashes: string[] = []) {
    const items = hashes.length === 1 ? hashes[0] : hashes;
    return this.sdk.estimateWithdrawAccountPayment(items);
  }

  topUpAccountVirtualBalance(estimated: Object) {
    return this.sdk.submitAccountTransaction(estimated);
  }

  withdrawFromVirtualAccount(estimated: Object) {
    return this.sdk.withdrawFromAccountVirtualBalance(estimated);
  }

  withdrawAccountPayment(estimated: Object) {
    return this.sdk.submitAccountTransaction(estimated);
  }

  searchAccount(address: string) {
    return this.sdk.searchAccount({ address });
  }

  /**
   * SDK API call results are sorted descending by creation date
   * lastSyncedId is used to determine whether this page was already fetched
   */
  async getAccountPayments(lastSyncedId: ?number, page?: number = 0) {
    if (!this.sdkInitialized) return [];
    const data = await this.sdk.getConnectedAccountPayments(page).catch(this.handleError);
    if (!data) return [];

    const items = data.items || [];
    const foundLastSyncedTx = lastSyncedId
      ? items.find(({ id }) => id === lastSyncedId)
      : null;
    if (data.nextPage && !foundLastSyncedTx) {
      return [...items, ...(await this.getAccountPayments(lastSyncedId, page + 1))];
    }

    return items;
  }
  /**
   * SDK API call results are sorted descending by creation date
   * lastSyncedId is used to determine whether this page was already fetched
   */
  async getAccountTransactions(lastSyncedId: ?number, page?: number = 0) {
    if (!this.sdkInitialized) return [];
    // make sure getConnectedAccountTransactions passed hash is empty string
    const data = await this.sdk.getConnectedAccountTransactions('', page).catch(this.handleError);
    if (!data) return [];

    const items = data.items || [];
    const foundLastSyncedTx = lastSyncedId
      ? items.find(({ id }) => id === lastSyncedId)
      : null;
    if (data.nextPage && !foundLastSyncedTx) {
      return [...items, ...(await this.getAccountTransactions(lastSyncedId, page + 1))];
    }

    return items;
  }

  async getAccountPaymentsToSettle(accountAddress: string, page?: number = 0) {
    const filters = {
      state: PAYMENT_COMPLETED,
    };
    const data = await this.sdk.getConnectedAccountPayments(page, filters).catch(this.handleError);
    if (!data) return [];

    const items = (data.items || [])
      .filter(payment => {
        const recipientAddress = get(payment, 'recipient.account.address', '');
        return addressesEqual(recipientAddress, accountAddress);
      });

    if (data.nextPage) {
      return [...items, ...(await this.getAccountPaymentsToSettle(accountAddress, page + 1))];
    }

    return items;
  }

  async estimateAccountDeployment(gasInfo: GasInfo) {
    const deployEstimate = await this.sdk.estimateAccountDeployment().catch(() => {});
    return calculateEstimate(deployEstimate, gasInfo, SPEED_TYPES.FAST, DEFAULT_DEPLOYMENT_GAS_LIMIT);
  }

  async estimateAccountDeviceDeployment(deviceAddress: string, gasInfo: GasInfo) {
    const deployEstimate = await this.sdk.estimateAccountDeviceDeployment(deviceAddress).catch(() => {});
    return calculateEstimate(deployEstimate, gasInfo, SPEED_TYPES.FAST, DEFAULT_DEPLOYMENT_GAS_LIMIT);
  }

  async estimateAccountDeviceUnDeployment(deviceAddress: string, gasInfo: GasInfo) {
    const unDeployEstimate = await this.sdk.estimateAccountDeviceUnDeployment(deviceAddress).catch(() => {});
    return calculateEstimate(unDeployEstimate, gasInfo, SPEED_TYPES.FAST, DEFAULT_DEPLOYMENT_GAS_LIMIT);
  }

  async estimateAccountTransaction(transaction: AccountTransaction, gasInfo: GasInfo) {
    const {
      recipient,
      value,
      data,
      transactionSpeed = TransactionSpeeds[AVG],
    } = transaction;
    const estimatedTransaction = await this.sdk.estimateAccountTransaction(
      recipient,
      value,
      data,
      transactionSpeed,
    ).catch(() => {});
    const defaultSpeed = transactionSpeed === TransactionSpeeds[FAST]
      ? SPEED_TYPES.FAST
      : SPEED_TYPES.NORMAL;
    return calculateEstimate(estimatedTransaction, gasInfo, defaultSpeed);
  }

  getTransactionStatus(hash: string) {
    if (!this.sdkInitialized) return null;
    return this.sdk.getConnectedAccountTransaction(hash)
      .then(({ state }) => state)
      .catch(() => null);
  }

  addAccountDevice(address: string) {
    return this.sdk.createAccountDevice(address).catch(() => null);
  }


  removeAccountDevice(address: string) {
    return this.sdk.removeAccountDevice(address).catch(() => null);
  }

  handleError(error: any) {
    console.error('SmartWallet handleError: ', error);
  }

  reportError(errorMessge: string, errorData: Object) {
    Sentry.captureMessage(errorMessge, { extra: errorData });
    if (__DEV__) {
      console.log(errorMessge, errorData); // eslint-disable-line
    }
  }

  async reset() {
    if (!this.sdkInitialized) return;
    this.sdkInitialized = false;
    if (!this.sdk) return;
    this.sdk.event$.next(null); // unsubscribes
    subscribedToEvents = false;
    await this.sdk.reset({
      device: true,
      session: true,
    }).catch(null);
  }
}

const smartWalletInstance = new SmartWallet();
export default smartWalletInstance;
