import { Routes, Route } from "react-router-dom";
import Login from "./components/auth/Login";
import WatchTogether from "./page/WatchTogether";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/watch" element={<WatchTogether />} />
    </Routes>
  );
};

export default App;
