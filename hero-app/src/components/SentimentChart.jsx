import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function SentimentChart({ data = [] }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm col-span-1 lg:col-span-2">
      <h3 className="text-lg font-semibold text-[#1f2937] mb-6">Employee Sentiment Distribution</h3>
      <div className="h-[300px] w-full">
        {data.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-gray-500">
            No sentiment data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 13 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 13 }} />
              <Tooltip
                cursor={{ fill: "#f3f4f6" }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" }}
              />
              <Bar dataKey="value" fill="#1f7a6c" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
