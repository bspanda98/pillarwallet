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
import type { NavigationScreenProp } from 'react-navigation';
import { connect } from 'react-redux';
import { Container } from 'components/Layout';
import CheckPin from 'components/CheckPin';
import Header from 'components/Header';
import type { TransactionPayload } from 'models/Transaction';
import { onWalletConnectApproveCallRequest, onWalletConnectRejectCallRequest } from 'actions/walletConnectActions';
import { sendAssetAction } from 'actions/assetsActions';
import { resetIncorrectPasswordAction } from 'actions/authActions';
import { SEND_TOKEN_TRANSACTION } from 'constants/navigationConstants';
import { signMessage, signPersonalMessage, signTransaction } from 'utils/wallet';

type Props = {
  navigation: NavigationScreenProp<*>,
  approveCallRequest: (peerId: string, callId: string, result: any) => Function,
  rejectCallRequest: (peerId: string, callId: string, errorMsg?: string) => Function,
  sendAsset: (payload: TransactionPayload, wallet: Object, navigate: Function) => Function,
  resetIncorrectPassword: () => Function,
};

type State = {
  isChecking: boolean,
};

class WalletConnectPinConfirmScreeen extends React.Component<Props, State> {
  state = {
    isChecking: false,
  };

  handleDismissal = async () => {
    const { navigation, rejectCallRequest, resetIncorrectPassword } = this.props;
    const peerId = navigation.getParam('peerId', {});
    const payload = navigation.getParam('payload', {});
    await rejectCallRequest(peerId, payload.id);
    resetIncorrectPassword();
    navigation.dismiss();
  };

  handleCallRequest = (pin: string, wallet: Object) => {
    const { navigation } = this.props;
    const peerId = navigation.getParam('peerId', {});
    const payload = navigation.getParam('payload', {});

    let callback = () => {};

    switch (payload.method) {
      case 'eth_sendTransaction':
        callback = () => this.handleSendTransaction(peerId, payload, wallet);
        break;
      case 'eth_signTransaction':
        callback = () => this.handleSignTransaction(peerId, payload, wallet);
        break;
      case 'eth_sign':
      case 'personal_sign':
        callback = () => this.handleSignMessage(peerId, payload, wallet);
        break;
      default:
        break;
    }

    this.setState({ isChecking: true }, callback);
  };

  handleSendTransaction = (peerId: string, payload: Object, wallet: Object) => {
    const {
      sendAsset, approveCallRequest, rejectCallRequest, navigation,
    } = this.props;
    const transactionPayload = navigation.getParam('transactionPayload', {});
    sendAsset(transactionPayload, wallet, async (txStatus: Object) => {
      if (txStatus.isSuccess) {
        await approveCallRequest(peerId, payload.id, txStatus.txHash);
      } else {
        await rejectCallRequest(peerId, payload.id);
      }
      this.setState(
        {
          isChecking: false,
        },
        () => {
          this.handleDismissal();
          this.handleNavigationToTransactionState(txStatus);
        },
      );
    });
  };

  handleSignTransaction = async (peerId: string, payload: Object, wallet: Object) => {
    const { approveCallRequest, rejectCallRequest } = this.props;
    const trx = payload.params[0];
    try {
      const result = await signTransaction(trx, wallet);
      await approveCallRequest(peerId, payload.id, result);
    } catch (error) {
      await rejectCallRequest(peerId, payload.id);
    }
    this.setState(
      {
        isChecking: false,
      },
      () => this.handleDismissal(),
    );
  };

  handleSignMessage = async (peerId: string, payload: Object, wallet: Object) => {
    const { approveCallRequest, rejectCallRequest } = this.props;
    let message = '';
    try {
      let result = null;
      if (payload.method === 'personal_sign') {
        message = payload.params[0] // eslint-disable-line
        result = await signPersonalMessage(message, wallet);
      } else {
        message = payload.params[1] // eslint-disable-line
        result = await signMessage(message, wallet);
      }
      await approveCallRequest(peerId, payload.id, result);
    } catch (error) {
      await rejectCallRequest(peerId, payload.id, error.toString());
    }
    this.setState(
      {
        isChecking: false,
      },
      () => this.handleDismissal(),
    );
  };

  handleNavigationToTransactionState = (params: ?Object) => {
    const { navigation } = this.props;
    const transactionPayload = navigation.getParam('transactionPayload', {});

    navigation.navigate(SEND_TOKEN_TRANSACTION, { ...params, transactionPayload });
  };

  handleBack = () => {
    const { navigation, resetIncorrectPassword } = this.props;
    navigation.goBack(null);
    resetIncorrectPassword();
  };

  handleDismissal = () => {
    const { navigation, resetIncorrectPassword } = this.props;
    navigation.dismiss();
    resetIncorrectPassword();
  };

  render() {
    const { isChecking } = this.state;
    return (
      <Container>
        <Header onBack={this.handleBack} title="Enter pincode" />
        <CheckPin onPinValid={this.handleCallRequest} isChecking={isChecking} />
      </Container>
    );
  }
}

const mapDispatchToProps = dispatch => ({
  approveCallRequest: (peerId: string, callId: string, result: any) => {
    dispatch(onWalletConnectApproveCallRequest(peerId, callId, result));
  },
  rejectCallRequest: (peerId: string, callId: string, errorMsg?: string) => {
    dispatch(onWalletConnectRejectCallRequest(peerId, callId, errorMsg));
  },
  sendAsset: (transaction: TransactionPayload, wallet: Object, navigate) => {
    dispatch(sendAssetAction(transaction, wallet, navigate));
  },
  resetIncorrectPassword: () => dispatch(resetIncorrectPasswordAction()),
});

export default connect(
  null,
  mapDispatchToProps,
)(WalletConnectPinConfirmScreeen);
