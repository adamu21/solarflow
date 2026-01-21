import React, { useEffect, useState} from 'react';
import { Lead, LeadStatus } from '../types';
import { StatsCard } from './StatsCard';
import { Users, DollarSign, Zap, FileCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchActrecTop, ActRecRow } from '../services/actrec';
import { fetchWorkOrders, WorkOrderRow } from '../services/workorders';

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

    
  // ----- NEW: actrec state -----
  const [actrecRows, setActrecRows] = useState<ActRecRow[]>([]);
  const [actrecLoading, setActrecLoading] = useState(false);
  const [actrecError, setActrecError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setActrecLoading(true);
        const rows = await fetchActrecTop(10, 0);
        setActrecRows(rows);
      } catch (e: any) {
        setActrecError(e?.message ?? 'Failed to load Accounts Receivable');
      } finally {
        setActrecLoading(false);
      }
    })();
  }, []);

  // We’ll auto-detect columns from the first row for now
  const columns = React.useMemo(
    () => (actrecRows.length > 0 ? Object.keys(actrecRows[0]) : []),
    [actrecRows]
  );

// work orders
  // function WorkOrdersTable() {
    const [woRows, setWORows] = useState<WorkOrderRow[]>([]);
    const [woLoading, setWOLoading] = useState(false);
    const [woError, setWOError] = useState<string | null>(null);

    useEffect(() => {
      (async () => {
        try {
          setWOLoading(true);
          const data = await fetchWorkOrders(20, 0, '');
          setWORows(data);
        } catch (e: any) {
          setWOError(e?.message ?? 'Failed to load work orders');
        } finally {
          setWOLoading(false);
        }
      })();
    }, []);

  // We’ll auto-detect columns from the first row for now
  const wocolumns = React.useMemo(
    () => (woRows.length > 0 ? Object.keys(woRows[0]) : []),
    [woRows]
  );
  // }
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

            
{/* NEW: Full-width actrec table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Accounts Receivable (Top 20)</h3>

        {actrecLoading && <div className="text-gray-500">Loading…</div>}
        {actrecError && <div className="text-red-600">Error: {actrecError}</div>}

        {!actrecLoading && !actrecError && actrecRows.length === 0 && (
          <div className="text-gray-500">No rows returned.</div>
        )}

        {!actrecLoading && !actrecError && actrecRows.length > 0 && (
          <div className="overflow-auto">
            <table className="min-w-full text-sm text-left border border-gray-200 rounded-lg">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2 border-b border-gray-200 sticky top-0 bg-gray-50">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actrecRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {columns.map((c) => (
                      <td key={c} className="px-3 py-2 border-b border-gray-100">
                        {String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>

        {/* WorkOrders  */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Work Orders</h3>

        {woLoading && <div className="text-gray-500">Loading…</div>}
        {woError && <div className="text-red-600">Error: {actrecError}</div>}

        {!woLoading && !woError && woRows.length === 0 && (
          <div className="text-gray-500">No rows returned.</div>
        )}

        {!woLoading && !woError && woRows.length > 0 && (
          <div className="overflow-auto">
            <table className="min-w-full text-sm text-left border border-gray-200 rounded-lg">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  {wocolumns.map((c) => (
                    <th key={c} className="px-3 py-2 border-b border-gray-200 sticky top-0 bg-gray-50">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {woRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {wocolumns.map((c) => (
                      <td key={c} className="px-3 py-2 border-b border-gray-100">
                        {String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>

        </div>
    );
};