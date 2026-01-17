import React from 'react';
import { Lead, LeadStatus } from '../types';
import { StatsCard } from './StatsCard';
import { Users, DollarSign, Zap, FileCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
    leads: Lead[];
}

export const Dashboard: React.FC<DashboardProps> = ({ leads }) => {
    // Calculate Stats
    const totalLeads = leads.length;
    const activePipeline = leads.filter(l => l.status !== LeadStatus.NEW && l.status !== LeadStatus.SPAM && l.status !== LeadStatus.LOST).length;
    const signedDeals = leads.filter(l => l.status === LeadStatus.SIGNED).length;
    const auroraProjects = leads.filter(l => l.status === LeadStatus.AURORA_DESIGN || l.status === LeadStatus.PROPOSAL_SENT).length;
    
    // Revenue Potential (Mock: $30 for quote cost, assume $20k avg deal)
    const revenuePotential = activePipeline * 20000; 

    // Chart Data
    const data = [
        { name: 'New', count: leads.filter(l => l.status === LeadStatus.NEW).length },
        { name: 'Contacted', count: leads.filter(l => l.status === LeadStatus.CONTACTED).length },
        { name: 'Aurora', count: leads.filter(l => l.status === LeadStatus.AURORA_DESIGN).length },
        { name: 'Proposal', count: leads.filter(l => l.status === LeadStatus.PROPOSAL_SENT).length },
        { name: 'Signed', count: leads.filter(l => l.status === LeadStatus.SIGNED).length },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Total Leads" value={totalLeads} icon={Users} trend="12%" trendUp={true} />
                <StatsCard title="Pipeline Value (Est)" value={`$${(revenuePotential / 1000).toFixed(1)}k`} icon={DollarSign} trend="5%" trendUp={true} />
                <StatsCard title="Aurora Projects" value={auroraProjects} icon={Zap} />
                <StatsCard title="Signed Deals" value={signedDeals} icon={FileCheck} trend="2%" trendUp={false} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Lead Conversion Funnel</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="name" width={80} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]}>
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#cbd5e1', '#94a3b8', '#fbbf24', '#60a5fa', '#22c55e'][index % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Recent Activity</h3>
                    <div className="space-y-4">
                        {leads.slice(0, 4).map(lead => (
                            <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">{lead.name}</p>
                                    <p className="text-xs text-gray-500">Status: {lead.status}</p>
                                </div>
                                <span className="text-xs text-gray-400">{new Date(lead.dateReceived).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};