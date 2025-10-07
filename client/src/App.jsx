import { Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/user/HomePage.jsx";
import TeachingSchedule from "./pages/user/TeachingSchedule.jsx";
import Record from "./pages/user/Record.jsx";
import Summarize from "./pages/user/summarize.jsx";
import ResultsPage from "./pages/user/ResultsPage.jsx";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/user/Homepage" element={<HomePage />} />
        <Route>
          <Route path="/user/TeachingSchedule" element={<TeachingSchedule />} />
          <Route path="/user/Record" element={<Record />} />
          <Route path="/user/summarize" element={<Summarize />} />
        </Route>
        <Route path="/user/ResultsPage" element={<ResultsPage />} />


      </Routes>
    </>
  );
}

export default App;