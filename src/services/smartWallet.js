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
} from '@archanova/sdk';
import { ContractNames } from '@archanova/contracts';
import { toChecksumAddress } from '@netgum/utils';
import { BigNumber } from 'bignumber.js';
import { utils } from 'ethers';
import {
  ARCHANOVA_ETH_ACCOUNT_PROVIDER_ADDRESS,
  ARCHANOVA_ETH_ACCOUNT_PROXY_ADDRESS,
  ARCHANOVA_ETH_ACCOUNT_FRIEND_RECOVERY_ADDRESS,
  ARCHANOVA_ETH_ENS_REGISTRY_ADDRESS,
  ARCHANOVA_ETH_GUARDIAN_ADDRESS,
  ARCHANOVA_ETH_VIRTUAL_PAYMENT_MANAGER_ADDRESS,
  ARCHANOVA_HOST,
  NETWORK_PROVIDER,
} from 'react-native-dotenv';
import { onSmartWalletSdkEventAction } from 'actions/smartWalletActions';
import { addressesEqual } from 'utils/assets';

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

type AccountTransaction = {
  recipient: string,
  value: number | string | BigNumber,
  data: string | Buffer,
  transactionSpeed?: $Keys<typeof TransactionSpeeds>,
};

let subscribedToEvents = false;

class SmartWallet {
  sdk: Sdk;
  sdkInitialized: boolean = false;

  constructor() {
    const environmentNetwork = this.getEnvironmentNetwork(NETWORK_PROVIDER);
    const sdkOptions = getSdkEnvironment(environmentNetwork)
      .extendConfig('apiOptions', {
        host: ARCHANOVA_HOST,
      })
      .extendConfig('ensOptions', {
        supportedRootNames: [
          'pillarnetwork.eth',
        ],
      })
      .extendConfig('ethOptions', {
        networkName: 'Pillar',
        contractAddresses: {
          [ContractNames.AccountProvider]: ARCHANOVA_ETH_ACCOUNT_PROVIDER_ADDRESS,
          [ContractNames.AccountProxy]: ARCHANOVA_ETH_ACCOUNT_PROXY_ADDRESS,
          [ContractNames.AccountFriendRecovery]: ARCHANOVA_ETH_ACCOUNT_FRIEND_RECOVERY_ADDRESS,
          [ContractNames.ENSRegistry]: ARCHANOVA_ETH_ENS_REGISTRY_ADDRESS,
          [ContractNames.Guardian]: ARCHANOVA_ETH_GUARDIAN_ADDRESS,
          [ContractNames.VirtualPaymentManager]: ARCHANOVA_ETH_VIRTUAL_PAYMENT_MANAGER_ADDRESS,
        },
      })
      .extendConfig('storageOptions', {
        namespace: '@pillar',
      });

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

  async init(privateKey: string, dispatch?: Function) {
    if (this.sdkInitialized) return;

    await this.sdk
      .initialize({ device: { privateKey } })
      .then(() => { this.sdkInitialized = true; })
      .catch(() => {
        console.log('Error initiating sdk.');
      });

    if (this.sdkInitialized) {
      this.subscribeToEvents(dispatch);
    }
    // TODO: remove private key from smart wallet sdk
  }

  subscribeToEvents(dispatch?: Function) {
    if (subscribedToEvents || !dispatch) return;
    this.sdk.event$.subscribe(event => {
      if (dispatch) dispatch(onSmartWalletSdkEventAction(event));
    });
    subscribedToEvents = true;
  }

  async getAccounts() {
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

  async connectAccount(address: string) {
    const account = this.sdk.state.account || await this.sdk.connectAccount(address).catch(this.handleError);
    const devices = await this.sdk.getConnectedAccountDevices()
      .then(({ items = [] }) => items)
      .catch(this.handleError);

    /* if (!account.ensName && account.state === sdkConstants.AccountStates.Created) {
      account = await this.sdk.updateAccount(account.address).catch(this.handleError);
    } */

    return {
      ...account,
      devices,
    };
  }

  async deploy() {
    const deployEstimate = await this.sdk.estimateAccountDeployment().catch(this.handleError);

    const accountBalance = this.getAccountRealBalance();
    if (get(deployEstimate, 'totalCost') && accountBalance.gte(deployEstimate.totalCost)) {
      return this.sdk.deployAccount(deployEstimate);
    }

    console.log('insufficient balance: ', deployEstimate, accountBalance);
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
    const { state: { account } } = this.sdk;
    const devices = await this.sdk.getConnectedAccountDevices().catch(this.handleError);
    return {
      ...account,
      devices,
    };
  }

  async transferAsset(transaction: AccountTransaction) {
    let estimateError;
    const {
      recipient,
      value,
      data,
      transactionSpeed,
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

  createAccountPayment(recipient: string, token: ?string, value: BigNumber) {
    return this.sdk.createAccountPayment(recipient, toChecksumAddress(token), value.toHexString());
  }

  getConnectedAccountTransaction(txHash: string) {
    return this.sdk.getConnectedAccountTransaction(txHash);
  }

  estimateTopUpAccountVirtualBalance(value: BigNumber, tokenAddress: ?string) {
    return this.sdk.estimateTopUpAccountVirtualBalance(value.toHexString(), toChecksumAddress(tokenAddress));
  }

  estimateWithdrawFromAccountVirtualBalance(value: BigNumber) {
    return this.sdk.estimateWithdrawFromAccountVirtualBalance(value);
  }

  estimateWithdrawAccountPayment(hashes: string[] = []) {
    const items = hashes.length === 1 ? hashes[0] : hashes;
    return this.sdk.estimateWithdrawAccountPayment(items);
  }

  topUpAccountVirtualBalance(estimated: Object) {
    return this.sdk.submitAccountTransaction(estimated);
  }

  withdrawAccountVirtualBalance(estimated: Object) {
    return this.sdk.submitAccountTransaction(estimated);
  }

  withdrawAccountPayment(estimated: Object) {
    return this.sdk.submitAccountTransaction(estimated);
  }

  searchAccount(address: string) {
    return this.sdk.searchAccount({ address });
  }

  async getAccountPayments(lastSyncedHash: ?string, page?: number = 0) {
    if (!this.sdkInitialized) return [];
    const data = await this.sdk.getConnectedAccountPayments(page).catch(this.handleError);
    if (!data) return [];

    const items = data.items || [];
    const foundLastSyncedTx = lastSyncedHash
      ? items.find(({ hash }) => hash === lastSyncedHash)
      : null;
    if (data.nextPage && !foundLastSyncedTx) {
      return [...items, ...(await this.getAccountPayments(lastSyncedHash, page + 1))];
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

  getDeployEstimate(gasPrice: BigNumber) {
    /**
     * can also call `this.sdk.estimateAccountDeployment(REGULAR);`,
     * but it needs sdk init and when migrating we don't have SDK initiated yet
     * so we're using calculation method below that is provided by SDK creators
     */
    return utils.bigNumberify(650000).mul(gasPrice);
  }

  handleError(error: any) {
    console.error('SmartWallet handleError: ', error);
  }
}

const smartWalletInstance = new SmartWallet();
export default smartWalletInstance;
