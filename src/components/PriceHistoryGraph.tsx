import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { IngredientChange } from '../types';
import { formatCurrency } from '../utils';

interface Props {
  ingredientId: string;
  changes: IngredientChange[];
}

export const PriceHistoryGraph: React.FC<Props> = ({ ingredientId, changes }) => {
  // Filter and sort changes for this ingredient
  const ingredientChanges = changes
    .filter(c => c.ingredientId === ingredientId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (ingredientChanges.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-400 italic">
        변동 내역이 없습니다.
      </div>
    );
  }

  // Prepare data for the chart
  const data = ingredientChanges.map(c => ({
    date: new Date(c.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    purchasePrice: c.currPurchasePrice || 0,
    salesPrice: c.currSalesPrice || 0,
    fullDate: new Date(c.timestamp).toLocaleString()
  }));

  return (
    <div className="w-64 h-40 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700">
      <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 px-1">최근 3개월 가격 추이</h4>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            hide 
          />
          <YAxis 
            hide 
            domain={['auto', 'auto']} 
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[10px]">
                    <p className="font-bold mb-1">{payload[0].payload.fullDate}</p>
                    <p className="text-rose-600">매입가: {formatCurrency(payload[0].value as number)}</p>
                    <p className="text-blue-600">매출가: {formatCurrency(payload[1].value as number)}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line 
            type="monotone" 
            dataKey="purchasePrice" 
            stroke="#e11d48" 
            strokeWidth={2} 
            dot={{ r: 2 }} 
            activeDot={{ r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="salesPrice" 
            stroke="#2563eb" 
            strokeWidth={2} 
            dot={{ r: 2 }} 
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-between px-1 mt-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-rose-600 rounded-full"></div>
          <span className="text-[8px] text-slate-500">매입가</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
          <span className="text-[8px] text-slate-500">매출가</span>
        </div>
      </div>
    </div>
  );
};
