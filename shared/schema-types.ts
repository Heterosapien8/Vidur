/**
 * Shared TypeScript definitions between Vidur Chrome Extension and Node.js Server
 */

export type MessageType =
  | 'CAPTURE'
  | 'CAPTURE_SCREEN'
  | 'EXTRACT_DOM'
  | 'CAPTURE_SUCCESS'
  | 'CAPTURE_ERROR'
  | 'PING'
  | 'PONG';

export interface DOMElementBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DOMElementNode {
  id: string;
  tag: string;
  role: string | null;
  label: string | null;
  type: string | null;
  autocomplete: string | null;
  bbox: DOMElementBoundingBox;
  value: string | null;
}

export interface OCRResult {
  text: string;
  confidence: number;
  bbox: DOMElementBoundingBox;
}

export interface ScreenSchemaElement {
  id: string;
  source: 'dom' | 'ocr';
  tag: string | null;
  role: string | null;
  label: string | null;
  type: string | null;
  autocomplete: string | null;
  bbox: DOMElementBoundingBox;
  value: string | null;
  text: string | null;
}

export interface ScreenSchema {
  schemaVersion: '1.0';
  capturedAt: string; // ISO string
  viewport: {
    width: number;
    height: number;
  };
  domain: string; // hostname only, e.g. "example.com"
  elements: ScreenSchemaElement[];
}

export interface CapturePayload {
  screenshot: string; // base64 data URL
  elements: DOMElementNode[];
  count: number;
  url?: string;
  title?: string;
  timestamp: number;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface CaptureResponse {
  status: 'success' | 'error';
  data?: CapturePayload;
  message?: string;
}

export interface BaseMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  timestamp?: number;
}

export interface HealthResponse {
  status: 'ok';
  timestamp?: string;
  uptime?: number;
}
