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
import { utils } from 'ethers';
import { BigNumber } from 'bignumber.js';
import get from 'lodash.get';
import orderBy from 'lodash.orderby';

// constants
import { ETH } from 'constants/assetsConstants';
import { TX_PENDING_STATUS } from 'constants/historyConstants';

// utils
import { formatAmount, isCaseInsensitiveMatch } from 'utils/common';

// models
import type {
  Asset,
  Assets,
  Balance,
  Balances,
  Rates,
} from 'models/Asset';
import type { Transaction } from 'models/Transaction';

export const transformAssetsToObject = (assetsArray: Asset[] = []): Assets => {
  return assetsArray.reduce((memo, asset) => {
    memo[asset.symbol] = asset;
    return memo;
  }, {});
};

export const getBalance = (balances: Balances = {}, asset: string): number => {
  const assetBalance = get(balances, asset);
  if (!assetBalance) {
    return 0;
  }

  const number = new BigNumber(assetBalance.balance);

  return +formatAmount(number.toString());
};

export const getRate = (rates: Rates = {}, token: string, fiatCurrency: string): number => {
  const tokenRates = rates[token];
  const ethRate = rates[ETH];

  if (!tokenRates) {
    return 0;
  }

  if (!ethRate) {
    return tokenRates[fiatCurrency] || 0;
  }

  const ethToFiat = ethRate[fiatCurrency];
  if (!ethToFiat) {
    return 0;
  }

  if (token === ETH) {
    return ethToFiat;
  }

  const tokenToETH = tokenRates[ETH];
  if (!tokenToETH) {
    return tokenRates[fiatCurrency] || 0;
  }

  return ethToFiat * tokenToETH;
};

export const calculateMaxAmount = (token: string, balance: number | string, txFeeInWei: BigNumber): number => {
  if (typeof balance !== 'string') {
    balance = balance.toString();
  }

  if (token !== ETH) {
    return +balance;
  }

  const maxAmount = utils.parseUnits(balance, 'ether').sub(txFeeInWei);
  if (maxAmount.lt(0)) return 0;

  return new BigNumber(utils.formatEther(maxAmount)).toNumber();
};

export const checkIfEnoughForFee = (balances: Balances, txFeeInWei: BigNumber): boolean => {
  if (!balances[ETH]) return false;
  const ethBalance = getBalance(balances, ETH);
  const balanceInWei = utils.parseUnits(ethBalance.toString(), 'ether');
  return balanceInWei.gte(txFeeInWei);
};

export const balanceInEth = (balances: Balances, rates: Rates): number => {
  const balanceValues: Balance[] = Object.keys(balances).map(key => balances[key]);

  return balanceValues.reduce((total, item) => {
    const balance = +item.balance;
    const assetRates = rates[item.symbol];

    if (!assetRates || balance === 0) {
      return total;
    }

    const ethRate = assetRates[ETH] || 0;

    return total + (ethRate * balance);
  }, 0);
};

export const calculateBalanceInFiat = (
  rates: Rates,
  balances: Balances,
  currency: string,
) => {
  const ethRates = rates[ETH];
  if (!ethRates) {
    return 0;
  }

  const totalEth = balanceInEth(balances, rates);

  return get(ethRates, currency, 0) * totalEth;
};

export const getPPNTokenAddress = (token: string, assets: Assets): ?string => {
  if (token === ETH) return null;

  return get(assets[token], 'address', '');
};

export const addressesEqual = (address1: ?string, address2: ?string): boolean => {
  if (address1 === address2) return true;
  if (!address1 || !address2) return false;

  return isCaseInsensitiveMatch(address1, address2);
};

export const calculateTransactionNonceFromHistory = (
  totalTransactionCount: number,
  history: Transaction[],
  transactionHash: string,
): number => {
  const pendingTransactions = history.filter(({ status }) => status === TX_PENDING_STATUS);
  const sortedHistory = orderBy(pendingTransactions, ['createdAt'], ['asc']);
  const pendingTransactionIndex = sortedHistory.findIndex(({ hash }) => hash === transactionHash);
  if (pendingTransactionIndex < 0) return pendingTransactionIndex;
  return (totalTransactionCount - 1) - pendingTransactionIndex;
};
