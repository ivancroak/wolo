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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Wallet, ExternalLink, CheckCircle2, Copy, Mail, Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

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
  email: z.string().email("Invalid email address").nullable().optional().or(z.literal("")),
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
      email: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        walletAddress: profile.walletAddress || "",
        bio: profile.bio || "",
        twitterHandle: profile.twitterHandle || "",
        email: profile.email || "",
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
    const payload = {
      ...values,
      email: values.email?.trim() || null,
      twitterHandle: values.twitterHandle?.trim() || null,
      bio: values.bio?.trim() || null,
    };
    updateProfile(payload, {
      onSuccess: () => {
        toast({ title: "Profile Updated", description: "Your settings have been saved." });
        if (payload.email && !profile?.emailVerified) {
          setEmailCodeSent(false);
          setEmailCode("");
        }
      },
      onError: (err) => {
        toast({ title: "Error", description: err?.message || "Failed to update profile.", variant: "destructive" });
      },
    });
  };

  const [verifyCode, setVerifyCode] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyCopied, setVerifyCopied] = useState(false);
  const [blueLoading, setBlueLoading] = useState(false);
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCode, setEmailCode] = useState("");

  const checkBlueCheckmark = async () => {
    setBlueLoading(true);
    try {
      const res = await fetch("/api/profiles/check-blue", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message, variant: "destructive" });
        return;
      }
      if (data.isBlueVerified) {
        toast({ title: "Blue Checkmark Confirmed", description: "Your X account has a verified blue checkmark." });
      } else {
        toast({ title: "No Blue Checkmark", description: "This X account does not have a blue checkmark." });
      }
      window.location.reload();
    } catch {
      toast({ title: "Error", description: "Failed to check blue checkmark status", variant: "destructive" });
    } finally {
      setBlueLoading(false);
    }
  };

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

  const sendEmailVerification = async () => {
    setEmailVerifyLoading(true);
    try {
      const res = await fetch("/api/profiles/verify-email", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message, variant: "destructive" });
        return;
      }
      if (data.verified) {
        toast({ title: "Already Verified", description: "Your email is already verified." });
        return;
      }
      setEmailCodeSent(true);
      toast({ title: "Code Sent", description: "Check your inbox for the verification code." });
    } catch {
      toast({ title: "Error", description: "Failed to send verification email", variant: "destructive" });
    } finally {
      setEmailVerifyLoading(false);
    }
  };

  const checkEmailVerification = async () => {
    setEmailVerifyLoading(true);
    try {
      const res = await fetch("/api/profiles/verify-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: emailCode }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.verified) {
        toast({ title: "Verified!", description: "Your email has been verified." });
        setEmailCodeSent(false);
        setEmailCode("");
        window.location.reload();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Verification check failed", variant: "destructive" });
    } finally {
      setEmailVerifyLoading(false);
    }
  };

  const toggleEmailNotifications = (enabled: boolean) => {
    updateProfile({ emailNotifications: enabled } as any, {
      onSuccess: () => {
        toast({
          title: enabled ? "Notifications Enabled" : "Notifications Disabled",
          description: enabled ? "You will receive email notifications." : "Email notifications turned off.",
        });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update preference.", variant: "destructive" });
      },
    });
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

      {profile && (!profile.email || !profile.emailVerified) && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0" />
          {!profile.email
            ? "Add your email to receive notifications when you get messages."
            : "Verify your email to start receiving notifications."}
        </div>
      )}

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
                          {profile?.twitterVerified
                            ? "Your X account is verified. Save to update handle (re-verification required)."
                            : "Enter your handle, save, then verify to complete actions on the marketplace."}
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
                            {verifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XIcon className="h-3.5 w-3.5" />}
                            Verify X Account
                          </Button>
                        )}

                        {verifyCode && (
                          <div className="mt-3 space-y-3 rounded-md border p-3 bg-muted/50">
                            <p className="text-xs text-muted-foreground">
                              Post this exact text as a tweet, then click &ldquo;Check Verification&rdquo;:
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
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" /> Email
                          </FormLabel>
                          {profile?.emailVerified && (
                            <Badge variant="outline" className="gap-1 text-green-600 border-green-500/50">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormDescription>
                          {profile?.emailVerified
                            ? "Your email is verified. Save to update email (re-verification required)."
                            : "Enter your email, save, then verify to receive notifications."}
                        </FormDescription>
                        <FormMessage />

                        {profile?.email && !profile.emailVerified && !emailCodeSent && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={sendEmailVerification}
                            disabled={emailVerifyLoading}
                            className="mt-2 gap-1.5"
                          >
                            {emailVerifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                            Verify Email
                          </Button>
                        )}

                        {emailCodeSent && (
                          <div className="mt-3 space-y-3 rounded-md border p-3 bg-muted/50">
                            <p className="text-xs text-muted-foreground">
                              Enter the 6-digit code sent to your email:
                            </p>
                            <div className="flex items-center gap-2">
                              <Input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="000000"
                                value={emailCode}
                                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                className="font-mono text-center text-lg tracking-widest w-36"
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={checkEmailVerification}
                                disabled={emailVerifyLoading || emailCode.length !== 6}
                                className="gap-1.5"
                              >
                                {emailVerifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Verify
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={sendEmailVerification}
                              disabled={emailVerifyLoading}
                              className="text-xs text-muted-foreground"
                            >
                              Resend code
                            </Button>
                          </div>
                        )}

                        {profile?.emailVerified && (
                          <div className="mt-3 flex items-center justify-between rounded-md border p-3">
                            <div className="flex items-center gap-2">
                              {profile.emailNotifications ? (
                                <Bell className="h-4 w-4 text-foreground" />
                              ) : (
                                <BellOff className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div>
                                <p className="text-sm font-medium">Email Notifications</p>
                                <p className="text-xs text-muted-foreground">
                                  {profile.emailNotifications ? "You will receive emails for new messages" : "Email notifications are off"}
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={profile.emailNotifications}
                              onCheckedChange={toggleEmailNotifications}
                            />
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

                  <div className="rounded-md border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-base font-medium">Blue Checkmark</p>
                        <p className="text-sm text-muted-foreground">
                          {profile?.isInfluencer
                            ? "Your X account has a verified blue checkmark."
                            : "Check if this X account has a blue checkmark."}
                        </p>
                      </div>
                      {profile?.isInfluencer ? (
                        <Badge className="gap-1 bg-blue-500 hover:bg-blue-600 text-white shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground shrink-0">
                          Not verified
                        </Badge>
                      )}
                    </div>
                    {profile?.twitterHandle && (
                      <Button
                        type="button"
                        variant={profile?.isInfluencer ? "outline" : "default"}
                        size="sm"
                        onClick={checkBlueCheckmark}
                        disabled={blueLoading}
                        className="gap-1.5"
                      >
                        {blueLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XIcon className="h-3.5 w-3.5" />}
                        {profile?.isInfluencer ? "Re-check" : "Check Blue Checkmark"}
                      </Button>
                    )}
                  </div>

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
