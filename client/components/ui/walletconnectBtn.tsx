import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";


export const CustomConnectButton = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // Ensure the component is mounted and authentication status is not loading
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div className="w-full max-w-xs">
            {(() => {
              // Disconnected state: Show the "Connect Wallet" button
              if (!connected) {
                return (
                  <Button
                    onClick={openConnectModal}
                    className="w-full max-w-xs bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/70 px-4 py-2 rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <Wallet size={18} />
                    Connect Wallet
                  </Button>
                );
              }

              // Connected state: Show chain and account info
              return (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between gap-3 p-3 bg-muted rounded-md">
                    {/* Chain selector */}
                    <button
                      onClick={openChainModal}
                      className="flex items-center gap-1 text-sm font-medium hover:opacity-80"
                      type="button"
                      aria-label={`Switch network (Current: ${chain.name})`}
                    >
                      {chain.hasIcon && (
                        <div
                          className="w-4 h-4 rounded-full overflow-hidden mr-1"
                          style={{
                            background: chain.iconBackground,
                          }}
                        >
                          {chain.iconUrl && (
                            <img
                              alt={chain.name ?? "Chain icon"}
                              src={chain.iconUrl}
                              className="w-4 h-4"
                            />
                          )}
                        </div>
                      )}
                      {chain.name}
                    </button>

                    {/* Account info */}
                    <button
                      onClick={openAccountModal}
                      type="button"
                      className="text-sm font-medium hover:opacity-80"
                      aria-label={`Account: ${account.displayName}`}
                    >
                      {account.displayName}
                      {account.displayBalance ? ` (${account.displayBalance})` : ""}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};