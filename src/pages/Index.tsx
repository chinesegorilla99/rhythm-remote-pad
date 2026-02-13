import { useCallback, useState } from "react";
import { SetupPage } from "@/components/SetupPage";
import { GameController } from "@/components/GameController";

type Screen = "setup" | "controller";

const Index = () => {
  // Restore saved values (if any) from localStorage
  const [rokuIp, setRokuIp] = useState<string>(
    () => localStorage.getItem("rokuIp") || ""
  );
  const [relayUrl, setRelayUrl] = useState<string>(
    () => localStorage.getItem("relayUrl") || ""
  );

  // Start on setup page if we don't have saved config, otherwise go straight to controller
  const [screen, setScreen] = useState<Screen>(
    rokuIp && relayUrl ? "controller" : "setup"
  );

  /** Called by SetupPage after successful relay discovery */
  const handleConnected = useCallback((ip: string, relay: string) => {
    setRokuIp(ip);
    setRelayUrl(relay);
    localStorage.setItem("rokuIp", ip);
    localStorage.setItem("relayUrl", relay);
    setScreen("controller");
  }, []);

  /** Called by the ⚙️ button on the controller to go back to setup */
  const handleOpenSetup = useCallback(() => {
    setScreen("setup");
  }, []);

  if (screen === "setup") {
    return <SetupPage initialIp={rokuIp} onConnected={handleConnected} />;
  }

  return (
    <GameController
      rokuIp={rokuIp}
      relayUrl={relayUrl}
      onOpenSetup={handleOpenSetup}
    />
  );
};

export default Index;
