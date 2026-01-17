export enum LeadSource {
    TESLA = 'Tesla',
    ENMAX = 'Enmax',
    WEBSITE = 'RM Website',
    OTHER = 'Other'
}

export enum LeadStatus {
    NEW = 'New',
    QUALIFIED = 'Qualified',
    CONTACTED = 'Contacted', // Email sent
    AURORA_DESIGN = 'Aurora Design', // Project created in Aurora
    PROPOSAL_SENT = 'Proposal Sent',
    SIGNED = 'Signed',
    LOST = 'Lost',
    SPAM = 'Spam'
}

export interface BillData {
    monthlyUsage: number[]; // Jan-Dec kWh
    totalAnnualUsage: number;
    provider?: string;
}

export interface Lead {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address: string;
    source: LeadSource;
    status: LeadStatus;
    dateReceived: string;
    notes: string;
    aiSpamScore?: number; // 0-100, high is likely spam
    aiReasoning?: string;
    auroraProjectId?: string;
    billData?: BillData;
    messageBody?: string; // The content of the original email/form
}

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string; // Markdown supported
    targetSource: LeadSource | 'All';
}

export interface DashboardStats {
    totalLeads: number;
    conversionRate: number;
    pendingAurora: number;
    revenuePotential: number;
}