import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Settings, Database, Cloud, AlertTriangle, 
  MapPin, Camera, Save, ArrowLeft, RefreshCw,
  FileSpreadsheet, CheckCircle, Loader2, Trash2, Edit2, Map as MapIcon, X, Maximize2, Minimize2, Crosshair
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { Campaign, FieldDefinition, FieldType, Entry, GoogleAuthConfig } from './types';
import { db } from './db';
import * as GoogleService from './services/googleService';

// Fix Leaflet Default Icon issue in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- Helper Components ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }> = ({ 
  className = '', variant = 'primary', ...props 
}) => {
  const variants = {
    primary: 'bg-accent text-white hover:bg-blue-600',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-500 text-white hover:bg-red-600'
  };
  return (
    <button 
      className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
      {...props}
    />
  );
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none" {...props} />
);

// --- specialized Map Components ---

const RecenterMap = ({ lat, lng }: { lat: number, lng: number }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng]);
  return null;
};

// Draggable Marker for Point Field
const DraggableMarker = ({ position, onDragEnd }: { position: [number, number], onDragEnd: (lat: number, lng: number) => void }) => {
  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          onDragEnd(lat, lng);
        }
      },
    }),
    [onDragEnd],
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
};

// Map click handler for Polygon
const MapClickHandler = ({ onClick }: { onClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// --- Sub-Screens ---

const SettingsModal = ({ config, onSave, onClose }: { config: GoogleAuthConfig, onSave: (c: GoogleAuthConfig) => void, onClose: () => void }) => {
  const [localConfig, setLocalConfig] = useState(config);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Google Client ID</label>
            <Input value={localConfig.clientId} onChange={e => setLocalConfig({...localConfig, clientId: e.target.value})} placeholder="abc-123.apps.googleusercontent.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Google API Key</label>
            <Input value={localConfig.apiKey} onChange={e => setLocalConfig({...localConfig, apiKey: e.target.value})} placeholder="AIzaSy..." />
          </div>
          <div className="text-xs text-slate-500 bg-slate-100 p-3 rounded">
            To enable Google Sheets Sync, you must create a project in Google Cloud Console, enable Google Sheets API, and create OAuth 2.0 Client ID (Web) and an API Key.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(localConfig)}>Save Configuration</Button>
        </div>
      </div>
    </div>
  );
};

