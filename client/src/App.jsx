import { Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/user/HomePage.jsx";
import TeachingSchedule from "./pages/user/TeachingSchedule.jsx";
import AdminHomePage from "./pages/admin/AdminHomePage.jsx";
import AdminTeachingschedule from "./pages/admin/AdminTeachingschedule.jsx";
import AdminTeachers from "./pages/admin/AdminTeachers.jsx";
import AdminClassRoom from "./pages/admin/AdminClassRoom.jsx";

import Record from "./pages/user/Record.jsx";
import Summarize from "./pages/user/summarize.jsx";
import ResultsPage from "./pages/user/ResultsPage.jsx";
import { Toaster } from "react-hot-toast";


function App() {
  return (
    <>
      <Toaster/>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          {/* User */}
          <Route path="/user/Homepage" element={<HomePage />} />
          <Route>
            <Route path="/user/TeachingSchedule" element={<TeachingSchedule />} />
            <Route path="/user/Record" element={<Record />} />
            <Route path="/user/summarize" element={<Summarize />} />
          </Route>
          <Route path="/user/ResultsPage" element={<ResultsPage />} />

        <Route path="/admin/AdminHomePage" element={<AdminHomePage />} />
        <Route path="/admin/AdminTeachingschedule" element={<AdminTeachingschedule />} />
        <Route path="/admin/AdminTeachers" element={<AdminTeachers />} />
        <Route path="/admin/AdminClassRoom/:id" element={<AdminClassRoom />} />


      </Routes>
    </>
  );
}

export default App;