import { Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import LoginPage from "./pages/LoginPage.jsx";
import { CameraPage } from "./pages/SchedulePage.jsx";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/schedule" element={<CameraPage />} />
      </Routes>
    </>
  );
}

export default App;