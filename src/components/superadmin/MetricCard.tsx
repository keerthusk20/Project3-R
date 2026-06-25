import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  colorClass?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend, trendUp, colorClass = "text-cyan-400 bg-cyan-500/10" }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-3 rounded-xl ${colorClass}`}>
          {icon}
        </div>
        <span className="text-3xl font-black">{value}</span>
      </div>
      <p className="text-sm font-bold text-muted-foreground uppercase">{title}</p>
      {trend && (
        <div className="mt-4 pt-4 border-t border-border flex justify-between text-xs text-muted-foreground">
          <span className={`flex items-center gap-1 ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend}
          </span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
