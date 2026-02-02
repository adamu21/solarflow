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
  Laptop,
  FolderOpen,
  FilePlus,
  FileText,
  Image as ImageIcon,
  Archive
} from 'lucide-react';
import { Dashboard } from '../src/components/Dashboard';
import { Pipeline } from '../src/components/Pipeline';
import { LeadCard } from '../src/components/LeadCard';
import { INITIAL_LEADS, EMAIL_TEMPLATES } from './constants';
import { Lead, LeadStatus, LeadSource, AuroraProject } from '../src/types';
import { analyzeLeadSpam, draftResponseEmail } from '../src/services/geminiService';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'pipeline' | 'projects' | 'settings'>('dashboard');
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<string>('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // Aurora Projects State
  const [auroraProjects, setAuroraProjects] = useState<AuroraProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string>('');
  const [proposalModalOpen, setProposalModalOpen] = useState<AuroraProject | null>(null);

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

  // --- AURORA SOLAR API INTEGRATION (VIA PROXY) ---
  const fetchAuroraProjects = async () => {
    setLoadingProjects(true);
    setProjectsError('');
    
    // We now point to our own backend route
    // On Vercel, this automatically routes to the file we made in Step 1
    const url = "/api/aurora";

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        // Aurora usually wraps projects in a "projects" array, check your specific API response
        setAuroraProjects(data.projects || data || []);
        
    } catch (error: any) {
        console.warn("Aurora API not accessible (likely local dev or missing env vars). Using Mock Data.");
        
        // Fallback for demo purposes
        setAuroraProjects([
            { id: '643d0db7-6137-4fc6-86f1-eb23bf16cd9c', name: 'John Smith Residence', property_address: '123 Maple Drive, Calgary', created_at: '2023-10-15T10:00:00Z', status: 'Design' },
            { id: '743d0db7-6137-4fc6-86f1-eb23bf16cd9d', name: 'Enmax - Beta Site', property_address: '88 Test Street, Calgary', created_at: '2023-10-18T14:30:00Z', status: 'Proposed' }
        ]);

        // Only set error if it is NOT a 404. 404 is expected on localhost without Vercel/Netlify functions running.
        if (error.message && error.message.includes("404")) {
           setProjectsError(""); // Clear error, treat as silent fallback
        } else {
           setProjectsError("Using offline demo data.");
        }
    } finally {
        setLoadingProjects(false);
    }
  };

  // Initial fetch when tab opens
  useEffect(() => {
      if (activeTab === 'projects' && auroraProjects.length === 0) {
          fetchAuroraProjects();
      }
  }, [activeTab]);

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

  // Directly opens the proposal modal for the selected lead
  const handleOpenProposalModal = (lead: Lead) => {
       setProposalModalOpen({
           id: lead.id, // Use Lead ID for proposal tracking
           name: lead.name,
           property_address: lead.address,
           created_at: new Date().toISOString(),
           status: 'Design'
       });
  };

  // --- Proposal Generator ---
  const handleDownloadProposal = (project: AuroraProject) => {
      // Professional Solar Proposal Template
      const template = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solar Proposal - ${project.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              brand: { 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 900: '#14532d' }
            }
          }
        }
      }
    </script>
