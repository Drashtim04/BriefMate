import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, Clock, Users, ArrowRight, Lightbulb, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { getMeetingTranscript, listMeetings } from "../lib/api";

// ---------- Mini Calendar ----------
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function MiniCalendar({ meetings, onSelectMeeting }) {
  const today = new Date();
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
          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();
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
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    function formatNameFromEmail(emailText) {
      const local = String(emailText || "").split("@")[0];
      if (!local) return "";
      return local
        .split(/[._-]/g)
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
        .join(" ");
    }

    function toDisplayDate(dateText) {
      const d = new Date(dateText);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }

    function toDisplayTime(dateText) {
      const d = new Date(dateText);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }

    async function loadMeetings() {
      try {
        setIsLoading(true);
        setError("");
        const rows = await listMeetings({ limit: 30 });
        if (!isMounted) return;

        const mapped = rows
          .map((row) => {
            const at = row.meetingAt || "";
            const participantEmail = row.employeeEmail || row.participants?.[0] || "";

            return {
              id: row.meetingId,
              employeeEmail: participantEmail,
              empName: formatNameFromEmail(participantEmail),
              dept: "",
              date: at ? String(at).slice(0, 10) : "",
              displayDate: toDisplayDate(at),
              time: toDisplayTime(at),
              type: row.title || "",
              transcript: [],
              aiSummary: {
                topics: row.summary || "",
                concerns: "",
                career: "",
              },
              suggestions: [],
            };
          })
          .filter((row) => row.id);

        const seen = new Set();
        const deduped = mapped.filter((row) => {
          const key = `${String(row.employeeEmail || "").toLowerCase()}|${row.date}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setMeetings(deduped);
        setSelectedMeeting(deduped[0] || null);
      } catch (err) {
        if (!isMounted) return;
        setMeetings([]);
        setSelectedMeeting(null);
        setError(err?.message || "Unable to load live meetings");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadMeetings();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrateTranscript() {
      if (!selectedMeeting?.id) return;
      try {
        const details = await getMeetingTranscript(selectedMeeting.id);
        if (!isMounted) return;

        const transcriptLines = Array.isArray(details?.transcript)
          ? details.transcript.map((line) => ({
              speaker: line?.speaker || line?.role || "Participant",
              text: line?.text || line?.message || "",
            }))
          : [];

        setSelectedMeeting((prev) => ({
          ...prev,
          transcript: transcriptLines.length ? transcriptLines : prev.transcript,
          aiSummary: {
            topics: details?.summary || prev.aiSummary.topics,
            concerns: prev.aiSummary.concerns,
            career: prev.aiSummary.career,
          },
        }));
      } catch (_err) {
        // Keep current UI state when transcript endpoint is unavailable.
      }
    }

    hydrateTranscript();
    return () => {
      isMounted = false;
    };
  }, [selectedMeeting?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1f2937]">Meeting Summary</h1>
        <p className="text-gray-500 mt-1">
          Review AI-generated insights and transcripts from past conversations.
        </p>
      </div>

      {error && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
          Live meeting service unavailable: {error}.
        </div>
      )}

      {isLoading && <div className="text-sm text-gray-500">Loading meetings...</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: "600px" }}>
        {/* LEFT — Calendar + meeting list */}
        <div className="col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50 font-semibold text-gray-700 flex items-center text-sm">
            <CalendarIcon className="w-4 h-4 mr-2 text-[#1f7a6c]" /> Calendar
          </div>
          <div className="p-4">
            <MiniCalendar meetings={meetings} onSelectMeeting={setSelectedMeeting} />
          </div>

          {/* Scrollable meeting cards below the calendar */}
          <div className="border-t border-gray-100 overflow-y-auto flex-1 p-2 space-y-1.5">
            {meetings.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMeeting(m)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedMeeting?.id === m.id
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
            {meetings.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-500">No meetings available.</div>
            )}
          </div>
        </div>

        {/* RIGHT — Details panel */}
        <div className="col-span-1 lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {!selectedMeeting ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500 p-6">
              Select a meeting to view transcript and insights.
            </div>
          ) : (
            <>
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
                {selectedMeeting.suggestions.length === 0 && (
                  <div className="text-sm text-gray-500">No follow-up suggestions available.</div>
                )}
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
                {selectedMeeting.transcript.length === 0 ? (
                  <p className="italic text-center text-gray-400 mt-4">No transcript available.</p>
                ) : (
                  <p className="italic text-center text-gray-400 mt-4">End of transcript</p>
                )}
              </div>
            </section>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
