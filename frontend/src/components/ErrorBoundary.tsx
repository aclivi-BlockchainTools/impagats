import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-full p-12">
          <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
            <h2 className="text-lg font-bold text-red-700 mb-2">Error inesperat</h2>
            <p className="text-sm text-gray-600 mb-4">
              S'ha produit un error a l'aplicació. Prova de recarregar la pàgina.
            </p>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
