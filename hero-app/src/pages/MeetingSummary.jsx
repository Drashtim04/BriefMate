import { useState } from "react";
import { Calendar as CalendarIcon, Clock, Users, ArrowRight, Lightbulb, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

// ---------- Mock data ----------
const MEETINGS = [
  {
    id: 1,
    empName: "Elena Rodriguez",
    dept: "Design",
    date: "2025-10-14",
    displayDate: "Oct 14, 2025",
    time: "10:00 AM",
    type: "1:1 Check-in",
    transcript: [
      { speaker: "HR",    text: "So how has the new sprint cycle been treating you?" },
      { speaker: "Elena", text: "It's been okay, we're definitely moving faster. The only real issue is the Jira workflow — it's creating a bottleneck during code reviews." },
      { speaker: "HR",    text: "Could we solve that by removing a required approval step?" },
      { speaker: "Elena", text: "Yes! If the QA column were automated, we'd save about 4 hours a week." },
      { speaker: "HR",    text: "Noted. Any thoughts on the upcoming mobile apps work?" },
      { speaker: "Elena", text: "I'm really excited — I'd love to help lead that React Native migration." },
    ],
    aiSummary: {
      topics: "Q3 deliverables, team expansion plans, UI prototyping tools, mobile roadmap.",
      concerns: "Jira workflow bottlenecks slowing code reviews.",
      career: "Interest in leading the React Native migration taskforce.",
    },
    suggestions: [
      "How are you feeling about the React Native migration timeline?",
      "Have the Jira bottlenecks improved since our last check-in?",
    ],
  },
  {
    id: 2,
    empName: "Michael Chen",
    dept: "Sales",
    date: "2025-10-12",
    displayDate: "Oct 12, 2025",
    time: "02:30 PM",
    type: "Performance Review",
    transcript: [
      { speaker: "HR",     text: "Michael, your Q3 numbers look strong. How are you feeling about the team dynamic?" },
      { speaker: "Michael",text: "Overall good, but I'm noticing some friction between the SDR and AE layers." },
      { speaker: "HR",     text: "Interesting. What do you think is driving that?" },
      { speaker: "Michael",text: "Mostly unclear handoff criteria. If we document the qualification thresholds, it would help a lot." },
    ],
    aiSummary: {
      topics: "Q3 performance review, SDR-AE handoff friction, quota targets.",
      concerns: "Friction between SDRs and AEs due to unclear handoff criteria.",
      career: "Interested in a sales enablement role to help systemise the process.",
    },
    suggestions: [
      "Have you drafted the updated handoff criteria document?",
      "Would you be interested in leading the next sales enablement session?",
    ],
  },
  {
    id: 3,
    empName: "Sarah Jenkins",
    dept: "Engineering",
    date: "2025-10-10",
    displayDate: "Oct 10, 2025",
    time: "11:15 AM",
    type: "Career Growth",
    transcript: [
      { speaker: "HR",   text: "Sarah, we wanted to check in on your career aspirations as we head into Q4." },
      { speaker: "Sarah",text: "I've been thinking a lot about moving into an engineering management track." },
      { speaker: "HR",   text: "That's great. Have you had a chance to mentor any junior engineers?" },
      { speaker: "Sarah",text: "Yes — I've been doing informal code reviews and design sessions. I'd love to formalise that." },
    ],
    aiSummary: {
      topics: "Career trajectory, engineering management interest, current team dynamics.",
      concerns: "Feels underutilised in a purely IC role; wants more leadership visibility.",
      career: "Targeting an EM position within 6–12 months.",
    },
    suggestions: [
      "Would it help to put together a formal mentorship plan by end of month?",
      "Are there upcoming projects where you could take a tech-lead role?",
    ],
  },
];

// ---------- Mini Calendar ----------
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function MiniCalendar({ meetings, onSelectMeeting }) {
  const today = new Date(2025, 9, 14); // Oct 14 2025 (mock "today")
  const [viewDate, setViewDate] = useState(today);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const meetingMap = {};
  meetings.forEach((m) => {
    const d = new Date(m.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate();
      meetingMap[key] = meetingMap[key] || [];
      meetingMap[key].push(m);
    }
  });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="select-none">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-[#1f2937]">
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 pb-1">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />;
          const hasEvent = !!meetingMap[day];
          const isToday = day === 14 && month === 9 && year === 2025;
          return (
            <button
              key={day}
              onClick={() => hasEvent && onSelectMeeting(meetingMap[day][0])}
              className={`relative mx-auto w-8 h-8 flex items-center justify-center rounded-full text-xs transition-colors
                ${isToday ? "bg-[#1f7a6c] text-white font-bold" : "text-gray-700 hover:bg-gray-100"}
                ${hasEvent && !isToday ? "font-semibold" : ""}
              `}
            >
              {day}
              {hasEvent && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isToday ? "bg-white" : "bg-[#1f7a6c]"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Event list for this month */}
      <div className="mt-4 border-t border-gray-100 pt-3 space-y-1.5">
        {Object.entries(meetingMap).map(([day, ms]) =>
          ms.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectMeeting(m)}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#1f7a6c]/5 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#1f7a6c] flex-shrink-0" />
              <span className="text-xs text-gray-700 truncate">{m.empName} — {m.type}</span>
            </button>
          ))
        )}
        {Object.keys(meetingMap).length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">No meetings this month</p>
        )}
      </div>
    </div>
  );
}

