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
import { StyleSheet } from 'react-native';
import styled from 'styled-components/native';
import { baseColors, UIColors, fontSizes, spacing } from 'utils/variables';
import { Switch, Input } from 'native-base';
import { BaseText } from 'components/Typography';
import Icon from 'components/Icon';

const StyledItemView = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 9px ${spacing.rhythm}px;
  background-color: #ffffff;
  border-bottom-color: ${({ hasErrors }) => hasErrors ? UIColors.danger : baseColors.lightGray};
  border-top-color: ${({ hasErrors }) => hasErrors ? UIColors.danger : baseColors.lightGray};
  border-bottom-width: ${StyleSheet.hairlineWidth};
  border-top-width: ${StyleSheet.hairlineWidth};
  height: 60px;
  marginTop: ${({ marginTop = 0 }) => marginTop};
  marginBottom: ${({ marginBottom = 0 }) => marginBottom};
  marginLeft: ${({ marginLeft = 0 }) => marginLeft};
  marginRight: ${({ marginRight = 0 }) => marginRight};
`;

const ItemLabelHolder = styled.View`
  display: flex;
  flex: 1;
  flex-direction: column;
  margin: 0 20px 0 0;
`;

const ItemLabel = styled(BaseText)`
  font-size: ${({ hasErrors }) => hasErrors ? fontSizes.extraExtraSmall : fontSizes.extraSmall};
  color: ${({ hasErrors }) => hasErrors ? UIColors.danger : baseColors.coolGrey};
  flex-wrap: wrap;
  flex: 1;
  padding: 0 ${spacing.rhythm / 2}px
  align-self: flex-start;
`;

const ItemValue = styled(Input)`
  color: ${baseColors.slateBlack};
  font-size: ${fontSizes.small};
  flex-wrap: wrap;
  flex: 1;
  padding: 0 ${spacing.rhythm / 2}px
  align-self: flex-start;
  width:100%;
`;

const SelectedOption = styled(BaseText)`
  color: ${baseColors.slateBlack};
  font-size: ${fontSizes.small};
  flex-wrap: wrap;
  flex: 1;
  padding: 0 ${spacing.rhythm / 2}px
  align-self: flex-start;
  width:100%;
`;

const VerifyView = styled.View`
  align-items: center;
  flex-direction: row;
`;

const VerifyLabel = styled(BaseText)`
  color: ${({ isVerified }) => isVerified ? baseColors.jadeGreen : baseColors.brightBlue};
  font-size: ${fontSizes.extraSmall};
  margin: 0 4px 0;
`;

const ItemSelectHolder = styled.TouchableOpacity``;

const ListAddon = styled.View`
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin: 0 0 0 15px;
`;

type InputProps = {
  label: string,
  value?: string,
  onChange?: Function,
  onSelect?: Function,
  onBlur?: Function,
};

type SwitchProps = {
  onPress?: ?Function,
  switchStatus?: ?boolean,
}

type Props = {
  includeVerified?: ?boolean,
  isVerified?: ?boolean,
  disabledInput?: ?boolean,
  inputType?: string,
  errorMessage?: ?string,
  marginTop?: ?string,
  marginBottom?: ?string,
  marginLeft?: ?string,
  marginRight?: ?string,
  inputProps: InputProps,
  switchProps: SwitchProps,
}

type EventLike = {
  nativeEvent: Object,
}

export default class InputSwitch extends React.Component<Props> {
  fieldValue: string = '';

  handleBlur = () => {
    const { inputProps: { onBlur } } = this.props;
    if (onBlur) {
      onBlur(this.fieldValue);
    }
  };

  handleChange = (e: EventLike) => {
    const { inputProps: { onChange } } = this.props;
    this.fieldValue = e.nativeEvent.text;

    if (onChange) {
      onChange(this.fieldValue);
    }
  }

  render() {
    const {
      inputType,
      disabledInput,
      errorMessage,
      includeVerified = false,
      isVerified,
      inputProps: { value = '', label, onSelect },
      switchProps: { switchStatus, onPress },
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
    } = this.props;

    const hasErrors = !!errorMessage;
    const errorMessageLabel = hasErrors ? <ItemLabel hasErrors={hasErrors}>  *{errorMessage}</ItemLabel> : null;

    const inputSection = (inputType && inputType === 'Select' && onSelect) ? (
      <ItemSelectHolder
        onPress={onSelect}
      >
        <ItemLabel>
          {label}
          {errorMessageLabel}
        </ItemLabel>
        <SelectedOption>{value}</SelectedOption>
      </ItemSelectHolder>
    ) : (
      <ItemLabelHolder>
        <ItemLabel>
          {label}
          {errorMessageLabel}
        </ItemLabel>
        <ItemValue
          disabled={disabledInput}
          onChange={this.handleChange}
          onBlur={this.handleBlur}
          numberOfLines={1}
          value={value}
        />
      </ItemLabelHolder>
    );

    return (
      <StyledItemView
        hasErrors={hasErrors}
        marginTop={marginTop}
        marginBottom={marginBottom}
        marginLeft={marginLeft}
        marginRight={marginRight}
      >
        {inputSection}

        {includeVerified &&
          <VerifyView>
            <VerifyLabel isVerified={isVerified}>
              {isVerified ? 'Verified' : 'Verify'}
            </VerifyLabel>
            {isVerified &&
              <Icon
                name="check"
                style={{
                  color: baseColors.limeGreen,
                  fontSize: fontSizes.tiny,
                }}
              />
            }
          </VerifyView>
        }

        <ListAddon>
          <Switch
            onValueChange={onPress}
            value={switchStatus}
          />
        </ListAddon>
      </StyledItemView>
    );
  }
}
