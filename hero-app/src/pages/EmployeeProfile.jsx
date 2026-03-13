import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Briefcase, Calendar, User as UserIcon, Activity, AlertTriangle, MessageSquare } from "lucide-react";
import { getEmployeeProfileByEmail } from "../lib/api";

export function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const profileEmail = useMemo(() => {
    const decoded = decodeURIComponent(String(id || "")).toLowerCase();
    return decoded.includes("@") ? decoded : "";
  }, [id]);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError("");

        if (!profileEmail) {
          throw new Error("Invalid employee identifier");
        }

        const profile = await getEmployeeProfileByEmail(profileEmail);
        if (!isMounted) return;
        setEmployee(profile);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Unable to load employee profile");
        setEmployee(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [profileEmail]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-sm text-gray-500 hover:text-[#1f7a6c] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Employees
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">Loading profile...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-sm text-gray-500 hover:text-[#1f7a6c] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Employees
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
          {error || "Employee profile not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-sm text-gray-500 hover:text-[#1f7a6c] transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Employees
      </button>

      {isLoading && <div className="text-sm text-gray-500">Refreshing employee profile...</div>}
      {error && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
          Live profile unavailable: {error}.
        </div>
      )}

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
              <p className="text-2xl font-bold text-[#1f2937]">{employee.sentimentScore || ""}</p>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-[#f59e0b]/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-[#f59e0b]" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Retention Risk</span>
                <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
              </div>
              <p className="text-2xl font-bold text-[#f59e0b]">{employee.riskLevel || ""}</p>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Total Meetings</span>
                <MessageSquare className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-[#1f2937]">{employee.totalMeetings}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-6">
            <h4 className="text-md font-medium text-[#1f2937] mb-4">Latest Platform Observations</h4>
            <div className="space-y-4">
              {(employee.observations || []).slice(0, 2).map((item, index) => (
                <div key={index} className={`border-l-2 pl-4 py-1 ${index === 0 ? "border-[#f59e0b]" : "border-gray-300"}`}>
                  <p className="text-sm text-gray-800">{item}</p>
                  <p className="text-xs text-gray-500 mt-1">Generated from integrated intelligence data</p>
                </div>
              ))}
              {(!employee.observations || employee.observations.length === 0) && (
                <div className="border-l-2 border-gray-300 pl-4 py-1">
                  <p className="text-sm text-gray-800">No observations available yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
