import { Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/user/HomePage.jsx";
import TeachingSchedule from "./pages/user/TeachingSchedule.jsx";
import { CameraPage } from "./pages/SchedulePage.jsx";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/user/Homepage" element={<HomePage />} />
        <Route path="/user/TeachingSchedule" element={<TeachingSchedule />} />
        <Route path="/schedule" element={<CameraPage />} />
      </Routes>
    </>
  );
}

export default App;