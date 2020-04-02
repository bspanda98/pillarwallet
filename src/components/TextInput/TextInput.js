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
import styled, { withTheme } from 'styled-components/native';
import { Item as NBItem, Input } from 'native-base';
import {
  View,
  Platform,
  TextInput as RNInput,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
  ScrollView,
} from 'react-native';
import { CachedImage } from 'react-native-cached-image';
import { SDK_PROVIDER } from 'react-native-dotenv';
import get from 'lodash.get';

import { ETH } from 'constants/assetsConstants';

import IconButton from 'components/IconButton';
import { BaseText, MediumText } from 'components/Typography';
import Spinner from 'components/Spinner';
import Icon from 'components/Icon';
import Button from 'components/Button';
import SearchBar from 'components/SearchBar';
import SlideModal from 'components/Modals/SlideModal';
import EmptyStateParagraph from 'components/EmptyState/EmptyStateParagraph';
import ListItemWithImage from 'components/ListItem/ListItemWithImage';
import TankAssetBalance from 'components/TankAssetBalance';
import ProfileImage from 'components/ProfileImage';
import ContainerWithHeader from 'components/Layout/ContainerWithHeader';

import { fontSizes, spacing, fontStyles, appFont } from 'utils/variables';
import { getThemeColors, themedColors } from 'utils/themes';
import { formatMoney, noop } from 'utils/common';
import { images } from 'utils/images';

import type { Theme } from 'models/Theme';
import type { Props as ButtonProps } from 'components/Button';
import type { Props as IconButtonProps } from 'components/IconButton';


type SelectorValueType = {
  input: string | number,
  selector: {
    icon?: string,
    iconFallback?: string,
    value: string | number,
  }
};

type SelectorOptions = {
  options?: Array<Object>,
  horizontalOptions?: Array<Object>,
  fiatOptions?: Array<Object>,
  selectorPlaceholder?: 'string',
  fullWidth?: boolean,
  showOptionsTitles?: boolean,
  horizontalOptionsTitle?: string,
  optionsTitle?: string,
  fiatOptionsTitle?: string,
  selectorModalTitle?: string,
  optionsSearchPlaceholder?: string,
  displayFiatOptionsFirst?: boolean,
};

type Value = string | number;

type InputPropsType = {
  placeholder?: string,
  onChange: (Value | SelectorValueType) => void,
  onBlur?: (Value | SelectorValueType) => void,
  value: Value,
  selectorValue: SelectorValueType,
  multiline?: boolean,
  onSelectorOpen?: () => void,
  onSelectorChange?: () => void,
  label?: string,
};

type Props = {
  errorMessage?: string,
  inputProps: InputPropsType,
  trim?: boolean,
  autoCorrect?: boolean,
  keyboardAvoidance?: boolean,
  loading?: boolean,
  onLayout?: () => void,
  additionalStyle?: Object,
  errorMessageStyle?: Object,
  getInputRef?: (Input) => void,
  innerImageURI?: string,
  fallbackSource?: number,
  buttonProps?: ButtonProps,
  theme: Theme,
  leftSideText?: string,
  numeric?: boolean,
  iconProps?: IconButtonProps,
  selectorOptions?: SelectorOptions,
  errorMessageOnTop?: boolean,
  inputWrapperStyle?: Object,
  rightPlaceholder?: string,
  fallbackToGenericToken?: boolean,
};

type State = {
  isFocused: boolean,
  showOptionsSelector: boolean,
  query: string,
};

type EventLike = {
  nativeEvent: Object,
};

const getFontSize = (props: Props) => {
  const { inputProps: { value }, numeric } = props;
  if (numeric) return 34;
  if (value || value === 0) return 16;
  return 14;
};

const getLineHeight = (props: Props) => {
  const { inputProps: { value }, numeric } = props;
  if (numeric) return 42;
  if (value || value === 0) return 20;
  return 14;
};

