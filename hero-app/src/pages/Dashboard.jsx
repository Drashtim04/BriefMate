import { useState } from "react";
import { Users, Calendar, AlertTriangle, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";
import { SentimentChart } from "../components/SentimentChart";
import { DepartmentPieChart } from "../components/DepartmentPieChart";

const RECENT_INSIGHTS = [
  { id: "1", name: "Sarah Jenkins",   dept: "Engineering", role: "Frontend Dev",     lastMeeting: "2 days ago",  sentiment: "Positive", risk: "Low"    },
  { id: "2", name: "Michael Chen",    dept: "Sales",       role: "Account Exec",     lastMeeting: "1 week ago",  sentiment: "Neutral",  risk: "Medium" },
  { id: "3", name: "Elena Rodriguez", dept: "Design",      role: "Product Designer", lastMeeting: "3 days ago",  sentiment: "Negative", risk: "High"   },
  { id: "4", name: "David Kim",       dept: "HR",          role: "Recruiter",        lastMeeting: "Today",       sentiment: "Positive", risk: "Low"    },
];

// ---------- Employee Detail Modal ----------
function EmployeeModal({ person, onClose }) {
  if (!person) return null;

  const sentimentHistory = [
    { month: "Jul", score: 78 }, { month: "Aug", score: 74 },
    { month: "Sep", score: 65 }, { month: "Oct", score: person.sentiment === "Positive" ? 82 : person.sentiment === "Neutral" ? 67 : 55 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1f7a6c]/10 flex items-center justify-center text-[#1f7a6c] font-bold text-lg">
              {person.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1f2937]">{person.name}</h2>
              <p className="text-sm text-gray-500">{person.role} · {person.dept}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Risk & Sentiment Badges */}
          <div className="flex gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              person.sentiment === "Positive" ? "bg-green-100 text-green-800"
              : person.sentiment === "Negative" ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-800"
            }`}>
              Sentiment: {person.sentiment}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              person.risk === "High" ? "bg-amber-100 text-orange-800"
              : person.risk === "Medium" ? "bg-yellow-100 text-yellow-800"
              : "bg-green-100 text-green-800"
            }`}>
              Risk: {person.risk}
            </span>
          </div>

          {/* Sentiment History */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Sentiment History</h3>
            <div className="flex items-end gap-2 h-20">
              {sentimentHistory.map((sh) => (
                <div key={sh.month} className="flex flex-col items-center flex-1">
                  <div
                    className="w-full rounded-t-md bg-[#1f7a6c]"
                    style={{ height: `${sh.score}%`, opacity: 0.4 + sh.score / 200 }}
                  />
                  <span className="text-xs text-gray-500 mt-1">{sh.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Meeting History */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Meeting History</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>1:1 Check-in</span><span className="text-gray-400">Oct 14, 2025</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>Performance Review</span><span className="text-gray-400">Sep 30, 2025</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Career Growth Discussion</span><span className="text-gray-400">Aug 19, 2025</span>
              </div>
            </div>
          </div>

          {/* Recent Notes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Notes</h3>
            <div className="border-l-2 border-[#1f7a6c]/40 pl-4 space-y-3">
              <p className="text-sm text-gray-700">Expressed interest in leading a cross-functional project next quarter.</p>
              <p className="text-sm text-gray-400 text-xs">Oct 14 · 1:1 meeting</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#1f7a6c] text-white rounded-lg text-sm font-medium hover:bg-[#165a50] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Dashboard ----------
export function Dashboard() {
  const [modalEmployee, setModalEmployee] = useState(null);
  const navigate = useNavigate();

  return (
    <>
      {modalEmployee && (
        <EmployeeModal person={modalEmployee} onClose={() => setModalEmployee(null)} />
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1f2937]">Welcome back, Alex</h1>
          <p className="text-gray-500 mt-1">Here is what's happening with your workforce today.</p>
        </div>

        {/* SECTION 1 – Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Total Employees" value="1,248" description="+12 from last month"       icon={Users}         trend="up"   />
          <MetricCard title="Meetings This Week" value="342" description="-18% vs last week"        icon={Calendar}      trend="down" />
          <MetricCard title="Employees At Risk" value="45"  description="Requires immediate attention" icon={AlertTriangle} trend="down" />
          <MetricCard title="Sentiment Score" value="78/100" description="+2 pts from last quarter" icon={Activity}      trend="up"   />
        </div>

        {/* SECTION 2 & 3 – Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SentimentChart />
          <DepartmentPieChart />
        </div>

        {/* SECTION 4 – Recent Employee Insights (clickable rows) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#1f2937]">Recent Employee Insights</h3>
            <span className="text-xs text-gray-400">Click a row to view details</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Meeting</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sentiment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {RECENT_INSIGHTS.map((person) => (
                  <tr
                    key={person.id}
                    className="hover:bg-[#1f7a6c]/5 cursor-pointer transition-colors duration-150"
                    onClick={() => setModalEmployee(person)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#1f7a6c]/10 flex items-center justify-center text-[#1f7a6c] font-medium text-xs">
                          {person.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{person.name}</div>
                          <div className="text-sm text-gray-500">{person.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.dept}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.lastMeeting}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                        person.sentiment === "Positive" ? "bg-green-100 text-green-800"
                        : person.sentiment === "Negative" ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                      }`}>
                        {person.sentiment}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                        person.risk === "High"   ? "bg-amber-100 text-orange-800"
                        : person.risk === "Medium" ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                      }`}>
                        {person.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
