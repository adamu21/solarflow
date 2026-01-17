import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Kanban, 
  Settings, 
  Plus, 
  Bot, 
  Mail, 
  ExternalLink,
  ChevronRight,
  Sun,
  X,
  Download,
  CheckCircle,
  Monitor,
  Smartphone,
  RefreshCw,
  Share,
  PlusSquare,
  Laptop
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Pipeline } from './components/Pipeline';
import { LeadCard } from './components/LeadCard';
import { INITIAL_LEADS, EMAIL_TEMPLATES } from './constants';
import { Lead, LeadStatus, LeadSource } from './types';
import { analyzeLeadSpam, draftResponseEmail } from './services/geminiService';

// --- Helper Components for App Layout ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
      active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

// --- Utility: Clean HTML from Email Body ---
const cleanHtmlContent = (html: string) => {
  if (!html) return '';
  try {
      // 1. Replace common block tags with newlines to preserve structure before stripping
      const formatted = html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<li\s*\/?>/gi, '\n• ');
          
      // 2. Use browser DOM parser to strip tags and decode entities
      const doc = new DOMParser().parseFromString(formatted, 'text/html');
      let text = doc.body.textContent || '';
      
      // 3. Heavy Cleaning of Email "Gibberish"
      
      // Remove bracketed URLs/IDs common in automated signatures: [https://...], [cid:...]
      text = text.replace(/\[(https?|cid|tel|mailto):[^\]]*\]/gi, '');
      
      // Remove unbracketed long URLs
      text = text.replace(/https?:\/\/[^\s]+/gi, '');

      // Remove specific noise phrases/words found in email signatures
      const noisePhrases = [
        'App Banner Image', '__tpx__', 
        'icon', 'photo', 'facebook', 'instagram', 'linkedin', 'twitter', 'snapchat'
      ];
      
      noisePhrases.forEach(phrase => {
         // Create regex to match phrase case-insensitively
         text = text.replace(new RegExp(phrase, 'gi'), '');
      });

      // Remove long divider lines (------)
      text = text.replace(/[-_]{4,}/g, '');

      // 4. Formatting: Collapse multiple newlines and trim each line
      return text
          .split('\n')
          .map(line => line.trim())
          // Filter out empty lines or single characters (often left over from icon labels like "S", "L", "I")
          .filter(line => line.length > 1) 
          .join('\n')
          .replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  } catch (e) {
      console.warn("HTML cleaning failed, returning raw", e);
      return html;
  }
};

