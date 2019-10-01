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
import { connect } from 'react-redux';
import isEqual from 'lodash.isequal';
import type { NavigationScreenProp } from 'react-navigation';
import { Linking } from 'react-native';
import styled from 'styled-components/native';
import { utils } from 'ethers';
import { format as formatDate, differenceInSeconds } from 'date-fns';
import { createStructuredSelector } from 'reselect';
import isEmpty from 'lodash.isempty';

// models
import type { Transaction } from 'models/Transaction';
import type { Assets } from 'models/Asset';
import type { ApiUser, ContactSmartAddressData } from 'models/Contacts';
import type { Accounts } from 'models/Account';

// components
import { BaseText, BoldText } from 'components/Typography';
import Button from 'components/Button';
import ListItemParagraph from 'components/ListItem/ListItemParagraph';
import ListItemUnderlined from 'components/ListItem';
import ProfileImage from 'components/ProfileImage';

// utils
import { spacing, baseColors, fontSizes, fontWeights } from 'utils/variables';
import {
  formatFullAmount,
  noop,
  formatUnits,
} from 'utils/common';
import { createAlert } from 'utils/alerts';
import { addressesEqual } from 'utils/assets';
import { findAccountByAddress, getAccountName, getInactiveUserAccounts } from 'utils/accounts';
import { findMatchingContact } from 'utils/contacts';

// actions
import { updateTransactionStatusAction } from 'actions/historyActions';
import { getTxNoteByContactAction } from 'actions/txNoteActions';

// constants
import { TRANSACTION_EVENT, TX_PENDING_STATUS, TX_CONFIRMED_STATUS } from 'constants/historyConstants';
import {
  TYPE_RECEIVED,
  TYPE_ACCEPTED,
  TYPE_REJECTED,
  TYPE_SENT,
} from 'constants/invitationsConstants';
import {
  CONTACT,
  SEND_TOKEN_FROM_CONTACT_FLOW,
  COLLECTIBLE,
  CHAT,
} from 'constants/navigationConstants';
import { COLLECTIBLE_TRANSACTION, COLLECTIBLE_SENT, COLLECTIBLE_RECEIVED } from 'constants/collectiblesConstants';
import { PAYMENT_NETWORK_ACCOUNT_TOPUP, PAYMENT_NETWORK_TX_SETTLEMENT } from 'constants/paymentNetworkConstants';

// selectors
import { accountHistorySelector } from 'selectors/history';
import { activeAccountAddressSelector } from 'selectors';
import { accountAssetsSelector } from 'selectors/assets';

// local components
import EventHeader from './EventHeader';

type Props = {
  txDetailsUrl: string,
  transaction: Transaction,
  contacts: ApiUser[],
  history: Object[],
  assets: Assets,
  onClose: Function,
  onAccept: Function,
  onReject: Function,
  onCancel: Function,
  updateTransactionStatus: Function,
  navigation: NavigationScreenProp<*>,
  eventData: Object,
  eventType: string,
  eventStatus: string,
  txNotes: Object[],
  getTxNoteByContact: Function,
  activeAccountAddress: string,
  contactsSmartAddresses: ContactSmartAddressData[],
  inactiveAccounts: Accounts,
}

const ContentWrapper = styled.View`
  width: 100%;
`;

const EventBody = styled.View`
  padding: 0 ${spacing.mediumLarge}px 40px;
  background-color: ${baseColors.snowWhite};
`;

const EventProfileImage = styled(ProfileImage)`
`;

const ButtonsWrapper = styled.View`
  margin-top: 6px;
`;

const EventButton = styled(Button)`
  margin-top: 14px;
`;

const EventRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  margin-top: 32px;
  margin-bottom: 8px;
  flex-wrap: wrap;
`;

const EventBodyTitle = styled(BaseText)`
  font-size: ${fontSizes.large}px;
  font-weight: ${fontWeights.medium};
  color: ${props => props.color ? props.color : baseColors.slateBlack};
  margin: 0 10px 2px;
  text-align: center;
