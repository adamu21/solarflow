import React from 'react';
import { Lead, LeadStatus, LeadSource } from '../types';
import { Mail, Zap, AlertTriangle, CheckCircle, FileText, Check, Kanban, ArrowRight } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
  compact?: boolean;
  draggable?: boolean;
  onVerify?: (lead: Lead) => void;
  onViewPipeline?: () => void;
}

const SourceBadge = ({ source }: { source: LeadSource }) => {
  const colors = {
    [LeadSource.TESLA]: 'bg-red-100 text-red-800 border-red-200',
    [LeadSource.ENMAX]: 'bg-blue-100 text-blue-800 border-blue-200',
    [LeadSource.WEBSITE]: 'bg-purple-100 text-purple-800 border-purple-200',
    [LeadSource.OTHER]: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[source] || colors[LeadSource.OTHER]}`}>
      {source}
    </span>
  );
};

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onClick, compact, draggable, onVerify, onViewPipeline }) => {
  const isSpam = lead.status === LeadStatus.SPAM || (lead.aiSpamScore && lead.aiSpamScore > 80);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('leadId', lead.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleVerify = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onVerify) onVerify(lead);
  };
  
  const handleViewPipeline = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onViewPipeline) onViewPipeline();
  };

  return (
    <div 
      onClick={() => onClick(lead)}
      draggable={draggable}
      onDragStart={handleDragStart}
      className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer relative
        ${isSpam ? 'border-red-200 bg-red-50' : 'border-gray-200'}
        ${draggable ? 'active:cursor-grabbing hover:cursor-grab' : ''}
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{lead.name}</h3>
          <p className="text-sm text-gray-500 truncate w-48">{lead.address}</p>
        </div>
        <SourceBadge source={lead.source} />
      </div>

      {!compact && (
        <div className="mb-3 text-sm text-gray-600 line-clamp-2">
          {lead.messageBody}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <div className="flex space-x-2">
          {lead.aiSpamScore !== undefined && (
            <div className={`flex items-center text-xs font-medium ${lead.aiSpamScore > 50 ? 'text-red-600' : 'text-green-600'}`}>
               {lead.aiSpamScore > 50 ? <AlertTriangle size={14} className="mr-1"/> : <CheckCircle size={14} className="mr-1"/>}
               {lead.aiSpamScore > 50 ? 'High Risk' : 'Verified'}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
            {/* Pipeline Link Button */}
            {onViewPipeline && !compact && (
                <button 
                    onClick={handleViewPipeline}
                    className="text-gray-400 hover:text-brand-600 transition-colors p-1 rounded-full hover:bg-brand-50"
                    title="View in Pipeline"
                >
                    <Kanban size={16} />
                </button>
            )}

            {/* Verification Action (For Inbox) or Status Icons (For Pipeline) */}
            {onVerify && lead.status === LeadStatus.NEW && !isSpam ? (
                <button 
                    onClick={handleVerify}
                    className="flex items-center bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium border border-green-200 hover:bg-green-100 transition-colors"
                >
                    <Check size={12} className="mr-1" /> Verify
                </button>
            ) : (
                <div className="flex space-x-2 text-gray-400">
                {lead.status === LeadStatus.AURORA_DESIGN && <Zap size={16} className="text-yellow-500" />}
                {lead.status === LeadStatus.PROPOSAL_SENT && <FileText size={16} className="text-blue-500" />}
                {lead.status === LeadStatus.CONTACTED && <Mail size={16} className="text-green-500" />}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};