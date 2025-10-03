import { Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import LoginPage from "./pages/LoginPage.jsx";
<<<<<<< HEAD
import HomePage from "./pages/user/HomePage.jsx";
import TeachingSchedule from "./pages/user/TeachingSchedule.jsx";
=======
import { CameraPage } from "./pages/SchedulePage.jsx";
>>>>>>> 1bdf2e9d902aea3754015ad64e415590230bd52f

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />
<<<<<<< HEAD
        <Route path="/user/Homepage" element={<HomePage />} />
        <Route path="/user/TeachingSchedule" element={<TeachingSchedule />} />
=======
        <Route path="/schedule" element={<CameraPage />} />
>>>>>>> 1bdf2e9d902aea3754015ad64e415590230bd52f
      </Routes>
    </>
  );
}

export default App;