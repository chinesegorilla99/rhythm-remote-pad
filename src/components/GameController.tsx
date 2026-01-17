import { useCallback } from "react";
import { LaneTile } from "./LaneTile";

export const GameController = () => {
  const handlePress = useCallback((laneIndex: number) => {
    // This is where you'll add Roku communication later
    console.log(`[GAME] Lane ${laneIndex + 1} pressed`);
  }, []);

  const handleRelease = useCallback((laneIndex: number, wasLongPress: boolean) => {
    // This is where you'll add Roku communication later
    console.log(`[GAME] Lane ${laneIndex + 1} released - ${wasLongPress ? "HOLD" : "TAP"}`);
  }, []);

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