`;

const viewTransactionOnBlockchain = (txDetailsUrl: string, hash: string) => {
  Linking.openURL(txDetailsUrl + hash);
};

class EventDetails extends React.Component<Props, {}> {
  timer: ?IntervalID;
  timeout: ?TimeoutID;
  // HACK: we need to cache the tx data for smart wallet migration process
  cachedTxInfo = {};

  shouldComponentUpdate(nextProps: Props) {
    return !isEqual(this.props, nextProps);
  }

  componentDidMount() {
    const {
      eventType,
      eventData,
      updateTransactionStatus,
      getTxNoteByContact,
      contacts,
      history,
    } = this.props;

    if (eventType !== TRANSACTION_EVENT) return;

    if (contacts.find(contact => contact.username === eventData.username)
      && Object.keys(eventData.contact).length) {
      getTxNoteByContact(eventData.contact.username);
    }

    const txInfo = history.find(tx => tx.hash === eventData.hash) || {};
    if (txInfo.status === TX_PENDING_STATUS) {
      this.timeout = setTimeout(() => updateTransactionStatus(eventData.hash), 500);
      this.timer = setInterval(() => updateTransactionStatus(eventData.hash), 10000);
    }

    if (txInfo.status === TX_CONFIRMED_STATUS && (!txInfo.gasUsed || !txInfo.gasPrice)) {
      updateTransactionStatus(eventData.hash);
    }
  }

  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
    if (this.timeout) clearTimeout(this.timeout);
  }

  componentDidUpdate() {
    const { eventType, eventData, history } = this.props;
    if (eventType !== TRANSACTION_EVENT || !this.timer) return;

    const txInfo = history.find(tx => tx.hash === eventData.hash) || {};
    if (txInfo.status !== TX_PENDING_STATUS && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  handleAcceptConnection = () => {
    const { onClose, onAccept } = this.props;
    onClose();
    onAccept();
  };

  handleRejectConnection = (userData) => {
    const { onClose, onReject } = this.props;
    createAlert(TYPE_REJECTED, userData, () => {
      onClose();
      onReject();
    });
  };

  handleCancelConnection = () => {
    const { onClose, onCancel } = this.props;
    onClose();
    onCancel();
  };

  goToProfile = (contact = {}) => {
    if (!contact.username) return;
    const {
      navigation,
      onClose,
    } = this.props;
    onClose();
    navigation.navigate(CONTACT, { contact });
  };

  goToCollectible = (assetData = {}) => {
    const {
      navigation,
      onClose,
    } = this.props;
    onClose();
    navigation.navigate(COLLECTIBLE, { assetData });
  };

  sendTokensToUser = (contact) => {
    const {
      navigation,
      onClose,
    } = this.props;
    onClose();
    navigation.navigate(SEND_TOKEN_FROM_CONTACT_FLOW, { contact });
  };

  goToChatWithUser = (contact) => {
    const {
      navigation,
      onClose,
    } = this.props;
    onClose();
    navigation.navigate(CHAT, { username: contact.username });
  };

  findMatchingContactOrAccount = (address) => {
    const {
      contacts,
      contactsSmartAddresses = [],
      inactiveAccounts,
    } = this.props;
    return findMatchingContact(address, contacts, contactsSmartAddresses)
      || findAccountByAddress(address, inactiveAccounts)
      || {};
  };

  renderEventBody = (eventType, eventStatus) => {
    const {
      eventData,
      activeAccountAddress,
      onClose,
      history,
      txNotes,
      assets,
      txDetailsUrl,
    } = this.props;
    let eventTime = formatDate(new Date(eventData.createdAt * 1000), 'MMMM D, YYYY HH:mm');
    if (eventType === TRANSACTION_EVENT) {
      let txInfo = history.find(tx => tx.hash === eventData.hash);
      if (!txInfo) {
        txInfo = this.cachedTxInfo || {};
      } else {
        this.cachedTxInfo = txInfo;
      }
      const {
        to,
        from,
        asset,
        hash,
        gasUsed,
        gasPrice,
        status,
        note,
        isPPNTransaction,
        tag,
        extra,
      } = txInfo;

      const isReceived = addressesEqual(to, activeAccountAddress);
      const toMyself = isReceived && addressesEqual(from, to);
      let transactionNote = note;
      if (txNotes && txNotes.length > 0) {
        const txNote = txNotes.find(txn => txn.txHash === eventData.hash);
        if (txNote) {
          transactionNote = txNote.text;
        }
      }
      const hasNote = transactionNote && transactionNote !== '';
      const isPending = status === TX_PENDING_STATUS;
      const assetsData = Object.keys(assets).map(id => assets[id]);
      const { decimals = 18 } = assetsData.find(({ symbol }) => symbol === asset) || {};
      const value = formatUnits(txInfo.value, decimals);
      const recipientContact = this.findMatchingContactOrAccount(to);
      const senderContact = this.findMatchingContactOrAccount(from);
      const relatedUser = isReceived ? senderContact : recipientContact;
      // $FlowFixMe
      let relatedUserTitle = relatedUser.username || getAccountName(relatedUser.type) || (isReceived
        ? `${from.slice(0, 7)}…${from.slice(-7)}`
        : `${to.slice(0, 7)}…${to.slice(-7)}`);
      if (addressesEqual(to, from)) {
        relatedUserTitle = 'My account';
      }
      const relatedUserProfileImage = relatedUser.profileImage || null;
      // $FlowFixMe
      const showProfileImage = !relatedUser.type;

      if (isPending) {
        const pendingTimeInSeconds = differenceInSeconds(new Date(), new Date(eventData.createdAt * 1000));
        const ph = Math.floor(pendingTimeInSeconds / 3600);
        const pm = Math.floor((pendingTimeInSeconds % 3600) / 60);
        const ps = Math.floor((pendingTimeInSeconds % 3600) % 60);

        const pendingHours = ph > 0 ? `${ph} H ` : '';
        const pendingMinutes = pm > 0 ? `${pm} MIN ` : '';
        const pendingSeconds = ps > 0 ? `${ps} SEC` : '';

        eventTime = `${pendingHours}${pendingMinutes}${pendingSeconds} AGO`;
      }

      const fee = gasUsed && gasPrice ? Math.round(gasUsed * gasPrice) : 0;
      const freeTx = isPPNTransaction;
      let showAmountReceived = true;
      let showSender = true;
      let showNote = true;
      let showViewOnBlockchain = true;
      let showAmountTxType = false;
      let txType = '';
      const listSettledAssets = (tag === PAYMENT_NETWORK_TX_SETTLEMENT && !isEmpty(extra));

      if (tag === PAYMENT_NETWORK_TX_SETTLEMENT) {
        showAmountReceived = false;
        showSender = false;
        showNote = false;
        showAmountTxType = true;
        txType = 'PLR Network settle';
      } else if (tag === PAYMENT_NETWORK_ACCOUNT_TOPUP) {
        showSender = false;
        showNote = false;
        showAmountTxType = true;
        txType = 'TANK TOP UP';
      }

      if (isPPNTransaction) {
        showViewOnBlockchain = false;
      }

      return (
        <React.Fragment>
          <EventHeader
            eventType={TRANSACTION_EVENT}
            eventStatus={status}
            eventTime={eventTime}
            onClose={onClose}
          />
          <EventBody>
            {showAmountReceived &&
            <ListItemUnderlined
              label={isReceived ? 'AMOUNT RECEIVED' : 'AMOUNT SENT'}
              value={formatFullAmount(value)}
              valueAdditionalText={asset}
            />
            }
            {showAmountTxType &&
            <ListItemUnderlined
              label="TRANSACTION TYPE"
              value={txType}
            />
            }
            {showSender &&
            <ListItemUnderlined
              label={isReceived ? 'SENDER' : 'RECIPIENT'}
              value={relatedUserTitle}
              valueAddon={(!!relatedUser.username && <EventProfileImage
                uri={relatedUserProfileImage}
                showProfileImage={showProfileImage}
                userName={relatedUserTitle}
                diameter={40}
                initialsSize={fontSizes.extraSmall}
                style={{ marginBottom: 4 }}
                onPress={() => this.goToProfile(relatedUser)}
                noShadow
                borderWidth={0}
              />)}
            />
            }
            {listSettledAssets &&
            <ListItemUnderlined
              label="ASSETS"
              value={extra.map(item => <BoldText key={item.hash}> {item.value} {item.symbol}</BoldText>)}
            />
            }
            {(toMyself || !isReceived) && !isPending && (freeTx || !!fee) &&
            <ListItemUnderlined
              label="TRANSACTION FEE"
              value={freeTx ? 'free' : utils.formatEther(fee.toString())}
              valueAdditionalText={freeTx ? '' : 'ETH'}
            />
            }
            {!!hasNote && showNote &&
            <ListItemParagraph
              label="NOTE"
              value={transactionNote}
            />
            }
            {showViewOnBlockchain &&
            <ButtonsWrapper>
              <EventButton
                block
                title="View on the blockchain"
                primaryInverted
                onPress={() => viewTransactionOnBlockchain(txDetailsUrl, hash)}
              />
            </ButtonsWrapper>
            }
          </EventBody>
        </React.Fragment>
      );
    }

    if (eventType === COLLECTIBLE_TRANSACTION) {
      const {
        to,
        from,
        note,
        icon,
        assetData = {},
        gasUsed,
        gasPrice,
        hash,
      } = eventData;

      const { name = '' } = assetData;

      const isReceived = addressesEqual(to, activeAccountAddress);
      const toMyself = isReceived && addressesEqual(from, to);
      const status = isReceived ? COLLECTIBLE_RECEIVED : COLLECTIBLE_SENT;
      const fee = gasUsed && gasPrice ? Math.round(gasUsed * gasPrice) : 0;
      let transactionNote = note;

      if (txNotes && txNotes.length > 0) {
        const txNote = txNotes.find(txn => txn.txHash === eventData.hash);
        if (txNote) {
          transactionNote = txNote.text;
        }
      }
      const hasNote = transactionNote && transactionNote !== '';
      const recipientContact = this.findMatchingContactOrAccount(to);
      const senderContact = this.findMatchingContactOrAccount(from);
      const relatedUser = isReceived ? senderContact : recipientContact;
      // $FlowFixMe
      const relatedUserTitle = relatedUser.username || getAccountName(relatedUser.type) || (isReceived
        ? `${from.slice(0, 7)}…${from.slice(-7)}`
        : `${to.slice(0, 7)}…${to.slice(-7)}`);
      const relatedUserProfileImage = relatedUser.profileImage || null;
      // $FlowFixMe
      const showProfileImage = !relatedUser.type;

      return (
        <React.Fragment>
          <EventHeader
            eventType={COLLECTIBLE_TRANSACTION}
            eventStatus={status}
            eventTime={eventTime}
            onClose={onClose}
            iconUrl={icon}
            onIconPress={Object.keys(assetData).length ? () => this.goToCollectible(assetData) : noop}
            imageKey={name}
            touchDisabled={!Object.keys(assetData).length}
          />
          <EventBody>
            <ListItemUnderlined
              label={isReceived ? 'SENDER' : 'RECIPIENT'}
              value={relatedUserTitle}
              valueAddon={(!!relatedUser.username && <EventProfileImage
                uri={relatedUserProfileImage}
                showProfileImage={showProfileImage}
                userName={relatedUserTitle}
                diameter={40}
                initialsSize={fontSizes.extraSmall}
                style={{ marginBottom: 4 }}
                onPress={() => this.goToProfile(relatedUser)}
                noShadow
                borderWidth={0}
              />)}
            />
            {(toMyself || !isReceived) && !!fee &&
            <ListItemUnderlined
              label="TRANSACTION FEE"
              value={utils.formatEther(fee.toString())}
              valueAdditionalText="ETH"
            />
            }
            {!!hasNote &&
            <ListItemParagraph
              label="NOTE"
              value={transactionNote}
            />
            }
            <ButtonsWrapper>
              <EventButton
                block
                title="View on the blockchain"
                primaryInverted
                onPress={() => viewTransactionOnBlockchain(txDetailsUrl, hash)}
              />
            </ButtonsWrapper>
          </EventBody>
        </React.Fragment>
      );
    }

    const userData = {
      username: eventData.username,
      name: eventData.firstName,
      lastName: eventData.lastName,
      profileImage: eventData.profileImage,
      ethAddress: eventData.ethAddress,
    };

    return (
      <React.Fragment>
        <EventHeader
          eventType={eventType}
          eventStatus={eventStatus}
          eventTime={eventTime}
          onClose={onClose}
        />
        <EventBody>
          <EventRow>
            <EventProfileImage
              uri={userData.profileImage}
              userName={userData.username}
              diameter={40}
              initialsSize={fontSizes.extraSmall}
              onPress={() => this.goToProfile(userData)}
              noShadow
              borderWidth={0}
            />
            <EventBodyTitle>
              @{userData.username}
            </EventBodyTitle>
          </EventRow>
          {eventStatus === TYPE_RECEIVED &&
          <ButtonsWrapper>
            <EventButton
              block
              title="Accept request"
              primaryInverted
              onPress={this.handleAcceptConnection}
            />
            <EventButton
              block
              title="Decline"
              dangerInverted
              onPress={() => {
                this.handleRejectConnection(userData);
              }}
            />
          </ButtonsWrapper>
          }
          {eventStatus === TYPE_SENT &&
          <ButtonsWrapper>
            <EventButton
              block
              title="Cancel request"
              dangerInverted
              onPress={this.handleCancelConnection}
            />
          </ButtonsWrapper>
          }
          {eventStatus === TYPE_ACCEPTED &&
          <ButtonsWrapper>
            <EventButton block title="Send assets" primaryInverted onPress={() => this.sendTokensToUser(userData)} />
            <EventButton block title="Send message" primaryInverted onPress={() => this.goToChatWithUser(userData)} />
          </ButtonsWrapper>
          }
        </EventBody>
      </React.Fragment>
    );
  };

  render() {
    const { eventType, eventStatus } = this.props;

    return (
      <ContentWrapper>
        {this.renderEventBody(eventType, eventStatus)}
      </ContentWrapper>
    );
  }
}

const mapStateToProps = ({
  contacts: {
    data: contacts,
    contactsSmartAddresses: { addresses: contactsSmartAddresses },
  },
  txNotes: { data: txNotes },
  accounts: { data: accounts },
  network: { ethereumNetwork: { txDetailsUrl } },
}) => ({
  contacts,
  txNotes,
  contactsSmartAddresses,
  inactiveAccounts: getInactiveUserAccounts(accounts),
  txDetailsUrl,
});

const structuredSelector = createStructuredSelector({
  history: accountHistorySelector,
  activeAccountAddress: activeAccountAddressSelector,
  assets: accountAssetsSelector,
});

const combinedMapStateToProps = (state) => ({
  ...structuredSelector(state),
  ...mapStateToProps(state),
});

const mapDispatchToProps = (dispatch) => ({
  updateTransactionStatus: (hash) => dispatch(updateTransactionStatusAction(hash)),
  getTxNoteByContact: (username) => dispatch(getTxNoteByContactAction(username)),
});

export default connect(combinedMapStateToProps, mapDispatchToProps)(EventDetails);
