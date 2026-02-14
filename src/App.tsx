import { Scene } from './visualization/Scene';
import { Overlay } from './ui/Overlay';
import { useChainData } from './hooks/useChainData';
import './App.css';

export default function App() {
  useChainData();

  return (
    <div className="app">
      <Scene />
      <Overlay />
    </div>
  );
}