// ---------- Main Page ----------
export function MeetingSummary() {
  const [selectedMeeting, setSelectedMeeting] = useState(MEETINGS[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1f2937]">Meeting Summary</h1>
        <p className="text-gray-500 mt-1">
          Review AI-generated insights and transcripts from past conversations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: "600px" }}>
        {/* LEFT — Calendar + meeting list */}
        <div className="col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50 font-semibold text-gray-700 flex items-center text-sm">
            <CalendarIcon className="w-4 h-4 mr-2 text-[#1f7a6c]" /> Calendar
          </div>
          <div className="p-4">
            <MiniCalendar meetings={MEETINGS} onSelectMeeting={setSelectedMeeting} />
          </div>

          {/* Scrollable meeting cards below the calendar */}
          <div className="border-t border-gray-100 overflow-y-auto flex-1 p-2 space-y-1.5">
            {MEETINGS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMeeting(m)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedMeeting.id === m.id
                    ? "border-[#1f7a6c] bg-[#1f7a6c]/5"
                    : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="text-sm font-semibold text-[#1f2937]">{m.empName}</div>
                <div className="text-xs text-gray-400 mt-0.5 flex items-center">
                  <Clock className="w-3 h-3 mr-1" /> {m.displayDate} · {m.time}
                </div>
                <div className="mt-1.5 inline-flex bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded font-medium">
                  {m.type}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT — Details panel */}
        <div className="col-span-1 lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {/* Meeting header */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-[#1f2937]">
              {selectedMeeting.empName} — {selectedMeeting.type}
            </h2>
            <div className="flex gap-4 mt-1 text-gray-500 text-sm">
              <span className="flex items-center"><Users className="w-4 h-4 mr-1" />{selectedMeeting.dept}</span>
              <span className="flex items-center"><CalendarIcon className="w-4 h-4 mr-1" />{selectedMeeting.displayDate} · {selectedMeeting.time}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* AI Summary */}
            <section className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h3 className="text-sm font-bold text-[#1f2937] mb-3 flex items-center">
                <Lightbulb className="w-4 h-4 text-[#f59e0b] mr-2" /> AI Summary Insights
              </h3>
              <ul className="space-y-3">
                {[
                  ["Topics",   selectedMeeting.aiSummary.topics],
                  ["Concerns", selectedMeeting.aiSummary.concerns],
                  ["Career",   selectedMeeting.aiSummary.career],
                ].map(([label, text]) => (
                  <li key={label} className="flex items-start text-sm text-gray-700">
                    <span className="block w-20 flex-shrink-0 font-semibold text-gray-900">{label}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Follow-up suggestions */}
            <section>
              <h3 className="text-sm font-bold text-[#1f2937] mb-3 flex items-center">
                <CheckCircle2 className="w-4 h-4 text-[#1f7a6c] mr-2" /> Recommended Follow-up Questions
              </h3>
              <div className="space-y-2">
                {selectedMeeting.suggestions.map((q, i) => (
                  <div
                    key={i}
                    className="flex items-start p-3 bg-[#1f7a6c]/5 border border-[#1f7a6c]/20 rounded-lg text-sm text-[#165a50]"
                  >
                    <ArrowRight className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                    &ldquo;{q}&rdquo;
                  </div>
                ))}
              </div>
            </section>

            {/* Transcript */}
            <section>
              <h3 className="text-sm font-bold text-gray-700 mb-3">Meeting Transcript</h3>
              <div className="h-64 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm text-gray-600 space-y-4">
                {selectedMeeting.transcript.map((line, i) => (
                  <p key={i}>
                    <span className={`font-bold pr-2 ${line.speaker === "HR" ? "text-[#1f7a6c]" : "text-gray-800"}`}>
                      {line.speaker}:
                    </span>
                    {line.text}
                  </p>
                ))}
                <p className="italic text-center text-gray-400 mt-4">— End of transcript —</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
