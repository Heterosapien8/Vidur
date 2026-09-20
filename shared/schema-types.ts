/**
 * Shared TypeScript definitions between Vidur Chrome Extension and Node.js Server
 */

export type MessageType =
  | 'CAPTURE'
  | 'CAPTURE_SCREEN'
  | 'EXTRACT_DOM'
  | 'CAPTURE_SUCCESS'
  | 'CAPTURE_ERROR'
  | 'PLAN_ACTION'
  | 'PING'
  | 'PONG';

export type PIICategory =
  | 'EMAIL'
  | 'PHONE'
  | 'PASSWORD'
  | 'CREDIT_CARD'
  | 'NAME'
  | 'ADDRESS'
  | 'GOVT_ID'
  | 'GENERIC_SENSITIVE';

export type PlaceholderMap = Record<string, string>;

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

export interface SanitizeResult {
  sanitizedSchema: ScreenSchema;
  placeholderMap: PlaceholderMap;
  piiCount: number;
  piiCategories: Record<string, number>;
  sessionId: string;
}

export interface VaultRecord {
  sessionId: string;
  placeholderMap: PlaceholderMap;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// -------------------------------------------------------------
// Action Planning Schema Types
// -------------------------------------------------------------

export type ActionType = 'click' | 'type' | 'scroll' | 'wait';

export interface PlanActionItem {
  type: ActionType;
  elementId?: string | null;
  value?: string | null;
}

export interface ActionPlan {
  reasoning: string;
  done: boolean;
  actions: PlanActionItem[];
}

export interface PlanActionRequest {
  task: string;
  sanitizedSchema: ScreenSchema;
  actionHistory?: Array<{ action: PlanActionItem; result?: string }>;
}

export interface PlanActionResponse extends ActionPlan {
  status?: 'success' | 'error';
  error?: string;
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
