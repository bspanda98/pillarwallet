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
import get from 'lodash.get';
import {
  UPDATE_MESSAGES,
  ADD_MESSAGE,
  UPDATE_CHATS,
  FETCHING_CHATS,
  DELETE_CHAT,
  ADD_WEBSOCKET_SENT_MESSAGE,
  ADD_WEBSOCKET_RECEIVED_MESSAGE,
  REMOVE_WEBSOCKET_SENT_MESSAGE,
  REMOVE_WEBSOCKET_RECEIVED_USER_MESSAGES,
  REMOVE_WEBSOCKET_RECEIVED_USER_MESSAGE,
  CHAT_DECRYPTING_FINISHED,
  ADD_CHAT_DRAFT,
  CLEAR_CHAT_DRAFT,
  RESET_UNREAD_MESSAGE,
} from 'constants/chatConstants';
import merge from 'lodash.merge';

type Message = {
  _id: string,
  text: string,
  createdAt: Date,
  status: string,
  type: string,
  user: Object,
};

type Chat = {
  unread: number,
  username: string,
  lastMessage: {
    content: string,
    serverTimestamp: number,
    device: number,
    savedTimestamp: number,
    username: string,
  },
}

export type ChatReducerState = {
  data: {
    chats: Chat[],
    messages: {
      [string]: Message[],
    },
    webSocketMessages: {
      sent: Object[],
      received: Object[],
    },
    isFetching: boolean,
    isDecrypting: boolean,
  },
  draft: ?string,
}

export type ChatReducerAction = {
  type: string,
  payload: any,
}

const initialState = {
  data: {
    chats: [],
    messages: {},
    webSocketMessages: {
      sent: [],
      received: [],
    },
    isFetching: false,
    isDecrypting: false,
  },
  draft: null,
};

export default function chatReducer(
  state: ChatReducerState = initialState,
  action: ChatReducerAction,
): ChatReducerState {
  switch (action.type) {
    case ADD_MESSAGE:
      const { username, message } = action.payload;
      const contactMessages = state.data.messages[username] || [];
      const allMessages = [message, ...contactMessages];

      return merge(
        {},
        state,
        {
          data: {
            messages: {
              [username]: allMessages,
            },
            isFetching: false,
            isDecrypting: false,
          },
        },
      );
    case FETCHING_CHATS:
      return merge(
        {},
        state,
        {
          data: {
            chats: action.payload,
            isFetching: true,
            isDecrypting: true,
          },
        },
      );
    case UPDATE_CHATS:
      return {
        ...state,
        data: {
          ...state.data,
          chats: action.payload,
          isFetching: false,
          isDecrypting: false,
          messages: { ...state.data.messages },
        },
      };
    case UPDATE_MESSAGES:
      return merge(
        {},
        state,
        {
          data: {
            messages: {
              [action.payload.username]: [...action.payload.messages],
            },
            isDecrypting: false,
            isFetching: false,
            chats: state.data.chats
              .map(_chat => {
                let { lastMessage } = _chat;
                const { username: contactUsername } = _chat;
                if (contactUsername === action.payload.username &&
                  get(state, ['data', 'messages', contactUsername], []).length) {
                  const { text, createdAt } = state.data.messages[contactUsername][0];
                  lastMessage = {
                    content: text,
                    username: contactUsername,
                    device: 1,
                    serverTimestamp: createdAt,
                    savedTimestamp: 0,
                  };
                  return { ..._chat, lastMessage, unread: 0 };
                }
                return { ..._chat, unread: 0 };
              }),
          },
        },
      );
    case DELETE_CHAT:
      return {
        ...state,
        data: {
          ...state.data,
          messages: Object.keys(state.data.messages)
            .reduce((thisChat, key) => {
              if (key !== action.payload) {
                thisChat[key] = state.data.messages[key];
              }
              return thisChat;
            }, {}),
          chats: [...state.data.chats]
            .filter(thisChat => thisChat.username !== action.payload),
        },
      };
    case ADD_WEBSOCKET_RECEIVED_MESSAGE:
      return {
        ...state,
        data: {
          ...state.data,
          webSocketMessages: {
            ...state.data.webSocketMessages,
            received: [
              ...state.data.webSocketMessages.received.filter(
                chatMessage => chatMessage.source !== action.payload.source || (
                  chatMessage.source === action.payload.source &&
                  chatMessage.timestamp !== action.payload.timestamp
                ),
              ),
              action.payload,
            ],
          },
        },
      };
    case ADD_WEBSOCKET_SENT_MESSAGE:
      return {
        ...state,
        data: {
          ...state.data,
          webSocketMessages: {
            ...state.data.webSocketMessages,
            sent: [
              ...state.data.webSocketMessages.sent.filter(
                chatMessage => chatMessage.requestId !== action.payload.requestId,
              ),
              action.payload,
            ],
          },
        },
      };
    case REMOVE_WEBSOCKET_RECEIVED_USER_MESSAGES:
      return {
        ...state,
        data: {
          ...state.data,
          webSocketMessages: {
            ...state.data.webSocketMessages,
            received: state.data.webSocketMessages.received.filter(
              chatMessage => chatMessage.source !== action.payload,
            ),
          },
        },
      };
    case REMOVE_WEBSOCKET_RECEIVED_USER_MESSAGE:
      return {
        ...state,
        data: {
          ...state.data,
          webSocketMessages: {
            ...state.data.webSocketMessages,
            received: state.data.webSocketMessages.received.filter(
              chatMessage => chatMessage.source !== action.payload.username
                && chatMessage.timestamp !== action.payload.timestamp,
            ),
          },
        },
      };
    case REMOVE_WEBSOCKET_SENT_MESSAGE:
      return {
        ...state,
        data: {
          ...state.data,
          webSocketMessages: {
            ...state.data.webSocketMessages,
            sent: state.data.webSocketMessages.sent.filter(
              chatMessage => chatMessage.requestId !== action.payload,
            ),
          },
        },
      };
    case CHAT_DECRYPTING_FINISHED:
      return {
        ...state,
        data: {
          ...state.data,
          isDecrypting: false,
        },
      };
    case ADD_CHAT_DRAFT:
      const { draftText } = action.payload;
      return {
        ...state,
        draft: draftText,
      };
    case CLEAR_CHAT_DRAFT:
      return {
        ...state,
        draft: null,
      };
    case RESET_UNREAD_MESSAGE:
      return {
        ...state,
        data: {
          ...state.data,
          chats: state.data.chats
            .map(_chat => {
              const { username: contactUsername } = _chat;
              if (contactUsername === action.payload.username && state.data.messages[contactUsername].length) {
                const { lastMessage } = action.payload;
                return {
                  ..._chat,
                  lastMessage,
                  unread: 0,
                };
              }
              return _chat;
            }),
        },
      };
    default:
      return state;
  }
}
