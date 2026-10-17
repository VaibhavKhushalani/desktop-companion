import "./App.css";
import { Canvas } from "@react-three/fiber";
import Character from "./components/Character";

function App() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Canvas
        gl={{ alpha: true, antialias: false }}
        camera={{ position: [0, 0, 6], rotation: [0, 0, 0], fov: 45 }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 5]} intensity={0.5} />
        <Character />
      </Canvas>
    </div>
  );
}

export default App;
