"use client";

import { useWallet } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, LogOut, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConnectWalletProps {
  variant?: "default" | "outline" | "ghost" | "sidebar";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  fullWidth?: boolean;
}

export function ConnectWallet({
  variant = "default",
  size = "default",
  className = "",
  fullWidth = false,
}: ConnectWalletProps) {
  const { address, shortAddress, isConnecting, isConnected, error, connect, disconnect } = useWallet();
  const { toast } = useToast();

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast({ title: "Copied", description: "Wallet address copied to clipboard." });
    }
  };

  if (error) {
    return (
      <Button
        variant="outline"
        size={size}
        className={`${fullWidth ? "w-full" : ""} ${className}`}
        onClick={connect}
        data-testid="button-connect-wallet-retry"
      >
        <Wallet className="mr-2 h-4 w-4" />
        Retry Connection
      </Button>
    );
  }

  if (isConnected && shortAddress) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant === "sidebar" ? "ghost" : "outline"}
            size={size}
            className={`font-mono text-xs ${fullWidth ? "w-full justify-start" : ""} ${className}`}
            data-testid="button-wallet-connected"
          >
            <div className="h-2 w-2 rounded-full bg-green-500 mr-2 shrink-0" />
            {shortAddress}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground mb-1">Connected Wallet</p>
            <p className="text-xs font-mono truncate">{address}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyAddress} data-testid="button-copy-address">
            <Copy className="mr-2 h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={disconnect}
            className="text-destructive focus:text-destructive"
            data-testid="button-disconnect-wallet"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant={variant === "sidebar" ? "default" : variant}
      size={size}
      className={`${fullWidth ? "w-full" : ""} ${className}`}
      onClick={connect}
      disabled={isConnecting}
      data-testid="button-connect-wallet"
    >
      {isConnecting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Wallet className="mr-2 h-4 w-4" />
      )}
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
}