const getFontFamily = (props: Props) => {
  const { inputProps: { value }, numeric } = props;
  if (!(value || value === 0)) return appFont.medium;
  if (numeric) return appFont.bold;
  return appFont.regular;
};

const viewConfig = {
  minimumViewTime: 300,
  viewAreaCoveragePercentThreshold: 100,
  waitForInteraction: true,
};

const MIN_QUERY_LENGTH = 2;

const isMatchingSearch = (query, text) => query && text && text.toUpperCase().includes(query.toUpperCase());
const isCaseInsensitiveMatch = (query, text) => query && text && text.toLowerCase() === query.toLowerCase();

const ErrorMessage = styled(BaseText)`
  color: ${themedColors.negative};
  width: 100%;
  ${({ isOnTop }) => isOnTop ? 'margin-bottom: 10px' : 'margin-top: 10px'};
`;

const InputField = styled(Input)`
  color: ${themedColors.text};
  padding: 0 14px;
  align-self: center;
  margin: 0;
  text-align: ${({ alignTextOnRight }) => alignTextOnRight ? 'right' : 'left'};
`;

const IosFocusInput = styled(RNInput)`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 1px;
`;

const Item = styled(NBItem)`
  border-bottom-color: transparent;
  border-bottom-width: 0;
  flex-direction: row;
  min-height: 0;
  height: ${({ height }) => height}px;
  width: 100%;
  margin: 0;
`;

const InputBorder = styled.View`
  border-radius: 4px;
  border: 1px;
  border-color: ${({ error, theme }) => error ? theme.colors.negative : 'transparent'};
`;

const ItemHolder = styled.View`
  background-color: ${({ error, theme }) => error ? theme.colors.card : theme.colors.tertiary};
  position: relative;
  border-radius: 4px;
`;

const InputFooter = styled(View)`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 0 2px;
  margin-bottom: 6px;
  margin-top: -4px;
`;

const ButtonWrapper = styled.View`
  padding: 4px;
`;

const LeftSideWrapper = styled.View`
  padding-left: 14px;
  flex-direction: row;
  align-items: center;
  max-width: 25%;
`;

const RightSideWrapper = styled.View`
  padding-right: 14px;
  flex-direction: row;
  align-items: center;
`;

const Image = styled(CachedImage)`
  height: 24px;
  width: 24px;
  resize-mode: contain;
  ${({ source, theme }) => !source && `tint-color: ${theme.colors.text};`}
`;

const AddonRegularText = styled(BaseText)`
  color: ${themedColors.secondaryText};
  flex-wrap: wrap;
`;

const Selector = styled.TouchableOpacity`
  height: ${({ height }) => height}px;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-left: 16px;
  padding-right: 10px;
  background-color: ${themedColors.card};
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  border: 1px solid ${themedColors.secondaryAccent};
  ${({ fullWidth }) => fullWidth && `
    flex: 1;
    border-radius: 4px;
  `}
  margin: 0;
`;

const ValueWrapper = styled.View`
  flex-direction: row;
  align-items: center;
`;

const Placeholder = styled(MediumText)`
  ${fontStyles.big};
`;

const PlaceholderRight = styled(BaseText)`
  ${fontStyles.medium};
  margin-right: 8px;
`;

const SelectorValue = styled(MediumText)`
  ${fontStyles.big};
  color: ${themedColors.text};
  margin-left: 8px;
`;

const SelectorChevron = styled(Icon)`
  font-size: 16px;
  color: ${themedColors.primary};
  margin-left: 15px;
`;

const Wrapper = styled.View`
`;

const SearchBarWrapper = styled.View`
  padding: ${spacing.mediumLarge}px ${spacing.layoutSides}px 0;
`;

const HorizontalOptions = styled.View`
  border-bottom-width: 1px;
  border-style: solid;
  border-color: ${themedColors.border};
  padding-bottom: ${spacing.small}px;
`;