</head>
<body class="bg-gray-100 font-sans text-slate-800 print:bg-white">
    <div class="max-w-4xl mx-auto bg-white shadow-xl my-8 print:shadow-none print:my-0">
        <!-- Header -->
        <div class="bg-brand-900 text-white p-12 flex justify-between items-end print:p-8">
            <div>
                <div class="flex items-center space-x-2 mb-4">
                    <svg class="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    <span class="text-2xl font-bold tracking-tight">Rocky Mountain Solar</span>
                </div>
                <h1 class="text-4xl font-bold">Solar Energy Proposal</h1>
                <p class="mt-2 text-brand-100">Customized Energy Solution</p>
            </div>
            <div class="text-right text-brand-100">
                <p>Date: ${new Date().toLocaleDateString()}</p>
                <p>Valid Until: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
            </div>
        </div>

        <!-- Customer Info -->
        <div class="p-12 border-b border-gray-100 print:p-8">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-1">Prepared For</h3>
                    <h2 class="text-2xl font-bold text-gray-900">${project.name}</h2>
                    <p class="text-gray-600 mt-1">${project.property_address}</p>
                </div>
                <div class="text-right">
                    <h3 class="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-1">System Details</h3>
                    <p class="text-gray-900"><strong>System Size:</strong> 12.4 kW</p>
                    <p class="text-gray-900"><strong>Annual Production:</strong> 14,200 kWh</p>
                    <p class="text-gray-900"><strong>Offset:</strong> 103%</p>
                </div>
            </div>
        </div>

        <!-- System Visual -->
        <div class="p-12 bg-gray-50 border-b border-gray-100 print:p-8">
            <h3 class="text-xl font-bold text-gray-900 mb-6">Your System Design</h3>
            <div class="aspect-video bg-white rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden">
                 <!-- Mockup of satellite view -->
                 <div class="absolute inset-0 bg-gray-200 flex items-center justify-center">
                    <span class="text-gray-400 font-medium">Satellite Imagery & Panel Placement</span>
                 </div>
                 <div class="absolute inset-0 bg-brand-500/10 backdrop-grayscale"></div>
            </div>
            <div class="grid grid-cols-3 gap-6 mt-6 text-center">
                <div class="p-4 bg-white rounded shadow-sm">
                    <div class="text-2xl font-bold text-brand-600">28</div>
                    <div class="text-sm text-gray-500">Premium Panels</div>
                </div>
                <div class="p-4 bg-white rounded shadow-sm">
                    <div class="text-2xl font-bold text-brand-600">25 Yr</div>
                    <div class="text-sm text-gray-500">Performance Warranty</div>
                </div>
                <div class="p-4 bg-white rounded shadow-sm">
                    <div class="text-2xl font-bold text-brand-600">$2,400</div>
                    <div class="text-sm text-gray-500">Est. Annual Savings</div>
                </div>
            </div>
        </div>

        <!-- Pricing Options -->
        <div class="p-12 print:p-8 print:break-before-page">
            <h3 class="text-xl font-bold text-gray-900 mb-6">Investment Options</h3>
            <div class="grid grid-cols-2 gap-8">
                <!-- Standard -->
                <div class="border rounded-xl p-6 relative">
                    <h4 class="text-lg font-bold text-gray-900">Standard Solar</h4>
                    <p class="text-sm text-gray-500 mb-4">Maximum ROI</p>
                    <div class="text-3xl font-bold text-gray-900 mb-6">$22,500 <span class="text-sm font-normal text-gray-500">net</span></div>
                    <ul class="space-y-3 text-sm text-gray-600 mb-8">
                        <li class="flex items-center"><span class="mr-2 text-brand-500">✓</span> 400W Monocrystalline Panels</li>
                        <li class="flex items-center"><span class="mr-2 text-brand-500">✓</span> String Inverter Technology</li>
                        <li class="flex items-center"><span class="mr-2 text-brand-500">✓</span> Web Monitoring</li>
                    </ul>
                </div>
                
                <!-- Premium -->
                <div class="border-2 border-brand-500 bg-brand-50 rounded-xl p-6 relative shadow-sm">
                    <div class="absolute top-0 right-0 bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">RECOMMENDED</div>
                    <h4 class="text-lg font-bold text-gray-900">Tesla Powerwall + Solar</h4>
                    <p class="text-sm text-brand-700 mb-4">Energy Independence</p>
                    <div class="text-3xl font-bold text-gray-900 mb-6">$38,200 <span class="text-sm font-normal text-gray-500">net</span></div>
                    <ul class="space-y-3 text-sm text-gray-800 mb-8">
                        <li class="flex items-center"><span class="mr-2 text-brand-600">✓</span> <strong>Tesla Powerwall 3</strong> Included</li>
                        <li class="flex items-center"><span class="mr-2 text-brand-600">✓</span> <strong>All-Black</strong> Aesthetics</li>
                        <li class="flex items-center"><span class="mr-2 text-brand-600">✓</span> 25-Year Comprehensive Warranty</li>
                        <li class="flex items-center"><span class="mr-2 text-brand-600">✓</span> Backup Protection</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Acceptance -->
        <div class="bg-gray-50 p-12 border-t border-gray-100 print:p-8">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Next Steps</h3>
            <p class="text-gray-600 mb-8">By signing below, you authorize Rocky Mountain Solar to proceed with permitting and interconnection applications.</p>
            
            <div class="grid grid-cols-2 gap-12">
                <div>
                    <div class="border-b border-gray-400 h-12 mb-2"></div>
                    <p class="text-sm text-gray-500 uppercase">Customer Signature</p>
                </div>
                <div>
                    <div class="border-b border-gray-400 h-12 mb-2"></div>
                    <p class="text-sm text-gray-500 uppercase">Date</p>
                </div>
            </div>
        </div>
        
        <div class="bg-gray-900 text-gray-400 py-6 text-center text-sm print:text-black print:bg-white">
            <p>&copy; ${new Date().getFullYear()} Rocky Mountain Solar. All rights reserved.</p>
        </div>
    </div>
    
    <script>
       // Auto-print on open (optional, nice for PDF generation feel)
       // window.onload = () => window.print();
    </script>
