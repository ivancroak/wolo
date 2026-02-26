"use client";

import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProfileSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Wallet, ExternalLink, CheckCircle2, Copy, Twitter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/use-wallet";

const twitterHandleRegex = /^[A-Za-z0-9_]{1,15}$/;

const formSchema = insertProfileSchema.omit({ userId: true }).extend({
  twitterHandle: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => !val || twitterHandleRegex.test(val.replace(/^@/, "")),
      { message: "Handle must be 1-15 characters: letters, numbers, or underscores only" }
    )
    .transform((val) => (val ? val.replace(/^@/, "") : val)),
});

export default function ProfilePage() {
  const { user, isLoading: authLoading, isLoggingIn } = useAuth();
  const { address: walletAddress, isConnected: walletConnected } = useWallet();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { mutate: updateProfile, isPending: updatePending } = useUpdateProfile();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      walletAddress: "",
      bio: "",
      twitterHandle: "",
      isInfluencer: false,
    },
  });

  // removed redirect — show fallback UI instead to avoid race with wallet auto-login

  useEffect(() => {
    if (profile) {
      form.reset({
        walletAddress: profile.walletAddress || "",
        bio: profile.bio || "",
        twitterHandle: profile.twitterHandle || "",
        isInfluencer: profile.isInfluencer || false,
      });
    }
  }, [profile, form]);

  useEffect(() => {
    if (walletConnected && walletAddress) {
      const currentVal = form.getValues("walletAddress");
      if (!currentVal || currentVal === "") {
        form.setValue("walletAddress", walletAddress);
      }
    }
  }, [walletConnected, walletAddress, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateProfile(values, {
      onSuccess: () => {
        toast({ title: "Profile Updated", description: "Your settings have been saved." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
      },
    });
  };

  const [verifyCode, setVerifyCode] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyCopied, setVerifyCopied] = useState(false);

  const getVerifyCode = async () => {
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/profiles/verify-twitter", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message, variant: "destructive" });
        return;
      }
      if (data.verified) {
        toast({ title: "Already Verified", description: "Your X account is already verified." });
        return;
      }
      setVerifyCode(data.tweetText);
    } catch {
      toast({ title: "Error", description: "Failed to get verification code", variant: "destructive" });
    } finally {
      setVerifyLoading(false);
    }
  };

  const checkVerification = async () => {
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/profiles/verify-twitter", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.verified) {
        toast({ title: "Verified!", description: "Your X account has been verified." });
        setVerifyCode(null);
        // Refetch profile to update UI
        window.location.reload();
      } else {
        toast({ title: "Not Found", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Verification check failed", variant: "destructive" });
    } finally {
      setVerifyLoading(false);
    }
  };

  const copyVerifyText = () => {
    if (verifyCode) {
      navigator.clipboard.writeText(verifyCode);
      setVerifyCopied(true);
      toast({ title: "Copied", description: "Tweet text copied to clipboard." });
      setTimeout(() => setVerifyCopied(false), 2000);
    }
  };

  if (authLoading || isLoggingIn) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2">Connect wallet to view Profile</h2>
          <p className="text-muted-foreground text-sm mb-6">Manage your profile, bio, and verification.</p>
          <ConnectWallet />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-2xl">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-black tracking-tighter mb-8"
        data-testid="text-profile-title"
      >
        Profile Settings
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Public Profile</CardTitle>
            <CardDescription>
              Manage how you appear to others on the marketplace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="walletAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wallet Address</FormLabel>
                        <FormControl>
                          <div className="flex gap-2 flex-wrap">
                            <Input placeholder="Solana address..." className="font-mono text-sm flex-1 min-w-0" {...field} value={field.value || ""} data-testid="input-wallet" />
                            {walletConnected && walletAddress && field.value !== walletAddress && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => form.setValue("walletAddress", walletAddress)}
                                data-testid="button-use-connected-wallet"
                              >
                                <Wallet className="mr-1.5 h-3.5 w-3.5" />
                                Use Connected
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          {walletConnected ? (
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                              Wallet connected
                            </span>
                          ) : (
                            "Connect your wallet to auto-fill this field."
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="twitterHandle"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel>X Handle</FormLabel>
                          {profile?.twitterVerified && (
                            <Badge variant="outline" className="gap-1 text-green-600 border-green-500/50">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </Badge>
                          )}
                          {profile?.twitterHandle && twitterHandleRegex.test(profile.twitterHandle) && (
                            <a
                              href={`https://x.com/${profile.twitterHandle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              data-testid="link-view-on-x"
                            >
                              View on X
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <FormControl>
                          <div className="flex flex-wrap">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 text-muted-foreground text-sm">@</span>
                            <Input placeholder="username" className="rounded-l-none flex-1 min-w-0" {...field} value={field.value || ""} data-testid="input-twitter" />
                          </div>
                        </FormControl>
                        <FormDescription>
                          1-15 characters: letters, numbers, or underscores only.
                        </FormDescription>
                        <FormMessage />

                        {profile?.twitterHandle && !profile.twitterVerified && !verifyCode && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={getVerifyCode}
                            disabled={verifyLoading}
                            className="mt-2 gap-1.5"
                            data-testid="button-verify-x"
                          >
                            {verifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Twitter className="h-3.5 w-3.5" />}
                            Verify X Account
                          </Button>
                        )}

                        {verifyCode && (
                          <div className="mt-3 space-y-3 rounded-md border p-3 bg-muted/50">
                            <p className="text-xs text-muted-foreground">
                              Post this exact text as a tweet, then click "Check Verification":
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-background rounded px-2 py-1.5 border font-mono break-all">
                                {verifyCode}
                              </code>
                              <Button type="button" variant="ghost" size="icon" onClick={copyVerifyText} className="shrink-0 h-8 w-8">
                                {verifyCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={`https://x.com/intent/tweet?text=${encodeURIComponent(verifyCode)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Post on X
                                </Button>
                              </a>
                              <Button
                                type="button"
                                size="sm"
                                onClick={checkVerification}
                                disabled={verifyLoading}
                                className="gap-1.5"
                                data-testid="button-check-verification"
                              >
                                {verifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Check Verification
                              </Button>
                            </div>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us about your audience and influence..."
                            className="min-h-[100px]"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-bio"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isInfluencer"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-4 rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Influencer Mode</FormLabel>
                          <FormDescription>
                            Show a verified badge on your services.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="switch-influencer"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={updatePending} className="w-full" data-testid="button-save-profile">
                    {updatePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
