import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Settings, Database, Cloud, AlertTriangle, 
  MapPin, Camera, Save, ArrowLeft, RefreshCw,
  FileSpreadsheet, Download, CheckCircle, Loader2
} from 'lucide-react';
import { Campaign, FieldDefinition, FieldType, Entry, GoogleAuthConfig } from './types';
import { db } from './db';
import * as GoogleService from './services/googleService';

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

const CreateCampaign = ({ onSave, onCancel }: { onSave: (c: Campaign) => void, onCancel: () => void }) => {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  
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
      id: crypto.randomUUID(),
      name,
      description: '',
      fields,
      createdAt: Date.now()
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onCancel}><ArrowLeft size={20} /></Button>
        <h1 className="text-2xl font-bold">New Campaign</h1>
      </div>

      <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Campaign Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Forest Survey 2024" autoFocus />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Data Fields</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => addField('text')} className="text-xs"><Plus size={14} /> Text</Button>
            <Button variant="secondary" onClick={() => addField('number')} className="text-xs"><Plus size={14} /> Num</Button>
            <Button variant="secondary" onClick={() => addField('image')} className="text-xs"><Plus size={14} /> Img</Button>
            <Button variant="secondary" onClick={() => addField('location')} className="text-xs"><Plus size={14} /> Loc</Button>
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
        <Button className="w-full py-3 text-lg" onClick={handleSave}>Create Campaign</Button>
      </div>
    </div>
  );
};

const CampaignView = ({ 
  campaign, 
  onBack, 
  authConfig 
}: { 
  campaign: Campaign, 
  onBack: () => void,
  authConfig: GoogleAuthConfig
}) => {
  const [view, setView] = useState<'list' | 'entry'>('list');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [syncing, setSyncing] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [localCampaign, setLocalCampaign] = useState(campaign);

  // Load entries on mount
  useEffect(() => {
    loadEntries();
  }, [campaign.id]);

  const loadEntries = async () => {
    const data = await db.getEntries(campaign.id);
    setEntries(data);
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

    // Auto capture location metadata if not explicitly in fields but available
    // (Here we just assume explicit fields or hidden meta fields, let's add hidden meta)
    
    // Save
    const newEntry: Entry = {
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      data: formData,
      synced: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.saveEntry(newEntry);
    await loadEntries();
    setFormData({});
    setView('list');
  };

  const captureLocation = () => {
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          '__loc_lat': pos.coords.latitude,
          '__loc_lng': pos.coords.longitude,
          '__loc_acc': pos.coords.accuracy,
        }));
        setLocationLoading(false);
      },
      (err) => {
        alert('Could not get location: ' + err.message);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleFileChange = (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Resize image logic could go here to save space
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [fieldId]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (view === 'entry') {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => setView('list')}><ArrowLeft size={20} /></Button>
          <h1 className="text-xl font-bold">New Entry</h1>
        </div>
        
        <div className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          {/* Global Location Capture for every entry */}
          <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
            <div className="text-sm text-blue-800">
              <div className="font-bold mb-1">GPS Coordinates</div>
              {formData['__loc_lat'] ? (
                <span>{formData['__loc_lat'].toFixed(6)}, {formData['__loc_lng'].toFixed(6)} (±{Math.round(formData['__loc_acc'])}m)</span>
              ) : (
                <span>Not captured</span>
              )}
            </div>
            <Button variant="secondary" onClick={captureLocation} disabled={locationLoading} className="text-xs">
              {locationLoading ? <Loader2 className="animate-spin" size={16}/> : <MapPin size={16}/>}
              {formData['__loc_lat'] ? 'Update' : 'Capture'}
            </Button>
          </div>

          {campaign.fields.map(field => (
            <div key={field.id}>
              <label className="block text-sm font-bold text-slate-700 mb-2">
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
                <div className="text-xs text-slate-500 italic">
                  Note: Use the main GPS capture above. This field type is for explicit coordinate entry if needed manually.
                  <Input 
                    placeholder="-33.86, 151.20"
                    value={formData[field.id] ? `${formData[field.id].latitude},${formData[field.id].longitude}` : ''} 
                    onChange={e => {
                      const [lat, lng] = e.target.value.split(',').map(s => parseFloat(s.trim()));
                      if (!isNaN(lat) && !isNaN(lng)) {
                         setFormData({...formData, [field.id]: { latitude: lat, longitude: lng }});
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-4 max-w-2xl mx-auto">
          <Button variant="secondary" className="flex-1" onClick={() => setView('list')}>Cancel</Button>
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
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack}><ArrowLeft size={20} /></Button>
            <div>
              <h1 className="text-xl font-bold leading-tight">{localCampaign.name}</h1>
              <div className="text-xs text-slate-500">{entries.length} entries • {entries.filter(e => !e.synced).length} unsynced</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
              <span className="hidden sm:inline">Sync</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Database size={48} className="mx-auto mb-4 opacity-50" />
              <p>No data collected yet.</p>
            </div>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
                <div className="space-y-1">
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
                <div>
                  {entry.synced ? (
                    <span className="text-emerald-500 flex items-center gap-1 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle size={12} /> Synced
                    </span>
                  ) : (
                    <span className="text-amber-500 flex items-center gap-1 text-xs font-medium bg-amber-50 px-2 py-1 rounded-full">
                      <Cloud size={12} /> Local
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="absolute bottom-6 right-6">
        <button 
          onClick={() => setView('entry')}
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

  const handleCreateCampaign = async (campaign: Campaign) => {
    await db.saveCampaign(campaign);
    await loadCampaigns();
    setScreen('home');
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
      />
    );
  }

  if (screen === 'create') {
    return <CreateCampaign onSave={handleCreateCampaign} onCancel={() => setScreen('home')} />;
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
            onClick={() => setScreen('create')}
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
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between h-48"
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
