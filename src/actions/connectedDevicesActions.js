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
import { NavigationActions } from 'react-navigation';
import get from 'lodash.get';

// actions
import { addSmartWalletAccountDeviceAction } from 'actions/smartWalletActions';

// constants
import {
  SET_ADDING_CONNECTED_DEVICE_ADDRESS,
  DEVICE_CATEGORIES,
  SET_CONNECTED_DEVICES,
  RESET_ADDING_CONNECTED_DEVICE_ADDRESS,
} from 'constants/connectedDevicesConstants';
import { REMOVE_SMART_WALLET_CONNECTED_DEVICE } from 'constants/navigationConstants';

// utils
import { addressesEqual } from 'utils/assets';
import { isSmartWalletDeviceDeployed } from 'utils/smartWallet';

// services
import { navigate } from 'services/navigation';

// types
import type { Dispatch, GetState } from 'reducers/rootReducer';
import type { ConnectedDevice } from 'models/ConnectedDevice';
import type { SmartWalletAccountDevice } from 'models/SmartWalletAccount';


export const setConnectedDevicesAction = (devices: ConnectedDevice[]) => ({
  type: SET_CONNECTED_DEVICES,
  payload: devices,
});

export const addConnectedDeviceAction = (deviceCategory: string, deviceAddress: string) => {
  return async (dispatch: Dispatch, getState: GetState) => {
    dispatch({ type: SET_ADDING_CONNECTED_DEVICE_ADDRESS, payload: deviceAddress });
    if (deviceCategory === DEVICE_CATEGORIES.SMART_WALLET_DEVICE) {
      // error messages handled by smart wallet service
      await dispatch(addSmartWalletAccountDeviceAction(deviceAddress));

      // check if account was created
      const smartWalletAccountDevices = get(getState(), 'smartWallet.connectedAccount.devices', []);
      const newSmartWalletAccountDevice: ?SmartWalletAccountDevice = smartWalletAccountDevices.find(
        ({ device }) => addressesEqual(device.address, deviceAddress),
      );

      // check if device was deployed
      if (!newSmartWalletAccountDevice || !isSmartWalletDeviceDeployed(newSmartWalletAccountDevice)) {
        dispatch({ type: RESET_ADDING_CONNECTED_DEVICE_ADDRESS });
        return;
      }

      console.log('newSmartWalletAccountDevice: ', newSmartWalletAccountDevice);

      // device was added and deployed, add to connected devices
      const connectedDevices = get(getState(), 'connectedDevices.data');
      const newDevice: ConnectedDevice = {
        category: DEVICE_CATEGORIES.SMART_WALLET_DEVICE,
        address: deviceAddress,
      };
      const updatedDevices = connectedDevices
        .filter(({ address }) => addressesEqual(address, deviceAddress))
        .concat(newDevice);
      dispatch(setConnectedDevicesAction(updatedDevices));
      dispatch({ type: RESET_ADDING_CONNECTED_DEVICE_ADDRESS });
    }
    // TODO: add history entry
  };
};

export const removeConnectedDeviceAction = ({
  category: deviceCategory,
  address: deviceAddress,
}: ConnectedDevice) => {
  return async () => {
    if (deviceCategory === DEVICE_CATEGORIES.SMART_WALLET_DEVICE) {
      navigate(NavigationActions.navigate({
        routeName: REMOVE_SMART_WALLET_CONNECTED_DEVICE,
        params: { deviceAddress },
      }));
    }
  };
};
