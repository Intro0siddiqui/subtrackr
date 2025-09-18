
import React from 'react';

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  colorClass: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, colorClass }) => {
  return (
    <div className="bg-brand-secondary p-5 rounded-lg shadow-lg flex items-center space-x-4 transition-transform transform hover:scale-105">
      <div className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-lg ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-brand-subtle">{title}</p>
        <p className="text-2xl font-bold text-brand-text">{value}</p>
      </div>
    </div>
  );
};

export default SummaryCard;
