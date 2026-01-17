import { useCallback, useRef, useState } from "react";

interface LaneTileProps {
  laneIndex: number;
  onPress: (laneIndex: number) => void;
  onRelease: (laneIndex: number, wasLongPress: boolean) => void;
}

const LONG_PRESS_THRESHOLD = 200; // ms

export const LaneTile = ({ laneIndex, onPress, onRelease }: LaneTileProps) => {
  const [isPressed, setIsPressed] = useState(false);
  const pressStartTime = useRef<number>(0);
  const isLongPress = useRef(false);

  const handlePressStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      setIsPressed(true);
      pressStartTime.current = Date.now();
      isLongPress.current = false;
      onPress(laneIndex);
      console.log(`Lane ${laneIndex + 1}: PRESS START`);
    },
    [laneIndex, onPress]
  );

  const handlePressEnd = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      if (!isPressed) return;
      
      setIsPressed(false);
      const pressDuration = Date.now() - pressStartTime.current;
      const wasLongPress = pressDuration >= LONG_PRESS_THRESHOLD;
      
      console.log(
        `Lane ${laneIndex + 1}: RELEASE (${wasLongPress ? "LONG PRESS" : "TAP"} - ${pressDuration}ms)`
      );
      onRelease(laneIndex, wasLongPress);
    },
    [isPressed, laneIndex, onRelease]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <button
      className={`lane-tile lane-tile-${laneIndex + 1} ${isPressed ? "pressed" : ""} flex-1 h-full cursor-pointer`}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onContextMenu={handleContextMenu}
      aria-label={`Lane ${laneIndex + 1}`}
    >
      <span className="text-4xl md:text-6xl font-bold text-white/80 drop-shadow-lg select-none pointer-events-none">
        {laneIndex + 1}
      </span>
    </button>
  );
};
