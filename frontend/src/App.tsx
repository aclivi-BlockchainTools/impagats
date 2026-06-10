import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<div>Clients placeholder</div>} />
        <Route path="/invoices" element={<div>Invoices placeholder</div>} />
        <Route path="/import" element={<div>Import placeholder</div>} />
        <Route path="/receipts" element={<div>Receipts placeholder</div>} />
        <Route path="/receipts/:id" element={<div>Receipt detail placeholder</div>} />
        <Route path="/settings" element={<div>Settings placeholder</div>} />
      </Routes>
    </Layout>
  );
}

export default App;
