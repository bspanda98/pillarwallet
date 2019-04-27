// @flow
import merge from 'lodash.merge';
import {
  GENERATE_ENCRYPTED_WALLET,
  UPDATE_WALLET_STATE,
  DECRYPT_WALLET,
  CREATED,
  DECRYPTED,
  SET_WALLET_ERROR,
  RESET_WALLET_ERROR,
  WALLET_ERROR,
  IMPORT_WALLET,
  UPDATE_WALLET_MNEMONIC,
  NEW_WALLET_SET_PIN,
  NEW_WALLET_CONFIRM_PIN,
  PIN_SET,
  PIN_CONFIRMED,
  SET_API_USER,
  RESET_WALLET_IMPORT,
  UPDATE_WALLET_IMPORT_STATE,
  BACKUP_WALLET,
} from '../constants/walletConstants';

export type Wallet = {
  address: string,
  privateKey: string
}

export type WalletReducerState = {
  data: Wallet,
  walletState: ?string,
  onboarding: Object,
  error: ?{
    code: string,
    message: string,
  },
  backupStatus: Object,
}

export type WalletReducerAction = {
  type: string,
  payload: any
}

const initialState = {
  data: {
    address: '',
    privateKey: '',
  },
  onboarding: {
    mnemonic: {
      original: '',
      shuffled: '',
      wordsToValidate: [],
    },
    pin: '',
    confirmedPin: '',
    importedWallet: null,
    apiUser: {},
  },
  walletState: null,
  backupStatus: {
    isImported: false,
    isBackedUp: false,
  },
  error: null,
};

export default function newWalletReducer(
  state: WalletReducerState = initialState,
  action: WalletReducerAction,
) {
  switch (action.type) {
    case GENERATE_ENCRYPTED_WALLET:
      return merge({}, state, { data: action.payload, walletState: CREATED });
    case UPDATE_WALLET_STATE:
      return merge({}, state, { walletState: action.payload });
    case UPDATE_WALLET_MNEMONIC:
      return merge({}, state, { onboarding: { mnemonic: action.payload } });
    case SET_WALLET_ERROR:
      return merge({}, state, { error: action.payload, walletState: WALLET_ERROR });
    case RESET_WALLET_ERROR:
      return merge({}, state, { error: null, walletState: null });
    case DECRYPT_WALLET:
      return merge({}, state, { data: action.payload, walletState: DECRYPTED });
    case NEW_WALLET_SET_PIN:
      return merge(
        {},
        state,
        { onboarding: { pin: action.payload, confirmedPin: '' }, walletState: PIN_SET },
      );
    case NEW_WALLET_CONFIRM_PIN:
      return merge(
        {},
        state, { onboarding: { confirmedPin: action.payload }, walletState: PIN_CONFIRMED },
      );
    case IMPORT_WALLET:
      const { importedWallet, apiUser } = action.payload;
      return {
        ...state,
        onboarding: { ...state.onboarding, importedWallet, apiUser },
        backupStatus: { ...state.backupStatus, isImported: true },
      };
    case RESET_WALLET_IMPORT:
      return {
        ...state,
        onboarding: { ...state.onboarding, importedWallet: null, apiUser: {} },
      };
    case SET_API_USER:
      return {
        ...state,
        onboarding: { ...state.onboarding, apiUser: action.payload },
      };
    case UPDATE_WALLET_IMPORT_STATE:
      return merge(
        {},
        state, { backupStatus: { ...state.backupStatus, ...action.payload } },
      );

    case BACKUP_WALLET:
      return merge(
        {},
        state,
        { backupStatus: { ...state.backupStatus, isBackedUp: true } },
      );
    default:
      return state;
  }
}
