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
import { combineReducers } from 'redux';

// constants
import { LOG_OUT } from 'constants/authConstants';

// reducers
import offlineQueueReducer from './offlineQueueReducer';
import walletReducer from './walletReducer';
import smartWalletReducer from './smartWalletReducer';
import walletConnectReducer from './walletConnectReducer';
import assetsReducer from './assetsReducer';
import appSettingsReducer from './appSettingsReducer';
import ratesReducer from './ratesReducer';
import userReducer from './userReducer';
import historyReducer from './historyReducer';
import notificationsReducer from './notificationsReducer';
import contactsReducer from './contactsReducer';
import invitationsReducer from './invitationsReducer';
import chatReducer from './chatReducer';
import accessTokensReducer from './accessTokensReducer';
import sessionReducer from './sessionReducer';
import icosReducer from './icosReducer';
import txNoteReducer from './txNoteReducer';
import oAuthReducer from './oAuthReducer';
import txCountReducer from './txCountReducer';
import connectionKeyPairsReducer from './connectionKeyPairsReducer';
import collectiblesReducer from './collectiblesReducer';
import deepLinkReducer from './deepLinkReducer';
import connectionIdentityKeysReducer from './connectionIdentityKeysReducer';
import badgesReducer from './badgesReducer';
import exchangeReducer from './exchangeReducer';
import accountsReducer from './accountsReducer';
import balancesReducer from './balancesReducer';
import paymentNetworkReducer from './paymentNetworkReducer';
import featureFlagsReducer from './featureFlagsReducer';
import accountRecoveryReducer from './accountRecoveryReducer';
import blockchainNetworkReducer from './blockchainNetworkReducer';

const appReducer = combineReducers({
  offlineQueue: offlineQueueReducer,
  wallet: walletReducer,
  smartWallet: smartWalletReducer,
  walletConnect: walletConnectReducer,
  assets: assetsReducer,
  appSettings: appSettingsReducer,
  rates: ratesReducer,
  user: userReducer,
  history: historyReducer,
  notifications: notificationsReducer,
  contacts: contactsReducer,
  invitations: invitationsReducer,
  chat: chatReducer,
  accessTokens: accessTokensReducer,
  session: sessionReducer,
  icos: icosReducer,
  txNotes: txNoteReducer,
  oAuthTokens: oAuthReducer,
  txCount: txCountReducer,
  collectibles: collectiblesReducer,
  deepLink: deepLinkReducer,
  connectionKeyPairs: connectionKeyPairsReducer,
  connectionIdentityKeys: connectionIdentityKeysReducer,
  badges: badgesReducer,
  exchange: exchangeReducer,
  accounts: accountsReducer,
  balances: balancesReducer,
  paymentNetwork: paymentNetworkReducer,
  featureFlags: featureFlagsReducer,
  accountRecovery: accountRecoveryReducer,
  blockchainNetwork: blockchainNetworkReducer,
});

const initialState = appReducer(undefined, {});

const rootReducer = (state: Object, action: Object) => {
  if (action.type === LOG_OUT) {
    return initialState;
  }
  return appReducer(state, action);
};

export default rootReducer;
