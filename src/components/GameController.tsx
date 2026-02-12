import { useCallback, useEffect, useRef, useState } from "react";
import { LaneTile } from "./LaneTile";

// Lane to Roku remote key mapping
const LANE_TO_KEY: Record<number, string> = {
  0: 'Left',
  1: 'Up',
  2: 'Down',
  3: 'Right'
};

export const GameController = () => {
  const [rokuIp, setRokuIp] = useState<string>(() => {
    return localStorage.getItem('rokuIp') || '';
  });
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [inputIp, setInputIp] = useState(rokuIp);
  
  // Track pending requests to avoid overwhelming the Roku
  const pendingRequests = useRef<Set<string>>(new Set());

  // Save Roku IP to localStorage when it changes
  useEffect(() => {
    if (rokuIp) {
      localStorage.setItem('rokuIp', rokuIp);
    }
  }, [rokuIp]);

  // Test connection to Roku
  const testConnection = useCallback(async (ip: string): Promise<boolean> => {
    try {
      // Try to query Roku device info
      const response = await fetch(`http://${ip}:8060/query/device-info`, {
        method: 'GET',
        mode: 'no-cors', // Roku doesn't support CORS, so we use no-cors
      });
      // With no-cors, we can't read the response, but if it doesn't throw, it likely worked
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }, []);

  // Send key press/release to Roku via ECP (External Control Protocol)
  const sendKeyToRoku = useCallback(async (key: string, action: 'keydown' | 'keyup' | 'keypress') => {
    if (!rokuIp) {
      console.warn('No Roku IP configured');
      return;
    }

    const requestId = `${key}-${action}-${Date.now()}`;
    if (pendingRequests.current.has(`${key}-${action}`)) {
      return; // Skip if same key/action is already pending
    }

    const url = `http://${rokuIp}:8060/${action}/${key}`;
    
    try {
      pendingRequests.current.add(`${key}-${action}`);
      await fetch(url, { 
        method: 'POST',
        mode: 'no-cors' // Roku ECP doesn't support CORS
      });
      console.log(`✅ Sent ${action}/${key} to Roku`);
    } catch (error) {
      console.error(`❌ Error sending ${action}/${key}:`, error);
    } finally {
      pendingRequests.current.delete(`${key}-${action}`);
    }
  }, [rokuIp]);

  const handlePress = useCallback((laneIndex: number) => {
    const key = LANE_TO_KEY[laneIndex];
    console.log(`[GAME] Lane ${laneIndex + 1} pressed (key: ${key})`);
    sendKeyToRoku(key, 'keydown');
  }, [sendKeyToRoku]);

  const handleRelease = useCallback((laneIndex: number, wasLongPress: boolean) => {
    const key = LANE_TO_KEY[laneIndex];
    console.log(`[GAME] Lane ${laneIndex + 1} released - ${wasLongPress ? "HOLD" : "TAP"} (key: ${key})`);
    sendKeyToRoku(key, 'keyup');
  }, [sendKeyToRoku]);

  const handleSaveIp = useCallback(() => {
    setRokuIp(inputIp);
    setShowSettings(false);
    setIsConnected(true); // Assume connected after saving
  }, [inputIp]);

  // Show settings if no Roku IP is configured
  if (!rokuIp || showSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-4">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-bold mb-4 text-foreground">🎮 Roku Setup</h2>
          <p className="text-muted-foreground mb-4">
            Enter your Roku device's IP address to connect the controller.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Find it on your Roku: Settings → Network → About
          </p>
          <input
            type="text"
            value={inputIp}
            onChange={(e) => setInputIp(e.target.value)}
            placeholder="192.168.1.100"
            className="w-full p-3 border rounded-lg mb-4 bg-background text-foreground"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveIp}
              className="flex-1 bg-primary text-primary-foreground py-3 px-4 rounded-lg font-semibold"
            >
              Connect
            </button>
            {rokuIp && (
              <button
                onClick={() => setShowSettings(false)}
                className="bg-secondary text-secondary-foreground py-3 px-4 rounded-lg"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-2 sm:p-4">
      {/* Grid background effect */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(hsl(280 100% 60% / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(280 100% 60% / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Settings button */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-2 right-2 z-20 bg-secondary/50 text-secondary-foreground p-2 rounded-lg text-sm"
      >
        ⚙️
      </button>

      {/* Connection status */}
      <div className="absolute top-2 left-2 z-20 text-xs text-muted-foreground font-mono">
        📺 {rokuIp}
      </div>
      
      {/* Main controller container */}
      <div className="relative z-10 w-full h-full max-w-[100vw] max-h-[100vh] flex gap-2 sm:gap-4">
        {[0, 1, 2, 3].map((laneIndex) => (
          <LaneTile
            key={laneIndex}
            laneIndex={laneIndex}
            onPress={handlePress}
            onRelease={handleRelease}
          />
        ))}
      </div>

      {/* Status indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50 font-mono">
        RHYTHM CONTROLLER • LANDSCAPE MODE
      </div>
    </div>
  );
};
