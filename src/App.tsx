import { Scene } from './visualization/Scene';
import { Overlay } from './ui/Overlay';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { useChainData } from './hooks/useChainData';
import { isWebGLAvailable } from './utils/webgl';
import './App.css';

export default function App() {
  useChainData();

  if (!isWebGLAvailable()) {
    return (
      <div className="app">
        <div className="scene-error">
          <div className="scene-error-icon">◉</div>
          <h2>WebGL Not Available</h2>
          <p>ChainPulse requires WebGL to render. Please use a modern browser with hardware acceleration enabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <ErrorBoundary>
        <Scene />
      </ErrorBoundary>
      <Overlay />
    </div>
  );
}
