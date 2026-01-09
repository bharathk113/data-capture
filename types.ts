export type FieldType = 'text' | 'number' | 'datetime' | 'location' | 'polygon' | 'image' | 'boolean';

export interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  fields: FieldDefinition[];
  spreadsheetId?: string;
  createdAt: number;
}

export interface Entry {
  id: string;
  campaignId: string;
  data: Record<string, any>; // Keyed by FieldDefinition.id
  synced: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface GoogleAuthConfig {
  clientId: string;
  apiKey: string;
}

export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}