const HorizontalOptionItem = styled.TouchableOpacity`
  align-items: center;
  width: 68px;
`;

const HorizontalOptionItemName = styled(BaseText)`
  ${fontStyles.small};
  color: ${themedColors.secondaryText};
  padding: 0 4px;
  margin-top: 10px;
`;

const OptionsHeader = styled(MediumText)`
  margin: ${spacing.large}px ${spacing.layoutSides}px 0;
  ${fontStyles.regular};
  color: ${themedColors.secondaryText};
`;

const EmptyStateWrapper = styled(Wrapper)`
  padding-top: 90px;
  padding-bottom: 90px;
  align-items: center;
`;

const InputLabel = styled(MediumText)`
  margin-bottom: 8px;
`;


class TextInput extends React.Component<Props, State> {
  multilineInputField: Input;
  searchInput: RNInput;
  rnInput: Object;

  static defaultProps = {
    autoCorrect: false,
    trim: true,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      isFocused: false,
      showOptionsSelector: false,
      query: '',
    };
  }

  handleBlur = (e: EventLike) => {
    if (Platform.OS === 'android' && e.nativeEvent.text === undefined) {
      return;
    }

    const { inputProps: { onBlur, selectorValue = {} }, trim } = this.props;
    const { selector } = selectorValue;
    const value = trim ? e.nativeEvent.text.trim() : e.nativeEvent.text;
    if (onBlur) {
      if (selector) {
        onBlur({ selector, input: value });
      } else {
        onBlur(value);
      }
    }

    if (Platform.OS === 'ios' && this.props.inputProps.multiline && this.props.keyboardAvoidance) {
      this.setState({
        isFocused: false,
      });
    }
  };

  handleChange = (e: EventLike) => {
    const { inputProps: { onChange, selectorValue = {} } } = this.props;
    const value = e.nativeEvent.text;
    const { selector } = selectorValue;

    if (onChange) {
      if (selector) {
        onChange({ selector, input: value });
      } else {
        onChange(value);
      }
    }
  };

  handleFocus = () => {
    this.setState({
      isFocused: true,
    });
  };

  handleRNFocus = () => {
    setTimeout(() => {
      if (this.multilineInputField) this.multilineInputField.focus();
      this.setState({
        isFocused: true,
      });
    }, 500);
  };

  handleMultilineFocus = () => {
    if (!this.state.isFocused && this.rnInput) {
      this.rnInput.focus();
    }
  };

  resolveAssetSource(uri?: string | number) {
    if (!uri) return { uri: null };
    if (typeof uri === 'number') return uri;
    return {
      uri,
    };
  }

  openSelector = () => {
    Keyboard.dismiss();
    this.setState({ showOptionsSelector: true });
    const { inputProps } = this.props;
    const { onSelectorOpen } = inputProps;
    if (onSelectorOpen) onSelectorOpen();
  };

  renderOption = ({ item: option }: Object) => {
    const {
      name,
      symbol,
      assetBalance,
      formattedBalanceInFiat,
      paymentNetworkBalance,
    } = option;
    const iconUrl = `${SDK_PROVIDER}/${option.icon}?size=3`;
    const paymentNetworkBalanceFormatted = formatMoney(paymentNetworkBalance, 4);

    return (
      <ListItemWithImage
        onPress={() => this.selectValue(option)}
        label={name}
        itemImageUrl={iconUrl}
        fallbackToGenericToken
        balance={!!formattedBalanceInFiat && {
          balance: assetBalance,
          value: formattedBalanceInFiat,
          token: symbol,
        }}
        customAddon={!!paymentNetworkBalance &&
          <TankAssetBalance
            amount={paymentNetworkBalanceFormatted}
            isSynthetic={symbol !== ETH}
          />
        }
        rightColumnInnerStyle={{ alignItems: 'flex-end' }}
      />
    );
  };

  renderHorizontalOption = ({ item }) => {
    const { symbol, iconUrl } = item;
    const iconUri = `${SDK_PROVIDER}/${iconUrl}?size=3`;
    return (
      <HorizontalOptionItem
        key={symbol}
        onPress={() => this.selectValue(item)}
      >
        <ProfileImage
          uri={iconUri}
          userName={symbol}
          diameter={64}
          textStyle={{ fontSize: fontSizes.medium }}
          noShadow
          borderWidth={0}
        />
        <HorizontalOptionItemName numberOfLines={1}>{symbol}</HorizontalOptionItemName>
      </HorizontalOptionItem>
    );
  };

  selectValue = (selectedValue: Object) => {
    const { inputProps: { onChange, selectorValue } } = this.props;
    const { input } = selectorValue;
    if (onChange) onChange({ selector: selectedValue, input });
    this.setState({ showOptionsSelector: false });
  };

  focusInput = () => {
    if (this.searchInput) this.searchInput.focus();
  };

  onMultilineInputFieldPress = () => {
    if (this.multilineInputField) this.multilineInputField.focus();
  };

  handleSearch = (query: string) => {
    const formattedQuery = !query ? '' : query.trim();

    this.setState({
      query: formattedQuery,
    });
  };

  renderHorizontalOptions = (data, title) => {
    if (!data.length) return null;
    const { selectorOptions: { showOptionsTitles } = {} } = this.props;
    return (
      <HorizontalOptions>
        {(showOptionsTitles && !!title) &&
          <OptionsHeader>{title}</OptionsHeader>
        }
        <FlatList
          data={data}
          keyExtractor={({ name }) => name}
          keyboardShouldPersistTaps="always"
          renderItem={this.renderHorizontalOption}
          horizontal
          contentContainerStyle={{ paddingHorizontal: spacing.layoutSides, paddingVertical: spacing.medium }}
          ItemSeparatorComponent={() => <View style={{ width: 26, height: 1 }} />}
        />
      </HorizontalOptions>
    );
  };

  render() {
    const { isFocused, query, showOptionsSelector } = this.state;
    const {
      inputProps,
      errorMessage,
      autoCorrect,
      loading,
      onLayout,
      additionalStyle,
      getInputRef,
      errorMessageStyle,
      innerImageURI,
      fallbackToGenericToken,
      buttonProps,
      theme,
      leftSideText,
      numeric,
      iconProps,
      rightPlaceholder,
      selectorOptions = {},
      errorMessageOnTop,
      inputWrapperStyle = {},
    } = this.props;
    let { fallbackSource } = this.props;

    const colors = getThemeColors(theme);
    const { value = '', selectorValue = {}, label } = inputProps;
    const { selector = {}, input: inputValue } = selectorValue;
    const textInputValue = inputValue || value;
    if (fallbackToGenericToken) ({ genericToken: fallbackSource } = images(theme));

    const variableFocus = Platform.OS === 'ios' && inputProps.multiline && this.props.keyboardAvoidance ?
      this.handleMultilineFocus : this.handleFocus;

    let inputHeight = 54;
    if (inputProps.multiline) {
      inputHeight = Platform.OS === 'ios' ? 120 : 100;
    }

    const customStyle = inputProps.multiline ? { paddingTop: 10 } : {};

    const {
      options = [],
      horizontalOptions = [],
      selectorPlaceholder,
      fullWidth: fullWidthSelector,
      showOptionsTitles,
      horizontalOptionsTitle,
      optionsTitle,
      selectorModalTitle,
      optionsSearchPlaceholder,
      fiatOptions = [],
      fiatOptionsTitle,
      displayFiatOptionsFirst,
    } = selectorOptions;

    const showLeftAddon = (innerImageURI || fallbackSource) || !!leftSideText;
    const showRightAddon = !!iconProps || loading || rightPlaceholder;

    const selectorOptionsCount = options.length + horizontalOptions.length;
    const {
      icon: selectedOptionIcon,
      iconFallback: selectedOptionFallback,
      value: selectedValue,
    } = selector;

    let filteredHorizontalListData = horizontalOptions;
    let filteredListData = options;

    const isSearchQuery = query && query.length >= MIN_QUERY_LENGTH;
    if (isSearchQuery && showOptionsSelector) {
      // filter by search query and sort exact matches (case insensitve) first (-1) or keep existing order (0)
      filteredListData = filteredListData
        .filter(({ value: val, name }) => isMatchingSearch(query, val) || isMatchingSearch(query, name))
        .sort(
          ({ value: val, name }) => isCaseInsensitiveMatch(query, val) || isCaseInsensitiveMatch(query, name) ? -1 : 0,
        );
      filteredHorizontalListData = filteredHorizontalListData
        .filter(({ value: val, name }) => isMatchingSearch(query, val) || isMatchingSearch(query, name))
        .sort(
          ({ value: val, name }) => isCaseInsensitiveMatch(query, val) || isCaseInsensitiveMatch(query, name) ? -1 : 0,
        );
    }

    const imageSource = this.resolveAssetSource(innerImageURI);
    const optionImageSource = this.resolveAssetSource(selectedOptionIcon);

    const renderedFiatHorizontalOptions = this.renderHorizontalOptions(fiatOptions, fiatOptionsTitle);

    return (
      <View style={{ paddingBottom: 10, flexDirection: 'column', ...inputWrapperStyle }}>
        {!!errorMessage && !!errorMessageOnTop &&
          <ErrorMessage style={errorMessageStyle} isOnTop>{errorMessage}</ErrorMessage>
        }
        {!!label &&
          <InputLabel>{label}</InputLabel>
        }
        <InputBorder error={!!errorMessage}>
          <ItemHolder error={!!errorMessage}>
            <Item
              isFocused={isFocused}
              height={inputHeight}
            >
              {!!Object.keys(selectorOptions).length &&
              <Selector
                fullWidth={fullWidthSelector}
                onPress={selectorOptionsCount > 1 ? this.openSelector : noop}
                disabled={selectorOptionsCount < 1}
                height={inputHeight}
              >
                {selector.value
                  ? (
                    <ValueWrapper>
                      <Image
                        key={selectedValue}
                        source={optionImageSource}
                        fallbackSource={optionImageSource ? selectedOptionFallback : optionImageSource}
                        resizeMode="contain"
                      />
                      <SelectorValue>{selectedValue}</SelectorValue>
                    </ValueWrapper>
                    )
                  : (<Placeholder>{selectorPlaceholder || 'select'}</Placeholder>)}
                {selectorOptionsCount > 1 && <SelectorChevron name="selector" />}
              </Selector>}
              {showLeftAddon &&
              <TouchableWithoutFeedback onPress={this.onMultilineInputFieldPress}>
                <LeftSideWrapper>
                  {(innerImageURI || fallbackSource) && <Image
                    source={imageSource}
                    fallbackSource={fallbackSource}
                    style={{ marginRight: 9 }}
                  />}
                  {!!leftSideText && <AddonRegularText>{leftSideText}</AddonRegularText>}
                </LeftSideWrapper>
              </TouchableWithoutFeedback>}
              {!fullWidthSelector &&
              <InputField
                {...inputProps}
                innerRef={(input) => {
                  const inputRoot = get(input, '_root');
                  if (inputRoot) {
                    this.multilineInputField = inputRoot;
                    if (getInputRef) getInputRef(inputRoot);
                  }
                }}
                onChange={this.handleChange}
                onBlur={this.handleBlur}
                onEndEditing={this.handleBlur}
                onFocus={variableFocus}
                value={textInputValue}
                autoCorrect={autoCorrect}
                style={[{
                  fontSize: getFontSize(this.props),
                  lineHeight: getLineHeight(this.props),
                  fontFamily: getFontFamily(this.props),
                  textAlignVertical: inputProps.multiline ? 'top' : 'center',
                  height: inputHeight,
                }, customStyle,
                  additionalStyle,
                ]}
                onLayout={onLayout}
                placeholderTextColor={colors.accent}
                alignTextOnRight={!!numeric}
              />}
              {showRightAddon &&
              <RightSideWrapper>
                {!!rightPlaceholder && <PlaceholderRight color={colors.accent}>{rightPlaceholder}</PlaceholderRight>}
                {!!iconProps && <IconButton color={colors.primary} {...iconProps} />}
                {!!loading && <Spinner width={30} height={30} />}
              </RightSideWrapper>}
              {!!buttonProps &&
              <ButtonWrapper>
                <Button height={48} {...buttonProps} />
              </ButtonWrapper>}
            </Item>
            {Platform.OS === 'ios' && <IosFocusInput
              caretHidden
              autoCorrect={false}
              innerRef={(ref) => { this.rnInput = ref; }}
              onFocus={this.handleRNFocus}
            />}
          </ItemHolder>
        </InputBorder>
        <InputFooter>
          {!!errorMessage && !errorMessageOnTop &&
            <ErrorMessage style={errorMessageStyle}>{errorMessage}</ErrorMessage>
          }
        </InputFooter>
        <SlideModal
          isVisible={showOptionsSelector}
          fullScreen
          onModalShow={this.focusInput}
          onModalHidden={() => {
            this.setState({ query: '' });
            Keyboard.dismiss();
          }}
          noSwipeToDismiss
          noClose
          backgroundColor={colors.card}
        >
          <ContainerWithHeader
            headerProps={{
              noPaddingTop: true,
              customOnBack: () => {
                this.setState({ showOptionsSelector: false, query: '' });
                Keyboard.dismiss();
              },
              centerItems: [{ title: selectorModalTitle }],
            }}
          >
            <ScrollView
              contentContainerStyle={{ paddingBottom: 30 }}
              stickyHeaderIndices={[0]}
              onScroll={() => Keyboard.dismiss()}
              keyboardShouldPersistTaps="always"
            >
              <SearchBarWrapper>
                <SearchBar
                  inputProps={{
                    onChange: this.handleSearch,
                    value: query,
                    autoCapitalize: 'none',
                  }}
                  placeholder={optionsSearchPlaceholder}
                  inputRef={ref => { this.searchInput = ref; }}
                  noClose
                  marginBottom="0"
                />
              </SearchBarWrapper>
              {!!displayFiatOptionsFirst && renderedFiatHorizontalOptions}
              {this.renderHorizontalOptions(filteredHorizontalListData, horizontalOptionsTitle)}
              {!displayFiatOptionsFirst && renderedFiatHorizontalOptions}
              {!!filteredListData.length &&
              <FlatList
                data={filteredListData}
                renderItem={this.renderOption}
                keyExtractor={({ value: val }) => val}
                keyboardShouldPersistTaps="always"
                initialNumToRender={10}
                viewabilityConfig={viewConfig}
                ListHeaderComponent={
                  (showOptionsTitles && !!optionsTitle) && filteredListData.length &&
                  <OptionsHeader>{optionsTitle}</OptionsHeader>
                }
                getItemLayout={(data, index) => ({
                  length: 70,
                  offset: 70 * index,
                  index,
                })}
                windowSize={10}
                hideModalContentWhileAnimating
              />
              }
              {(!filteredListData.length && !filteredHorizontalListData.length) &&
              <EmptyStateWrapper fullScreen>
                <EmptyStateParagraph title="Nothing found" />
              </EmptyStateWrapper>
              }
            </ScrollView>
          </ContainerWithHeader>
        </SlideModal>
      </View>
    );
  }
}

export default withTheme(TextInput);
