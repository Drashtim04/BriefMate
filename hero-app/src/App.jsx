import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Employees } from "./pages/Employees";
import { EmployeeProfile } from "./pages/EmployeeProfile";
import { Chatbot } from "./pages/Chatbot";
import { MeetingSummary } from "./pages/MeetingSummary";
import { Profile } from "./pages/Profile";
import { HeroSection } from "./components/HeroSection";

/* ── Landing layout: NO navbar, no top padding ── */
function LandingLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#1f2937] overflow-x-hidden">
      <main className="flex-1 w-full m-0 p-0">{children}</main>
      <Footer />
    </div>
  );
}

/* ── App layout: WITH navbar + top-padding for fixed bar ── */
function AppLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f9fafb] text-[#1f2937] font-sans overflow-x-hidden">
      <Navbar />
      <main className="flex-1 w-full pt-20 pb-10 px-6 max-w-7xl mx-auto">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing — no navbar */}
        <Route path="/" element={<LandingLayout><HeroSection /></LandingLayout>} />

        {/* Auth — self-contained full-screen */}
        <Route path="/login"  element={<Login />}  />
        <Route path="/signup" element={<Signup />} />

        {/* Authenticated app — navbar visible */}
        <Route path="/dashboard"      element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/employees"      element={<AppLayout><Employees /></AppLayout>} />
        <Route path="/employees/:id"  element={<AppLayout><EmployeeProfile /></AppLayout>} />
        <Route path="/chatbot"        element={<AppLayout><Chatbot /></AppLayout>} />
        <Route path="/meeting-summary" element={<AppLayout><MeetingSummary /></AppLayout>} />
        <Route path="/profile"        element={<AppLayout><Profile /></AppLayout>} />
      </Routes>
    </Router>
  );
}

export default App;
