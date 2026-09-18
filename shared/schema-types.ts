/**
 * Shared TypeScript definitions between Vidur Chrome Extension and Node.js Server
 */

export type MessageType =
  | 'CAPTURE_SCREEN'
  | 'CAPTURE_SCREEN_SUCCESS'
  | 'CAPTURE_SCREEN_ERROR'
  | 'PING'
  | 'PONG';

export interface BaseMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  timestamp?: number;
}

export interface CaptureScreenMessage extends BaseMessage {
  type: 'CAPTURE_SCREEN';
}

export interface CaptureScreenResponse {
  status: 'received_by_content_script' | 'error';
  timestamp: number;
  message?: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp?: string;
  uptime?: number;
}
