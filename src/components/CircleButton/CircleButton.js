// @flow
import * as React from 'react';
import { ImageBackground, Image } from 'react-native';
import styled from 'styled-components/native';
import { baseColors, fontSizes, fontTrackings } from '../../utils/variables';
import { BaseText } from '../Typography';

type Props = {
  disabled?: boolean,
  onPress: Function,
  label: string,
  icon: string,
}

const CircleButtonIconWrapperColors = ['#ffffff', '#f2f4f9'];

const CircleButtonWrapper = styled.TouchableOpacity`
  justify-content: center;
  align-items: center;
  padding: 8px 4px 0px;
`;

const CircleButtonIconWrapper = styled.View`
  border-radius: 46;
  width: 92px;
  height: 92px;
  justify-content: center;
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const CircleButtonIcon = styled(Image)`
  height: 24px;
  width: 24px;
  opacity: ${props => props.disabled ? 0.3 : 1};
  justify-content: center;
  display: flex;
`;

const CircleButtonText = styled(BaseText)`
  color: ${props => props.disabled ? baseColors.mediumGray : baseColors.electricBlue};
  opacity: ${props => props.disabled ? 0.7 : 1};
  text-align: center;
  font-size: ${fontSizes.small};
  letter-spacing: ${fontTrackings.tiny}px;
  margin-top: -6px;
`;

const actionButtonBackground = require('../../assets/images/bg_action_button.png');
const actionButtonBackgroundDisabled = require('../../assets/images/bg_action_button_disabled.png');


const CircleButton = (props: Props) => {
  const {
    disabled,
    onPress,
    icon,
    label,
  } = props;

  return (
    <CircleButtonWrapper
      disabled={disabled}
      onPress={() => onPress()}
    >
      <ImageBackground
        source={disabled ? actionButtonBackgroundDisabled : actionButtonBackground}
        style={{ width: 92, height: 92 }}
      >
        <CircleButtonIconWrapper
          disabled={disabled}
          colors={CircleButtonIconWrapperColors}
        >
          <CircleButtonIcon
            disabled={disabled}
            source={icon}
          />
        </CircleButtonIconWrapper>

      </ImageBackground>
      <CircleButtonText disabled={disabled}>
        {label}
      </CircleButtonText>
    </CircleButtonWrapper>
  );
};

export default CircleButton;
