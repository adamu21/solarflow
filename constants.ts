import { Lead, LeadSource, LeadStatus, EmailTemplate } from './src/types';

export const INITIAL_LEADS: Lead[] = [
    {
        id: 'test-1',
        name: 'Mohammad Kiaksar',
        email: 'kiaksarmohammad@gmail.com',
        phone: '555-0199',
        address: '88 Test Street, Calgary, AB',
        source: LeadSource.WEBSITE,
        status: LeadStatus.NEW,
        dateReceived: new Date().toISOString(),
        notes: 'Test customer for email system verification.',
        messageBody: 'I am interested in testing your solar panel installation process. Please send me a quote.',
        aiSpamScore: 0,
        aiReasoning: 'Known test customer.'
    },
    {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@gmail.com',
        phone: '403-555-0101',
        address: '123 Maple Drive, Calgary, AB',
        source: LeadSource.TESLA,
        status: LeadStatus.NEW,
        dateReceived: new Date().toISOString(),
        notes: 'Interested in Powerwall + Solar.',
        messageBody: 'Hi, Tesla sent me here. I have a Model Y and want to charge it with solar.',
        aiSpamScore: 5,
        aiReasoning: 'Consistent with verified Tesla lead patterns.'
    },
    {
        id: '4',
        name: 'Mike Johnson',
        email: 'mike.j@enmax.user.com',
        address: '789 Pine Rd, Airdrie, AB',
        source: LeadSource.ENMAX,
        status: LeadStatus.AURORA_DESIGN,
        dateReceived: new Date(Date.now() - 200000000).toISOString(),
        notes: 'Bill data extracted manually.',
        auroraProjectId: 'a1b2c3d4',
        messageBody: 'Enmax referral program lead.'
    }
];

// Mock data to simulate fetching from lwrtemp@lynnwoodroofing.ca
export const INCOMING_EMAILS_MOCK: Lead[] = [
    {
        id: 'imported-1',
        name: 'Liam Wilson',
        email: 'liam.w@outlook.com',
        phone: '403-555-8822',
        address: '442 Roofing Lane, Edmonton, AB',
        source: LeadSource.OTHER,
        status: LeadStatus.NEW,
        dateReceived: new Date().toISOString(),
        notes: 'Imported from lwrtemp@lynnwoodroofing.ca',
        messageBody: 'Saw your flyer at the roofing site. Looking for solar shingles or panels.',
    },
    {
        id: 'imported-2',
        name: 'Enmax Referral: T. Baker',
        email: 't.baker@gmail.com',
        address: '2211 4th St NW, Calgary',
        source: LeadSource.ENMAX,
        status: LeadStatus.NEW,
        dateReceived: new Date().toISOString(),
        notes: 'Imported from lwrtemp@lynnwoodroofing.ca',
        messageBody: 'Forwarded Lead from Enmax: Customer usage is 12000kWh/yr. Interested in offset.',
    }
];

export const EMAIL_TEMPLATES: EmailTemplate[] = [
    {
        id: 'tesla-intro',
        name: 'Tesla Customer Intro',
        subject: 'Your Tesla Solar Inquiry - Rocky Mountain Solar',
        targetSource: LeadSource.TESLA,
        body: `Hi {name},

Thanks for reaching out through Tesla! We are a certified Tesla installer.

Attached you will find our product information guide specifically for Tesla Powerwall and solar integration.

Our typical process involves:
1. Preliminary design (Aurora Solar)
2. Site Assessment
3. Installation

Let me know if you have a copy of your recent electricity bill so I can finalize a design for you.

Best,
Jake`
    },
    {
        id: 'standard-intro',
        name: 'Standard Residential Intro',
        subject: 'Solar Quote Request - Rocky Mountain Solar',
        targetSource: 'All',
        body: `Hi {name},

Thank you for your interest in going solar with Rocky Mountain Solar.

I've received your request for a quote for {address}. To provide the most accurate proposal, could you please reply with a recent electricity bill?

Attached is our brochure explaining our panels and typical pricing structure.

Best,
Jake`
    }
];