import { useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const EMPLOYEES = [
  { id: "1", name: "Sarah Jenkins",   email: "sarah.j@company.com",   dept: "Engineering", role: "Frontend Dev",      manager: "Alex Rivera",   joinDate: "Jan 12, 2024", lastMeeting: "2 days ago",  sentiment: "Positive", risk: "Low"    },
  { id: "2", name: "Michael Chen",    email: "m.chen@company.com",     dept: "Sales",       role: "Account Exec",      manager: "Jessica Wong",  joinDate: "Mar 05, 2023", lastMeeting: "1 week ago",  sentiment: "Neutral",  risk: "Medium" },
  { id: "3", name: "Elena Rodriguez", email: "elena.r@company.com",    dept: "Design",      role: "Product Designer",  manager: "Sam Taylor",    joinDate: "Nov 20, 2022", lastMeeting: "3 days ago",  sentiment: "Negative", risk: "High"   },
  { id: "4", name: "David Kim",       email: "d.kim@company.com",      dept: "HR",          role: "Recruiter",         manager: "Alex Rivera",   joinDate: "Jul 15, 2025", lastMeeting: "Today",       sentiment: "Positive", risk: "Low"    },
  { id: "5", name: "Priya Sharma",    email: "p.sharma@company.com",   dept: "Engineering", role: "Backend Dev",       manager: "Alex Rivera",   joinDate: "Feb 01, 2025", lastMeeting: "1 month ago", sentiment: "Neutral",  risk: "Medium" },
  { id: "6", name: "Marcus Johnson",  email: "m.johnson@company.com",  dept: "Sales",       role: "Sales Director",    manager: "Jessica Wong",  joinDate: "Sep 10, 2021", lastMeeting: "4 days ago",  sentiment: "Positive", risk: "Low"    },
];

export function Employees() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filteredEmployees = EMPLOYEES.filter((emp) => {
    const term = search.toLowerCase();
    return (
      emp.name.toLowerCase().includes(term) ||
      emp.dept.toLowerCase().includes(term) ||
      emp.role.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1f2937]">Employees</h1>
          <p className="text-gray-500 mt-1">Manage and track your entire workforce here.</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, dept, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1f7a6c]/50 focus:border-[#1f7a6c] bg-white transition-colors"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department / Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joining Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Meeting</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((person) => (
                <tr
                  key={person.id}
                  onClick={() => navigate(`/employees/${person.id}`)}
                  className="hover:bg-[#1f7a6c]/5 cursor-pointer transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1f7a6c]/10 flex items-center justify-center text-[#1f7a6c] font-medium text-sm">
                        {person.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{person.name}</div>
                        <div className="text-sm text-gray-500">{person.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{person.dept}</div>
                    <div className="text-sm text-gray-500">{person.role}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.manager}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.joinDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.lastMeeting}</td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                    No employees found matching &ldquo;{search}&rdquo;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
