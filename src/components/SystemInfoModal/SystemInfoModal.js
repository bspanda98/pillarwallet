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
import {
  BUILD_NUMBER,
} from 'react-native-dotenv';
import styled from 'styled-components/native';
import { Wrapper } from 'components/Layout';
import { BoldText } from 'components/Typography';
import { baseColors, fontSizes } from 'utils/variables';

import type { EthereumNetwork } from 'models/Network';

const LabeledRow = styled.View`
  margin: 6px 0;
`;

const Label = styled(BoldText)`
  color: ${baseColors.darkGray};
  font-size: ${fontSizes.extraSmall};
  letter-spacing: 0.5;
  line-height: 24px;
`;

const Value = styled(BoldText)`
  font-size: ${fontSizes.medium}
`;

type Props = {
  ethereumNetwork: EthereumNetwork,
};

const SystemInfoModal = (props: Props) => {
  const {
    ethereumNetwork: {
      id,
      bcxUrl,
      txDetailsUrl,
      sdkProvider,
      collectiblesNetwork,
      notificationsUrl,
      openSeaUrl,
    },
  } = props;

  return (
    <Wrapper regularPadding>
      <LabeledRow>
        <Label>BUILD_NUMBER</Label>
        <Value>{BUILD_NUMBER}</Value>
      </LabeledRow>
      <LabeledRow>
        <Label>BCX_URL</Label>
        <Value>{bcxUrl}</Value>
      </LabeledRow>
      <LabeledRow>
        <Label>SDK_PROVIDER</Label>
        <Value>{sdkProvider}</Value>
      </LabeledRow>
      <LabeledRow>
        <Label>TX_DETAILS_URL</Label>
        <Value>{txDetailsUrl}</Value>
      </LabeledRow>
      <LabeledRow>
        <Label>NETWORK_PROVIDER</Label>
        <Value>{id}</Value>
      </LabeledRow>
      <LabeledRow>
        <Label>COLLECTIBLES_NETWORK</Label>
        <Value>{collectiblesNetwork}</Value>
      </LabeledRow>
      <LabeledRow>
        <Label>NOTIFICATIONS_URL</Label>
        <Value>{notificationsUrl}</Value>
      </LabeledRow>
      <LabeledRow>
        <Label>OPEN_SEA_API</Label>
        <Value>{openSeaUrl}</Value>
      </LabeledRow>
    </Wrapper>
  );
};

export default SystemInfoModal;
