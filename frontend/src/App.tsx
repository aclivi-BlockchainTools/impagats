import { Routes, Route } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="p-6 text-xl">Dashboard - Impagats</div>} />
    </Routes>
  );
}

export default App;
