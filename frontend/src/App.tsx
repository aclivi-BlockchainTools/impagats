import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import ClientsList from "./pages/ClientsList";
import ClientForm from "./pages/ClientForm";
import InvoicesList from "./pages/InvoicesList";
import InvoiceForm from "./pages/InvoiceForm";
import BankImport from "./pages/BankImport";
import ReturnedReceiptsList from "./pages/ReturnedReceiptsList";
import ReturnedReceiptForm from "./pages/ReturnedReceiptForm";
import ReturnedReceiptDetail from "./pages/ReturnedReceiptDetail";
import Settings from "./pages/Settings";
import WorkTray from "./pages/WorkTray";
import Login from "./pages/Login";

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<ClientsList />} />
              <Route path="/clients/new" element={<ClientForm />} />
              <Route path="/clients/:id" element={<ClientForm />} />
              <Route path="/invoices" element={<InvoicesList />} />
              <Route path="/invoices/new" element={<InvoiceForm />} />
              <Route path="/invoices/:id" element={<InvoiceForm />} />
              <Route path="/import" element={<BankImport />} />
              <Route path="/receipts" element={<ReturnedReceiptsList />} />
              <Route path="/receipts/new" element={<ReturnedReceiptForm />} />
              <Route path="/receipts/:id" element={<ReturnedReceiptDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/work-tray" element={<WorkTray />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
