import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ClientsList from "./pages/ClientsList";
import ClientForm from "./pages/ClientForm";
import InvoicesList from "./pages/InvoicesList";
import InvoiceForm from "./pages/InvoiceForm";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<ClientsList />} />
        <Route path="/clients/new" element={<ClientForm />} />
        <Route path="/clients/:id" element={<ClientForm />} />
        <Route path="/invoices" element={<InvoicesList />} />
        <Route path="/invoices/new" element={<InvoiceForm />} />
        <Route path="/invoices/:id" element={<InvoiceForm />} />
        <Route path="/import" element={<div>Import placeholder</div>} />
        <Route path="/receipts" element={<div>Receipts placeholder</div>} />
        <Route path="/receipts/:id" element={<div>Receipt detail placeholder</div>} />
        <Route path="/settings" element={<div>Settings placeholder</div>} />
      </Routes>
    </Layout>
  );
}

export default App;
