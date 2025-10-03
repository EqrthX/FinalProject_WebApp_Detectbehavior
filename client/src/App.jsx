import { Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/user/HomePage.jsx";
import TeachingSchedule from "./pages/user/TeachingSchedule.jsx";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/user/Homepage" element={<HomePage />} />
        <Route path="/user/TeachingSchedule" element={<TeachingSchedule />} />
      </Routes>
    </>
  );
}

export default App;