const CreateCampaign = ({ onSave, onCancel, existingCampaign }: { onSave: (c: Campaign) => void, onCancel: () => void, existingCampaign?: Campaign }) => {
  const [name, setName] = useState(existingCampaign?.name || '');
  const [fields, setFields] = useState<FieldDefinition[]>(existingCampaign?.fields || []);
  
  const addField = (type: FieldType) => {
    setFields([...fields, { id: crypto.randomUUID(), name: '', type, required: false }]);
  };

  const updateField = (id: string, updates: Partial<FieldDefinition>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) return alert('Please enter a campaign name');
    if (fields.some(f => !f.name.trim())) return alert('All fields must have a name');
    
    onSave({
      id: existingCampaign?.id || crypto.randomUUID(),
      name,
      description: '',
      fields,
      createdAt: existingCampaign?.createdAt || Date.now(),
      spreadsheetId: existingCampaign?.spreadsheetId
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onCancel}><ArrowLeft size={20} /></Button>
        <h1 className="text-2xl font-bold">{existingCampaign ? 'Edit Campaign' : 'New Campaign'}</h1>
      </div>

      <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Campaign Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Forest Survey 2024" autoFocus />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold">Data Fields</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => addField('text')} className="text-xs px-2"><Plus size={14} /> Text</Button>
            <Button variant="secondary" onClick={() => addField('number')} className="text-xs px-2"><Plus size={14} /> Num</Button>
            <Button variant="secondary" onClick={() => addField('image')} className="text-xs px-2"><Plus size={14} /> Img</Button>
            <Button variant="secondary" onClick={() => addField('location')} className="text-xs px-2"><Plus size={14} /> Point</Button>
            <Button variant="secondary" onClick={() => addField('polygon')} className="text-xs px-2"><Plus size={14} /> Poly</Button>
          </div>
        </div>

        {fields.length === 0 && (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
            Add fields to define your data collection schema
          </div>
        )}

        <div className="space-y-3">
          {fields.map((field, idx) => (
            <div key={field.id} className="flex gap-3 items-start bg-white p-4 rounded-lg shadow-sm border border-slate-200">
              <div className="mt-3 text-slate-400 font-mono text-xs w-6">{idx + 1}</div>
              <div className="flex-1 space-y-2">
                <Input 
                  value={field.name} 
                  onChange={e => updateField(field.id, { name: e.target.value })} 
                  placeholder="Field Name" 
                />
                <div className="flex gap-4 text-xs">
                  <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 uppercase font-bold">{field.type}</span>
                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} />
                    Required
                  </label>
                </div>
              </div>
              <Button variant="ghost" onClick={() => removeField(field.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                ×
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-6">
        <Button className="w-full py-3 text-lg" onClick={handleSave}>
          {existingCampaign ? 'Update Campaign' : 'Create Campaign'}
        </Button>
      </div>
    </div>
  );
};

// Map Component to show multiple points/polygons
const CampaignMap = ({ entries, fields }: { entries: Entry[], fields: FieldDefinition[] }) => {
  const center: [number, number] = entries.find(e => e.data['__loc_lat']) 
    ? [entries.find(e => e.data['__loc_lat'])!.data['__loc_lat'], entries.find(e => e.data['__loc_lat'])!.data['__loc_lng']] 
    : [0, 0];
  
  const hasData = entries.some(e => e.data['__loc_lat']);

  // Custom component to update view bounds
  const Recenter = ({ lat, lng }: { lat: number, lng: number }) => {
    const map = useMap();
    useEffect(() => {
      if (lat !== 0 && lng !== 0) {
        map.setView([lat, lng], 13);
      }
    }, [lat, lng]);
    return null;
  };

  if (!hasData) return <div className="p-10 text-center text-slate-500 bg-slate-100">No location data to display</div>;

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-slate-300 relative z-0">
      <MapContainer center={center} zoom={2} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={center[0]} lng={center[1]} />
        
        {entries.map(entry => {
           // Main Global Location
           const globalLat = entry.data['__loc_lat'];
           const globalLng = entry.data['__loc_lng'];
           const title = Object.entries(entry.data).find(([k]) => !k.startsWith('__loc'))?.[1]?.toString().substring(0, 50) || 'Entry';
           
           return (
             <React.Fragment key={entry.id}>
               {globalLat && (
                 <Marker position={[globalLat, globalLng]}>
                   <Popup>
                     <div className="font-bold">{title}</div>
                     <div className="text-xs">{new Date(entry.createdAt).toLocaleString()}</div>
                   </Popup>
                 </Marker>
               )}
               
               {/* Render Polygons if any */}
               {fields.filter(f => f.type === 'polygon').map(f => {
                 const polyData = entry.data[f.id];
                 if (polyData && Array.isArray(polyData) && polyData.length > 2) {
                    const positions = polyData.map((p: any) => [p.latitude, p.longitude] as [number, number]);
                    return <Polygon key={f.id} positions={positions} pathOptions={{ color: 'blue' }} />;
                 }
                 return null;
               })}
             </React.Fragment>
           );
        })}
      </MapContainer>
    </div>
  );
};

const CampaignView = ({ 
  campaign, 
  onBack, 
  authConfig,
  onEditCampaign,
  onDeleteCampaign
}: { 
  campaign: Campaign, 
  onBack: () => void,
  authConfig: GoogleAuthConfig,
  onEditCampaign: (c: Campaign) => void,
  onDeleteCampaign: (id: string) => void
}) => {
  const [view, setView] = useState<'list' | 'entry'>('list');
  const [showMap, setShowMap] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState<string | null>(null); // tracks field ID being located
  const [localCampaign, setLocalCampaign] = useState(campaign);

  useEffect(() => {
    loadEntries();
  }, [campaign.id]);

  const loadEntries = async () => {
    const data = await db.getEntries(campaign.id);
    setEntries(data);
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('Delete this entry?')) {
      await db.deleteEntry(id);
      loadEntries();
    }
  };

  const handleEditEntry = (entry: Entry) => {
    setFormData(entry.data);
    setEditingEntryId(entry.id);
    setView('entry');
  };

  const handleSync = async () => {
    if (!authConfig.clientId || !authConfig.apiKey) {
      alert("Please configure Google API Credentials in settings first.");
      return;
    }

    setSyncing(true);
    try {
      await GoogleService.initGoogleClient(authConfig.clientId, authConfig.apiKey);
      await GoogleService.signInAndGetToken();
      
      let spreadsheetId = localCampaign.spreadsheetId;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleService.createSpreadsheet(localCampaign.name);
        const updatedCampaign = { ...localCampaign, spreadsheetId };
        await db.saveCampaign(updatedCampaign);
        setLocalCampaign(updatedCampaign);
      }

      await GoogleService.ensureSheetStructure(spreadsheetId!, localCampaign);

      const unsynced = entries.filter(e => !e.synced);
      if (unsynced.length > 0) {
        await GoogleService.syncEntries(spreadsheetId!, localCampaign, unsynced);
        await db.markSynced(unsynced.map(e => e.id));
        await loadEntries();
      }
      alert('Sync successful!');
    } catch (error: any) {
      console.error(error);
      alert(`Sync failed: ${error.message || JSON.stringify(error)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveEntry = async () => {
    // Validate
    for (const f of campaign.fields) {
      if (f.required && !formData[f.id]) {
        alert(`${f.name} is required`);
        return;
      }
    }

    // Auto-determine main "entry location" for the Dashboard map
    // We look for the first 'location' field, or the first point of the first 'polygon' field
    let mainLoc: any = null;
    
    // Check specific location fields
    for (const f of campaign.fields) {
      if (f.type === 'location' && formData[f.id]) {
        mainLoc = formData[f.id];
        break;
      }
    }
    
    // Fallback to polygon start point
    if (!mainLoc) {
      for (const f of campaign.fields) {
        if (f.type === 'polygon' && formData[f.id] && formData[f.id].length > 0) {
          mainLoc = formData[f.id][0];
          break;
        }
      }
    }

    // Prepare global location data if found
    const locUpdates = mainLoc ? {
      '__loc_lat': mainLoc.latitude,
      '__loc_lng': mainLoc.longitude,
      '__loc_acc': mainLoc.accuracy || 0
    } : {};

    const newEntry: Entry = {
      id: editingEntryId || crypto.randomUUID(),
      campaignId: campaign.id,
      data: { ...formData, ...locUpdates },
      synced: false,
      createdAt: editingEntryId ? entries.find(e => e.id === editingEntryId)?.createdAt || Date.now() : Date.now(),
      updatedAt: Date.now()
    };

    await db.saveEntry(newEntry);
    await loadEntries();
    setFormData({});
    setEditingEntryId(null);
    setView('list');
  };

  const handleFileChange = (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [fieldId]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const capturePoint = (fieldId: string) => {
    setLoadingLoc(fieldId);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          [fieldId]: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          }
        }));
        setLoadingLoc(null);
      },
      (err) => {
        alert(err.message);
        setLoadingLoc(null);
      },
      { enableHighAccuracy: true }
    );
  };

  // Polygon Helper
  const addPolygonPoint = (fieldId: string) => {
    setLoadingLoc(fieldId);
    navigator.geolocation.getCurrentPosition(pos => {
      const current = formData[fieldId] || [];
      const newPoint = { 
        latitude: pos.coords.latitude, 
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp
      };
      setFormData(prev => ({ ...prev, [fieldId]: [...current, newPoint] }));
      setLoadingLoc(null);
    }, err => {
      alert(err.message);
      setLoadingLoc(null);
    }, { enableHighAccuracy: true });
  };

  const clearPolygon = (fieldId: string) => {
    if(confirm("Clear all points for this polygon?")) {
      setFormData(prev => ({ ...prev, [fieldId]: [] }));
    }
  };

  if (view === 'entry') {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => { setView('list'); setEditingEntryId(null); }}><ArrowLeft size={20} /></Button>
          <h1 className="text-xl font-bold">{editingEntryId ? 'Edit Entry' : 'New Entry'}</h1>
        </div>
        
        <div className="space-y-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs text-slate-400 font-mono text-right border-b pb-2">
             ID: {editingEntryId || 'New'}
          </div>

          {campaign.fields.map(field => (
            <div key={field.id} className="border-b border-slate-100 pb-8 last:border-0 last:pb-0">
              <label className="block text-base font-bold text-slate-800 mb-3">
                {field.name} {field.required && <span className="text-red-500">*</span>}
              </label>
              
              {field.type === 'text' && (
                <textarea 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                  rows={3}
                  value={formData[field.id] || ''}
                  onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                />
              )}
              
              {field.type === 'number' && (
                <Input 
                  type="number"
                  value={formData[field.id] || ''}
                  onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                />
              )}

              {field.type === 'datetime' && (
                <Input 
                  type="datetime-local"
                  value={formData[field.id] || ''}
                  onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                />
              )}

              {field.type === 'image' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
                      <Camera size={20} className="text-slate-600" />
                      <span className="text-sm font-medium text-slate-700">Take Photo / Upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                        onChange={(e) => handleFileChange(field.id, e)}
                      />
                    </label>
                    {formData[field.id] && (
                      <Button variant="ghost" onClick={() => setFormData({...formData, [field.id]: null})} className="text-red-500 text-xs">Clear</Button>
                    )}
                  </div>
                  {formData[field.id] && (
                    <div className="relative h-48 w-full rounded-lg overflow-hidden bg-black/5 border border-slate-200">
                      <img src={formData[field.id]} alt="Preview" className="h-full w-full object-contain" />
                    </div>
                  )}
                </div>
              )}

              {field.type === 'location' && (
                <div className="space-y-3">
                  {!formData[field.id] ? (
                    <Button 
                      variant="secondary" 
                      onClick={() => capturePoint(field.id)} 
                      disabled={loadingLoc === field.id}
                      className="w-full py-4 border-dashed"
                    >
                      {loadingLoc === field.id ? <Loader2 className="animate-spin" /> : <MapPin />}
                      Capture GPS Location
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                         <div>
                           <label className="text-[10px] uppercase font-bold text-slate-500">Latitude</label>
                           <Input 
                              type="number" step="any"
                              value={formData[field.id].latitude}
                              onChange={(e) => setFormData(prev => ({...prev, [field.id]: {...prev[field.id], latitude: parseFloat(e.target.value)}}))}
                           />
                         </div>
                         <div>
                           <label className="text-[10px] uppercase font-bold text-slate-500">Longitude</label>
                           <Input 
                              type="number" step="any"
                              value={formData[field.id].longitude}
                              onChange={(e) => setFormData(prev => ({...prev, [field.id]: {...prev[field.id], longitude: parseFloat(e.target.value)}}))}
                           />
                         </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500">
                         <span>Acc: {Math.round(formData[field.id].accuracy)}m</span>
                         <Button variant="ghost" onClick={() => capturePoint(field.id)} className="text-xs h-8 text-accent">
                            <RefreshCw size={12} className={loadingLoc === field.id ? 'animate-spin' : ''} /> Update GPS
                         </Button>
                      </div>
                      
                      {/* Mini Map for Point */}
                      <div className="h-64 rounded-lg overflow-hidden border border-slate-300 relative z-0">
                         <MapContainer center={[formData[field.id].latitude, formData[field.id].longitude]} zoom={16} style={{height: '100%', width: '100%'}}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <RecenterMap lat={formData[field.id].latitude} lng={formData[field.id].longitude} />
                            <DraggableMarker 
                              position={[formData[field.id].latitude, formData[field.id].longitude]}
                              onDragEnd={(lat, lng) => {
                                setFormData(prev => ({
                                  ...prev, 
                                  [field.id]: { ...prev[field.id], latitude: lat, longitude: lng }
                                }));
                              }}
                            />
                         </MapContainer>
                         <div className="absolute top-2 right-2 z-[400] bg-white/90 px-2 py-1 text-[10px] rounded shadow backdrop-blur">
                            Drag pin to adjust
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {field.type === 'polygon' && (
                <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex flex-wrap gap-2 mb-2">
                     <Button variant="primary" className="text-xs flex-1" onClick={() => addPolygonPoint(field.id)} disabled={loadingLoc === field.id}>
                        {loadingLoc === field.id ? <Loader2 className="animate-spin" size={14}/> : <Plus size={14} />} 
                        GPS Point
                     </Button>
                     {(formData[field.id] || []).length > 0 && (
                        <Button variant="danger" className="text-xs" onClick={() => clearPolygon(field.id)}>
                           <Trash2 size={14} /> Clear
                        </Button>
                     )}
                  </div>

                  {/* Polygon Map */}
                  <div className="h-72 rounded-lg overflow-hidden border border-slate-300 relative z-0">
                     <MapContainer 
                        center={(formData[field.id] && formData[field.id].length > 0) ? [formData[field.id][0].latitude, formData[field.id][0].longitude] : [0,0]} 
                        zoom={15} 
                        style={{height: '100%', width: '100%'}}
                     >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        
                        {/* Auto center if we have points */}
                        {(formData[field.id] && formData[field.id].length > 0) && (
                           <RecenterMap lat={formData[field.id][formData[field.id].length-1].latitude} lng={formData[field.id][formData[field.id].length-1].longitude} />
                        )}

                        <MapClickHandler onClick={(lat, lng) => {
                           const current = formData[field.id] || [];
                           setFormData(prev => ({ ...prev, [field.id]: [...current, { latitude: lat, longitude: lng, accuracy: 0, timestamp: Date.now() }] }));
                        }} />

                        {(formData[field.id] || []).length > 0 && (
                           <>
                              <Polygon positions={(formData[field.id] as any[]).map(p => [p.latitude, p.longitude])} pathOptions={{ color: 'blue' }} />
                              {(formData[field.id] as any[]).map((p, idx) => (
                                 <DraggableMarker 
                                    key={`${idx}-${p.latitude}-${p.longitude}`}
                                    position={[p.latitude, p.longitude]}
                                    onDragEnd={(lat, lng) => {
                                       const newPoints = [...(formData[field.id] as any[])];
                                       newPoints[idx] = { ...newPoints[idx], latitude: lat, longitude: lng };
                                       setFormData(prev => ({ ...prev, [field.id]: newPoints }));
                                    }}
                                 />
                              ))}
                           </>
                        )}
                     </MapContainer>
                     <div className="absolute top-2 right-2 z-[400] bg-white/90 px-2 py-1 text-[10px] rounded shadow backdrop-blur flex flex-col items-end">
                        <span>Tap map to add point</span>
                        <span>Drag points to move</span>
                     </div>
                  </div>
                  
                  {/* Coordinates List (Editable) */}
                  {(formData[field.id] || []).length > 0 && (
                    <div className="max-h-32 overflow-y-auto bg-white border border-slate-200 rounded text-xs p-2 space-y-2">
                       {(formData[field.id] as any[]).map((p, i) => (
                         <div key={i} className="flex gap-2 items-center">
                           <span className="w-8 text-slate-400">#{i+1}</span>
                           <input 
                              className="w-20 border rounded px-1"
                              type="number" step="any"
                              value={p.latitude}
                              onChange={(e) => {
                                 const newPoints = [...formData[field.id]];
                                 newPoints[i].latitude = parseFloat(e.target.value);
                                 setFormData(prev => ({ ...prev, [field.id]: newPoints }));
                              }}
                           />
                           <input 
                              className="w-20 border rounded px-1"
                              type="number" step="any"
                              value={p.longitude}
                              onChange={(e) => {
                                 const newPoints = [...formData[field.id]];
                                 newPoints[i].longitude = parseFloat(e.target.value);
                                 setFormData(prev => ({ ...prev, [field.id]: newPoints }));
                              }}
                           />
                           <button className="text-red-400 hover:text-red-600 ml-auto" onClick={() => {
                              const newPoints = [...formData[field.id]];
                              newPoints.splice(i, 1);
                              setFormData(prev => ({ ...prev, [field.id]: newPoints }));
                           }}><Trash2 size={12} /></button>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-4 max-w-2xl mx-auto z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <Button variant="secondary" className="flex-1" onClick={() => { setView('list'); setEditingEntryId(null); }}>Cancel</Button>
          <Button className="flex-1" onClick={handleSaveEntry}>
            <Save size={18} /> Save Entry
          </Button>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={onBack}><ArrowLeft size={20} /></Button>
              <div>
                <h1 className="text-xl font-bold leading-tight">{localCampaign.name}</h1>
                <div className="text-xs text-slate-500">{entries.length} entries • {entries.filter(e => !e.synced).length} unsynced</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onEditCampaign(campaign)}><Edit2 size={18} /></Button>
              <Button variant="ghost" className="text-red-500" onClick={() => onDeleteCampaign(campaign.id)}><Trash2 size={18} /></Button>
            </div>
          </div>
          
          <div className="flex gap-2 mt-2">
            <Button variant="secondary" onClick={() => setShowMap(!showMap)} className="flex-1 sm:flex-none">
              <MapIcon size={18}/> {showMap ? 'Hide Map' : 'Show Map'}
            </Button>
            <Button variant="secondary" onClick={handleSync} disabled={syncing} className="flex-1 sm:flex-none">
              {syncing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
              <span className="hidden sm:inline">Sync Sheets</span>
              <span className="sm:hidden">Sync</span>
            </Button>
          </div>
        </div>
      </div>
      
      {showMap && (
        <div className="bg-slate-100 border-b border-slate-300 p-2">
          <div className="max-w-4xl mx-auto">
             <CampaignMap entries={entries} fields={campaign.fields} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-slate-50 p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Database size={48} className="mx-auto mb-4 opacity-50" />
              <p>No data collected yet.</p>
            </div>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex justify-between items-start">
                <div className="space-y-1 flex-1 cursor-pointer" onClick={() => handleEditEntry(entry)}>
                  <div className="font-mono text-xs text-slate-400">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                  <div className="font-medium text-slate-800 line-clamp-1">
                    {/* Try to find a meaningful title field */}
                    {Object.entries(entry.data).find(([k]) => !k.startsWith('__loc'))?.[1]?.toString().substring(0, 50) || 'Untitled Entry'}
                  </div>
                  {entry.data['__loc_lat'] && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={10} /> {entry.data['__loc_lat'].toFixed(4)}, {entry.data['__loc_lng'].toFixed(4)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 pl-2">
                  {entry.synced ? (
                    <span className="text-emerald-500 flex items-center gap-1 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle size={12} /> Synced
                    </span>
                  ) : (
                    <span className="text-amber-500 flex items-center gap-1 text-xs font-medium bg-amber-50 px-2 py-1 rounded-full">
                      <Cloud size={12} /> Local
                    </span>
                  )}
                   <div className="flex gap-1">
                      <button className="p-2 text-slate-400 hover:text-blue-500" onClick={() => handleEditEntry(entry)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id); }}>
                        <Trash2 size={16} />
                      </button>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="absolute bottom-6 right-6">
        <button 
          onClick={() => { setFormData({}); setEditingEntryId(null); setView('entry'); }}
          className="bg-accent hover:bg-blue-600 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105"
        >
          <Plus size={28} />
        </button>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [screen, setScreen] = useState<'home' | 'create' | 'campaign'>('home');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [authConfig, setAuthConfig] = useState<GoogleAuthConfig>(() => {
    const saved = localStorage.getItem('dc_auth_config');
    return saved ? JSON.parse(saved) : { clientId: '', apiKey: '' };
  });

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    const data = await db.getCampaigns();
    setCampaigns(data.sort((a, b) => b.createdAt - a.createdAt));
  };

  const handleSaveCampaign = async (campaign: Campaign) => {
    await db.saveCampaign(campaign);
    await loadCampaigns();
    setScreen('home');
    setEditingCampaign(undefined);
  };

  const handleDeleteCampaign = async (id: string) => {
    if(confirm("Are you sure? This will delete the campaign and ALL locally collected data. This cannot be undone.")) {
      await db.deleteCampaign(id);
      setScreen('home');
      setSelectedCampaign(null);
      await loadCampaigns();
    }
  };

  const handleEditCampaignRequest = (c: Campaign) => {
    setEditingCampaign(c);
    setScreen('create');
  };

  const saveAuthConfig = (config: GoogleAuthConfig) => {
    setAuthConfig(config);
    localStorage.setItem('dc_auth_config', JSON.stringify(config));
    setShowSettings(false);
  };

  const openCampaign = (c: Campaign) => {
    setSelectedCampaign(c);
    setScreen('campaign');
  };

  if (screen === 'campaign' && selectedCampaign) {
    return (
      <CampaignView 
        campaign={selectedCampaign} 
        onBack={() => setScreen('home')} 
        authConfig={authConfig}
        onEditCampaign={handleEditCampaignRequest}
        onDeleteCampaign={handleDeleteCampaign}
      />
    );
  }

  if (screen === 'create') {
    return (
      <CreateCampaign 
        onSave={handleSaveCampaign} 
        onCancel={() => { setScreen('home'); setEditingCampaign(undefined); }} 
        existingCampaign={editingCampaign}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-bold">DC</div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Data Capture</h1>
          </div>
          <Button variant="ghost" onClick={() => setShowSettings(true)}>
            <Settings size={20} />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Auth Warning */}
        {(!authConfig.clientId || !authConfig.apiKey) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
            <div className="text-sm text-amber-900">
              <span className="font-bold">Google Sheets Sync is disabled.</span> To enable cloud sync, configure your API keys in Settings.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Create New Card */}
          <button 
            onClick={() => { setEditingCampaign(undefined); setScreen('create'); }}
            className="group flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-slate-300 hover:border-accent hover:bg-blue-50 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 text-accent flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <span className="font-medium text-slate-600 group-hover:text-accent">New Campaign</span>
          </button>

          {/* Campaign Cards */}
          {campaigns.map(c => (
            <div 
              key={c.id} 
              onClick={() => openCampaign(c)}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between h-48 relative group"
            >
              <div>
                <h3 className="font-bold text-lg text-slate-800 mb-1 line-clamp-1">{c.name}</h3>
                <p className="text-xs text-slate-500 mb-4">Created {new Date(c.createdAt).toLocaleDateString()}</p>
                <div className="flex gap-2 flex-wrap">
                  {c.fields.slice(0, 3).map(f => (
                    <span key={f.id} className="text-[10px] uppercase font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">
                      {f.type}
                    </span>
                  ))}
                  {c.fields.length > 3 && <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">+{c.fields.length - 3}</span>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1 text-slate-500 text-xs">
                  <Database size={12} /> Local
                </div>
                {c.spreadsheetId && (
                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                    <FileSpreadsheet size={12} /> Linked
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showSettings && (
        <SettingsModal 
          config={authConfig} 
          onSave={saveAuthConfig} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
};

export default App;