</body>
</html>`;
      
      const blob = new Blob([template], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name.replace(/\s+/g, '_')}_Proposal.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setProposalModalOpen(null);
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
          <SidebarItem icon={FolderOpen} label="Previous Projects" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
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
             {activeTab === 'projects' ? 'Aurora Projects' : activeTab}
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

          {activeTab === 'projects' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Aurora Project Database</h3>
                        <p className="text-sm text-gray-500">Live connection to Aurora Solar API</p>
                    </div>
                    <button 
                        onClick={fetchAuroraProjects} 
                        disabled={loadingProjects}
                        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
                    >
                        <RefreshCw size={16} className={loadingProjects ? 'animate-spin' : ''} />
                        <span>Refresh Projects</span>
                    </button>
                </div>

                {projectsError && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-start text-sm">
                        <Monitor className="mr-2 mt-0.5 flex-shrink-0" size={16} />
                        <div>
                            <p className="font-semibold">Demo Mode / Error</p>
                            <p>{projectsError}</p>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loadingProjects ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
                                        <td className="px-6 py-4"><div className="h-8 bg-gray-200 rounded w-24"></div></td>
                                    </tr>
                                ))
                            ) : (
                                auroraProjects.map(project => (
                                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{project.name}</div>
                                            <div className="text-xs text-gray-500">ID: {project.id.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500">{project.property_address}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500">{new Date(project.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button 
                                                onClick={() => alert("Opening project in Aurora Solar (External Link)...")}
                                                className="flex items-center space-x-2 px-3 py-1.5 text-gray-600 hover:text-brand-600 hover:bg-gray-50 rounded-lg transition-colors text-sm font-medium"
                                            >
                                                <ExternalLink size={16} />
                                                <span>Open in Aurora</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {!loadingProjects && auroraProjects.length === 0 && (
                        <div className="p-12 text-center text-gray-500">
                            No projects found via API.
                        </div>
                    )}
                </div>
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
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
                
                {leads.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {leads.map(lead => (
                      <LeadCard 
                          key={lead.id} 
                          lead={lead} 
                          onClick={setSelectedLead}
                          onVerify={handleVerifyLead}
                          onViewPipeline={handleViewInPipeline}
                          onCreateProposal={handleOpenProposalModal}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <div className="bg-gray-50 p-4 rounded-full mb-3">
                        <Users size={32} />
                    </div>
                    <p>No leads found.</p>
                    <button onClick={handleSyncEmails} className="text-brand-600 text-sm mt-2 hover:underline">
                        Sync from Email
                    </button>
                  </div>
                )}
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

      {/* PROPOSAL CREATION MODAL */}
      {proposalModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                      <div>
                          <h2 className="text-xl font-bold text-gray-900">Generate Proposal Package</h2>
                          <p className="text-sm text-gray-500">Project: {proposalModalOpen.name}</p>
                      </div>
                      <button onClick={() => setProposalModalOpen(null)} className="text-gray-400 hover:text-gray-600 p-2">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left: Configuration */}
                      <div className="space-y-6">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Proposal Expiration</label>
                              <div className="p-3 bg-orange-50 text-orange-800 text-sm rounded-lg border border-orange-200 flex items-start">
                                  <Archive size={16} className="mr-2 mt-0.5" />
                                  <span>
                                      <strong>Issue:</strong> Standard links expire in 9 days.<br/>
                                      <strong>Solution:</strong> The button below generates a permanent offline package.
                                  </span>
                              </div>
                          </div>

                          <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                              <h4 className="font-semibold text-gray-900 flex items-center">
                                  <ImageIcon size={16} className="mr-2" />
                                  Image Adjustments
                              </h4>
                              <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase">Cover Image</label>
                                  <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border bg-white">
                                      <option>3D Model - South View (Default)</option>
                                      <option>3D Model - Top Down</option>
                                      <option>Street View</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase">System Overlay</label>
                                  <div className="mt-2 flex items-center space-x-4">
                                      <label className="inline-flex items-center">
                                          <input type="radio" className="form-radio text-brand-600" name="overlay" defaultChecked />
                                          <span className="ml-2 text-sm">Solid Panels</span>
                                      </label>
                                      <label className="inline-flex items-center">
                                          <input type="radio" className="form-radio text-brand-600" name="overlay" />
                                          <span className="ml-2 text-sm">Translucent</span>
                                      </label>
                                  </div>
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Pricing Tier</label>
                              <div className="grid grid-cols-2 gap-3">
                                  <div className="border border-brand-500 bg-brand-50 p-3 rounded-lg cursor-pointer">
                                      <div className="text-sm font-bold text-brand-900">Premium (Tesla)</div>
                                      <div className="text-xs text-brand-700">Includes Powerwall</div>
                                  </div>
                                  <div className="border border-gray-200 p-3 rounded-lg hover:border-gray-300 cursor-pointer">
                                      <div className="text-sm font-bold text-gray-700">Standard</div>
                                      <div className="text-xs text-gray-500">Solar Only</div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Right: Preview & Action */}
                      <div className="flex flex-col h-full bg-gray-100 rounded-lg border border-gray-200 overflow-hidden relative">
                           <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">Preview</div>
                           <div className="flex-1 flex items-center justify-center p-8">
                               <div className="bg-white w-full h-64 shadow-lg rounded flex flex-col items-center justify-center space-y-2 border">
                                    <Sun size={48} className="text-brand-500" />
                                    <h3 className="font-bold text-gray-800">Solar Proposal</h3>
                                    <p className="text-xs text-gray-400">Prepared for {proposalModalOpen.name}</p>
                                    <div className="w-3/4 h-2 bg-gray-100 rounded mt-4"></div>
                                    <div className="w-1/2 h-2 bg-gray-100 rounded"></div>
                               </div>
                           </div>
                           <div className="bg-white p-4 border-t border-gray-200">
                               <button 
                                  onClick={() => handleDownloadProposal(proposalModalOpen)}
                                  className="w-full flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
                               >
                                   <Download size={20} />
                                   <span>Download Proposal Package</span>
                               </button>
                               <p className="text-center text-xs text-gray-500 mt-2">Bypasses 9-day link expiry limit</p>
                           </div>
                      </div>
                  </div>
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
               
               {/* Action: Proposal */}
               <div className="space-y-4 pb-12">
                   <h3 className="font-semibold text-gray-900 border-b pb-2">Proposal Generation</h3>
                   <div className="flex items-center justify-between bg-white border p-4 rounded-lg">
                       <div>
                           <p className="font-medium">Customer Proposal</p>
                           <p className="text-xs text-gray-500">
                               Generate a PDF proposal based on the active template.
                           </p>
                       </div>
                       
                       <button 
                           onClick={() => handleOpenProposalModal(selectedLead)}
                           className="flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-semibold shadow-md"
                       >
                           <FilePlus size={16} />
                           <span>Create Proposal</span>
                       </button>
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