const App = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'pipeline' | 'settings'>('dashboard');
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<string>('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // Handle PWA Install Prompt & Environment Checks
  useEffect(() => {
    // Install Prompt Listener
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Environment Checks
    const checkStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    };
    const installed = checkStandalone();
    setIsStandalone(installed);
    
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);
    
    // Show iOS prompt only if iOS, not installed, and hasn't been dismissed this session (simple logic for now)
    if (ios && !installed) {
        setShowIOSPrompt(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleLeadUpdate = (updatedLead: Lead) => {
    setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
    setSelectedLead(updatedLead);
  };

  // Move lead to a new status (Used by Pipeline Drag&Drop)
  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return { ...l, status: newStatus };
      }
      return l;
    }));
  };

  // Verify lead (Used in Inbox)
  const handleVerifyLead = (lead: Lead) => {
    setLeads(prev => prev.map(l => {
        if (l.id === lead.id) {
            return {
                ...l,
                status: LeadStatus.QUALIFIED,
                aiSpamScore: 0, // Manually set to 0 to trigger green checkmark
                aiReasoning: 'Manually verified by user'
            };
        }
        return l;
    }));
  };

  // Switch to Pipeline View
  const handleViewInPipeline = () => {
      setActiveTab('pipeline');
  };

  // --- THE NEW SYNC FUNCTION CONNECTED TO YOUR GOOGLE SHEET ---
  const handleSyncEmails = async () => {
    setIsSyncing(true);

    // YOUR CONNECTED SHEET ID
    const SHEET_ID = '14EK200uGxLKI3Poaer90-2QdCPVyNmHEizFj_iy3grw'; 
    const TAB_NAME = 'Sheet1'; 

    try {
      // Fetch data from the Google Sheet via the public opensheet API
      const response = await fetch(`https://opensheet.elk.sh/${SHEET_ID}/${TAB_NAME}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch from Google Sheet. Check permissions.');
      }

      const data = await response.json();

      // Transform Google Sheet rows into App Lead format
      const newLeadsFromSheet = data.map((row: any) => {
        // Simple helper to guess name if missing
        const guessName = (emailStr: string) => {
             if (!emailStr) return 'Unknown Lead';
             const part = emailStr.split('@')[0];
             return part.charAt(0).toUpperCase() + part.slice(1);
        };

        const rawBody = row['Body Content'] || row['Subject'] || '';
        const cleanedBody = cleanHtmlContent(rawBody);

        return {
          id: row['ID'] || `sheet_${Math.random().toString(36).substr(2, 9)}`,
          name: guessName(row['From Email']),
          email: row['From Email'],
          // We set address to 'Pending' so you know to run AI on it later
          address: 'Pending AI Scan', 
          phone: '',
          status: LeadStatus.NEW,
          source: LeadSource.WEBSITE, // Default source for email imports
          date: row['Date'],
          messageBody: cleanedBody
        };
      });

      // Filter out duplicates (leads we already have)
      const trulyNewLeads = newLeadsFromSheet.filter((newLead: Lead) => 
        !leads.some(existing => existing.id === newLead.id)
      );

      if (trulyNewLeads.length > 0) {
        setLeads(prev => [...trulyNewLeads, ...prev]);
        alert(`Success! Synced ${trulyNewLeads.length} new emails from Outlook.`);
      } else {
        alert("Sync complete. No new unique emails found in the sheet.");
      }

    } catch (error) {
      console.error("Sync Error:", error);
      alert("Failed to sync. Make sure your Google Sheet is set to 'Public to Anyone with link'.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendEmail = () => {
    if (!selectedLead || !generatedEmail) return;

    const subject = selectedLead.source === LeadSource.TESLA 
        ? 'Your Tesla Solar Inquiry - Rocky Mountain Solar'
        : 'Solar Quote Request - Rocky Mountain Solar';

    const body = generatedEmail;

    // Create mailto link
    const mailtoLink = `mailto:${selectedLead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open default mail client
    window.location.href = mailtoLink;

    // Update status locally
    handleLeadUpdate({...selectedLead, status: LeadStatus.CONTACTED});
    setGeneratedEmail('');
  };

  const runSpamCheck = async (lead: Lead) => {
    setLoadingAI(true);
    // Service handles missing key gracefully by returning default spam score or error
    const result = await analyzeLeadSpam(lead);
    setLoadingAI(false);
    
    const updated = { 
      ...lead, 
      aiSpamScore: result.score, 
      aiReasoning: result.reason,
      status: result.score > 80 ? LeadStatus.SPAM : lead.status,
      // If AI found an address in the body, update it!
      address: lead.address === 'Pending AI Scan' ? 'Address Not Found' : lead.address 
    };
    handleLeadUpdate(updated);
  };

  const generateEmailDraft = async (lead: Lead) => {
    setLoadingAI(true);
    const tpl = lead.source === LeadSource.TESLA 
      ? EMAIL_TEMPLATES.find(t => t.id === 'tesla-intro') 
      : EMAIL_TEMPLATES.find(t => t.id === 'standard-intro');
    
    if (tpl) {
      // Service will fallback to template with regex replacement if AI fails or key is missing
      const draft = await draftResponseEmail(lead, tpl.body);
      setGeneratedEmail(draft);
    }
    setLoadingAI(false);
  };

  const handleCreateAuroraProject = (lead: Lead) => {
      // SAFEGUARD: No POST request is made here.
      // This is purely a simulation as requested.
      alert(`[SIMULATION] Creating project in Aurora for ${lead.address}...\n\nNote: No API charges were incurred. This is a mock action.`);
      setTimeout(() => {
          handleLeadUpdate({
              ...lead,
              status: LeadStatus.AURORA_DESIGN,
              auroraProjectId: `aurora_${Math.floor(Math.random() * 10000)}`
          });
      }, 1000);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10 hidden md:flex">
        <div className="p-6 border-b border-gray-100 flex items-center space-x-2">
          <div className="bg-brand-500 p-2 rounded-lg">
             <Sun className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">SolarFlow</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Users} label="Inbox & Leads" active={activeTab === 'leads'} onClick={() => setActiveTab('leads')} />
          <SidebarItem icon={Kanban} label="Pipeline" active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')} />
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <SidebarItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 flex-1 overflow-y-auto h-full flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-8 py-4 flex justify-between items-center shadow-sm">
           <h2 className="text-xl font-semibold text-gray-800 capitalize flex items-center">
             {/* Mobile Menu Trigger (Visual only for now, can be functional if needed) */}
             <div className="md:hidden mr-4 bg-brand-500 p-1.5 rounded text-white"><Sun size={20}/></div>
             {activeTab}
           </h2>
           <div className="flex items-center space-x-3">
             {installPrompt && (
                <button 
                  onClick={handleInstallClick}
                  className="hidden md:flex bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 px-4 py-2 rounded-lg items-center shadow-sm transition-all animate-pulse"
                >
                  <Download size={18} className="mr-2" /> Install to Desktop
                </button>
             )}
             <button className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-all">
               <Plus size={18} className="mr-2" /> New Lead
             </button>
           </div>
        </header>

        <div className="p-8 pb-24">
          {activeTab === 'dashboard' && <Dashboard leads={leads} />}
          
          {activeTab === 'pipeline' && (
             <Pipeline 
                leads={leads} 
                onLeadClick={setSelectedLead} 
                onStatusChange={handleStatusChange} 
             />
          )}

          {activeTab === 'leads' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <h3 className="font-medium text-gray-700">Incoming Requests</h3>
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">{leads.filter(l => l.status === LeadStatus.NEW).length} Pending</span>
                    </div>
                    <button 
                        onClick={handleSyncEmails}
                        disabled={isSyncing}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            isSyncing 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <RefreshCw size={14} className={`mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Emails'}
                    </button>
                </div>
                {/* Info banner about email source */}
                <div className="bg-brand-50 px-4 py-2 text-xs text-brand-700 border-b border-brand-100 flex items-center">
                    <Mail size={12} className="mr-2" />
                    Connected to: lwrtemp@lynnwoodroofing.ca (via Power Automate)
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {leads.map(lead => (
                    <LeadCard 
                        key={lead.id} 
                        lead={lead} 
                        onClick={setSelectedLead}
                        onVerify={handleVerifyLead}
                        onViewPipeline={handleViewInPipeline}
                    />
                  ))}
                </div>
            </div>
          )}

          {activeTab === 'settings' && (
             <div className="space-y-6">
                 {/* API Key Configuration removed per request */}

                 <div className="max-w-md bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Download size={20} className="mr-2" />
                        Download / Install App
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        You can install SolarFlow as a standalone app. It will create a desktop icon and open in its own window, just like a .exe file.
                    </p>
                    
                    <div className="space-y-3 text-sm">
                        {installPrompt && (
                          <div className="mb-4">
                             <button
                                onClick={handleInstallClick}
                                className="w-full flex justify-center items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-white bg-brand-600 hover:bg-brand-700"
                              >
                                <Laptop size={20} />
                                <span className="font-medium">Click to Install to Desktop</span>
                              </button>
                          </div>
                        )}
                        <div className="p-3 bg-gray-50 rounded border border-gray-100 flex items-start space-x-3">
                             <Monitor className="text-gray-400 mt-1" size={16} />
                             <div>
                                <span className="font-semibold block text-gray-800">Desktop (Windows/Mac)</span>
                                <span className="text-gray-600">
                                   Click the <b>Install to Desktop</b> button above (or the <Download size={12} className="inline"/> icon in your browser bar). 
                                   This creates a desktop shortcut that launches the app instantly without opening a browser tab.
                                </span>
                             </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded border border-gray-100 flex items-start space-x-3">
                             <Smartphone className="text-gray-400 mt-1" size={16} />
                             <div>
                                <span className="font-semibold block text-gray-800">iOS / Android</span>
                                <span className="text-gray-600">Tap <strong>Share</strong> (iOS) or <strong>Menu</strong> (Android) and select <strong>"Add to Home Screen"</strong>.</span>
                             </div>
                        </div>
                    </div>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* iOS Installation Banner */}
      {showIOSPrompt && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom duration-500">
            <div className="max-w-xl mx-auto flex justify-between items-start">
                <div className="flex-1 mr-4">
                    <p className="font-semibold text-gray-900 mb-1">Install SolarFlow App</p>
                    <p className="text-sm text-gray-600">
                        Tap <Share size={16} className="inline mx-1 align-text-bottom"/> then "Add to Home Screen" <PlusSquare size={16} className="inline mx-1 align-text-bottom"/> for the best experience.
                    </p>
                </div>
                <button onClick={() => setShowIOSPrompt(false)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X size={24} />
                </button>
            </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-start bg-gray-50">
               <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedLead.name}</h2>
                  <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
                     <span className="bg-white border px-2 py-0.5 rounded text-gray-500">{selectedLead.source}</span>
                     <span>•</span>
                     <span>{selectedLead.email}</span>
                  </div>
               </div>
               <div className="flex items-center space-x-2">
                 {/* Link to Pipeline from Modal */}
                 <button 
                    onClick={handleViewInPipeline}
                    className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
                    title="Open in Pipeline View"
                 >
                    <Kanban size={20} />
                 </button>
                 <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600 p-2">
                   <X size={24} />
                 </button>
               </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
               
               {/* Status Bar */}
               <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <span className="text-xs font-uppercase text-gray-500 tracking-wider">Current Status</span>
                    <p className="font-semibold text-brand-700">{selectedLead.status}</p>
                  </div>
                  {/* Quick Actions based on status */}
                  {selectedLead.status === LeadStatus.NEW && (
                     <div className="flex space-x-2">
                        <button 
                          onClick={() => runSpamCheck(selectedLead)}
                          disabled={loadingAI}
                          className="flex items-center px-3 py-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 text-sm font-medium"
                        >
                           <Bot size={16} className="mr-2" />
                           {loadingAI ? 'Analyzing...' : 'AI Spam Check'}
                        </button>
                     </div>
                  )}
                  {selectedLead.status === LeadStatus.AURORA_DESIGN && (
                    <button className="flex items-center px-3 py-2 bg-yellow-50 text-yellow-700 rounded-md hover:bg-yellow-100 text-sm font-medium">
                       <ExternalLink size={16} className="mr-2" />
                       Open Aurora
                    </button>
                  )}
               </div>

               {/* AI Analysis Result */}
               {selectedLead.aiReasoning && (
                 <div className={`p-4 rounded-lg border ${selectedLead.aiSpamScore && selectedLead.aiSpamScore > 50 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <h4 className="font-semibold text-sm mb-1 flex items-center">
                        <Bot size={16} className="mr-2" />
                        AI Analysis ({selectedLead.aiSpamScore}/100 Risk)
                    </h4>
                    <p className="text-sm text-gray-700">{selectedLead.aiReasoning}</p>
                 </div>
               )}

               {/* Content */}
               <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 border-b pb-2">Request Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                     <div>
                        <label className="text-gray-500 block">Address</label>
                        <p className="text-gray-800">{selectedLead.address}</p>
                     </div>
                     <div>
                        <label className="text-gray-500 block">Phone</label>
                        <p className="text-gray-800">{selectedLead.phone || 'N/A'}</p>
                     </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 italic">
                     "{selectedLead.messageBody}"
                  </div>
               </div>

               {/* Action: Send Email */}
               <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 border-b pb-2 flex justify-between items-center">
                    <span>Communication</span>
                    <button 
                        onClick={() => generateEmailDraft(selectedLead)}
                        className="text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded hover:bg-brand-200"
                    >
                        {loadingAI ? 'Drafting...' : 'Auto-Draft Email'}
                    </button>
                  </h3>
                  
                  {generatedEmail ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                          <div className="bg-brand-50 px-4 py-2 text-xs font-medium text-brand-800 border-b border-brand-100 flex items-center">
                              <Bot size={14} className="mr-2 text-brand-600" />
                              AI Draft Preview
                          </div>
                          <textarea 
                             className="w-full p-4 text-sm text-gray-800 h-48 focus:outline-none bg-white placeholder-gray-400 resize-none"
                             value={generatedEmail}
                             onChange={(e) => setGeneratedEmail(e.target.value)}
                             placeholder="Edit your email draft here..."
                          />
                          <div className="bg-gray-50 p-3 flex justify-end space-x-3 border-t border-gray-100">
                              <button 
                                onClick={() => setGeneratedEmail('')} 
                                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                              >
                                Discard
                              </button>
                              <button 
                                onClick={handleSendEmail}
                                className="px-4 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-md hover:bg-brand-700 shadow-sm transition-colors flex items-center"
                              >
                                  <Mail size={14} className="mr-2" />
                                  Send via Outlook
                              </button>
                          </div>
                      </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded border border-dashed text-gray-400 text-sm">
                        No email draft started.
                    </div>
                  )}
               </div>
               
               {/* Action: Aurora */}
               <div className="space-y-4 pb-12">
                   <h3 className="font-semibold text-gray-900 border-b pb-2">Technical Design</h3>
                   <div className="flex items-center justify-between bg-white border p-4 rounded-lg">
                       <div>
                           <p className="font-medium">Aurora Solar Project</p>
                           <p className="text-xs text-gray-500">
                               {selectedLead.auroraProjectId ? `ID: ${selectedLead.auroraProjectId}` : 'Not created yet'}
                           </p>
                       </div>
                       {!selectedLead.auroraProjectId ? (
                           <button 
                            onClick={() => handleCreateAuroraProject(selectedLead)}
                            className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
                           >
                               Create Project
                           </button>
                       ) : (
                           <span className="text-green-600 text-sm font-medium flex items-center">
                               <CheckCircle size={16} className="mr-1" /> Active
                           </span>
                       )}
                   </div>
               </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;