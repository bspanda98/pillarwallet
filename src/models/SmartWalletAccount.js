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
import { BigNumber } from 'ethers/utils';
import { SMART_WALLET_DEPLOYMENT_ERRORS } from 'constants/smartWalletConstants';

export type SmartWalletAccount = {
  address: string,
  deployMode: string,
  id: number,
  state: string,
  updatedAt: Date,
};

export type SmartWalletConnectedAccount = {
  ensName: ?string,
  address: string,
  activeDeviceAddress: string,
  type: ?string,
  state: string,
  nextState: ?string,
  balance: { real: BigNumber, virtual: BigNumber },
  updatedAt: Date,
};

export type SmartWalletDeploymentError = $Keys<typeof SMART_WALLET_DEPLOYMENT_ERRORS>;
