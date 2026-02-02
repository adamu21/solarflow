import React, { useState } from 'react';
import { Lead, LeadStatus } from '../types';
import { LeadCard } from './LeadCard';

interface PipelineProps {
    leads: Lead[];
    onLeadClick: (lead: Lead) => void;
    onStatusChange?: (leadId: string, newStatus: LeadStatus) => void;
}

const COLUMNS = [
    { id: LeadStatus.NEW, title: 'Inbox / New', color: 'border-blue-500' },
    { id: LeadStatus.CONTACTED, title: 'Contacted', color: 'border-indigo-500' },
    { id: LeadStatus.AURORA_DESIGN, title: 'Aurora Design', color: 'border-yellow-500' },
    { id: LeadStatus.PROPOSAL_SENT, title: 'Proposal Sent', color: 'border-orange-500' },
    { id: LeadStatus.SIGNED, title: 'Signed / Won', color: 'border-green-500' },
];

export const Pipeline: React.FC<PipelineProps> = ({ leads, onLeadClick, onStatusChange }) => {
    const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null);

    const handleDragOver = (e: React.DragEvent, colId: LeadStatus) => {
        e.preventDefault(); // Necessary to allow dropping
        setDragOverCol(colId);
    };

    const handleDragLeave = () => {
        setDragOverCol(null);
    };

    const handleDrop = (e: React.DragEvent, status: LeadStatus) => {
        e.preventDefault();
        setDragOverCol(null);
        const leadId = e.dataTransfer.getData('leadId');
        if (leadId && onStatusChange) {
            onStatusChange(leadId, status);
        }
    };

    return (
        <div className="h-full overflow-x-auto pb-4">
            <div className="flex h-full min-w-max space-x-4">
                {COLUMNS.map(col => {
                    const colLeads = leads.filter(l => l.status === col.id);
                    const isOver = dragOverCol === col.id;

                    return (
                        <div 
                            key={col.id} 
                            className={`w-80 flex flex-col rounded-xl p-3 border transition-colors duration-200
                                ${isOver ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}
                            `}
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className={`flex justify-between items-center mb-4 pb-2 border-b-2 ${col.color}`}>
                                <h3 className="font-semibold text-gray-700">{col.title}</h3>
                                <span className="text-sm bg-white px-2 py-1 rounded-full shadow-sm text-gray-500">{colLeads.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 min-h-[100px]">
                                {colLeads.map(lead => (
                                    <LeadCard 
                                        key={lead.id} 
                                        lead={lead} 
                                        onClick={onLeadClick} 
                                        compact 
                                        draggable={true}
                                    />
                                ))}
                                {colLeads.length === 0 && (
                                    <div className="text-center py-10 text-gray-400 text-sm italic">
                                        {isOver ? 'Drop here' : 'No leads'}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};