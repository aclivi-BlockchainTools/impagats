import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ClientsList from "./pages/ClientsList";
import ClientForm from "./pages/ClientForm";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<ClientsList />} />
        <Route path="/clients/new" element={<ClientForm />} />
        <Route path="/clients/:id" element={<ClientForm />} />
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
