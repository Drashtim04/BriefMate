export function MetricCard({ title, value, description, icon: Icon, trend }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-[#1f2937]">{value}</p>
        </div>
        <div className="p-2 bg-[#1f7a6c]/10 rounded-lg text-[#1f7a6c]">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm">
        <span className={trend === "up" ? "text-[#1f7a6c]" : trend === "down" ? "text-red-500" : "text-gray-500"}>
          {description}
        </span>
      </div>
    </div>
  );
}
