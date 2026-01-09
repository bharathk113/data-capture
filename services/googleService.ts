import { Campaign, Entry, FieldDefinition } from '../types';

// Declare types for global google object
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGoogleClient = (clientId: string, apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (gapiInited && gisInited) {
      resolve();
      return;
    }

    const gapiLoadPromise = new Promise<void>((innerResolve) => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        innerResolve();
      });
    });

    const gisLoadPromise = new Promise<void>((innerResolve) => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: '', // defined at request time
      });
      gisInited = true;
      innerResolve();
    });

    Promise.all([gapiLoadPromise, gisLoadPromise])
      .then(() => resolve())
      .catch((err) => reject(err));
  });
};

export const signInAndGetToken = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      resolve(resp);
    };
    if (window.gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when there's no session.
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

const getHeaders = (fields: FieldDefinition[]) => {
  return ['ID', 'Created At', 'Latitude', 'Longitude', 'Accuracy', ...fields.map(f => f.name)];
};

export const createSpreadsheet = async (title: string): Promise<string> => {
  const response = await window.gapi.client.sheets.spreadsheets.create({
    resource: {
      properties: {
        title: `Data Capture: ${title}`,
      },
    },
  });
  return response.result.spreadsheetId;
};

export const ensureSheetStructure = async (spreadsheetId: string, campaign: Campaign) => {
  const headers = getHeaders(campaign.fields);
  
  // Check first row
  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A1:Z1',
  });

  const existingHeaders = response.result.values?.[0];

  if (!existingHeaders || existingHeaders.length === 0) {
    // Write headers
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      resource: {
        values: [headers],
      },
    });
  }
};

export const syncEntries = async (spreadsheetId: string, campaign: Campaign, entries: Entry[]) => {
  if (entries.length === 0) return;

  const rows = entries.map(entry => {
    const baseData = [
      entry.id,
      new Date(entry.createdAt).toISOString(),
      entry.data['__loc_lat'] || '',
      entry.data['__loc_lng'] || '',
      entry.data['__loc_acc'] || '',
    ];

    const fieldData = campaign.fields.map(field => {
      const val = entry.data[field.id];
      if (val === undefined || val === null) return '';
      if (field.type === 'image') {
        // Truncate or put a marker if too long, or better yet, if we had Drive API, we'd put a link.
        // For simple sheets sync, we will denote it.
        // Base64 is often too large for a cell (50k limit).
        // Let's assume we store small text representation or a huge string if it fits.
        if (typeof val === 'string' && val.length > 40000) {
          return '(Image too large for Sheet Cell)';
        }
        return val; 
      }
      if (field.type === 'location') {
        const loc = val as { latitude: number, longitude: number };
        return `${loc.latitude},${loc.longitude}`;
      }
      return String(val);
    });

    return [...baseData, ...fieldData];
  });

  await window.gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: rows,
    },
  });
};
