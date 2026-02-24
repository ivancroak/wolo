"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useReputation } from "@/hooks/use-reputation";
import { useServices } from "@/hooks/use-services";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceCard } from "@/components/ServiceCard";
import { Loader2, Star, Twitter, Shield, Award } from "lucide-react";

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile", id],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: reputation } = useReputation(id);
  const { data: services } = useServices({ creatorId: id });

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const displayName = profile.firstName
    ? `${profile.firstName} ${profile.lastName || ""}`.trim()
    : `${id.slice(0, 4)}...${id.slice(-4)}`;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {profile.profileImageUrl && (
              <img src={profile.profileImageUrl} alt="" className="w-16 h-16 rounded-full" />
            )}
            <div>
              <CardTitle className="text-2xl">{displayName}</CardTitle>
              <p className="text-sm text-muted-foreground font-mono">{id}</p>
              {profile.profile?.twitterHandle && (
                <a
                  href={`https://twitter.com/${profile.profile.twitterHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline flex items-center gap-1 mt-1"
                >
                  <Twitter className="h-3 w-3" />@{profile.profile.twitterHandle}
                </a>
              )}
            </div>
          </div>
        </CardHeader>
        {profile.profile?.bio && (
          <CardContent>
            <p className="text-muted-foreground">{profile.profile.bio}</p>
          </CardContent>
        )}
      </Card>

      {reputation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" /> Reputation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{reputation.ordersCompleted}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold flex items-center justify-center gap-1">
                  {reputation.avgRating ? reputation.avgRating.toFixed(1) : "N/A"}
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                </p>
                <p className="text-xs text-muted-foreground">Rating</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{reputation.ordersDisputed}</p>
                <p className="text-xs text-muted-foreground">Disputed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{reputation.totalEarned}</p>
                <p className="text-xs text-muted-foreground">Earned</p>
              </div>
            </div>
            {reputation.badges && reputation.badges.length > 0 && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {reputation.badges.map((badge: string) => (
                  <Badge key={badge} variant="secondary" className="flex items-center gap-1">
                    <Award className="h-3 w-3" /> {badge.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {services && services.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Services ({services.length})</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {services.map((service: any) => (
              <ServiceCard key={service.id} service={service} onPurchase={() => {}} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
