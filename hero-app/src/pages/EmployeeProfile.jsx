import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Briefcase, Calendar, User as UserIcon, Activity, AlertTriangle, MessageSquare } from "lucide-react";

export function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock employee data based on ID - in reality fetched from API
  const employee = {
    id,
    name: "Elena Rodriguez",
    email: "elena.r@company.com",
    dept: "Design",
    role: "Product Designer",
    manager: "Sam Taylor",
    joinDate: "Nov 20, 2022",
    sentimentScore: "62/100",
    riskLevel: "High",
    totalMeetings: 24,
  };

  return (
    <div className="space-y-6">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-sm text-gray-500 hover:text-[#1f7a6c] transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Employees
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Section */}
        <div className="col-span-1 lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-[#1f7a6c]/10 flex items-center justify-center text-[#1f7a6c] font-medium text-2xl mb-4">
            {employee.name.split(' ').map(n => n[0]).join('')}
          </div>
          <h2 className="text-xl font-bold text-[#1f2937] text-center">{employee.name}</h2>
          <p className="text-gray-500 text-sm mb-6 bg-gray-100 px-3 py-1 rounded-full mt-2">{employee.role}</p>
          
          <div className="w-full space-y-4 pt-4 border-t border-gray-200 text-sm">
            <div className="flex items-center text-gray-600">
              <Mail className="w-4 h-4 mr-3 text-gray-400" />
              {employee.email}
            </div>
            <div className="flex items-center text-gray-600">
              <Briefcase className="w-4 h-4 mr-3 text-gray-400" />
              {employee.dept}
            </div>
            <div className="flex items-center text-gray-600">
              <UserIcon className="w-4 h-4 mr-3 text-gray-400" />
              Reports to: {employee.manager}
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-3 text-gray-400" />
              Joined {employee.joinDate}
            </div>
          </div>
        </div>

        {/* Insights Section */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <h3 className="text-lg font-semibold text-[#1f2937]">Employee Insights</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Sentiment Score</span>
                <Activity className="w-4 h-4 text-[#1f7a6c]" />
              </div>
              <p className="text-2xl font-bold text-[#1f2937]">{employee.sentimentScore}</p>
              <p className="text-xs text-red-500 mt-2">-5 pts trailing 30 days</p>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-[#f59e0b]/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-[#f59e0b]" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Retention Risk</span>
                <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
              </div>
              <p className="text-2xl font-bold text-[#f59e0b]">{employee.riskLevel}</p>
              <p className="text-xs text-gray-500 mt-2">Elevated burnout signals</p>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Total Meetings</span>
                <MessageSquare className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-[#1f2937]">{employee.totalMeetings}</p>
              <p className="text-xs text-[#1f7a6c] mt-2">+3 from last month</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-6">
            <h4 className="text-md font-medium text-[#1f2937] mb-4">Latest Platform Observations</h4>
            <div className="space-y-4">
              <div className="border-l-2 border-[#f59e0b] pl-4 py-1">
                <p className="text-sm text-gray-800">Elena has expressed frustration with recent project deadlines during her last 2 1:1s.</p>
                <p className="text-xs text-gray-500 mt-1">Extracted from meeting on Oct 14</p>
              </div>
              <div className="border-l-2 border-gray-300 pl-4 py-1">
                <p className="text-sm text-gray-800">Showed strong interest in migrating to a Team Lead role in Q1.</p>
                <p className="text-xs text-gray-500 mt-1">Extracted from quarterly review on Sept 30</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
