import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<div>Dashboard placeholder</div>} />
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
