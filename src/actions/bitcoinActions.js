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
import {
  keyPairAddress,
  getAddressUtxos,
  importKeyPair,
  exportKeyPair,
  rootFromMnemonic,
  transactionFromPlan,
  sendRawTransaction,
} from 'services/bitcoin';
import {
  UPDATE_BITCOIN_BALANCE,
  REFRESH_THRESHOLD,
  SET_BITCOIN_ADDRESSES,
} from 'constants/bitcoinConstants';
import Storage from 'services/storage';
import type { BitcoinReducerAction } from 'reducers/bitcoinReducer';
import type { Wallet } from 'models/Wallet';
import type {
  BitcoinAddress,
  BitcoinTransactionPlan,
} from 'models/Bitcoin';
import Toast from 'components/Toast';
import { saveDbAction } from './dbActions';

const storage = Storage.getInstance('db');

type BitcoinStore = {
  keys?: { [key: string]: string },
};

const saveDb = (data: BitcoinStore) => {
  return saveDbAction('bitcoin', data, true); // TODO: +true+ required?
};

const loadDb = async (): Promise<BitcoinStore> => {
  return storage.get('bitcoin');
};

export const initializeBitcoinWalletAction = (wallet: Wallet) => {
  return async (dispatch: Function) => {
    const root = await rootFromMnemonic(wallet.mnemonic);
    const keyPair = root.derivePath(wallet.path);

    const address = keyPairAddress(keyPair);

    dispatch(saveDb({
      keys: { [address]: exportKeyPair(keyPair) },
    }));

    dispatch({ type: SET_BITCOIN_ADDRESSES, payload: { addresses: [address] } });
  };
};

export const loadBitcoinAddresses = () => {
  return async (dispatch: (action: BitcoinReducerAction) => void) => {
    const { keys = {} } = await loadDb();

    const loaded: string[] = Object.keys(keys);

    dispatch({ type: SET_BITCOIN_ADDRESSES, payload: { addresses: loaded } });

    return loaded;
  };
};

const fetchBalanceAction = async (address: string): Promise<BitcoinReducerAction> => {
  const unspentTransactions = await getAddressUtxos(address);

  return {
    type: UPDATE_BITCOIN_BALANCE,
    payload: {
      address,
      unspentTransactions,
    },
  };
};

const transactionSendingFailed = () => {
  Toast.show({
    message: 'There was an error sending the transaction',
    type: 'warning',
    title: 'Transaction could not be sent',
    autoClose: false,
  });
};

export const sendTransactionAction = (plan: BitcoinTransactionPlan) => {
  return async () => {
    const { keys = {} } = await loadDb();

    const rawTransaction = transactionFromPlan(plan, (address: string) => {
      const wif = keys[address];

      return importKeyPair(wif);
    });

    sendRawTransaction(rawTransaction)
      .then((txid) => {
        if (!txid) {
          transactionSendingFailed();
          return;
        }

        Toast.show({
          message: 'The transaction was sent to the Bitcoin network',
          type: 'success',
          title: 'Transaction sent',
          autoClose: true,
        });
      })
      .catch(() => {
        transactionSendingFailed();
      });
  };
};

export const refreshAddressBalanceAction = (address: string, force: boolean) => {
  return async (dispatch: Function, getState: Function) => {
    const { bitcoin: { data: { addresses } } } = getState();

    const matchingAddress: BitcoinAddress = addresses.find(
      ({ address: addr }) => addr === address,
    );
    if (!matchingAddress) {
      return;
    }

    if (!force && ((Date.now() - matchingAddress.updatedAt) < REFRESH_THRESHOLD)) {
      return;
    }
    const fetchBalance = await fetchBalanceAction(address);

    dispatch(fetchBalance);
  };
};
